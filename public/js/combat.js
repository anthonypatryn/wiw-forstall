import {
  $, esc, api, startPolling, injectDefs, bulletSVG, animateRoll, staticDice, toast, store, timeAgo,
  mountNav, tryWarden, forgetWarden, savedPin, poolHTML, readPool,
} from './common.js';
import { renderLogInto } from './tablelog.js';

const EP = '/api/combat';
injectDefs();
mountNav('/combat');
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = bulletSVG(el.dataset.icon, 'hit'); });

let data = null;
let meta = null;
let warden = false;
let poller = null;
let pendingRender = false;
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Titan'];

async function act(body, okMsg) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (okMsg) toast(okMsg);
    return res.result;
  } catch (e) { toast(e.message, true); return null; }
}

// ---------- dice pool parsing (client side, for buttons) ----------
const poolText = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
const isPool = (s) => /^(\d+[BG])+$/.test(poolText(s));
function damagePool(effect) { const m = effect.match(/((?:\d+[BG])+)\s+damage/i); return m ? m[1].toUpperCase() : null; }
function statusPools(effect) { return [...effect.matchAll(/(\w+)\s*\[((?:\d+[BG])+)\]/gi)].map((m) => ({ status: m[1], pool: m[2].toUpperCase() })); }

// ---------- turn banner ----------
function nameOf(key) {
  if (key === 'enemies') return 'The enemies';
  return data.posse.find((p) => p.id === key)?.name || data.enemies.find((e) => e.id === key)?.name || '—';
}

function renderTurn() {
  const c = data.combat;
  const el = $('#turn-card');
  const isEnemyTurn = data.enemies.some((e) => e.id === c.current);
  const slotOfCurrent = isEnemyTurn ? 'enemies' : c.current;

  const orderChips = (c.active ? c.order : [
    ...data.posse.filter((p) => !p.dead).map((p) => ({ key: p.id, name: p.name, hits: c.init[p.id]?.hits ?? null, surprise: c.surprise.includes(p.id) })),
    ...(data.enemies.length ? [{ key: 'enemies', name: 'The enemies', hits: c.init.enemies?.hits ?? null, surprise: c.surprise.includes('enemies') }] : []),
  ]).map((o) => `<span class="slot${o.key === slotOfCurrent ? ' now' : ''}">${esc(o.name)}
      <span class="h">${o.hits === null ? '—' : `${o.hits} hit${o.hits === 1 ? '' : 's'}`}</span>
      ${warden ? `<button type="button" class="${o.surprise ? 'on' : ''}" data-surprise="${o.key}" title="Surprise attackers go first">${o.surprise ? '⚡ SURPRISE' : 'surprise?'}</button>` : (o.surprise ? '<span class="h">⚡ surprise</span>' : '')}
    </span>`).join('');

  if (!c.active) {
    el.innerHTML = `
      <div class="turn-top">
        <div><div class="round">BETWEEN FIGHTS</div><div class="who">Everyone roll with Finesse!<small>Most Hits goes first · ties re-roll · the Warden rolls once for all enemies</small></div></div>
        ${warden ? `<div class="turn-actions">
          ${data.enemies.length ? '<button class="btn small" data-act="enemyInit" type="button">🎲 Roll for the enemies</button>' : ''}
          <button class="btn small go" data-act="start" type="button">⚔ Start combat</button></div>` : ''}
      </div>
      ${orderChips ? `<div class="order">${orderChips}</div>` : '<p class="turn-help">Add characters on the Posse Sheets page to get started.</p>'}
      <p class="turn-help">${warden ? 'Anyone who hasn’t rolled when you start gets rolled for automatically.' : 'Tap “Roll Finesse” on your character card. The Warden starts the fight.'}</p>`;
  } else {
    const cur = data.posse.find((p) => p.id === c.current) || data.enemies.find((e) => e.id === c.current);
    el.innerHTML = `
      <div class="turn-top">
        <div><div class="round">ROUND ${c.round}</div>
          <div class="who">${cur ? `${esc(cur.name)}’s turn` : 'Nobody left standing'}<small>${isEnemyTurn ? 'The enemies act in sequence' : 'Grit reloaded to 6'}</small></div></div>
        ${warden ? `<div class="turn-actions">
          <button class="btn small go" data-act="next" type="button">Next turn ▶</button>
          <button class="btn small" data-act="end" type="button">End combat</button></div>` : ''}
      </div>
      <div class="order">${orderChips}</div>`;
  }
  el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.act;
    if (k === 'end' && !confirm('End combat? Turn order will be cleared.')) return;
    act({ action: k === 'enemyInit' ? 'enemyInitiative' : k });
  }));
  el.querySelectorAll('[data-surprise]').forEach((b) => b.addEventListener('click', () => act({ action: 'surprise', key: b.dataset.surprise })));
}

// ---------- shared card bits ----------
function hpHTML(f, editable) {
  const pct = Math.max(0, Math.min(100, (f.health / Math.max(1, f.maxHealth)) * 100));
  return `<div class="hp"><span class="lbl">HEALTH</span><span class="bar"><i style="width:${pct}%"></i></span>
    <span class="num">${f.health}/${f.maxHealth}</span>
    ${editable ? `<span class="pm"><button type="button" data-hp="-1" aria-label="Lose 1 Health">−</button><button type="button" data-hp="1" aria-label="Gain 1 Health">+</button></span>
    <input type="number" data-hpn placeholder="±" title="Type damage (−5) or healing (3), then Enter" aria-label="Change Health by">` : ''}</div>`;
}
function gritHTML(f, editable) {
  const max = Math.max(6, f.grit);
  return `<div class="row2"><span class="lbl">GRIT</span><span class="pips">${Array.from({ length: max }, (_, i) =>
    `<button type="button" class="pip${i < f.grit ? ' on' : ''}" ${editable ? `data-grit="${i + 1}"` : 'disabled'} aria-label="${i + 1} Grit"></button>`).join('')}</span>
    <span class="muted" style="font-size:14px">${f.grit} left</span></div>`;
}
function statusesHTML(f, editable) {
  const list = Object.entries(f.statuses || {});
  const tip = (s) => esc(`${s} (relieve with ${meta.statuses[s].skill}): ${meta.statuses[s].text}`);
  const chips = list.map(([s, v]) => `<span class="st" title="${tip(s)}">${s} <b>${v}</b>${editable
    ? `<button type="button" data-st="${s}" data-v="${v - 1}" aria-label="Lower ${s}">−</button><button type="button" data-st="${s}" data-v="${v + 1}" aria-label="Raise ${s}">+</button>` : ''}</span>`).join('');
  const add = editable ? `<select class="st-add" data-st-add aria-label="Add a Status"><option value="">+ Status…</option>${
    Object.keys(meta.statuses).filter((s) => !f.statuses?.[s]).map((s) => `<option>${s}</option>`).join('')}</select>` : '';
  return (chips || add) ? `<div class="statuses">${chips}${add}</div>` : '';
}
function wireCommon(card, send) {
  card.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', () => send({ op: 'health', delta: Number(b.dataset.hp) })));
  card.querySelector('[data-hpn]')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.value) return;
    send({ op: 'health', delta: Number(e.target.value) });
    e.target.value = '';
  });
  card.querySelectorAll('[data-grit]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.grit);
    send({ op: 'grit', value: b.classList.contains('on') && !b.nextElementSibling?.classList.contains('on') ? n - 1 : n });
  }));
  card.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => send({ op: 'status', status: b.dataset.st, value: Number(b.dataset.v) })));
  card.querySelector('[data-st-add]')?.addEventListener('change', (e) => { if (e.target.value) send({ op: 'status', status: e.target.value, value: 1 }); });
}

// ---------- posse ----------
function pcCard(p) {
  const c = data.combat;
  const t = meta.trades[p.trade];
  const now = c.current === p.id;
  const init = c.init[p.id];
  const hasQuickDraw = p.abilities?.includes('Quick-Draw');
  const aces = t.aces.filter((_, i) => i === 0 || p.aceTwo);
  return `<article class="fighter${now ? ' now' : ''}${p.dead ? ' down' : ''}" data-pc="${p.id}">
    <div class="f-head">
      <div><div class="f-name"><a href="/posse#${p.id}">${esc(p.name)}</a></div>
        <div class="f-sub">The ${esc(p.trade)} · Finesse ${esc(p.skills.finesse)}${p.talents?.includes('Finesse') ? ' ↻' : ''}</div></div>
      ${now ? '<span class="f-tag now">THEIR TURN</span>' : p.dead ? '<span class="f-tag red">FALLEN</span>' : p.bleeding ? '<span class="f-tag red">BLEEDING OUT</span>' : ''}
    </div>
    ${hpHTML(p, !p.dead)}
    ${p.dead ? '' : gritHTML(p, true)}
    ${p.dead ? '' : `<div class="row2"><span class="lbl">ACES</span><span class="pips">${Array.from({ length: 6 }, (_, i) =>
      `<button type="button" class="pip ace${i < p.aces ? ' on' : ''}" data-aces="${i + 1}" aria-label="${i + 1} Aces"></button>`).join('')}</span></div>`}
    ${p.aces >= 6 && !p.dead ? `<div class="ace-ready"><b>ACE-IN-THE-HOLE READY</b> — ${aces.map((a) => `<b>${esc(a.name)}</b>: ${esc(a.text)}`).join('<br>')}
      <div style="margin-top:6px"><button class="btn small" data-ace-use type="button">Play it (reset meter)</button></div></div>` : ''}
    ${p.dead ? '' : statusesHTML(p, true)}
    ${p.bleeding ? `<div class="bleed"><b>BLEEDING OUT</b> — at the end of each ally’s turn, roll a different Skill and get at least one Hit. Miss once, or run out of Skills, and it’s over.
      <div class="skills">${meta.skills.map((s) => `<button type="button" class="${p.bleeding.skills.includes(s) ? 'done' : ''}" data-bleed="${s}">${s}</button>`).join('')}</div>
      <button class="btn small" data-op="stabilize" type="button">Saved by First Aid</button> <button class="btn small danger" data-op="die" type="button">Didn’t make it</button></div>` : ''}
    <div class="f-actions">
      ${!p.dead ? `<button class="btn small secondary" data-init type="button">🎲 Finesse${init ? ` · ${init.hits} hit${init.hits === 1 ? '' : 's'}` : ' (turn order)'}</button>` : ''}
      ${hasQuickDraw && !p.dead ? '<label class="check" style="font-size:14px"><input type="checkbox" data-qd> Quick-Draw +2B</label>' : ''}
      ${!p.dead && now ? `<button class="btn small secondary" data-op="fool" type="button" ${p.foolUsed ? 'disabled' : ''} title="Once per turn: +1 Grit for 1 Health">Fool’s Grit</button>` : ''}
      ${p.dead && warden ? '<button class="btn small secondary" data-op="revive" type="button">Revive</button>' : ''}
    </div>
  </article>`;
}

function renderPosse() {
  const box = $('#posse');
  if (!data.posse.length) { box.innerHTML = '<p class="empty-note">No characters yet — <a href="/posse">make one on the Posse Sheets page</a>.</p>'; return; }
  box.innerHTML = data.posse.map(pcCard).join('');
  box.querySelectorAll('[data-pc]').forEach((card) => {
    const pid = card.dataset.pc;
    const send = (o) => act({ action: 'pc', id: pid, ...o });
    wireCommon(card, send);
    card.querySelectorAll('[data-aces]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.aces);
      send({ op: 'aces', value: b.classList.contains('on') && !b.nextElementSibling?.classList.contains('on') ? n - 1 : n });
    }));
    card.querySelector('[data-ace-use]')?.addEventListener('click', () => send({ op: 'aces', value: 0, used: true }));
    card.querySelectorAll('[data-bleed]').forEach((b) => b.addEventListener('click', () => send({ op: 'bleedSkill', skill: b.dataset.bleed })));
    card.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.op === 'die' && !confirm('Mark this character as dead?')) return;
      send({ op: b.dataset.op });
    }));
    card.querySelector('[data-init]')?.addEventListener('click', () => {
      act({ action: 'initiative', id: pid, bonus: card.querySelector('[data-qd]')?.checked ? '2B' : '' });
    });
  });
}

// ---------- enemies ----------
function enemyCard(e) {
  const c = data.combat;
  const now = c.current === e.id;
  const tags = `${now ? '<span class="f-tag now">ITS TURN</span>' : ''}${e.defeated ? '<span class="f-tag">DOWN</span>' : ''}${(warden ? e.frenzied.length : e.frenzied) ? '<span class="f-tag red">FRENZIED</span>' : ''}`;
  const frenzied = warden ? e.frenzied.length > 0 : e.frenzied;
  if (!warden) {
    return `<article class="fighter${now ? ' now' : ''}${e.defeated ? ' down' : ''}${frenzied ? ' frenzied' : ''}">
      <div class="f-head"><div><div class="f-name">${esc(e.name)}</div><div class="f-sub">${esc(e.size)}</div></div><div>${tags}</div></div>
      ${e.health !== undefined ? hpHTML(e, false) : ''}
      ${statusesHTML(e, false)}
    </article>`;
  }
  const p = e.profile ? data.profiles[e.profile] : null;
  const skills = Object.entries(e.skills || {}).filter(([, v]) => isPool(v));
  return `<article class="fighter${now ? ' now' : ''}${e.defeated ? ' down' : ''}${frenzied ? ' frenzied' : ''}" data-enemy="${e.id}">
    <div class="f-head"><div><div class="f-name">${esc(e.name)}</div><div class="f-sub">${esc(e.size)}${p ? ` · p. ${p.page}` : ' · custom'}</div></div><div>${tags}</div></div>
    ${hpHTML(e, true)}
    ${gritHTML(e, true)}
    <div class="e-stats">
      <div>DEFENSE<b>${isPool(e.defense) ? `<button type="button" data-rollpool="${esc(poolText(e.defense))}" data-label="Defense">${esc(e.defense)}</button>` : esc(e.defense || '—')}</b></div>
      <div>SPEED<b>${esc(e.speed || '—')}</b></div>
      <div>SIZE<b>${esc(e.size)}</b></div>
      ${skills.map(([k, v]) => `<div>${k.toUpperCase()}<b><button type="button" data-rollpool="${esc(poolText(v))}" data-label="${esc(k[0].toUpperCase() + k.slice(1))}">${esc(v)}</button></b></div>`).join('')}
    </div>
    ${statusesHTML(e, true)}
    ${p ? `<div class="attacks">${p.attacks.map((a) => {
      const dmg = damagePool(a.effect);
      return `<div class="atk"><span class="an">${esc(a.name)}<small>${a.range.toUpperCase()}${a.aoe ? ' · AOE' : ''} · ${a.grit} GRIT</small></span>
        <span class="rolls">${dmg ? `<button type="button" data-rollpool="${dmg}" data-label="${esc(a.name)} — damage">${dmg}</button>` : ''}${
          statusPools(a.effect).map((s) => `<button type="button" class="st-roll" data-rollpool="${s.pool}" data-label="${esc(a.name)} — ${esc(s.status)}">${esc(s.status)} ${s.pool}</button>`).join('')}</span>
        <span class="ae">${esc(a.effect)}</span></div>`;
    }).join('')}</div>
    <div>${p.frenzy.map((f) => `<div class="frenzy-row${e.frenzied.includes(f.name) ? ' hit' : ''}"><b>${esc(f.name)}</b> ${f.event ? '(Event) ' : ''}at ${f.health} Health${e.frenzied.includes(f.name) ? ' — <b>ACTIVE</b>' : ''}<br>${esc(f.text)}</div>`).join('')}</div>
    <details class="more"><summary>Features &amp; tolerances</summary>${p.features.map((f) => `<p>${esc(f)}</p>`).join('')}<p><b>Tolerances:</b> ${esc(p.tolerances)}</p></details>` : ''}
    <div class="f-actions">
      <label class="check" style="font-size:14px"><input type="checkbox" data-secret> Secret rolls</label>
      <button class="btn small secondary danger" data-remove type="button">Remove</button>
    </div>
  </article>`;
}

function renderEnemies() {
  const box = $('#enemies');
  $('#enemy-tools').hidden = !warden;
  if (!data.enemies.length) box.innerHTML = `<p class="empty-note">${warden ? 'Add monsters or outlaws above.' : 'No enemies in sight… yet.'}</p>`;
  else box.innerHTML = data.enemies.map(enemyCard).join('');
  if (!warden) return;
  box.querySelectorAll('[data-enemy]').forEach((card) => {
    const eid = card.dataset.enemy;
    const send = (o) => act({ action: 'enemy', id: eid, ...o });
    wireCommon(card, send);
    card.querySelectorAll('[data-rollpool]').forEach((b) => b.addEventListener('click', () =>
      doRoll({ pool: b.dataset.rollpool, who: eid, label: b.dataset.label, hidden: card.querySelector('[data-secret]').checked })));
    card.querySelector('[data-remove]').addEventListener('click', () => { if (confirm('Remove this enemy?')) send({ op: 'remove' }); });
  });
}

function renderEnemyTools() {
  const box = $('#enemy-tools');
  if (!warden || box.dataset.ready) return;
  box.dataset.ready = '1';
  const groups = {};
  data.catalog.forEach((m) => (groups[m.size] ||= []).push(m));
  box.innerHTML = `
    <div class="add-enemy">
      <select id="add-monster" aria-label="Monster">${SIZES.filter((s) => groups[s]).map((s) => `<optgroup label="${s}">${
        groups[s].map((m) => `<option value="${esc(m.name)}">${esc(m.name)} · ${m.health} Health</option>`).join('')}</optgroup>`).join('')}</select>
      <input type="number" id="add-count" min="1" max="8" value="1" aria-label="How many">
      <button class="btn small" id="add-monster-btn" type="button">+ Add monster</button>
    </div>
    <div class="custom-enemy">
      <input id="ce-name" placeholder="Outlaw, bandit…" aria-label="Name">
      <input id="ce-hp" type="number" min="1" placeholder="Health" aria-label="Health">
      <div class="ce-pool"><span>DEFENSE</span>${poolHTML('id="ce-def"', 'Defense')}</div>
      <div class="ce-pool"><span>FINESSE</span>${poolHTML('id="ce-fin"', 'Finesse')}</div>
      <button class="btn small secondary" id="ce-add" type="button">+ Custom</button>
    </div>
    <div class="opts" style="margin:-4px 0 14px">
      <label class="check"><input type="checkbox" id="show-hp"> Show enemy Health to the posse</label>
      <button class="btn small secondary danger" id="clear-enemies" type="button">Clear all enemies</button>
    </div>`;
  $('#add-monster-btn').addEventListener('click', () => act({ action: 'addEnemy', profile: $('#add-monster').value, count: $('#add-count').value }));
  $('#ce-add').addEventListener('click', async () => {
    const ok = await act({ action: 'addEnemy', name: $('#ce-name').value, health: $('#ce-hp').value, defense: readPool($('#ce-def')) || '—', finesse: readPool($('#ce-fin')) || '1B', size: 'Human' });
    if (ok !== null) { $('#ce-name').value = ''; $('#ce-hp').value = ''; document.querySelectorAll('.custom-enemy .dp input').forEach((i) => { i.value = ''; }); }
  });
  $('#show-hp').addEventListener('change', (e) => act({ action: 'setting', key: 'showEnemyHealth', value: e.target.checked }));
  $('#clear-enemies').addEventListener('click', () => { if (confirm('Remove every enemy?')) act({ action: 'clearEnemies' }); });
}

// ---------- dice roller ----------
const pool = { B: store.get('wiw.rollB', 2), G: store.get('wiw.rollG', 0) };
function renderPoolCtl() {
  $('#rb').textContent = pool.B; $('#rg').textContent = pool.G;
  $('#roll-pool').textContent = `${pool.B ? pool.B + 'B' : ''}${pool.G ? pool.G + 'G' : ''}` || '—';
}
document.querySelectorAll('.mini-step').forEach((s) => s.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  const c = s.dataset.color;
  pool[c] = Math.max(0, Math.min(12, pool[c] + Number(b.dataset.d)));
  store.set('wiw.roll' + c, pool[c]);
  renderPoolCtl();
})));
renderPoolCtl();

function renderRollAs() {
  const sel = $('#roll-as');
  const cur = sel.value || store.get('wiw.rollAs', '');
  sel.innerHTML = '<option value="">— nobody in particular —</option>'
    + data.posse.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')
    + (warden ? '<option value="warden">The Warden</option>' + data.enemies.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('') : '');
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : '';
  $('#hidden-wrap').hidden = !warden;
  $('#clear-log').hidden = !warden;
}
$('#roll-as').addEventListener('change', (e) => {
  store.set('wiw.rollAs', e.target.value);
  const pc = data.posse.find((p) => p.id === e.target.value);
  if (pc) $('#roll-spur').checked = false; // pick the Talent that fits the roll
});

let rolling = false;
async function doRoll(body) {
  if (rolling) return;
  rolling = true;
  const r = await act({ action: 'roll', ...body });
  if (r) {
    await animateRoll($('#tray'), r.dice);
    $('#tally').innerHTML = `<span class="muted">${esc(r.who)} · ${esc(r.pool)}${r.label ? ` · ${esc(r.label)}` : ''}</span>
      <span class="hits">${r.hits} HIT${r.hits === 1 ? '' : 'S'}</span>${r.aces ? `<span class="muted">${r.aces} Ace${r.aces > 1 ? 's' : ''}${r.aceMeter ? ` → meter ${r.aceMeter}/6` : ''}</span>` : ''}${r.hidden ? '<span class="muted">(secret)</span>' : ''}`;
  }
  rolling = false;
}
$('#roll-btn').addEventListener('click', () => doRoll({
  black: pool.B, gold: pool.G, who: $('#roll-as').value, label: $('#roll-label').value,
  spur: $('#roll-spur').checked, hidden: warden && $('#roll-hidden').checked,
}));

// ---------- log ----------
function renderLog() { renderLogInto($('#log'), data.log); }
$('#clear-log').addEventListener('click', () => { if (confirm('Clear the table log?')) act({ action: 'clearLog' }); });

// ---------- render & boot ----------
function render() {
  // Don't yank a dropdown or text box out from under someone mid-edit.
  const f = document.activeElement;
  if (f && f.closest('#posse, #enemies') && /^(SELECT|INPUT)$/.test(f.tagName) && f.type !== 'checkbox') { pendingRender = true; return; }
  pendingRender = false;
  renderTurn();
  renderPosse();
  renderEnemyTools();
  renderEnemies();
  renderRollAs();
  renderLog();
  if (warden && $('#show-hp')) $('#show-hp').checked = !!data.settings.showEnemyHealth;
}
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) render(); }, 60));

function connect() {
  poller?.stop();
  poller = startPolling(warden ? 'warden' : 'player', (d) => { data = d; render(); }, (ok, e) => {
    if (e?.status === 401) { warden = false; forgetWarden(); connect(); return; }
    $('#conn').classList.toggle('off', !ok);
    $('#conn').textContent = ok ? 'Connected' : 'Reconnecting…';
  }, EP);
}

function setWardenBtn() {
  $('#warden-btn').textContent = warden ? '⭐ Warden mode · lock' : '⭐ Warden';
}
$('#warden-btn').addEventListener('click', () => {
  if (warden) { warden = false; forgetWarden(); setWardenBtn(); $('#enemy-tools').dataset.ready = ''; connect(); return; }
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-label="Warden PIN"><h2>Warden PIN</h2>
    <form><input type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" aria-label="PIN"><button class="btn" type="submit">Unlock</button></form>
    <p class="muted" data-msg></p></div>`;
  document.body.appendChild(back);
  const input = back.querySelector('input');
  input.focus();
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  back.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await tryWarden(input.value.trim(), EP)) { warden = true; back.remove(); setWardenBtn(); connect(); toast('Warden mode on.'); }
    else back.querySelector('[data-msg]').textContent = 'Wrong PIN, partner.';
  });
});

(async () => {
  meta = await api('GET', null, '?view=meta', EP);
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWardenBtn();
  connect();
})();
