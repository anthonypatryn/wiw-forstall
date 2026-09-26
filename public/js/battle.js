import { $, esc, api, startPolling, toast, mountNav, tryWarden, forgetWarden, savedPin, wardenModal, rollPopup, abilityOptions, abilityTargetsHTML, abilityBody, ask, pickFighters, isPool } from './common.js';
import { gl } from './glyphs.js';
import { play, weaponSound } from './sound.js';
let meta = null;
// the Ability button depends on this, so redraw the turn panel once it arrives
api('GET', null, '?view=meta', '/api/combat').then((m) => { meta = m; renderTurnBar(); }).catch(() => {});
import { mountTableLog } from './tablelog.js';
import { pcCardHTML, enemyCardHTML, wireFighters, openSpoils } from './fighter-card.js';
import { openAddEnemies } from './enemy-add.js';
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
    if (!foes.length) return `<h3 class="d-h">${gl('revolver')} ATTACK</h3><p class="muted">No enemies standing on the board.</p>`;
    if (!foes.some((f) => f.t.id === s.t)) s.t = foes[0].t.id;
    const tgt = foes.find((f) => f.t.id === s.t), bandKey = WEAPON_KEY[band(tgt.d)];
    const weapons = pc.weapons.map((w, i) => [w, i]).filter(([w]) => (w.model || w.manufacturer) && isPool(w[bandKey]));
    if (!weapons.some(([, i]) => i === s.w)) s.w = weapons[0]?.[1];
    const w = pc.weapons[s.w] || {};
    const loaded = (w.ammo || []).map((a, k) => [a, k]).filter(([a]) => a.name && Number(a.rds) > 0);
    if (!loaded.some(([, k]) => String(k) === String(s.ammo))) s.ammo = '';
    const cost = (parseInt(String(w.grit || '').split('|')[0], 10) || 0) + (s.aim ? 1 : 0);
    const mine = combat.combat.current === pc.id;
    return `<h3 class="d-h">${gl('revolver')} ATTACK FROM HERE ${mine ? '<span class="tag turn">THEIR TURN</span>' : ''} <small>${pc.grit} Grit</small></h3>
      <div class="atk-form">
        <select data-as="t" aria-label="Target">${foes.map(({ t, d }) => `<option value="${t.id}"${t.id === s.t ? ' selected' : ''}>→ ${esc(t.name)} · ${d}″ ${BAND_LABEL[band(d)]}</option>`).join('')}</select>
        ${weapons.length ? `<select data-as="w" aria-label="Weapon">${weapons.map(([x, i]) => `<option value="${i}"${i === s.w ? ' selected' : ''}>${esc(x.model || x.manufacturer)} · ${esc(String(x[bandKey]).toUpperCase())}</option>`).join('')}</select>
        <select data-as="ammo" aria-label="Ammo"><option value="">regular ammo</option>${loaded.map(([a, k]) => `<option value="${k}"${String(k) === String(s.ammo) ? ' selected' : ''}>${esc(a.name)} (${a.rds})</option>`).join('')}</select>
        <label class="check"><input type="checkbox" data-as="aim"${s.aim ? ' checked' : ''}${pc.aimed ? ' disabled' : ''}> Aim +1</label>
        <button type="button" class="btn small" data-map-attack>${gl('revolver')} Attack · ${cost} Grit</button>`
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
    return `<h3 class="d-h">${gl('claws')} ATTACK THE POSSE <small>${e.grit ?? '?'} Grit</small></h3>
      <div class="atk-form">
        <select data-as="t" aria-label="Target">${posse.map(({ t, d }) => `<option value="${t.id}"${t.id === s.t ? ' selected' : ''}>→ ${esc(t.name)} · ${d}″ ${BAND_LABEL[band(d)]}</option>`).join('')}</select>
        <select data-as="a" aria-label="Attack">${prof.attacks.map((a, i) => { const ok = fits.some(([, k]) => k === i);
          return `<option value="${i}"${i === s.a ? ' selected' : ''}>${ok ? '' : '(out of range) '}${esc(a.name)} · ${a.range}${a.grit ? ` · ${a.grit} Grit` : ''}</option>`; }).join('')}</select>
        <select data-as="cover" aria-label="Cover"><option value="0">no cover</option><option value="1"${s.cover == 1 ? ' selected' : ''}>light cover</option><option value="2"${s.cover == 2 ? ' selected' : ''}>heavy cover</option></select>
        <button type="button" class="btn small" data-map-eattack>${gl('claws')} Roll it</button>
      </div>`;
  }
  return '';
}
const vp = $('#viewport'), stage = $('#stage');
const pz = panZoom(vp, stage, {
  maxScale: 2.5, ignore: '.btoken, .fstoken, .map-ctrls',
  onTap: (target) => { if (!target.closest('.btoken, .fstoken')) select(null); },
});
$('#zoom-in').addEventListener('click', () => pz.zoom(1.35));
$('#zoom-out').addEventListener('click', () => pz.zoom(1 / 1.35));
$('#zoom-fit').addEventListener('click', () => pz.fit());

// ---------- pings: press and hold (or right-click) the map → a marker everyone sees for a few seconds ----------
const PING_HOLD_MS = 550, PING_SHOW_MS = 4000;
const seenPings = new Set();
let pingTimer = null, pingRedraw = null;
function renderPings() {
  const layer = $('#pings');
  if (!layer || !data) return;
  const live = (data.pings || []).filter((p) => Date.now() - p.at < PING_SHOW_MS);
  // big enough to see at any zoom: at least ~110 px across and 15 px text on screen
  const z = pz.view.s || 1, size = Math.max(data.grid.ppi * 1.6, 110 / z), font = Math.max(data.grid.ppi * 0.28, 15 / z);
  layer.innerHTML = live.map((p) => { const c = center(p.col, p.row); return `<div class="ping" style="left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;border-width:${4 / z}px"><span class="ping-name" style="font-size:${font}px;padding:${2 / z}px ${8 / z}px">${esc(p.name)}</span></div>`; }).join('');
  if (live.some((p) => !seenPings.has(p.id))) play('lockClick');
  live.forEach((p) => seenPings.add(p.id));
  clearTimeout(pingRedraw);
  if (live.length) pingRedraw = setTimeout(renderPings, Math.max(200, Math.min(...live.map((p) => p.at + PING_SHOW_MS - Date.now())) + 50)); // drop it when it expires
}
async function sendPing(clientX, clientY) {
  if (!data) return;
  const pt = pz.toStage(clientX, clientY), hex = toHex(pt.x, pt.y);
  let me = null; try { me = JSON.parse(localStorage.getItem('wiw.me') || 'null'); } catch {}
  const r = await act({ action: 'ping', col: hex.col, row: hex.row, pc: me });
  if (r) { data.pings = [...(data.pings || []).filter((p) => p.id !== r.id), r]; renderPings(); }
}
vp.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('.btoken, .fstoken, .map-ctrls')) return;
  const x0 = e.clientX, y0 = e.clientY;
  clearTimeout(pingTimer);
  pingTimer = setTimeout(() => sendPing(x0, y0), PING_HOLD_MS);
  const cancel = (ev) => { if (ev.type !== 'pointermove' || Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { clearTimeout(pingTimer); off(); } };
  const off = () => ['pointermove', 'pointerup', 'pointercancel'].forEach((t) => vp.removeEventListener(t, cancel));
  ['pointermove', 'pointerup', 'pointercancel'].forEach((t) => vp.addEventListener(t, cancel));
});
vp.addEventListener('contextmenu', (e) => { if (e.target.closest('.btoken, .fstoken, .map-ctrls')) return; e.preventDefault(); sendPing(e.clientX, e.clientY); });

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
  const src = map.kind === 'upload' ? `/api/battle?view=img&v=${map.imgV}` : `/img/battle/${map.id}.webp`;
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
    const art = t.photo || (t.img ? `/img/tokens/${t.img}.webp` : '');
    const bg = art ? `background:${color(t)} url('${esc(art)}') center / cover` : `background:${color(t)}`;
    const nStatus = Object.keys(t.statuses || {}).length;
    return `<div class="btoken ${t.kind}${art ? ' art' : ' stand-in'}${canMove(t) ? ' movable' : ''}${t.id === selected ? ' sel' : ''}${t.ref && t.ref === data.current ? ' turn' : ''}${t.hidden ? ' hidden-tok' : ''}${t.down ? ' down' : ''}${t.frenzied ? ' frenzied' : ''}"
      data-id="${t.id}" data-size="${esc(t.size || '')}" style="left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;${bg};font-size:${font}px;border-width:${data.grid.ppi * 0.05}px"
      title="${esc(t.name)}">${art ? '' : esc(initials(t.name))}
      ${t.holding ? `<span class="hold-dot" style="font-size:${labFont * 1.4}px" title="Prepared: ${esc(t.holding)}">${gl('watch')}</span>` : ''}
      ${t.dead ? `<span class="skull" style="font-size:${size * 0.62}px" aria-label="Down">${gl('skull')}</span>` : t.bleeding ? `<span class="skull bleed" style="font-size:${size * 0.5}px" aria-label="Bleeding Out">${gl('drop')}</span>` : ''}
      ${(data.forstalls || []).some((f) => f.owner && f.owner === t.ref) ? `<span class="fs-dot${(data.forstalls || []).find((f) => f.owner === t.ref)?.sweep ? ' on' : ''}" style="font-size:${labFont * 1.3}px" title="Carries a Forstall">${gl('forstall')}</span>` : ''}
      ${t.swept ? `<span class="sw-dot" style="font-size:${labFont * 1.3}px" title="${esc(t.sweepPreview || 'In a Sweeping Forstall’s Range')}">${gl('forstall')}</span>` : ''}
      ${nStatus ? `<span class="st-dot" style="font-size:${labFont}px" title="${esc(Object.entries(t.statuses).map(([k, v]) => `${k} ${v}`).join(', '))}">${nStatus}</span>` : ''}
      <span class="lab" style="font-size:${labFont}px">${esc(t.name)}${hasHp ? `<i class="hpbar"><i style="width:${pct}%"></i></i><em>${t.health}/${t.maxHealth}</em>` : ''}</span>
      ${d !== null ? `<span class="dist ${band(d)}" style="font-size:${labFont}px">${d}″ · ${BAND_LABEL[band(d)]}</span>` : ''}</div>`;
  }).join('') + fsMarkers();
  layer.querySelectorAll('.btoken').forEach(wireToken);
  layer.querySelectorAll('.fstoken').forEach(wireFsMarker);
}

function renderPanel() {
  const sel = selected && data.tokens.find((x) => x.id === selected);
  const box = $('#sel-box');
  if (box.contains(document.activeElement) && /^(SELECT|INPUT)$/.test(document.activeElement.tagName)) return; // don't redraw under the Warden's typing
  const selF = !sel && selFs ? fsOf(selFs) : null;
  if (selF) {
    box.innerHTML = `<div class="sel-card"><div class="kind">FORSTALL${selF.hidden ? ' · HIDDEN FROM POSSE' : ''}</div>${forstallCard(selF)}</div>`;
    wireFs(box);
  } else if (!sel) {
    box.innerHTML = `<div class="sel-card"><div class="kind">RANGE METER</div><h2>Tap a token</h2>
      <p>You’ll see its Arm’s Reach, Short and Long Range, and how far away everyone else is.</p></div>`;
  } else {
    const others = data.tokens.filter((t) => t.id !== sel.id).map((t) => ({ t, d: dist(sel, t) })).sort((a, b) => a.d - b.d);
    const st = Object.entries(sel.statuses || {});
    const hpPct = sel.maxHealth != null ? Math.max(0, Math.min(100, (sel.health / Math.max(1, sel.maxHealth)) * 100)) : 0;
    // the Warden gets the full fighter card: Health ±, Grit, Statuses, and for enemies the stat block with public dice and loot
    const fc = warden && combat && meta && sel.ref && (sel.kind === 'pc' ? combat.posse.find((x) => x.id === sel.ref) : combat.enemies.find((x) => x.id === sel.ref));
    const fcHTML = !fc ? '' : sel.kind === 'pc' ? pcCardHTML(fc, { data: combat, meta }) : enemyCardHTML(fc, { data: combat, meta });
    const detail = `
      ${!fcHTML && sel.maxHealth != null ? `<div class="d-hp"><span class="bar"><i style="width:${hpPct}%"></i></span><b>${sel.health}/${sel.maxHealth}</b></div>` : ''}
      <div class="d-tags">${sel.ref && sel.ref === data.current ? '<span class="tag turn">THEIR TURN</span>' : ''}${sel.frenzied ? '<span class="tag red">FRENZIED</span>' : ''}${sel.bleeding ? '<span class="tag red">BLEEDING OUT</span>' : ''}${sel.down ? '<span class="tag">DOWN</span>' : ''}</div>
      ${!fcHTML && st.length ? `<div class="d-st">${st.map(([k, v]) => `<span class="st">${esc(k)} <b>${v}</b></span>`).join('')}</div>` : ''}
      ${fcHTML ? "" : `<div class="d-row">${sel.grit != null ? `<span><b>GRIT</b> ${sel.grit}</span>` : ''}${sel.defense ? `<span><b>DEFENSE</b> ${esc(sel.defense)}</span>` : ''}${sel.speed ? `<span><b>SPEED</b> ${esc(sel.speed)}</span>` : ''}${sel.finesse ? `<span><b>FINESSE</b> ${esc(sel.finesse)}</span>` : ''}${sel.aces ? `<span><b>ACES</b> ${sel.aces}/6</span>` : ''}${sel.size ? `<span><b>SIZE</b> ${esc(sel.size)}</span>` : ''}</div>`}
      ${sel.frenzyText?.length ? `<div class="d-note">${sel.frenzyText.map(esc).join('<br>')}</div>` : ''}
      ${sel.sweepPreview ? `<div class="d-note fs-prev">${gl('forstall')} ${esc(sel.sweepPreview)}</div>` : ''}
      ${sel.emp != null ? `<button type="button" class="btn small danger" data-emp="${esc(sel.ref)}"${sel.emp < 1 ? ' disabled' : ''}>${gl('flash')} Natural EMP (${sel.emp}/2 left today)</button>` : ''}
      ${warden && sel.kind === 'enemy' && sel.ref ? `<label class="check"><input type="checkbox" data-submerged="${esc(sel.ref)}"${sel.submerged ? ' checked' : ''}> Submerged — Forstalls can’t reach it</label>` : ''}
      ${(() => { const f = sel.kind === 'pc' && (data.forstalls || []).find((x) => x.owner === sel.ref); return f ? forstallCard(f) : ''; })()}
      ${!fcHTML && sel.attacks?.length ? `<details class="d-atk"><summary>Attacks</summary>${sel.attacks.map((a) => `<p>${esc(a)}</p>`).join('')}</details>` : ''}
      ${combat?.combat?.active && sel.ref && sel.ref === combat.combat.current ? '<p class="tp-hint">Attacks and actions are in the turn panel above.</p>' : ''}`;
    const kindLabel = sel.kind === 'pc' ? `POSSE${sel.trade ? ` · THE ${esc(sel.trade.toUpperCase())}` : ''}` : sel.kind === 'enemy' ? 'ENEMY' : 'NPC';
    box.innerHTML = `<div class="sel-card">${sel.photo || sel.img ? `<img class="sel-art" src="${esc(sel.photo || `/img/tokens/${sel.img}.webp`)}" alt="">` : ''}<div class="kind">${kindLabel}${sel.hidden ? ' · HIDDEN FROM POSSE' : ''}</div>${fcHTML ? '' : `<h2>${esc(sel.name)}</h2>`}${fcHTML}${detail}
      <h3 class="d-h">DISTANCES</h3>
      ${others.length ? others.map(({ t, d }) => `<div class="tok-row" data-pick="${t.id}"><span class="chip" style="background:${color(t)}">${esc(initials(t.name))}</span>
        <span class="n">${esc(t.name)}</span><span class="d ${band(d)}">${d}″ · ${BAND_LABEL[band(d)]}</span></div>`).join('') : '<p class="muted">Nobody else on the board.</p>'}</div>`;
  }
  if (sel) wireFs(box);
  if (sel && warden) wireFighters(box, { data: combat, meta, act: async (body) => { const r = await combatAct(body); renderPanel(); renderTurnBar(); poller?.now?.(); return r; } });
  box.querySelector('[data-emp]')?.addEventListener('click', async (e) => {
    if (!await ask('Natural EMP?\n\nEvery Forstall within Long Range (18″) stops Sweeping, and they can’t Scan or Burst until this monster’s next turn.', { ok: 'Let it rip', danger: true })) return;
    play('zap');
    const r = await fsAct({ action: 'forstall', op: 'emp', enemy: e.target.closest('[data-emp]').dataset.emp });
    if (r) toast(r.hit.length ? `EMP! ${r.hit.join(', ')} knocked out.` : 'EMP — no Forstall in range.');
  });
  box.querySelector('[data-submerged]')?.addEventListener('change', (e) => fsAct({ action: 'enemy', id: e.target.dataset.submerged, op: 'submerged' }));
  const list = $('#token-list');
  list.innerHTML = data.tokens.length ? data.tokens.map((t) => `<div class="tok-row${t.id === selected ? ' sel' : ''}" data-pick="${t.id}">
      <span class="chip" style="background:${color(t)}">${esc(initials(t.name))}</span>
      <span class="n">${esc(t.name)}<small>${t.kind === 'pc' ? `The ${esc(t.trade || '')}` : t.kind === 'enemy' ? 'Enemy' : 'NPC'}${t.down ? ' · down' : ''}${t.gone ? ' · removed from Combat' : ''}</small></span>
      ${warden ? `<button type="button" data-hide="${t.id}">${t.hidden ? 'Reveal' : 'Hide'}</button><button aria-label="Remove this token" type="button" data-rm="${t.id}">✕</button>` : ''}</div>`).join('')
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
  return `${t.name} moves ${d}″ · ${m.cost} Grit (${m.speed}${tp.rough ? ', rough' : ''})${m.cost > (actor.grit || 0) ? ` · only ${actor.grit || 0} left!` : ''}`;
}
// ---------- turn panel: whose turn, Grit left, this turn's actions (pp. 40–43) ----------
const tp = { open: '', pp: { kind: 'attack', trig: 'within-short', grit: 1, gear: 0, aim: false, ammo: '', ab: {} }, ab: {}, rough: false, dodge: 1, gear: 0, imp: 1, impLabel: '', impSkill: '', prep: 1, prepLabel: '', rl: '', rlDice: 1 };
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
    bar.innerHTML = warden ? `<div class="turn-bar"><div><small>NO COMBAT RUNNING</small><span class="muted">${pcs} in the posse · ${n} enem${n === 1 ? 'y' : 'ies'} ready</span></div>
      <button type="button" class="btn secondary" data-addenemies>${gl('claws')} Add enemies</button>
      <button type="button" class="btn" data-startfight${pcs + n ? '' : ' disabled'}>${gl('revolver')} Start combat</button></div>` : '';
    bar.querySelector('[data-addenemies]')?.addEventListener('click', () => openAddEnemies(combat, () => poller?.now?.()));
    bar.querySelector('[data-startfight]')?.addEventListener('click', async () => { const who = await pickFighters(combat); if (who && await tpAct({ action: 'start', ...who }, 'Combat begins — tokens placed.')) poller?.now?.(); });
    return;
  }
  bar.hidden = false;
  const cur = currentActor();
  const nm = (k) => combat.posse.find((p) => p.id === k)?.name || combat.enemies.find((e) => e.id === k)?.name || '—';
  const order = c.turnList || [], i = order.indexOf(c.current), next = order.length > 1 ? order[(i + 1) % order.length] : null;
  const u = combat.undo || {};
  if (!cur) { bar.innerHTML = `<div class="turn-bar"><span>Round ${c.round || 1}</span>${warden ? '<button type="button" class="btn small" data-nextturn>Next turn</button>' : ''}</div>`; wireTurnBar(bar, null); return; }
  const a = cur.a, isPc = cur.kind === 'pc';
  const can = warden || (isPc && myId() === a.id);
  const log = a.turnLog || [];
  const tok = data?.tokens.find((t) => t.ref === a.id);
  // the action buttons — each opens its options underneath (one at a time)
  const gear = isPc ? a.gear.map((g, k) => [g, k]).filter(([g]) => g.item) : [];
  const sts = isPc ? Object.entries(a.statuses || {}).filter(([, v]) => v) : [];
  const abil = isPc && meta ? abilityOptions(a, meta) : [];
  const ACTIONS = [
    ['attack', 'revolver', 'Attack', 'weapon’s Grit'],
    ['move', 'boot', 'Move', 'drag token'],
    ['dodge', 'dodge', 'Dodge', '1 per die'],
    ...(abil.length ? [['ability', 'star', 'Ability', 'varies']] : []),
    ...(gear.length ? [['item', 'satchel', 'Use Item', 'item’s Grit']] : []),
    ...(sts.length ? [['relieve', 'bandage', 'Relieve', '1 per die']] : []),
    ['improvise', 'lasso', 'Improvise', '1+'],
    ...(isPc && a.forstall?.model ? [['forstall', 'forstall', 'Forstall', `${parseInt(a.forstall.grit, 10) || 4} Grit`]] : []),
    ...(isPc ? [['prepare', 'watch', 'Prepare', 'held', a.prepared]] : []),
    ...(isPc ? [['fool', 'heart', 'Fool’s Grit', '+1 for 1 HP', a.foolUsed]] : []),
  ];
  if (!ACTIONS.some(([k]) => k === tp.open)) tp.open = '';
  let drawer = '';
  if (can) switch (tp.open) {
    case 'attack':
      drawer = tok ? attackHTML(tok).replace(/<h3 class="d-h">[\s\S]*?<\/h3>/, '') : '<p class="muted">Put their token on the board first.</p>';
      break;
    case 'move':
      drawer = `<p class="tp-hint">Drag <b>${esc(a.name)}</b>’s token on the map — the Grit cost shows while you drag, and it’s spent when you drop.</p>
        <label class="check"><input type="checkbox" data-tp="rough"${tp.rough ? ' checked' : ''}> Rough terrain (costs double)</label>
        ${isPc && (a.horse?.breed || a.mech?.class) ? `<select data-tp-mount aria-label="On foot or mounted"><option value="">On foot (Normal)</option>${a.horse?.breed ? `<option value="horse"${a.mounted === 'horse' ? ' selected' : ''}>Riding ${esc(a.horse.name || a.horse.breed)} (Fast)</option>` : ''}${a.mech?.class ? `<option value="mech"${a.mounted === 'mech' ? ' selected' : ''}>Driving the ${esc(a.mech.class)} mech</option>` : ''}</select>` : ''}
        ${isPc && /arabian/i.test(a.horse?.breed || '') && a.horse?.bond === 'Revered' && a.mounted === 'horse' ? `<button type="button" class="btn small secondary" data-tp-horse${(a.horseGrit || 0) >= 2 ? ' disabled' : ''}>${gl('horseshoe')} Arabian +1 Grit (${a.horseGrit || 0}/2)</button>` : ''}`;
      break;
    case 'forstall': {
      const f = fsOf(`pc:${a.id}`);
      drawer = f ? forstallCard(f) : '<p class="muted">Put their token on the board first.</p>';
      break;
    }
    case 'dodge':
      drawer = `<p class="tp-hint">Spend Grit, roll that many Black dice. The Hits soak the next attack on ${esc(a.name)} — gone at their next turn.</p>
        <div class="tp-form"><input aria-label="Dodge dice" type="number" min="1" max="12" data-tp="dodge" value="${tp.dodge}"> Grit <button type="button" class="btn small" data-tp-dodge>${gl('dodge')} Dodge</button></div>`;
      break;
    case 'ability':
      if (!abil.some((o) => o.name === tp.ab.name)) tp.ab.name = abil.find((o) => !o.out)?.name || abil[0].name;
      drawer = `<div class="tp-form"><select aria-label="Ability" data-abp="name">${abil.map((o) => `<option value="${esc(o.name)}"${o.name === tp.ab.name ? ' selected' : ''}${o.out ? ' disabled' : ''}>${esc(o.label)}</option>`).join('')}</select>
        ${abilityTargetsHTML(tp.ab.name, a, combat.posse, combat.enemies.filter((e) => !e.defeated), tp.ab)}<button type="button" class="btn small" data-tp-ab>${gl('star')} Use</button></div>`;
      break;
    case 'item':
      drawer = `<div class="tp-form"><select aria-label="Item" data-tp="gear">${gear.map(([g, k]) => `<option value="${k}"${k === tp.gear ? ' selected' : ''}>${esc(g.item)} · ${esc(g.grit || 0)} Grit${g.notes ? ` · ${esc(g.notes)}` : ''}</option>`).join('')}</select><button type="button" class="btn small" data-tp-item>Use it</button></div>`;
      break;
    case 'relieve':
      if (!sts.some(([st]) => st === tp.rl)) tp.rl = sts[0][0];
      drawer = `<p class="tp-hint">Roll up to your Skill’s dice, 1 Grit each. Each Hit lowers the Severity by 1 (once per Status per turn).</p>
        <div class="tp-form"><select aria-label="Status to relieve" data-tp="rl">${sts.map(([st, v]) => `<option value="${st}"${st === tp.rl ? ' selected' : ''}>${st} [${v}]</option>`).join('')}</select>
        <input aria-label="Dice to roll" type="number" min="1" max="12" data-tp="rlDice" value="${tp.rlDice}"> dice <button type="button" class="btn small" data-tp-rl>Roll</button></div>`;
      break;
    case 'improvise':
      drawer = `<div class="tp-form"><input data-tp="impLabel" maxlength="60" placeholder="What? e.g. climb the wagon" value="${esc(tp.impLabel)}">
        <input aria-label="Grit to spend" type="number" min="1" max="12" data-tp="imp" value="${tp.imp}"> Grit
        ${isPc ? `<select aria-label="Skill to roll" data-tp="impSkill"><option value="">no roll</option>${['Charm', 'Finesse', 'Intuition', 'Nerve'].map((k) => `<option${k === tp.impSkill ? ' selected' : ''}>${k}</option>`).join('')}</select>` : ''}
        <button type="button" class="btn small" data-tp-imp>Do it</button></div>`;
      break;
    case 'prepare': {
      const pp = tp.pp;
      const weapons = a.weapons.map((w, k) => [w, k]).filter(([w]) => w.model || w.manufacturer);
      if (!weapons.some(([, k]) => k === pp.weapon)) pp.weapon = weapons[0]?.[1] ?? 0;
      const w = a.weapons[pp.weapon] || {};
      const ranges = [['arms', 'Arm’s Reach'], ['short', 'Short Range'], ['long', 'Long Range'], ['distant', 'Distant']].filter(([k]) => /^(\d+[BG])+$/.test(String(w[k] || '')));
      if (!ranges.some(([k]) => k === pp.range)) pp.range = ranges.find(([k]) => k === 'short')?.[0] || ranges[0]?.[0] || '';
      const foes = combat.enemies.filter((e) => !e.defeated);
      const loaded = (w.ammo || []).map((am, k) => [am, k]).filter(([am]) => am.name && Number(am.rds) > 0);
      const cost = pp.kind === 'attack' ? (parseInt(String(w.grit || '').split('|')[0], 10) || 0) + (pp.aim ? 1 : 0) : pp.kind === 'dodge' || pp.kind === 'improvise' ? pp.grit : pp.kind === 'item' ? (parseInt(String(a.gear[pp.gear]?.grit || '0'), 10) || 0) : (meta?.abilityInfo?.[pp.ab?.name]?.cost || 0);
      drawer = a.hold ? `<p class="tp-hint">Already holding <b>${esc(a.hold.label)}</b> — when ${esc(a.hold.when)}.</p>`
        : `<p class="tp-hint">Pay now, fire outside your turn when the trigger happens. It fizzles at your next turn (p. 42).</p>
        <div class="pp-grid">
          <label>HOLD<select data-pp="kind"><option value="attack"${pp.kind === 'attack' ? ' selected' : ''}>an attack</option><option value="dodge"${pp.kind === 'dodge' ? ' selected' : ''}>a Dodge</option>${gear.length ? `<option value="item"${pp.kind === 'item' ? ' selected' : ''}>an item</option>` : ''}${abil.length ? `<option value="ability"${pp.kind === 'ability' ? ' selected' : ''}>an ability</option>` : ''}<option value="improvise"${pp.kind === 'improvise' ? ' selected' : ''}>an Improvise</option></select></label>
          ${pp.kind === 'attack' ? `<label>WEAPON<select data-pp="weapon">${weapons.map(([x, k]) => `<option value="${k}"${k === pp.weapon ? ' selected' : ''}>${esc(x.model || x.manufacturer)}</option>`).join('')}</select></label>
            <label>AT<select data-pp="range">${ranges.map(([k, l]) => `<option value="${k}"${k === pp.range ? ' selected' : ''}>${l} · ${esc(String(w[k]).toUpperCase())}</option>`).join('')}</select></label>
            <label>AMMO<select data-pp="ammo"><option value="">regular</option>${loaded.map(([am, k]) => `<option value="${k}"${String(k) === String(pp.ammo) ? ' selected' : ''}>${esc(am.name)} (${am.rds})</option>`).join('')}</select></label>
            <label class="check"><input type="checkbox" data-pp="aim"${pp.aim ? ' checked' : ''}> Aim +1</label>` : ''}
          ${pp.kind === 'dodge' || pp.kind === 'improvise' ? `<label>GRIT<input type="number" min="1" max="12" data-pp="grit" value="${pp.grit}"></label>` : ''}
          ${pp.kind === 'improvise' ? `<label class="wide">DO WHAT<input data-pp="itext" maxlength="60" placeholder="e.g. kick the lantern into the hay" value="${esc(pp.itext || '')}"></label>
            <label>ROLL<select data-pp="skill"><option value="">no roll</option>${['Charm', 'Finesse', 'Intuition', 'Nerve'].map((k) => `<option${k === pp.skill ? ' selected' : ''}>${k}</option>`).join('')}</select></label>` : ''}
          ${pp.kind === 'item' ? `<label>ITEM<select data-pp="gear">${gear.map(([g, k]) => `<option value="${k}"${k === pp.gear ? ' selected' : ''}>${esc(g.item)}</option>`).join('')}</select></label>` : ''}
          ${pp.kind === 'ability' ? `<label>ABILITY<select data-pp="abname">${abil.map((o) => `<option value="${esc(o.name)}"${o.name === pp.ab?.name ? ' selected' : ''}${o.out ? ' disabled' : ''}>${esc(o.label)}</option>`).join('')}</select></label>` : ''}
          <label class="wide">WHEN<select data-pp="trig">
            <option value="within-short"${pp.trig === 'within-short' ? ' selected' : ''}>an enemy comes within Short Range of me</option>
            <option value="within-arms"${pp.trig === 'within-arms' ? ' selected' : ''}>an enemy comes within Arm’s Reach of me</option>
            ${foes.map((e) => `<option value="moves:${e.id}"${pp.trig === `moves:${e.id}` ? ' selected' : ''}>${esc(e.name)} moves</option><option value="attacks:${e.id}"${pp.trig === `attacks:${e.id}` ? ' selected' : ''}>${esc(e.name)} attacks</option>`).join('')}
            <option value="ally"${pp.trig === 'ally' ? ' selected' : ''}>an ally is attacked</option>
            <option value="custom"${pp.trig === 'custom' ? ' selected' : ''}>something else…</option></select></label>
          ${pp.trig === 'custom' ? `<label class="wide">DESCRIBE IT<input data-pp="text" maxlength="80" placeholder="e.g. the wagon door opens" value="${esc(pp.text || '')}"></label>` : ''}
        </div>
        <button type="button" class="btn small" data-tp-prep>${gl('watch')} Prepare · ${cost} Grit</button>`;
      break;
    }
  }
  bar.innerHTML = `<div class="turn-panel${can && !warden ? ' mine' : ''}">
    <div class="tp-top">
      <div><small>ROUND ${c.round || 1}${next ? ` · NEXT UP: ${esc(nm(next))}` : ''}</small><b data-goto="${esc(a.id)}">${esc(a.name)}</b><span class="tp-sub">’s turn</span></div>
      <div class="tp-grit" title="Grit left this turn">${pips(a.grit || 0)}<span><b>${a.grit ?? 0}</b> Grit</span></div>
    </div>
    ${holdsHTML()}
    <div class="tp-log">${log.length ? log.map((l) => `<span class="tp-chip">${esc(l.text)}${l.grit > 0 ? ` <i>−${l.grit}</i>` : l.grit < 0 ? ` <i class="plus">+${-l.grit}</i>` : ''}</span>`).join('') : '<span class="muted">Nothing done yet this turn.</span>'}
      ${a.dodge ? `<span class="tp-chip good">${gl('dodge')} ${a.dodge} Dodge ready</span>` : ''}</div>
    ${can ? `
      ${quickHTML(cur, tok)}
      <div class="tp-actions">${ACTIONS.map(([k, ic, label, cost, off]) => `<button type="button" class="tp-act${tp.open === k ? ' on' : ''}" data-open="${k}"${off ? ' disabled' : ''}><span class="ic">${gl(ic)}</span>${label}<small>${off ? 'used' : cost}</small></button>`).join('')}</div>
      ${drawer ? `<div class="tp-drawer">${drawer}</div>` : ''}
      <div class="tp-end">
        <span class="tp-undo">${(warden ? u.last : u.lastIsThisTurn && u.last) ? `<button type="button" class="btn small secondary" data-undo="last" title="Undo: ${esc(u.last)}">↶ Undo <small>${esc(u.last)}</small></button>` : ''}
          ${u.thisTurn ? `<button type="button" class="btn small secondary" data-undo="turn">⟲ Restart turn</button>` : ''}</span>
        ${warden ? `<button type="button" class="btn small secondary" data-addenemies title="Reinforcements">${gl('claws')} + Enemies</button><button type="button" class="btn small secondary" data-endfight>End combat</button><button type="button" class="btn" data-nextturn>Next turn</button>` : '<button type="button" class="btn" data-endmine>End my turn</button>'}
      </div>`
    : `<p class="muted tp-empty">${isPc ? `Waiting on ${esc(a.name)}’s player (or the Warden).` : 'The enemies are acting.'}</p>`}
  </div>`;
  wireTurnBar(bar, cur, tok);
  if (can) wireQuick(bar, cur, tok);
}
// ---------- quick moves: one tap for the usual thing (the full Attack menu is still there for aim, ammo…) ----------
const QUICK_MAX = 3; // nearest targets shown
const diceIn = (pool) => (String(pool || '').match(/\d+/g) || []).reduce((n, d) => n + Number(d), 0);
function quickHTML(cur, tok) {
  if (!tok || !combat?.combat?.active) return '';
  const a = cur.a, out = [];
  if (cur.kind === 'pc') {
    const foes = data.tokens.filter((t) => t.kind === 'enemy' && !t.down && !t.hidden && combat.enemies.some((e) => e.id === t.ref && !e.defeated))
      .map((t) => ({ t, d: dist(tok, t) })).sort((x, y) => x.d - y.d).slice(0, QUICK_MAX);
    for (const { t, d } of foes) {
      const key = WEAPON_KEY[band(d)];
      // the weapon with the most dice at this range
      const best = a.weapons.map((w, i) => [w, i]).filter(([w]) => (w.model || w.manufacturer) && isPool(w[key])).sort(([x], [y]) => diceIn(y[key]) - diceIn(x[key]))[0];
      if (!best) { out.push(`<span class="tp-quick-none">${esc(t.name)} is out of reach (${d}″)</span>`); continue; }
      const [w, i] = best, cost = parseInt(String(w.grit || '').split('|')[0], 10) || 0;
      const melee = /melee/i.test(w.type || '') || key === 'arms';
      out.push(`<button type="button" class="tp-quick" data-quick="pc" data-w="${i}" data-range="${key}" data-target="${esc(t.ref)}"${(a.grit ?? 0) < cost ? ' disabled title="Not enough Grit"' : ''}>
        ${gl(melee ? 'claws' : 'revolver')} ${melee ? 'Hit' : 'Shoot'} <b>${esc(t.name)}</b><small>${esc(w.model || w.manufacturer)} · ${esc(String(w[key]).toUpperCase())} · ${d}″ · ${cost} Grit</small></button>`);
    }
  } else if (warden) {
    const e = combat.enemies.find((x) => x.id === a.id), prof = e?.profile ? combat.profiles?.[e.profile] : null;
    if (!prof?.attacks?.length) return '';
    const posse = data.tokens.filter((t) => t.kind === 'pc' && combat.posse.some((p) => p.id === t.ref && !p.dead))
      .map((t) => ({ t, d: dist(tok, t) })).sort((x, y) => x.d - y.d).slice(0, QUICK_MAX);
    for (const { t, d } of posse) {
      const b = band(d);
      const fit = prof.attacks.map((x, i) => [x, i]).find(([x]) => (ATK_BAND[x.range] || 'arm') === b || (b === 'arm' && x.range === 'Short'));
      if (!fit) { out.push(`<span class="tp-quick-none">${esc(t.name)} is out of reach (${d}″)</span>`); continue; }
      out.push(`<button type="button" class="tp-quick" data-quick="en" data-a="${fit[1]}" data-target="${esc(t.ref)}"${(a.grit ?? 0) < (fit[0].grit || 0) ? ' disabled title="Not enough Grit"' : ''}>
        ${gl('claws')} ${esc(fit[0].name)} → <b>${esc(t.name)}</b><small>${d}″ · ${fit[0].grit ?? '?'} Grit</small></button>`);
    }
  }
  return out.length ? `<div class="tp-quicks"><small>QUICK MOVES</small>${out.join('')}</div>` : '';
}
function wireQuick(bar, cur, tok) {
  bar.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const d = b.dataset;
    if (d.quick === 'pc') {
      const r = await combatAct({ action: 'pc', id: cur.a.id, op: 'attack', weapon: Number(d.w), range: d.range, target: d.target });
      if (r?.dice) {
        play(weaponSound(cur.a.weapons[Number(d.w)]));
        await rollPopup(r, `${cur.a.name} → ${r.target} · ${r.pool}`);
        toast(`${r.dmg ? `${r.dmg} damage to ${r.target}` : `${r.target} shrugs it off`} (${r.hits} Hits − ${r.def} Defense)${r.down ? ' — it’s down!' : ''}`, !r.dmg);
      }
    } else {
      let r;
      try { const res = await api('POST', { action: 'enemyAttack', enemy: cur.a.id, attack: Number(d.a), pc: d.target, cover: 0 }, '', '/api/combat'); combat = res.state || combat; r = res.result; }
      catch (err) {
        if (!/^OUT_OF_RANGE: /.test(err.message)) { toast(err.message, true); b.disabled = false; return; }
        if (!await ask(`${err.message.slice(14)}\n\nRoll it anyway?`)) { b.disabled = false; return; }
        r = await combatAct({ action: 'enemyAttack', enemy: cur.a.id, attack: Number(d.a), pc: d.target, cover: 0, force: true });
      }
      if (r?.atk?.dice) { play(/range|shoot|spit|throw/i.test(r.atk.label) ? 'gun' : 'swing'); rollPopup(r.atk, `${r.atk.label} · ${r.atk.pool}`); }
      if (r) toast(`${r.dmg ? `${r.dmg} damage` : 'No damage'}${r.notes?.length ? ` · ${r.notes.join(', ')}` : ''}`);
    }
    renderTurnBar(); poller?.now?.();
  }));
}
// ---------- prepared (held) Actions: who's holding what, and Fire now ----------
function holdsHTML() {
  const holders = (combat?.posse || []).filter((p) => p.hold);
  if (!holders.length) return '';
  const foes = (combat.enemies || []).filter((e) => !e.defeated);
  return `<div class="tp-holds">${holders.map((p) => {
    const h = p.hold, may = warden || myId() === p.id;
    const tgt = h.triggeredBy?.enemy || h.trigger?.enemy || '';
    return `<div class="tp-hold${h.triggeredBy ? ' hot' : ''}"><div>${gl('watch')} <b>${esc(p.name)}</b> holds ${esc(h.label)} — when ${esc(h.when)}${h.triggeredBy ? `<small>${esc(h.triggeredBy.text)} — it can go off!</small>` : ''}</div>
      ${may ? `<div class="tp-hold-btns">${h.kind === 'attack' ? `<select data-hold-target="${p.id}" aria-label="Target">${foes.map((e) => `<option value="${e.id}"${e.id === tgt ? ' selected' : ''}>→ ${esc(e.name)}</option>`).join('')}</select>` : ''}
        <button type="button" class="btn small" data-hold-fire="${p.id}">${gl('flash')} Fire now</button><button type="button" class="btn small secondary" data-hold-drop="${p.id}">Let it go</button></div>` : ''}</div>`;
  }).join('')}</div>`;
}
function wireHolds(box) {
  box.querySelectorAll('[data-hold-fire]').forEach((b) => b.addEventListener('click', async () => {
    const pid = b.dataset.holdFire, p = combat.posse.find((x) => x.id === pid);
    const target = box.querySelector(`[data-hold-target="${pid}"]`)?.value;
    // range from the map when both tokens are on it; otherwise the range that was held
    const me = data?.tokens.find((t) => t.ref === pid), foe = target && data?.tokens.find((t) => t.ref === target);
    const range = me && foe ? { arm: 'arms', short: 'short', long: 'long', distant: 'distant' }[band(dist(me, foe))] : undefined;
    const r = await tpAct({ action: 'pc', id: pid, op: 'fireHold', target, range: p?.hold?.kind === 'attack' ? range : undefined });
    if (r?.dice) rollPopup(r, `${p.name} · prepared ${r.fired} · ${r.pool}`);
    if (r) toast(r.dmg != null ? (r.dmg ? `${r.dmg} damage to ${r.target}` : `${r.target} shrugs it off`) : `${r.fired} — done!`);
  }));
  box.querySelectorAll('[data-hold-drop]').forEach((b) => b.addEventListener('click', async () => { if (await ask('Let the prepared Action go? The Grit isn’t refunded.')) tpAct({ action: 'pc', id: b.dataset.holdDrop, op: 'dropHold' }); }));
}
async function tpAct(body, msg) {
  const r = await combatAct(body);
  if (r !== null) { if (msg) toast(msg); combatPoller?.now?.(); poller?.now?.(); }
  return r;
}
function wireTurnBar(bar, cur, tok) {
  const c = combat?.combat;
  bar.querySelector('[data-nextturn]')?.addEventListener('click', () => { tp.open = ''; tpAct({ action: 'next' }); });
  bar.querySelector('[data-addenemies]')?.addEventListener('click', () => openAddEnemies(combat, () => poller?.now?.()));
  bar.querySelector('[data-endmine]')?.addEventListener('click', () => { tp.open = ''; tpAct({ action: 'pc', id: c.current, op: 'endTurn' }); });
  bar.querySelector('[data-endfight]')?.addEventListener('click', async () => {
    if (!await ask('End combat? Grit refills and Dodge/Aim clear. Health and Statuses stay as they are.')) return;
    if (!await tpAct({ action: 'end' }, 'Combat is over.')) return;
    poller?.now?.();
    // loot the fallen now, while it matters (p. 79)
    openSpoils({ getData: () => combat, meta, act: async (body) => { const r = await combatAct(body); renderPanel(); return r; } });
  });
  bar.querySelector('[data-goto]')?.addEventListener('click', () => {
    const t = data?.tokens.find((x) => x.ref === c.current);
    if (t) { select(t.id); const p = center(t.col, t.row); pz.centerOn(p.x, p.y, Math.max(pz.view.s, 0.45)); }
  });
  bar.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.undo === 'turn' && !await ask('Restart this turn? Everything done this turn is undone.')) return;
    const r = await tpAct({ action: 'undo', mode: b.dataset.undo });
    if (r) toast(`↶ Undone: ${r.labels.join(' · ')}`);
  }));
  if (!cur) return;
  const a = cur.a, isPc = cur.kind === 'pc';
  const base = isPc ? { action: 'pc', id: a.id } : { action: 'enemy', id: a.id };
  bar.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', async () => {
    const k = b.dataset.open;
    if (k === 'fool') { if (await ask('Fool’s Grit: +1 Grit for 1 Health?')) tpAct({ ...base, op: 'fool' }, '+1 Grit, −1 Health.'); return; }
    tp.open = tp.open === k ? '' : k;
    if (k === 'move' && tp.open && tok) { select(tok.id); const p = center(tok.col, tok.row); pz.centerOn(p.x, p.y, Math.max(pz.view.s, 0.45)); }
    renderTurnBar();
  }));
  if (tok && tp.open === 'attack') wireAttack(bar, tok);
  bar.querySelectorAll('[data-tp]').forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.tp;
    tp[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : k === 'gear' ? Number(el.value) : el.value;
  }));
  bar.querySelectorAll('input[data-tp]:not([type=checkbox])').forEach((el) => el.addEventListener('input', () => { tp[el.dataset.tp] = el.type === 'number' ? Number(el.value) : el.value; }));
  bar.querySelector('[data-tp-mount]')?.addEventListener('change', (e) => tpAct({ ...base, op: 'mount', value: e.target.value }, e.target.value ? 'Mounted up.' : 'On foot.'));
  bar.querySelector('[data-tp-horse]')?.addEventListener('click', () => tpAct({ ...base, op: 'horseGrit' }, '+1 Grit.'));
  bar.querySelector('[data-tp-dodge]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'dodge', grit: tp.dodge });
    if (r?.dice) rollPopup(r, `${a.name} · Dodge · ${r.pool}`);
  });
  bar.querySelector('[data-tp-item]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'useItem', gear: tp.gear });
    if (r && /explos|dynamite|bomb|grenade/i.test(`${r.label || ''} ${r.used || ''} ${a.gear?.[tp.gear]?.type || ''}`)) play('explosion');
    if (r?.dice) rollPopup(r, `${a.name} · ${r.label} · ${r.pool}`); else if (r) toast(`Used ${r.used}.`);
  });
  bar.querySelector('[data-tp-imp]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'improvise', grit: tp.imp, label: tp.impLabel, skill: tp.impSkill });
    if (r?.dice) rollPopup(r, `${a.name} · ${r.label} · ${r.pool}`);
    if (r) tp.impLabel = '';
  });
  bar.querySelectorAll('[data-pp]').forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.pp, pp = tp.pp;
    if (k === 'aim') pp.aim = el.checked; else if (k === 'weapon' || k === 'gear' || k === 'grit') pp[k] = Number(el.value); else if (k === 'abname') pp.ab = { name: el.value }; else pp[k] = el.value;
    // let go of the dropdown first — the panel won't redraw while a field is focused
    if (k !== 'text' && k !== 'itext') { el.blur(); renderTurnBar(); }
  }));
  bar.querySelector('input[data-pp="text"]')?.addEventListener('input', (e) => { tp.pp.text = e.target.value; });
  bar.querySelector('input[data-pp="itext"]')?.addEventListener('input', (e) => { tp.pp.itext = e.target.value; });
  bar.querySelector('[data-tp-prep]')?.addEventListener('click', async () => {
    const pp = tp.pp, [tt, id] = pp.trig.split(':');
    const trigger = tt === 'within-short' ? { type: 'within', range: 'short' } : tt === 'within-arms' ? { type: 'within', range: 'arms' } : tt === 'moves' || tt === 'attacks' ? { type: tt, enemy: id } : tt === 'ally' ? { type: 'allyAttacked' } : { type: 'custom', text: pp.text };
    const hold = { kind: pp.kind, weapon: pp.weapon, range: pp.range, ammo: pp.ammo, aim: pp.aim, grit: pp.grit, gear: pp.gear, ability: pp.ab, text: pp.itext, skill: pp.skill, trigger };
    const r = await tpAct({ ...base, op: 'prepare', hold });
    if (r) { tp.open = ''; toast(`Holding ${r.label} — when ${r.when}.`); }
  });
  wireHolds(bar);
  wireFs(bar);
  bar.querySelector('[data-tp-rl]')?.addEventListener('click', async () => {
    const r = await tpAct({ ...base, op: 'relieve', status: tp.rl, dice: tp.rlDice });
    if (r?.dice) rollPopup(r, `${a.name} · Relieve ${tp.rl} · ${r.pool}`);
  });
  bar.querySelectorAll('[data-abp], [data-ab]').forEach((el) => el.addEventListener('change', () => {
    if (el.dataset.abp) { tp.ab = { name: el.value }; el.blur(); renderTurnBar(); return; }
    tp.ab[el.dataset.ab] = el.value;
  }));
  bar.querySelector('[data-tp-ab]')?.addEventListener('click', async () => {
    bar.querySelectorAll('[data-ab]').forEach((el) => { tp.ab[el.dataset.ab] = el.value; });
    const r = await tpAct(abilityBody(a, tp.ab));
    if (r?.dice) rollPopup(r, `${a.name} · ${r.ability} · ${r.pool}`);
    if (r) toast(`${r.ability}${r.extra ? ` — ${r.extra}` : ''}`);
  });
}

function wireAttack(box, sel) {
  if (!sel) return;
  const s = atkSel[sel.id] ||= {};
  box.querySelectorAll('[data-as]').forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.as;
    s[k] = k === 'aim' ? el.checked : (k === 'w' || k === 'a' || k === 'cover') ? Number(el.value) : el.value;
    el.blur();
    renderTurnBar();
  }));
  box.querySelector('[data-map-attack]')?.addEventListener('click', async () => {
    const tgt = data.tokens.find((t) => t.id === s.t);
    const bandKey = WEAPON_KEY[band(dist(sel, tgt))];
    const r = await combatAct({ action: 'pc', id: sel.ref, op: 'attack', weapon: s.w, range: bandKey, target: tgt.ref, ammo: s.ammo, aim: s.aim });
    if (r?.dice) {
      play(weaponSound(combat?.posse.find((p) => p.id === sel.ref)?.weapons[s.w]));
      s.aim = false;
      await rollPopup(r, `${sel.name} → ${r.target} · ${r.pool}`);
      toast(`${r.dmg ? `${r.dmg} damage to ${r.target}` : `${r.target} shrugs it off`} (${r.hits} Hits − ${r.def} Defense)${r.down ? ' — it’s down!' : ''}`, !r.dmg);
      poller?.now?.();
    }
  });
  box.querySelector('[data-map-eattack]')?.addEventListener('click', async () => {
    const tgt = data.tokens.find((t) => t.id === s.t);
    let r;
    try { const res = await api('POST', { action: 'enemyAttack', enemy: sel.ref, attack: s.a, pc: tgt.ref, cover: s.cover || 0 }, '', '/api/combat'); combat = res.state || combat; r = res.result; }
    catch (err) {
      if (!/^OUT_OF_RANGE: /.test(err.message)) { toast(err.message, true); return; }
      if (!await ask(`${err.message.slice(14)}\n\nRoll it anyway?`)) return;
      r = await combatAct({ action: 'enemyAttack', enemy: sel.ref, attack: s.a, pc: tgt.ref, cover: s.cover || 0, force: true });
    }
    if (r?.atk?.dice) { play(/range|shoot|spit|throw/i.test(r.atk.label) ? 'gun' : 'swing'); rollPopup(r.atk, `${r.atk.label} · ${r.atk.pool}`); }
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
  $('#show-hp').checked = !!combat?.settings?.showEnemyHealth;
  renderFsWarden();
}

function render() {
  if (dragging) return; // don't yank a token out from under a drag
  renderStage();
  renderFields();
  renderRanges();
  renderTokens();
  renderPings();
  renderPanel();
  renderWarden();
  if (combat) renderTurnBar(); // quick moves and ranges need the token positions
}
function select(id) { selected = id; selFs = null; renderRanges(); renderTokens(); renderPanel(); if (warden && data) renderFsWarden(); }

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
    ro.style.left = `${e.clientX}px`; ro.style.top = `${e.clientY}px`;
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
$('#show-hp').addEventListener('change', (e) => combatAct({ action: 'setting', key: 'showEnemyHealth', value: e.target.checked }));
$('#clear-enemies').addEventListener('click', async () => { if (await ask('Remove every enemy from the fight?', { ok: 'Remove them all' })) { await combatAct({ action: 'clearEnemies' }); poller?.now?.(); } });
$('#sync').addEventListener('click', () => act({ action: 'syncCombat', hidden: $('#sync-hidden').checked }, 'Tokens added.'));
$('#npc-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#npc-name').value.trim();
  if (!name) return;
  if (await act({ action: 'addToken', kind: 'npc', name })) $('#npc-name').value = '';
});
$('#clear').addEventListener('click', async () => { if (await ask('Remove every token from the board?')) { selected = null; act({ action: 'clearTokens' }); } });

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

// ---------- Forstalls (pp. 81–87): Range fields, Sweep, memory slots, Burst, Edison's Rule 1 ----------
let kzPosse = [], kzAll = [], selFs = null, fieldsKey = '';
const fsOf = (key) => data?.forstalls?.find((f) => f.key === key) || null;
const clashKeys = () => new Set((data?.edison || []).flat());
// What a slot can be programmed with: decoded monsters for the posse, every monster for the Warden.
async function loadKz() {
  // a character's Forstall: only what the posse has fully decoded. The Warden's own Forstalls: any monster.
  const byName = (a, b) => a.name.localeCompare(b.name);
  try { kzPosse = ((await api('GET', null, '?view=player', '/api/scan')).notebook || []).filter((e) => e.solved).map((e) => ({ name: e.name, kz: e.kz })).sort(byName); } catch { kzPosse = []; }
  try { kzAll = warden ? ((await api('GET', null, '?view=warden', '/api/scan')).monsters || []).map((m) => ({ name: m.name, kz: m.kz })).sort(byName) : []; } catch { kzAll = []; }
}
function renderFields() {
  const svg = $('#fields');
  const fs = data.forstalls || [], clash = clashKeys();
  const key = JSON.stringify([fs.map((f) => [f.key, f.pos, f.rangeIn, !!f.sweep]), [...clash], data.map.w, data.map.h, data.grid]);
  if (key === fieldsKey) return;
  fieldsKey = key;
  svg.setAttribute('width', data.map.w); svg.setAttribute('height', data.map.h);
  svg.innerHTML = fs.map((f) => {
    const cls = `fs-field${f.sweep ? ' on' : ''}${clash.has(f.key) ? ' clash' : ''}`;
    if (f.rangeIn >= 999) return `<rect class="${cls} whole" x="8" y="8" width="${data.map.w - 16}" height="${data.map.h - 16}"/>`;
    let d = '';
    const r = f.rangeIn;
    for (let row = Math.max(0, f.pos.row - r); row <= Math.min(data.size.rows - 1, f.pos.row + r); row++) {
      for (let col = Math.max(0, f.pos.col - r - 1); col <= Math.min(data.size.cols - 1, f.pos.col + r + 1); col++) {
        if (dist(f.pos, { col, row }) <= r) d += hexPath(col, row);
      }
    }
    return `<path class="${cls}" d="${d}"/>`;
  }).join('');
}
// the Warden's free-standing Forstalls, drawn with the tokens
function fsMarkers() {
  const size = data.grid.ppi * 0.66, labFont = data.grid.ppi * 0.2, clash = clashKeys();
  return (data.forstalls || []).filter((f) => !f.owner).map((f) => {
    const c = center(f.pos.col, f.pos.row);
    return `<div class="fstoken${f.sweep ? ' on' : ''}${clash.has(f.key) ? ' clash' : ''}${selFs === f.key ? ' sel' : ''}${f.hidden ? ' hidden-tok' : ''}${warden ? ' movable' : ''}" data-fs="${esc(f.key)}"
      style="left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;font-size:${size * 0.62}px" title="${esc(f.name)} · ${esc(f.range)} Range">${gl('forstall')}
      <span class="lab" style="font-size:${labFont}px">${esc(f.name)}${f.sweep ? ` · Sweep ${f.sweep.hits}` : ''}</span></div>`;
  }).join('');
}
function slotOptions(cur, list) {
  const opts = list.map((o) => `${o.name} · ${o.kz}`);
  if (cur && !opts.includes(cur)) opts.unshift(cur);
  return `<option value="">— empty —</option>${opts.map((v) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('')}`
    + (list.length ? '' : '<option value="" disabled>Nothing decoded yet — use the Forstall Scanner</option>');
}
function forstallCard(f) {
  const may = warden || (f.owner && myId() === f.owner);
  const fight = combat?.combat?.active;
  const clashWith = (data.edison || []).filter((p) => p.includes(f.key)).map((p) => fsOf(p.find((k) => k !== f.key))?.name).filter(Boolean);
  const cost = f.owner ? `${fight ? `${f.grit} Grit · ` : ''}1 charge` : 'Warden';
  return `<div class="fs-card${f.sweep ? ' on' : ''}">
    <div class="fs-head"><span class="fs-ic">${gl('forstall')}</span><div><b>${esc(f.name)}</b><small>${esc(f.range)} Range${f.rangeIn < 999 ? ` (${f.rangeIn}″)` : ''} · Sweep ${esc(f.pool)}${data.cave ? ' −1 (cave)' : ''}${f.charges != null ? ` · ${f.charges} charge${f.charges === 1 ? '' : 's'} left` : ''}${f.ownerName ? ` · ${esc(f.ownerName)}` : ''}</small></div></div>
    <p class="fs-state">${f.sweep ? `<b>Sweeping · ${f.sweep.hits} Hit${f.sweep.hits === 1 ? '' : 's'}.</b> Monsters in Range lose that much Grit when their turn starts or they come into Range (+1 for programmed frequencies, minus their Sweep Tolerance).` : 'Switched off.'}</p>
    ${f.jammed ? `<p class="fs-warn">${gl('flash')} Scrambled by a Natural EMP — no Scan or Burst until the monster’s next turn.</p>` : ''}
    ${f.pulse ? `<p class="fs-state">${gl('heart')} <b>Heartbeat Sensor:</b> ${f.pulse.count ? `${f.pulse.count} monster${f.pulse.count === 1 ? '' : 's'} within ${f.rangeIn + 6}″ — the nearest is ${f.pulse.nearest}″ away.` : `quiet — nothing within ${f.rangeIn + 6}″.`}</p>` : ''}
    ${clashWith.length ? `<p class="fs-warn">${gl('flash')} Edison’s Rule 1: its waves cross ${esc(clashWith.join(' and '))}’s.</p>` : ''}
    ${may ? `<div class="fs-btns"><button type="button" class="btn small" data-fs-sweep="${esc(f.key)}"${f.owner && !f.charges ? ' disabled' : ''}>${gl('forstall')} ${f.sweep ? 'Readjust' : 'Sweep'} · ${cost}</button>
        ${f.sweep ? `<button type="button" class="btn small secondary" data-fs-off="${esc(f.key)}">Switch off</button>` : ''}</div>
      ${f.efficiency != null ? `<label class="check fs-eff"><input type="checkbox" data-fs-eff="${esc(f.key)}"${f.efficiency < 1 ? ' disabled' : ''}> Forstall Efficiency — turn one Hit into an Ace (${f.efficiency}/2 left today)</label>` : ''}
      <div class="fs-slots"><span>MEMORY SLOTS</span>${[0, 1, 2, 3].map((i) => `<select data-fs-slot="${esc(f.key)}" data-i="${i}" aria-label="Memory slot ${i + 1}">${slotOptions(f.slots[i] || '', f.owner ? kzPosse : kzAll)}</select>`).join('')}</div>
      ${f.fuse ? (f.burst?.length ? `<div class="fs-burst"><select data-fs-bt="${esc(f.key)}" aria-label="Burst target">${f.burst.map((b) => `<option value="${esc(b.ref)}">${esc(b.name)}</option>`).join('')}</select>
          <button type="button" class="btn small danger" data-fs-burst="${esc(f.key)}">${gl('flash')} Burst${f.owner ? ' · 1 crystal' : ''}</button></div>`
        : '<p class="muted fs-note">Burst: no programmed monster in Range.</p>')
        : f.owner ? '<p class="muted fs-note">Add a Crystal Burst Fuse upgrade to Burst.</p>' : ''}` : ''}
  </div>`;
}
async function fsAct(body) {
  try {
    const res = await api('POST', body, '', '/api/combat');
    combat = res.state || combat; combatPoller?.now?.(); poller?.now?.();
    return res.result ?? true;
  } catch (e) {
    if (!/^EDISON: /.test(e.message)) { toast(e.message, true); return null; }
    if (!await ask(`Edison’s Rule 1\n\n${e.message.slice(8)}`, { ok: 'Do it anyway', danger: true })) return null;
    return fsAct({ ...body, force: true });
  }
}
function wireFs(box) {
  box.querySelectorAll('[data-fs-sweep]').forEach((b) => b.addEventListener('click', async () => {
    const eff = box.querySelector(`[data-fs-eff="${CSS.escape(b.dataset.fsSweep)}"]`)?.checked;
    play('forstall');
    const r = await fsAct({ action: 'forstall', op: 'sweep', key: b.dataset.fsSweep, efficiency: !!eff });
    if (r?.melted) play('zap');
    if (r?.dice) { await rollPopup(r, `${r.label} · ${r.pool}`); toast(`Sweep ${r.hits} — monsters in Range lose ${r.hits} Grit at their turn (+1 if programmed).`); }
    else if (r?.melted) toast('The waves crossed — sparks, Electrocuted, batteries melted.', true);
  }));
  box.querySelectorAll('[data-fs-off]').forEach((b) => b.addEventListener('click', () => fsAct({ action: 'forstall', op: 'off', key: b.dataset.fsOff })));
  box.querySelectorAll('[data-fs-slot]').forEach((el) => el.addEventListener('change', async () => {
    const f = fsOf(el.dataset.fsSlot), i = Number(el.dataset.i);
    el.blur();
    if (!f) return;
    if (el.value && f.slots.some((v, k) => k !== i && v === el.value)) { toast('That frequency is already in another slot.', true); el.value = f.slots[i] || ''; return; }
    if (f.owner) {
      try { await api('POST', { action: 'sheet', id: f.owner, path: `forstall.kz.${i}`, value: el.value }, '', '/api/combat'); combatPoller?.now?.(); poller?.now?.(); toast(el.value ? `Programmed ${el.value.split(' · ')[0]}.` : 'Slot cleared.'); }
      catch (e) { toast(e.message, true); }
    } else {
      const slots = [...f.slots]; slots[i] = el.value;
      act({ action: 'editForstall', id: f.key, slots }, el.value ? `Programmed ${el.value.split(' · ')[0]}.` : 'Slot cleared.');
    }
  }));
  box.querySelectorAll('[data-fs-burst]').forEach((b) => b.addEventListener('click', async () => {
    const f = fsOf(b.dataset.fsBurst), sel = box.querySelector(`[data-fs-bt="${CSS.escape(b.dataset.fsBurst)}"]`);
    const tgt = f?.burst.find((x) => x.ref === sel?.value);
    if (!tgt || !await ask(`Burst ${f.name} on the ${tgt.name}’s frequency?\n\nThe crystal shatters and the monster flees for at least two hours.`, { ok: 'Burst', danger: true })) return;
    const r = await fsAct({ action: 'forstall', op: 'burst', key: f.key, enemy: tgt.ref });
    if (r?.fled) play('explosion');
    if (r?.fled) toast(`${r.fled} flees!`);
  }));
}
function renderFsWarden() {
  const list = $('#fs-list');
  if (document.activeElement?.id !== 'fs-cave') $('#fs-cave').checked = !!data.cave;
  const mine = (data.forstalls || []).filter((f) => !f.owner), carried = (data.forstalls || []).filter((f) => f.owner);
  const pairs = (data.edison || []).map(([a, b]) => [fsOf(a), fsOf(b)]).filter(([a, b]) => a && b);
  list.innerHTML = `${pairs.map(([a, b]) => `<div class="fs-warn">${gl('flash')} <b>${esc(a.name)}</b> and <b>${esc(b.name)}</b> are Sweeping in each other’s Range.
      <button type="button" class="btn small danger" data-edison="${esc(a.key)}|${esc(b.key)}">Apply Rule 1</button></div>`).join('')}
    ${[...mine, ...carried].map((f) => `<div class="tok-row fs-row${selFs === f.key ? ' sel' : ''}" data-fs-pick="${esc(f.key)}"><span class="chip fs-chip${f.sweep ? ' on' : ''}">${gl('forstall')}</span>
      <span class="n">${esc(f.name)}<small>${f.owner ? `carried by ${esc(f.ownerName)}` : esc(f.range)}${f.sweep ? ` · Sweep ${f.sweep.hits}` : ''}</small></span>
      ${f.owner ? '' : `<button type="button" data-fs-hide="${esc(f.key)}">${f.hidden ? 'Reveal' : 'Hide'}</button><button aria-label="Remove this Forstall" type="button" data-fs-rm="${esc(f.key)}">✕</button>`}</div>`).join('')
    || '<p class="muted">No Forstalls on the board. A character’s own Forstall appears on their token.</p>'}`;
  list.querySelectorAll('[data-edison]').forEach((b) => b.addEventListener('click', async () => {
    if (!await ask('Apply Edison’s Rule 1? Everyone within Short Range of either Forstall is Electrocuted [6], and both batteries melt.', { ok: 'Apply', danger: true })) return;
    fsAct({ action: 'forstall', op: 'edison', keys: b.dataset.edison.split('|') });
  }));
  list.querySelectorAll('[data-fs-pick]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const f = fsOf(el.dataset.fsPick);
    if (!f) return;
    if (f.owner) select(f.tokenId); else selectFs(f.key);
    const c = center(f.pos.col, f.pos.row); pz.centerOn(c.x, c.y, Math.max(pz.view.s, 0.35));
  }));
  list.querySelectorAll('[data-fs-hide]').forEach((b) => b.addEventListener('click', () => act({ action: 'editForstall', id: b.dataset.fsHide, hidden: !fsOf(b.dataset.fsHide)?.hidden })));
  list.querySelectorAll('[data-fs-rm]').forEach((b) => b.addEventListener('click', async () => {
    if (!await ask(`Remove ${fsOf(b.dataset.fsRm)?.name || 'this Forstall'} from the board?`)) return;
    if (selFs === b.dataset.fsRm) selFs = null;
    act({ action: 'removeForstall', id: b.dataset.fsRm });
  }));
}
function selectFs(key) { selFs = key; selected = null; renderRanges(); renderTokens(); renderPanel(); if (warden) renderFsWarden(); }
// dragging a Warden Forstall around the board
function wireFsMarker(el) {
  const key = el.dataset.fs;
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!warden) { selectFs(key); return; }
    const f = fsOf(key); if (!f) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    const c = center(f.pos.col, f.pos.row);
    drag = { cx: e.clientX, cy: e.clientY, x: c.x, y: c.y, moved: false, hex: { ...f.pos } };
    dragging = { id: key };
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.cx) + Math.abs(e.clientY - drag.cy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const dx = (e.clientX - drag.cx) / pz.view.s, dy = (e.clientY - drag.cy) / pz.view.s;
    el.style.left = `${drag.x + dx}px`; el.style.top = `${drag.y + dy}px`;
    drag.hex = toHex(drag.x + dx, drag.y + dy);
  });
  const end = async () => {
    if (!drag) return;
    const d = drag; drag = null; dragging = null;
    if (!d.moved) { selectFs(key); return; }
    const f = fsOf(key);
    if (f) f.pos = d.hex;
    fieldsKey = '';
    render();
    await act({ action: 'moveForstall', id: key, ...d.hex });
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
$('#fs-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const sel = selected && data.tokens.find((t) => t.id === selected);
  const f = await act({ action: 'addForstall', kind: $('#fs-kind').value, name: $('#fs-name').value.trim(), ...(sel ? { col: sel.col, row: sel.row } : {}) }, 'Forstall placed — drag it where you want it.');
  if (f?.id) { $('#fs-name').value = ''; selFs = f.id; }
});
$('#fs-cave').addEventListener('change', (e) => act({ action: 'cave', value: e.target.checked }, e.target.checked ? 'Cave: Sweeps roll 1 fewer die.' : 'Out of the cave.'));

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
    if (selFs && !fsOf(selFs)) selFs = null;
    render();
  }, (ok, e) => { if (e?.status === 401) { warden = false; forgetWarden(); setWarden(); connect(); } }, EP);
}
function setWarden() {
  $('#warden-btn').innerHTML = `${gl('star')} ${warden ? 'Warden mode · lock' : 'Warden'}`;
  if (data) render();
}
$('#warden-btn').addEventListener('click', async () => {
  if (warden) { warden = false; forgetWarden(); }
  else if (!(warden = await wardenModal(EP))) return;
  setWarden(); connect(); loadKz();
});

(async () => {
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWarden();
  connect();
  loadKz();
})();
