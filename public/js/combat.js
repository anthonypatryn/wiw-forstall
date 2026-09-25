import {
  $, esc, api, startPolling, injectDefs, bulletSVG, animateRoll, staticDice, toast, store, timeAgo,
  mountNav, tryWarden, forgetWarden, savedPin, poolHTML, readPool, rollPopup, bleedPanel,
} from './common.js';
import { NPC } from './npc-data.js';
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
  // Apply the typed amount on Enter or when leaving the box (whichever comes first).
  const hpn = card.querySelector('[data-hpn]');
  const applyHp = () => { const v = Number(hpn.value); hpn.value = ''; if (v) send({ op: 'health', delta: v }); };
  hpn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyHp(); });
  hpn?.addEventListener('change', applyHp);
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
    ${bleedPanel(p, meta.skills)}
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
    card.querySelectorAll('[data-bleed-roll]').forEach((b) => b.addEventListener('click', async () => {
      const r = await send({ op: 'bleedRoll', skill: b.dataset.bleedRoll });
      if (r?.dice) rollPopup(r, `${r.who} · Bleeding Out · ${b.dataset.bleedRoll} · ${r.pool}${r.outcome === 'dead' ? ' · DIED' : ''}`);
    }));
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
    <div class="f-head"><div><div class="f-name">${esc(e.name)} <button type="button" class="rename" data-rename title="Rename" aria-label="Rename ${esc(e.name)}">✎</button></div><div class="f-sub">${esc(e.size)}${p ? ` · p. ${p.page}${p.name !== e.name ? ` · ${esc(p.name.replace('Human - ', ''))}` : ''}` : ' · custom'}</div></div><div>${tags}</div></div>
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
    ${eaHTML(e, p)}
    <details class="more"><summary>Features &amp; tolerances</summary>${p.features.map((f) => `<p>${esc(f)}</p>`).join('')}<p><b>Tolerances:</b> ${esc(p.tolerances)}</p></details>` : ''}
    ${e.defeated ? lootHTML(e, p) : ''}
    <div class="f-actions">
      <label class="check" style="font-size:14px"><input type="checkbox" data-secret> Secret rolls</label>
      <button class="btn small secondary danger" data-remove type="button">Remove</button>
    </div>
  </article>`;
}

// ---------- enemy attacks a posse member (Warden) ----------
const eaSel = {};
function eaHTML(e, p) {
  if (e.defeated || !p?.attacks?.length) return '';
  const s = eaSel[e.id] ||= { atk: 0, pc: '', cover: 0 };
  const alive = data.posse.filter((x) => !x.dead);
  return `<div class="ea"><b class="loot-h">💥 ATTACK THE POSSE</b>
    <div class="loot-row"><select data-ea="atk" aria-label="Attack">${p.attacks.map((a, i) => `<option value="${i}"${i === s.atk ? ' selected' : ''}>${esc(a.name)} · ${a.range}${a.aoe ? ' · AOE' : ''}</option>`).join('')}</select>
      <select data-ea="pc" aria-label="Target"><option value="">— who? —</option>${alive.map((x) => `<option value="${x.id}"${x.id === s.pc ? ' selected' : ''}>${esc(x.name)}${x.dodge ? ` (🛡${x.dodge})` : ''}</option>`).join('')}</select>
      <select data-ea="cover" aria-label="Cover"><option value="0">no cover</option><option value="1"${s.cover == 1 ? ' selected' : ''}>light cover (+1B)</option><option value="2"${s.cover == 2 ? ' selected' : ''}>heavy cover (+2B)</option></select>
      <button class="btn small" type="button" data-ea-go>Roll it</button></div>
    <p class="loot-guide"><span>Rolls the damage, then their Defense + Cover + any banked Dodge, and applies the rest. AOE: roll once per target.</span></p></div>`;
}

// ---------- loot (p. 79), Warden side ----------
const lootSel = {}; // keep dropdown picks across re-renders
function lootHTML(e, p) {
  const sel = lootSel[e.id] ||= { pc: '', cond: 'Good' };
  const alive = data.posse.filter((x) => !x.dead);
  const who = (attr) => `<select ${attr} aria-label="Who">${`<option value="">— who? —</option>`}${alive.map((x) => `<option value="${x.id}"${x.id === sel.pc ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
  const t = p?.trophy;
  return `<div class="loot"><b class="loot-h">🏆 LOOT</b>${e.looted ? ` <span class="muted">Trophy taken by ${esc(e.looted)}.</span>` : ''}
    ${t ? `<p class="loot-tro"><b>${esc(t.split(/\.\s/)[0])}.</b> ${esc(t.slice(t.split(/\.\s/)[0].length + 1).trim())}</p>
      <div class="loot-row">${who('data-loot-pc')}<select data-loot-cond aria-label="Condition">${data.loot.conditions.map((c) => `<option${c === sel.cond ? ' selected' : ''}>${c}</option>`).join('')}</select>
        <button class="btn small" type="button" data-loot>Give trophy</button></div>
      <p class="loot-guide">${data.loot.guide.map((g) => `<span><b>${g.range}</b>: ${g.with}</span>`).join('')}</p>` : ''}
    <div class="loot-row">${t ? '' : who('data-loot-pc')}<button class="btn small secondary" type="button" data-search>🎲 Search the body (Intuition)</button><span class="muted">you decide what they find</span></div></div>`;
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
    card.querySelector('[data-rename]')?.addEventListener('click', () => {
      const cur = card.querySelector('.f-name').firstChild.textContent.trim();
      const n = prompt('New name:', cur);
      if (n && n.trim() && n.trim() !== cur) send({ op: 'rename', name: n.trim() });
    });
    const es = eaSel[eid] ||= { atk: 0, pc: '', cover: 0 };
    card.querySelectorAll('[data-ea]').forEach((el) => el.addEventListener('change', () => { es[el.dataset.ea] = el.dataset.ea === 'pc' ? el.value : Number(el.value); }));
    card.querySelector('[data-ea-go]')?.addEventListener('click', async () => {
      if (!es.pc) return toast('Pick who it targets.', true);
      const r = await act({ action: 'enemyAttack', enemy: eid, attack: es.atk, pc: es.pc, cover: es.cover });
      if (r?.atk?.dice) rollPopup(r.atk, `${r.atk.label} · ${r.atk.pool}`);
      if (r) toast(`${r.dmg ? `${r.dmg} damage` : 'No damage'}${r.notes.length ? ` · ${r.notes.join(', ')}` : ''}`);
    });
    const ls = lootSel[eid] ||= { pc: '', cond: 'Good' };
    card.querySelector('[data-loot-pc]')?.addEventListener('change', (ev) => { ls.pc = ev.target.value; });
    card.querySelector('[data-loot-cond]')?.addEventListener('change', (ev) => { ls.cond = ev.target.value; });
    card.querySelector('[data-loot]')?.addEventListener('click', async () => {
      const r = await act({ action: 'loot', enemy: eid, pc: ls.pc, condition: ls.cond });
      if (r) toast(`${r.name} is in their Inventory.`);
    });
    card.querySelector('[data-search]')?.addEventListener('click', async () => {
      const r = await act({ action: 'search', enemy: eid, pc: ls.pc });
      if (r?.dice) rollPopup(r, `${r.who} searches ${card.querySelector('.f-name').textContent} · ${r.pool}`);
    });
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
      <input id="add-mon-name" maxlength="40" placeholder="Name (optional)" aria-label="Monster name">
      <input type="number" id="add-count" min="1" max="8" value="1" aria-label="How many">
      <button class="btn small" id="add-monster-btn" type="button">+ Add monster</button>
    </div>
    <div class="add-enemy add-npc">
      <select id="add-npc" aria-label="NPC"><option value="">— an NPC or human —</option>
        <optgroup label="Human combatants (p. 191)">${data.npcCatalog.filter((n) => !n.faction).map((n) => `<option value="${esc(n.key)}">${esc(n.name.replace('Human - ', ''))} · ${n.health} Health</option>`).join('')}</optgroup>
        ${[...new Set(data.npcCatalog.filter((n) => n.faction).map((n) => n.faction))].map((f) => `<optgroup label="${esc(f)}">${data.npcCatalog.filter((n) => n.faction === f).map((n) => `<option value="${esc(n.key)}">${esc(n.name)} · ${n.health} Health</option>`).join('')}</optgroup>`).join('')}
        <optgroup label="Your NPC ledger" id="ledger-opts"></optgroup></select>
      <select id="npc-as" aria-label="Fights like" title="Stats for a ledger NPC">${data.npcCatalog.filter((n) => !n.faction).map((n) => `<option value="${esc(n.key)}">fights like: ${esc(n.name.replace('Human - ', ''))}</option>`).join('')}</select>
      <input id="add-npc-name" maxlength="40" placeholder="Name" aria-label="NPC name">
      <button class="btn small secondary" id="npc-dice" type="button" title="Random name (NPC deck, p. 204)" aria-label="Random name">🎲</button>
      <button class="btn small" id="add-npc-btn" type="button">+ Add NPC</button>
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
  $('#add-monster-btn').addEventListener('click', async () => {
    if (await act({ action: 'addEnemy', profile: $('#add-monster').value, count: $('#add-count').value, name: $('#add-mon-name').value }) !== null) $('#add-mon-name').value = '';
  });
  const randName = () => `${NPC[Math.random() < 0.5 ? 'first1' : 'first2'][Math.floor(Math.random() * 52)]} ${NPC.last[Math.floor(Math.random() * 52)]}`;
  $('#npc-dice').addEventListener('click', () => { $('#add-npc-name').value = randName(); });
  // ledger NPCs have no stat block, so they borrow a human combatant's (Weak / Moderate / Strong)
  const npcAs = () => {
    const v = $('#add-npc').value;
    $('#npc-as').hidden = !v.startsWith('ledger:');
    // fill in a name to start from: the ledger/book name, or a random one for a nameless human combatant
    const n = data.npcCatalog.find((x) => x.key === v);
    $('#add-npc-name').value = v.startsWith('ledger:') ? v.slice(7) : n?.faction ? n.name : v ? randName() : '';
  };
  $('#add-npc').addEventListener('change', npcAs); npcAs();
  api('GET', null, '?view=warden', '/api/npcs').then((r) => {
    ledgerNpcs = r.npcs || []; duelSig = ''; renderDuel();
    $('#ledger-opts').innerHTML = (r.npcs || []).map((n) => `<option value="ledger:${esc(n.name)}">${esc(n.name)}${n.faction ? ` (${esc(n.faction)})` : ''}</option>`).join('');
  }).catch(() => {});
  $('#add-npc-btn').addEventListener('click', () => {
    const v = $('#add-npc').value;
    if (!v) return toast('Pick an NPC.', true);
    const name = $('#add-npc-name').value.trim();
    act(v.startsWith('ledger:') ? { action: 'addEnemy', profile: $('#npc-as').value, name: name || v.slice(7) } : { action: 'addEnemy', profile: v, name })
      .then((ok) => { if (ok !== null) npcAs(); });
  });
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

// ---------- High Noon Duel (p. 58) ----------
const DUEL_STEPS = ['Charm', 'Finesse', 'Intuition', 'Nerve', 'Draw!'];
let duelSeen = 0, duelKey = null, duelSig = '', ledgerNpcs = [];
function renderDuel() {
  const box = $('#duel');
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  const d = data.duel;
  const alive = data.posse.filter((p) => !p.dead);
  // redraw only when something changed, so a roll animation isn't cut off by the next poll
  const sig = JSON.stringify([d?.at, d?.step, d?.done, alive.map((p) => [p.id, p.name]), data.enemies.map((e) => [e.id, e.name, e.defeated])]);
  if (sig === duelSig) return;
  duelSig = sig;
  if (!d) {
    const foes = data.enemies.filter((e) => !e.defeated);
    const opts = `<option value="">— pick —</option><optgroup label="The Posse">${alive.map((p) => `<option value="pc:${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>
      ${foes.length ? `<optgroup label="NPCs & enemies in the fight">${foes.map((e) => `<option value="en:${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>` : ''}
      ${warden && data.npcCatalog ? `<optgroup label="Book NPCs (Warden)">${data.npcCatalog.filter((n) => n.faction).map((n) => `<option value="np:${esc(n.key)}|${esc(n.name)}">${esc(n.name)}</option>`).join('')}</optgroup>
        <optgroup label="Human combatants (p. 191)">${data.npcCatalog.filter((n) => !n.faction).map((n) => `<option value="np:${esc(n.key)}|">${esc(n.name.replace('Human - ', ''))}</option>`).join('')}</optgroup>
        ${ledgerNpcs.length ? `<optgroup label="Your NPC ledger (fights like a Moderate combatant)">${ledgerNpcs.map((n) => `<option value="np:npc:Human - Moderate Combatant|${esc(n.name)}">${esc(n.name)}</option>`).join('')}</optgroup>` : ''}` : ''}`;
    box.innerHTML = `<p class="muted" style="margin-top:0">Stripped of gear and defenses: just Skills and the town’s Dueling Pistols (2G). Both roll each Skill in turn; whoever rolls more Hits adds <b>1B</b> to their Draw! (a tie gives both). Then both fire.</p>
      <p class="muted">Dueling an NPC? In Warden mode the list includes every book NPC and your NPC ledger. Someone already in the fight takes the result on their card.</p>
      <div class="duel-pick"><select id="duel-a" aria-label="First duelist">${opts}</select><b>vs</b><select id="duel-b" aria-label="Second duelist">${opts}</select>
      <button class="btn" id="duel-go" type="button">Face off</button></div>`;
    $('#duel-go').addEventListener('click', () => act({ action: 'duelStart', a: $('#duel-a').value, b: $('#duel-b').value }));
    duelKey = null;
    return;
  }
  const next = DUEL_STEPS[d.step];
  const cell = (r, i) => r ? `<td><div class="tray duel-tray" data-dt="${r.skill}-${i}"></div><span class="dh">${r.rolls[i].hits} hit${r.rolls[i].hits === 1 ? '' : 's'}</span>${r.won?.[i] ? ' <b class="plus">+1B</b>' : ''}</td>` : '<td class="muted">—</td>';
  box.innerHTML = `<table class="duel-table"><thead><tr><th></th><th>${esc(d.names[0])}<small>Draw! ${d.bonus[0]}B 2G</small></th><th>${esc(d.names[1])}<small>Draw! ${d.bonus[1]}B 2G</small></th></tr></thead>
    <tbody>${DUEL_STEPS.map((st) => { const r = d.rounds.find((x) => x.skill === st);
      return `<tr class="${st === next ? 'now' : ''}"><th>${st}</th>${cell(r, 0)}${cell(r, 1)}</tr>`; }).join('')}</tbody></table>
    ${d.result ? `<div class="duel-result">${d.result.map((r) => `<div class="dr ${r.level}"><b>${esc(r.name)}</b> takes <b>${r.against}</b> Hit${r.against === 1 ? '' : 's'}: ${esc(r.text)}</div>`).join('')}</div>` : ''}
    <div class="duel-actions">${next ? `<button class="btn" id="duel-roll" type="button">${next === 'Draw!' ? '💥 DRAW!' : `🎲 Both roll ${next}`}</button>` : ''}
      <button class="btn small secondary" id="duel-end" type="button">${d.done ? 'Close the Duel' : 'Call it off'}</button></div>`;
  d.rounds.forEach((r) => r.rolls.forEach((x, i) => { const t = box.querySelector(`[data-dt="${r.skill}-${i}"]`); if (t) staticDice(t, x.dice); }));
  // animate only the newest round, once
  if (duelKey !== d.at) { duelKey = d.at; duelSeen = d.rounds.length; } // joined mid-duel: don't replay
  else if (d.rounds.length > duelSeen) {
    const r = d.rounds[d.rounds.length - 1];
    r.rolls.forEach((x, i) => { const t = box.querySelector(`[data-dt="${r.skill}-${i}"]`); if (t) animateRoll(t, x.dice); });
    duelSeen = d.rounds.length;
  }
  $('#duel-roll')?.addEventListener('click', (e) => { e.target.disabled = true; act({ action: 'duelRoll' }); });
  $('#duel-end').addEventListener('click', () => { if (d.done || confirm('Call off the Duel?')) act({ action: 'duelEnd' }); });
}
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
  renderDuel();
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
