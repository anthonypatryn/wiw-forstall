import { $, esc, api, startPolling, toast, mountNav, tryWarden, forgetWarden, savedPin, wardenModal, rollPopup, abilityOptions, abilityTargetsHTML, abilityBody } from './common.js';
let meta = null;
api('GET', null, '?view=meta', '/api/combat').then((m) => { meta = m; }).catch(() => {});
import { mountTableLog } from './tablelog.js';
import { panZoom } from './panzoom.js';

const EP = '/api/battle';
mountTableLog();
mountNav('/battle');

const TRADE_COLOR = {
  Doctor: '#2f6d73', Gunslinger: '#a4401f', Hunter: '#4d6b2f', Marshal: '#8a6a2a',
  Mechanic: '#3d5a7a', Prospector: '#b3702a', Trapper: '#6b3f5e',
};
const color = (t) => (t.kind === 'enemy' ? '#5a1a12' : t.kind === 'npc' ? '#5e5750' : TRADE_COLOR[t.trade] || '#555');
const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// Guidebook ranges in inches (1 hex = 1").
const band = (d) => (d <= 1 ? 'arm' : d <= 6 ? 'short' : d <= 18 ? 'long' : 'distant');
const BAND_LABEL = { arm: 'Arm’s Reach', short: 'Short', long: 'Long', distant: 'Distant' };

let data = null, warden = false, poller = null, selected = null, dragging = null;
// Combat data (sheets, enemies, attacks) so tokens can attack from the map
let combat = null, combatPoller = null;
const atkSel = {}; // per selected token: remembered picks
const WEAPON_KEY = { arm: 'arms', short: 'short', long: 'long', distant: 'distant' };
const ATK_BAND = { Melee: 'arm', Short: 'short', Long: 'long', Distant: 'distant' };
const isPool = (s) => /^(\d+[BG])+$/.test(String(s || '').toUpperCase());
async function combatAct(body) {
  try { const res = await api('POST', body, '', '/api/combat'); combat = res.state || combat; return res.result ?? true; }
  catch (e) { toast(e.message, true); return null; }
}
function attackHTML(sel) {
  if (!combat?.combat?.active) return '';
  const s = atkSel[sel.id] ||= {};
  if (sel.kind === 'pc') {
    const pc = combat.posse.find((p) => p.id === sel.ref);
    if (!pc || pc.dead) return '';
    const foes = data.tokens.filter((t) => t.kind === 'enemy' && !t.down && combat.enemies.some((e) => e.id === t.ref && !e.defeated))
      .map((t) => ({ t, d: dist(sel, t) })).sort((a, b) => a.d - b.d);
    if (!foes.length) return '<h3 class="d-h">⚔ ATTACK</h3><p class="muted">No enemies standing on the board.</p>';
    if (!foes.some((f) => f.t.id === s.t)) s.t = foes[0].t.id;
    const tgt = foes.find((f) => f.t.id === s.t), bandKey = WEAPON_KEY[band(tgt.d)];
    const weapons = pc.weapons.map((w, i) => [w, i]).filter(([w]) => (w.model || w.manufacturer) && isPool(w[bandKey]));
    if (!weapons.some(([, i]) => i === s.w)) s.w = weapons[0]?.[1];
    const w = pc.weapons[s.w] || {};
    const loaded = (w.ammo || []).map((a, k) => [a, k]).filter(([a]) => a.name && Number(a.rds) > 0);
    if (!loaded.some(([, k]) => String(k) === String(s.ammo))) s.ammo = '';
    const cost = (parseInt(String(w.grit || '').split('|')[0], 10) || 0) + (s.aim ? 1 : 0);
    const mine = combat.combat.current === pc.id;
    return `<h3 class="d-h">⚔ ATTACK FROM HERE ${mine ? '<span class="tag turn">THEIR TURN</span>' : ''} <small>${pc.grit} Grit</small></h3>
      <div class="atk-form">
        <select data-as="t" aria-label="Target">${foes.map(({ t, d }) => `<option value="${t.id}"${t.id === s.t ? ' selected' : ''}>→ ${esc(t.name)} · ${d}″ ${BAND_LABEL[band(d)]}</option>`).join('')}</select>
        ${weapons.length ? `<select data-as="w" aria-label="Weapon">${weapons.map(([x, i]) => `<option value="${i}"${i === s.w ? ' selected' : ''}>${esc(x.model || x.manufacturer)} · ${esc(String(x[bandKey]).toUpperCase())}</option>`).join('')}</select>
        <select data-as="ammo" aria-label="Ammo"><option value="">regular ammo</option>${loaded.map(([a, k]) => `<option value="${k}"${String(k) === String(s.ammo) ? ' selected' : ''}>${esc(a.name)} (${a.rds})</option>`).join('')}</select>
        <label class="check"><input type="checkbox" data-as="aim"${s.aim ? ' checked' : ''}${pc.aimed ? ' disabled' : ''}> Aim +1</label>
        <button type="button" class="btn small" data-map-attack>⚔ Attack · ${cost} Grit</button>`
        : `<p class="muted">No weapon reaches ${BAND_LABEL[band(tgt.d)]} (${tgt.d}″). Move closer.</p>`}
      </div>`;
  }
  if (sel.kind === 'enemy' && warden) {
    const e = combat.enemies.find((x) => x.id === sel.ref);
    const prof = e?.profile ? combat.profiles?.[e.profile] : null;
    if (!e || e.defeated || !prof?.attacks?.length) return '';
    const posse = data.tokens.filter((t) => t.kind === 'pc' && combat.posse.some((p) => p.id === t.ref && !p.dead))
      .map((t) => ({ t, d: dist(sel, t) })).sort((a, b) => a.d - b.d);
    if (!posse.length) return '';
    if (!posse.some((f) => f.t.id === s.t)) s.t = posse[0].t.id;
    const tgt = posse.find((f) => f.t.id === s.t), b = band(tgt.d);
    const fits = prof.attacks.map((a, i) => [a, i]).filter(([a]) => (ATK_BAND[a.range] || 'arm') === b || (b === 'arm' && a.range === 'Short'));
    if (!prof.attacks.some((_, i) => i === s.a)) s.a = (fits[0] || [null, 0])[1];
    return `<h3 class="d-h">💥 ATTACK THE POSSE <small>${e.grit ?? '?'} Grit</small></h3>
      <div class="atk-form">
        <select data-as="t" aria-label="Target">${posse.map(({ t, d }) => `<option value="${t.id}"${t.id === s.t ? ' selected' : ''}>→ ${esc(t.name)} · ${d}″ ${BAND_LABEL[band(d)]}</option>`).join('')}</select>
        <select data-as="a" aria-label="Attack">${prof.attacks.map((a, i) => { const ok = fits.some(([, k]) => k === i);
          return `<option value="${i}"${i === s.a ? ' selected' : ''}>${ok ? '' : '(out of range) '}${esc(a.name)} · ${a.range}${a.grit ? ` · ${a.grit} Grit` : ''}</option>`; }).join('')}</select>
        <select data-as="cover" aria-label="Cover"><option value="0">no cover</option><option value="1"${s.cover == 1 ? ' selected' : ''}>light cover</option><option value="2"${s.cover == 2 ? ' selected' : ''}>heavy cover</option></select>
        <button type="button" class="btn small" data-map-eattack>💥 Roll it</button>
      </div>`;
  }
  return '';
}
const vp = $('#viewport'), stage = $('#stage');
const pz = panZoom(vp, stage, {
  maxScale: 2.5, ignore: '.btoken, .map-ctrls',
  onTap: (target) => { if (!target.closest('.btoken')) select(null); },
});
$('#zoom-in').addEventListener('click', () => pz.zoom(1.35));
$('#zoom-out').addEventListener('click', () => pz.zoom(1 / 1.35));
$('#zoom-fit').addEventListener('click', () => pz.fit());

// ---------- hex math: pointy-top, odd rows shifted right ----------
const R = () => data.grid.ppi / Math.sqrt(3);
function center(col, row) {
  const r = R(), w = data.grid.ppi;
  return { x: data.grid.dx + w * (col + 0.5 * (row & 1)) + w / 2, y: data.grid.dy + 1.5 * r * row + r };
}
function toHex(x, y) {
  const r = R(), w = data.grid.ppi;
  const px = x - data.grid.dx - w / 2, py = y - data.grid.dy - r;
  let q = ((Math.sqrt(3) / 3) * px - py / 3) / r, rr = ((2 / 3) * py) / r, s = -q - rr;
  let [rq, rr2, rs] = [Math.round(q), Math.round(rr), Math.round(s)];
  const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr2 - rr), Math.abs(rs - s)];
  if (dq > dr && dq > ds) rq = -rr2 - rs; else if (dr > ds) rr2 = -rq - rs;
  const row = Math.max(0, Math.min(data.size.rows - 1, rr2));
  const col = Math.max(0, Math.min(data.size.cols - 1, rq + (rr2 - (rr2 & 1)) / 2));
  return { col, row };
}
const cube = (col, row) => { const q = col - (row - (row & 1)) / 2; return { q, r: row, s: -q - row }; };
function dist(a, b) {
  const A = cube(a.col, a.row), B = cube(b.col, b.row);
  return (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.s - B.s)) / 2;
}
function hexPath(col, row) {
  const c = center(col, row), r = R();
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    d += `${i ? 'L' : 'M'}${(c.x + r * Math.cos(a)).toFixed(1)} ${(c.y + r * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
}

// ---------- rendering ----------
let gridKey = '';
function renderStage() {
  const { map, grid } = data;
  stage.style.width = `${map.w}px`; stage.style.height = `${map.h}px`;
  const src = map.kind === 'upload' ? `/api/battle?view=img&v=${map.imgV}` : `/img/battle/${map.id}.jpg`;
  const bg = $('#bg');
  if (bg.getAttribute('src') !== src) { bg.src = src; bg.width = map.w; bg.height = map.h; pz.setSize(map.w, map.h); pz.fit(); }
  const key = `${map.w}x${map.h}|${grid.ppi}|${grid.dx}|${grid.dy}|${grid.show}|${grid.opacity}`;
  if (key !== gridKey) {
    gridKey = key;
    const svg = $('#grid');
    svg.setAttribute('width', map.w); svg.setAttribute('height', map.h);
    let d = '';
    if (grid.show) for (let row = 0; row < data.size.rows; row++) for (let col = 0; col < data.size.cols; col++) d += hexPath(col, row);
    svg.innerHTML = `<path d="${d}" style="stroke-opacity:${grid.opacity}"/>`;
    $('#ranges').setAttribute('width', map.w); $('#ranges').setAttribute('height', map.h);
  }
}

function renderRanges() {
  const svg = $('#ranges');
  const t = selected && data.tokens.find((x) => x.id === selected);
  if (!t) { svg.innerHTML = ''; return; }
  const paths = { arm: '', short: '', long: '' };
  for (let row = Math.max(0, t.row - 19); row <= Math.min(data.size.rows - 1, t.row + 19); row++) {
    for (let col = Math.max(0, t.col - 20); col <= Math.min(data.size.cols - 1, t.col + 20); col++) {
      const d = dist(t, { col, row });
      if (d === 0 || d > 18) continue;
      paths[band(d)] += hexPath(col, row);
    }
  }
  svg.innerHTML = Object.entries(paths).map(([k, d]) => `<path class="${k}" d="${d}"/>`).join('');
}

const canMove = (t) => warden || t.kind === 'pc';
function renderTokens() {
  const layer = $('#tokens');
  const size = data.grid.ppi * 0.84, font = data.grid.ppi * 0.3, labFont = data.grid.ppi * 0.2;
  const sel = selected && data.tokens.find((x) => x.id === selected);
  layer.innerHTML = data.tokens.map((t) => {
    const c = center(t.col, t.row);
    const d = sel && sel.id !== t.id ? dist(sel, t) : null;
    const hasHp = t.maxHealth != null;
    const pct = hasHp ? Math.max(0, Math.min(100, (t.health / Math.max(1, t.maxHealth)) * 100)) : 0;
    const bg = t.img ? `background:${color(t)} url('/img/tokens/${esc(t.img)}.webp') center / cover` : `background:${color(t)}`;
    const nStatus = Object.keys(t.statuses || {}).length;
    return `<div class="btoken ${t.kind}${t.img ? ' art' : ' stand-in'}${canMove(t) ? ' movable' : ''}${t.id === selected ? ' sel' : ''}${t.ref && t.ref === data.current ? ' turn' : ''}${t.hidden ? ' hidden-tok' : ''}${t.down ? ' down' : ''}${t.frenzied ? ' frenzied' : ''}"
      data-id="${t.id}" data-size="${esc(t.size || '')}" style="left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;${bg};font-size:${font}px;border-width:${data.grid.ppi * 0.05}px"
      title="${esc(t.name)}">${t.img ? '' : esc(initials(t.name))}
      ${t.dead ? `<span class="skull" style="font-size:${size * 0.62}px" aria-label="Down">💀</span>` : t.bleeding ? `<span class="skull bleed" style="font-size:${size * 0.5}px" aria-label="Bleeding Out">🩸</span>` : ''}
      ${nStatus ? `<span class="st-dot" style="font-size:${labFont}px" title="${esc(Object.entries(t.statuses).map(([k, v]) => `${k} ${v}`).join(', '))}">${nStatus}</span>` : ''}
      <span class="lab" style="font-size:${labFont}px">${esc(t.name)}${hasHp ? `<i class="hpbar"><i style="width:${pct}%"></i></i><em>${t.health}/${t.maxHealth}</em>` : ''}</span>
      ${d !== null ? `<span class="dist ${band(d)}" style="font-size:${labFont}px">${d}″ · ${BAND_LABEL[band(d)]}</span>` : ''}</div>`;
  }).join('');
  layer.querySelectorAll('.btoken').forEach(wireToken);
}

function renderPanel() {
  const sel = selected && data.tokens.find((x) => x.id === selected);
  const box = $('#sel-box');
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  if (!sel) {
    box.innerHTML = `<div class="sel-card"><div class="kind">RANGE METER</div><h2>Tap a token</h2>
      <p>You’ll see its Arm’s Reach, Short and Long Range, and how far away everyone else is.</p></div>`;
  } else {
    const others = data.tokens.filter((t) => t.id !== sel.id).map((t) => ({ t, d: dist(sel, t) })).sort((a, b) => a.d - b.d);
    const st = Object.entries(sel.statuses || {});
    const hpPct = sel.maxHealth != null ? Math.max(0, Math.min(100, (sel.health / Math.max(1, sel.maxHealth)) * 100)) : 0;
    const detail = `
      ${sel.maxHealth != null ? `<div class="d-hp"><span class="bar"><i style="width:${hpPct}%"></i></span><b>${sel.health}/${sel.maxHealth}</b></div>` : ''}
      <div class="d-tags">${sel.ref && sel.ref === data.current ? '<span class="tag turn">THEIR TURN</span>' : ''}${sel.frenzied ? '<span class="tag red">FRENZIED</span>' : ''}${sel.bleeding ? '<span class="tag red">BLEEDING OUT</span>' : ''}${sel.down ? '<span class="tag">DOWN</span>' : ''}</div>
      ${st.length ? `<div class="d-st">${st.map(([k, v]) => `<span class="st">${esc(k)} <b>${v}</b></span>`).join('')}</div>` : ''}
      <div class="d-row">${sel.grit != null ? `<span><b>GRIT</b> ${sel.grit}</span>` : ''}${sel.defense ? `<span><b>DEFENSE</b> ${esc(sel.defense)}</span>` : ''}${sel.speed ? `<span><b>SPEED</b> ${esc(sel.speed)}</span>` : ''}${sel.finesse ? `<span><b>FINESSE</b> ${esc(sel.finesse)}</span>` : ''}${sel.aces ? `<span><b>ACES</b> ${sel.aces}/6</span>` : ''}${sel.size ? `<span><b>SIZE</b> ${esc(sel.size)}</span>` : ''}</div>
      ${sel.frenzyText?.length ? `<div class="d-note">${sel.frenzyText.map(esc).join('<br>')}</div>` : ''}
      ${sel.attacks?.length ? `<details class="d-atk"><summary>Attacks</summary>${sel.attacks.map((a) => `<p>${esc(a)}</p>`).join('')}</details>` : ''}
      ${attackHTML(sel)}`;
    const kindLabel = sel.kind === 'pc' ? `POSSE${sel.trade ? ` · THE ${esc(sel.trade.toUpperCase())}` : ''}` : sel.kind === 'enemy' ? 'ENEMY' : 'NPC';
    box.innerHTML = `<div class="sel-card">${sel.img ? `<img class="sel-art" src="/img/tokens/${esc(sel.img)}.webp" alt="">` : ''}<div class="kind">${kindLabel}${sel.hidden ? ' · HIDDEN FROM POSSE' : ''}</div><h2>${esc(sel.name)}</h2>${detail}
      <h3 class="d-h">DISTANCES</h3>
      ${others.length ? others.map(({ t, d }) => `<div class="tok-row" data-pick="${t.id}"><span class="chip" style="background:${color(t)}">${esc(initials(t.name))}</span>
        <span class="n">${esc(t.name)}</span><span class="d ${band(d)}">${d}″ · ${BAND_LABEL[band(d)]}</span></div>`).join('') : '<p class="muted">Nobody else on the board.</p>'}</div>`;
  }
  wireAttack(box, sel);
  const list = $('#token-list');
  list.innerHTML = data.tokens.length ? data.tokens.map((t) => `<div class="tok-row${t.id === selected ? ' sel' : ''}" data-pick="${t.id}">
      <span class="chip" style="background:${color(t)}">${esc(initials(t.name))}</span>
      <span class="n">${esc(t.name)}<small>${t.kind === 'pc' ? `The ${esc(t.trade || '')}` : t.kind === 'enemy' ? 'Enemy' : 'NPC'}${t.down ? ' · down' : ''}${t.gone ? ' · removed from Combat' : ''}</small></span>
      ${warden ? `<button type="button" data-hide="${t.id}">${t.hidden ? 'Reveal' : 'Hide'}</button><button type="button" data-rm="${t.id}">✕</button>` : ''}</div>`).join('')
    : `<p class="muted">${warden ? 'Use “Add posse & enemies from Combat” below.' : 'The Warden hasn’t set the board yet.'}</p>`;
  document.querySelectorAll('#panel [data-pick]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    select(el.dataset.pick);
    const t = data.tokens.find((x) => x.id === el.dataset.pick);
    if (t) { const c = center(t.col, t.row); pz.centerOn(c.x, c.y, Math.max(pz.view.s, 0.45)); }
  }));
  list.querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', () => {
    const t = data.tokens.find((x) => x.id === b.dataset.hide);
    act({ action: 'tokenEdit', id: t.id, hidden: !t.hidden });
  }));
  list.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => act({ action: 'removeToken', id: b.dataset.rm })));
}

function moveReadout(t, d) {
  const c = combat?.combat;
  const actor = t.kind === 'pc' ? combat?.posse.find((p) => p.id === t.ref) : t.kind === 'enemy' ? combat?.enemies.find((e) => e.id === t.ref) : null;
  if (!c?.active || !actor) return `${t.name} moves ${d}″`;
  if (c.current !== t.ref) return warden ? `${t.name} moves ${d}″ · free (Warden, off-turn)` : `Not ${t.name}’s turn`;
  const m = moveCostFor(t.kind, actor, d, tp.rough);
  return `${t.name} moves ${d}″ · ${m.cost} Grit (${m.speed}${tp.rough ? ', rough' : ''})${m.cost > (actor.grit || 0) ? ` · ⚠ only ${actor.grit || 0} left` : ''}`;
}
// ---------- turn panel: whose turn, Grit left, this turn's actions (pp. 40–43) ----------
const tp = { ab: {}, rough: false, dodge: 1, gear: 0, imp: 1, impLabel: '', impSkill: '', prep: 1, prepLabel: '', rl: '', rlDice: 1 };
const myId = () => { try { return JSON.parse(localStorage.getItem('wiw.me') || 'null'); } catch { return null; } };
function currentActor() {
  const c = combat?.combat;
  if (!c?.active || !c.current) return null;
  const pc = combat.posse.find((p) => p.id === c.current);
  if (pc) return { kind: 'pc', a: pc };
  const e = combat.enemies.find((x) => x.id === c.current);
  return e ? { kind: 'enemy', a: e } : null;
}
// same rules as the server (lib/combat.js moveCost)
function moveCostFor(kind, a, inches, rough) {
  if (!inches) return { cost: 0, speed: 'Normal' };
  const w = (t) => ['Very Slow', 'Slow', 'Normal', 'Fast'].find((x) => String(t || '').toLowerCase().startsWith(x.toLowerCase())) || 'Normal';
  const speed = kind === 'enemy' ? w(a.speed) : a.mounted === 'horse' ? 'Fast' : a.mounted === 'mech' ? w(a.mech?.speed) : 'Normal';
  const shorts = Math.ceil(inches / 6);
  let cost = speed === 'Fast' ? Math.ceil(inches / 12) : speed === 'Slow' ? shorts * 2 : speed === 'Very Slow' ? shorts * 3 : shorts;
  if (rough) cost *= 2;
  if (kind === 'pc' && a.mounted === 'mech' && a.mech?.state === 'Compromised') cost = Math.min(6, cost * 2);
  return { cost: Math.max(1, cost), speed };
}
const pips = (n) => `<span class="grit-pips">${Array.from({ length: Math.max(6, n) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

function renderTurnBar() {
  const bar = $('#turn-bar');
  if (bar.contains(document.activeElement) && /^(SELECT|INPUT)$/.test(document.activeElement.tagName)) return;
  const c = combat?.combat;
  if (!c?.active) {
    bar.hidden = !warden;
    const n = (combat?.enemies || []).filter((e) => !e.defeated).length, pcs = (combat?.posse || []).filter((p) => !p.dead).length;
    bar.innerHTML = warden ? `<div class="turn-bar"><div><small>NO COMBAT RUNNING</small><span class="muted">${pcs} in the posse · ${n} enem${n === 1 ? 'y' : 'ies'} ready${n ? '' : ' — add them on the Combat page'}</span></div>
      <button type="button" class="btn" data-startfight${pcs + n ? '' : ' disabled'}>⚔ Start combat</button></div><p class="muted tp-empty">Rolls everyone’s Finesse for turn order (the Warden rolls once for all enemies, p. 40) and puts every fighter on the board.</p>` : '';
    bar.querySelector('[data-startfight]')?.addEventListener('click', async () => { if (await tpAct({ action: 'start' }, 'Combat begins — tokens placed.')) poller?.now?.(); });
    return;
  }
  bar.hidden = false;
  const cur = currentActor();
  const nm = (k) => combat.posse.find((p) => p.id === k)?.name || combat.enemies.find((e) => e.id === k)?.name || '—';
  const order = c.turnList || [], i = order.indexOf(c.current), next = order.length > 1 ? order[(i + 1) % order.length] : null;
  if (!cur) { bar.innerHTML = `<div class="turn-bar"><span>Round ${c.round || 1}</span>${warden ? '<button type="button" class="btn small" data-nextturn>Next turn ⏭</button>' : ''}</div>`; wireTurnBar(bar, null); return; }
  const a = cur.a, isPc = cur.kind === 'pc';
  const mine = isPc && myId() === a.id;
  const can = warden || mine;
  const log = a.turnLog || [];
  const lastIsMove = a.lastMove && log.length && log[log.length - 1].id === a.lastMove.logId;
  const gear = isPc ? a.gear.map((g, k) => [g, k]).filter(([g]) => g.item) : [];
  const sts = isPc ? Object.entries(a.statuses || {}).filter(([, v]) => v) : [];
  if (!sts.some(([s]) => s === tp.rl)) tp.rl = sts[0]?.[0] || '';
  const row = (label, body) => `<div class="tp-row"><b class="tp-h">${label}</b>${body}</div>`;
  bar.innerHTML = `<div class="turn-panel${mine ? ' mine' : ''}">
    <div class="tp-top"><div><small>ROUND ${c.round || 1}${next ? ` · NEXT: ${esc(nm(next))}` : ''}</small><b data-goto="${esc(a.id)}">${esc(a.name)}</b>’s turn</div>
      <div class="tp-grit">${pips(a.grit || 0)}<span><b>${a.grit ?? 0}</b> Grit</span></div></div>
    ${log.length ? `<ol class="tp-log">${log.map((l) => `<li>${esc(l.text)}<span>${l.grit > 0 ? `−${l.grit}` : l.grit < 0 ? `+${-l.grit}` : ''}</span></li>`).join('')}</ol>` : '<p class="muted tp-empty">Nothing done yet this turn.</p>'}
    ${a.dodge ? `<p class="tp-note">🛡 ${a.dodge} Dodge ready for the next hit.</p>` : ''}
    ${can ? `
      ${row('MOVE', `<span class="muted">Drag ${esc(a.name)}’s token — the cost shows as you drag.</span>
        <label class="check"><input type="checkbox" data-tp="rough"${tp.rough ? ' checked' : ''}> Rough terrain (×2)</label>
        ${isPc ? `<select data-tp-mount aria-label="On foot or mounted"><option value="">On foot</option>${a.horse?.breed ? `<option value="horse"${a.mounted === 'horse' ? ' selected' : ''}>Riding ${esc(a.horse.name || a.horse.breed)} (Fast)</option>` : ''}${a.mech?.class ? `<option value="mech"${a.mounted === 'mech' ? ' selected' : ''}>Driving the ${esc(a.mech.class)} mech</option>` : ''}</select>` : ''}
        ${lastIsMove ? '<button type="button" class="btn small secondary" data-undo>↶ Undo last move</button>' : ''}`)}
      ${row('ATTACK', `<button type="button" class="btn small" data-tp-attack>⚔ Attack…</button><span class="muted">pick the target and weapon in the panel below</span>`)}
      ${row('DODGE', `<input type="number" min="1" max="12" data-tp="dodge" value="${tp.dodge}"> Grit → that many B <button type="button" class="btn small secondary" data-tp-dodge>🛡 Dodge</button>`)}
      ${isPc && gear.length ? row('USE ITEM', `<select data-tp="gear">${gear.map(([g, k]) => `<option value="${k}"${k === tp.gear ? ' selected' : ''}>${esc(g.item)} · ${esc(g.grit || 0)} Grit</option>`).join('')}</select><button type="button" class="btn small secondary" data-tp-item>Use</button>`) : ''}
      ${row('IMPROVISE', `<input type="number" min="1" max="12" data-tp="imp" value="${tp.imp}"> Grit <input data-tp="impLabel" maxlength="60" placeholder="what? e.g. climb the wagon" value="${esc(tp.impLabel)}">
        ${isPc ? `<select data-tp="impSkill"><option value="">no roll</option>${['Charm', 'Finesse', 'Intuition', 'Nerve'].map((k) => `<option${k === tp.impSkill ? ' selected' : ''}>${k}</option>`).join('')}</select>` : ''}<button type="button" class="btn small secondary" data-tp-imp>Do it</button>`)}
      ${isPc ? row('PREPARE', `<input type="number" min="0" max="12" data-tp="prep" value="${tp.prep}"> Grit <input data-tp="prepLabel" maxlength="60" placeholder="e.g. shoot whoever comes round the corner" value="${esc(tp.prepLabel)}"><button type="button" class="btn small secondary" data-tp-prep${a.prepared ? ' disabled' : ''}>${a.prepared ? 'Prepared' : 'Prepare'}</button>`) : ''}
      ${isPc && sts.length ? row('RELIEVE', `<select data-tp="rl">${sts.map(([st, v]) => `<option value="${st}"${st === tp.rl ? ' selected' : ''}>${st} [${v}]</option>`).join('')}</select><input type="number" min="1" max="12" data-tp="rlDice" value="${tp.rlDice}"> dice (1 Grit each)<button type="button" class="btn small secondary" data-tp-rl>Roll</button>`) : ''}
      ${isPc && meta ? (() => { const opts = abilityOptions(a, meta); if (!opts.length) return '';
        if (!opts.some((o) => o.name === tp.ab.name)) tp.ab.name = opts.find((o) => !o.out)?.name || opts[0].name;
        return row('ABILITIES', `<select data-abp="name">${opts.map((o) => `<option value="${esc(o.name)}"${o.name === tp.ab.name ? ' selected' : ''}${o.out ? ' disabled' : ''}>${esc(o.label)}</option>`).join('')}</select>
          ${abilityTargetsHTML(tp.ab.name, a, combat.posse, combat.enemies.filter((e) => !e.defeated), tp.ab)}<button type="button" class="btn small" data-tp-ab>✨ Use</button>`); })() : ''}
      ${isPc && /arabian/i.test(a.horse?.breed || '') && a.horse?.bond === 'Revered' && a.mounted === 'horse' ? row('ARABIAN', `<button type="button" class="btn small secondary" data-tp-horse${(a.horseGrit || 0) >= 2 ? ' disabled' : ''}>🐎 +1 Grit</button><span class="muted">${a.horseGrit || 0}/2 today</span>`) : ''}
      ${isPc ? row('FOOL’S GRIT', `<button type="button" class="btn small secondary" data-tp-fool${a.foolUsed ? ' disabled' : ''}>+1 Grit for 1 Health</button><span class="muted">once per turn</span>`) : ''}
      <div class="tp-end">${warden ? '<button type="button" class="btn small secondary" data-endfight>End combat</button><button type="button" class="btn" data-nextturn>Next turn ⏭</button>' : '<button type="button" class="btn" data-endmine>End my turn ⏭</button>'}</div>`
    : `<p class="muted tp-empty">${isPc ? 'Only that player (or the Warden) acts on this turn.' : 'The enemies are acting.'}</p>`}
  </div>`;
  wireTurnBar(bar, cur);
}
async function tpAct(body, msg) {
  const r = await combatAct(body);
  if (r !== null) { if (msg) toast(msg); combatPoller?.now?.(); poller?.now?.(); }
  return r;
}
function wireTurnBar(bar, cur) {
  const c = combat?.combat;
  bar.querySelector('[data-nextturn]')?.addEventListener('click', () => tpAct({ action: 'next' }));
  bar.querySelector('[data-endfight]')?.addEventListener('click', async () => {
    if (!confirm('End combat? Grit refills and Dodge/Aim clear. Health and Statuses stay as they are.')) return;
    if (await tpAct({ action: 'end' }, 'Combat is over. Loot the fallen on the Combat page.')) poller?.now?.();
  });
  bar.querySelector('[data-endmine]')?.addEventListener('click', () => tpAct({ action: 'pc', id: c.current, op: 'endTurn' }));
  bar.querySelector('[data-goto]')?.addEventListener('click', () => {
    const t = data?.tokens.find((x) => x.ref === c.current);
    if (t) { select(t.id); const p = center(t.col, t.row); pz.centerOn(p.x, p.y, Math.max(pz.view.s, 0.45)); }
  });
  if (!cur) return;
  const a = cur.a, isPc = cur.kind === 'pc';
  const base = isPc ? { action: 'pc', id: a.id } : { action: 'enemy', id: a.id };
  bar.querySelectorAll('[data-tp]').forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.tp;
    tp[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : k === 'gear' ? Number(el.value) : el.value;
  }));
  bar.querySelectorAll('input[data-tp]:not([type=checkbox])').forEach((el) => el.addEventListener('input', () => { tp[el.dataset.tp] = el.type === 'number' ? Number(el.value) : el.value; }));
  bar.querySelector('[data-tp-mount]')?.addEventListener('change', (e) => tpAct({ ...base, op: 'mount', value: e.target.value }, e.target.value ? 'Mounted up.' : 'On foot.'));
  bar.querySelector('[data-undo]')?.addEventListener('click', async () => {
    try { const res = await api('POST', { action: 'undoMove', ref: a.id }, '', EP); poller.push(res.state); toast('Move undone — Grit refunded.'); combatPoller?.now?.(); }
    catch (e) { toast(e.message, true); }
  });
  bar.querySelector('[data-tp-attack]')?.addEventListener('click', () => {
    const t = data?.tokens.find((x) => x.ref === a.id);
    if (!t) return toast('Put their token on the board first.', true);
    select(t.id); $('#sel-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  bar.querySelector('[data-tp-dodge]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'dodge', grit: tp.dodge });
    if (r?.dice) rollPopup(r, `${a.name} · Dodge · ${r.pool}`);
  });
  bar.querySelector('[data-tp-item]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'useItem', gear: tp.gear });
    if (r?.dice) rollPopup(r, `${a.name} · ${r.label} · ${r.pool}`); else if (r) toast(`Used ${r.used}.`);
  });
  bar.querySelector('[data-tp-imp]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'improvise', grit: tp.imp, label: tp.impLabel, skill: tp.impSkill });
    if (r?.dice) rollPopup(r, `${a.name} · ${r.label} · ${r.pool}`);
    if (r) { tp.impLabel = ''; }
  });
  bar.querySelector('[data-tp-prep]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'prepare', grit: tp.prep, label: tp.prepLabel });
    if (r) { tp.prepLabel = ''; toast('Prepared — it goes off when the trigger happens.'); }
  });
  bar.querySelector('[data-tp-rl]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'relieve', status: tp.rl, dice: tp.rlDice });
    if (r?.dice) rollPopup(r, `${a.name} · Relieve ${tp.rl} · ${r.pool}`);
  });
  bar.querySelector('[data-tp-fool]')?.addEventListener('click', () => tpAct({ ...base, op: 'fool' }, '+1 Grit, −1 Health.'));
  bar.querySelectorAll('[data-abp], [data-ab]').forEach((el) => el.addEventListener('change', () => {
    if (el.dataset.abp) { tp.ab = { name: el.value }; renderTurnBar(); return; }
    tp.ab[el.dataset.ab] = el.value;
  }));
  bar.querySelector('[data-tp-ab]')?.addEventListener('click', async () => {
    bar.querySelectorAll('[data-ab]').forEach((el) => { tp.ab[el.dataset.ab] = el.value; });
    const r = await tpAct(abilityBody(a, tp.ab));
    if (r?.dice) rollPopup(r, `${a.name} · ${r.ability} · ${r.pool}`);
    if (r) toast(`✨ ${r.ability}${r.extra ? ` — ${r.extra}` : ''}`);
  });
  bar.querySelector('[data-tp-horse]')?.addEventListener('click', () => tpAct({ ...base, op: 'horseGrit' }, '+1 Grit.'));
}

function wireAttack(box, sel) {
  if (!sel) return;
  const s = atkSel[sel.id] ||= {};
  box.querySelectorAll('[data-as]').forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.as;
    s[k] = k === 'aim' ? el.checked : (k === 'w' || k === 'a' || k === 'cover') ? Number(el.value) : el.value;
    el.blur();
    renderPanel();
  }));
  box.querySelector('[data-map-attack]')?.addEventListener('click', async () => {
    const tgt = data.tokens.find((t) => t.id === s.t);
    const bandKey = WEAPON_KEY[band(dist(sel, tgt))];
    const r = await combatAct({ action: 'pc', id: sel.ref, op: 'attack', weapon: s.w, range: bandKey, target: tgt.ref, ammo: s.ammo, aim: s.aim });
    if (r?.dice) {
      s.aim = false;
      await rollPopup(r, `${sel.name} → ${r.target} · ${r.pool}`);
      toast(`${r.dmg ? `💥 ${r.dmg} damage to ${r.target}` : `${r.target} shrugs it off`} (${r.hits} Hits − ${r.def} Defense)${r.down ? ' — it’s down!' : ''}`, !r.dmg);
      poller?.now?.();
    }
  });
  box.querySelector('[data-map-eattack]')?.addEventListener('click', async () => {
    const tgt = data.tokens.find((t) => t.id === s.t);
    const r = await combatAct({ action: 'enemyAttack', enemy: sel.ref, attack: s.a, pc: tgt.ref, cover: s.cover || 0 });
    if (r?.atk?.dice) rollPopup(r.atk, `${r.atk.label} · ${r.atk.pool}`);
    if (r) { toast(`${r.dmg ? `${r.dmg} damage` : 'No damage'}${r.notes?.length ? ` · ${r.notes.join(', ')}` : ''}`); poller?.now?.(); }
  });
}

function renderWarden() {
  $('#warden-box').hidden = !warden;
  if (!warden) return;
  const pre = $('#presets');
  pre.innerHTML = data.presets.map((p) => `<button type="button" data-preset="${p.id}" aria-pressed="${data.map.kind === 'preset' && data.map.id === p.id}">
    <img src="${p.thumb}" alt="" loading="lazy"><span>${esc(p.name)}</span></button>`).join('');
  pre.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => act({ action: 'preset', id: b.dataset.preset }, 'Map changed.')));
  if (document.activeElement?.id !== 'g-ppi') $('#g-ppi').value = data.grid.ppi;
  if (document.activeElement?.id !== 'g-op') $('#g-op').value = data.grid.opacity;
  $('#g-show').checked = data.grid.show;
}

function render() {
  if (dragging) return; // don't yank a token out from under a drag
  renderStage();
  renderRanges();
  renderTokens();
  renderPanel();
  renderWarden();
}
function select(id) { selected = id; renderRanges(); renderTokens(); renderPanel(); }

// ---------- dragging tokens ----------
function wireToken(el) {
  const t = data.tokens.find((x) => x.id === el.dataset.id);
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!canMove(t)) { select(t.id); return; }
    try { el.setPointerCapture(e.pointerId); } catch {}
    const start = center(t.col, t.row);
    dragging = { id: t.id, cx: e.clientX, cy: e.clientY, x: start.x, y: start.y, moved: false, hex: { col: t.col, row: t.row } };
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging || dragging.id !== t.id) return;
    const dx = (e.clientX - dragging.cx) / pz.view.s, dy = (e.clientY - dragging.cy) / pz.view.s;
    if (Math.abs(e.clientX - dragging.cx) + Math.abs(e.clientY - dragging.cy) > 4) { dragging.moved = true; el.classList.add('dragging'); }
    if (!dragging.moved) return;
    el.style.left = `${dragging.x + dx}px`; el.style.top = `${dragging.y + dy}px`;
    dragging.hex = toHex(dragging.x + dx, dragging.y + dy);
    const d = dist(t, dragging.hex);
    const ro = $('#readout');
    ro.hidden = false;
    // Normal speed: 1 Grit per Short Range distance (6"); Long needs 2+, Distant 6 over two turns.
    ro.textContent = d === 0 ? 'Drop to stay put' : moveReadout(t, d);
  });
  const end = async () => {
    if (!dragging || dragging.id !== t.id) return;
    const drag = dragging;
    dragging = null;
    $('#readout').hidden = true;
    el.classList.remove('dragging');
    if (!drag.moved) { select(t.id); return; }
    if (drag.hex.col === t.col && drag.hex.row === t.row) { render(); return; }
    const was = { col: t.col, row: t.row };
    t.col = drag.hex.col; t.row = drag.hex.row; // move locally right away
    selected = t.id;
    render();
    const ok = await act({ action: 'move', id: t.id, ...drag.hex, rough: tp.rough });
    if (ok === null) { t.col = was.col; t.row = was.row; render(); } // not allowed: snap back
    else if (ok?.cost) { toast(`${t.name} moved — ${ok.cost} Grit.`); combatPoller?.now?.(); }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---------- Warden controls ----------
$('#g-show').addEventListener('change', (e) => act({ action: 'grid', show: e.target.checked }));
$('#g-ppi').addEventListener('change', (e) => act({ action: 'grid', ppi: Number(e.target.value) }));
$('#g-op').addEventListener('change', (e) => act({ action: 'grid', opacity: Number(e.target.value) }));
document.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => {
  const [x, y] = b.dataset.n.split(',').map(Number);
  act({ action: 'grid', dx: data.grid.dx + x, dy: data.grid.dy + y });
}));
$('#sync').addEventListener('click', () => act({ action: 'syncCombat', hidden: $('#sync-hidden').checked }, 'Tokens added.'));
$('#npc-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#npc-name').value.trim();
  if (!name) return;
  if (await act({ action: 'addToken', kind: 'npc', name })) $('#npc-name').value = '';
});
$('#clear').addEventListener('click', () => { if (confirm('Remove every token from the board?')) { selected = null; act({ action: 'clearTokens' }); } });

// Shrink uploads in the browser so they fit comfortably in the database.
$('#upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  toast('Preparing the map…');
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const scale = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    let q = 0.82, data64 = c.toDataURL('image/jpeg', q);
    while (data64.length > 2_700_000 && q > 0.4) { q -= 0.1; data64 = c.toDataURL('image/jpeg', q); }
    const inches = Number($('#inches').value) || 36;
    await act({ action: 'upload', data: data64, name: file.name.replace(/\.[^.]+$/, ''), w, h, inches }, 'Map uploaded.');
  } catch { toast('Couldn’t read that image.', true); }
});

// ---------- data & boot ----------
async function act(body, okMsg) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (okMsg) toast(okMsg);
    return res.result ?? true;
  } catch (e) { toast(e.message, true); render(); return null; }
}
function connect() {
  poller?.stop();
  combatPoller?.stop();
  combatPoller = startPolling(warden ? 'warden' : 'player', (d) => { combat = d; renderTurnBar(); if (data && !dragging) renderPanel(); }, null, '/api/combat');
  poller = startPolling(warden ? 'warden' : 'player', (d) => {
    data = d;
    if (selected && !data.tokens.some((t) => t.id === selected)) selected = null;
    render();
  }, (ok, e) => { if (e?.status === 401) { warden = false; forgetWarden(); setWarden(); connect(); } }, EP);
}
function setWarden() {
  $('#warden-btn').textContent = warden ? '⭐ Warden mode · lock' : '⭐ Warden';
  if (data) render();
}
$('#warden-btn').addEventListener('click', async () => {
  if (warden) { warden = false; forgetWarden(); }
  else if (!(warden = await wardenModal(EP))) return;
  setWarden(); connect();
});

(async () => {
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWarden();
  connect();
})();
