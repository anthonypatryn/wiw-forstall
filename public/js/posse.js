import {
  $, esc, api, startPolling, abilityOptions, abilityTargetsHTML, abilityBody, tryWarden, forgetWarden, savedPin, wardenModal, store, injectDefs, toast, mountNav, poolHTML, readPool, fillPool, rollPopup, bleedPanel,
} from './common.js';
import { mountTableLog } from './tablelog.js';
import { ICONS } from './icons.js';
import { NPC } from './npc-data.js';

const EP = '/api/combat';
injectDefs();
mountTableLog();
mountNav('/posse');

// Wording from the official sheets.
const SKILL_INFO = {
  charm: ['Charm', 'convince, barter, intimidate, calm'],
  finesse: ['Finesse', 'sneak, craft, steer, fix'],
  intuition: ['Intuition', 'track, investigate, observe, discern'],
  nerve: ['Nerve', 'climb, lift, grapple, push'],
};
const TALENT_INFO = {
  Charm: 'convincing, intimidating', Finesse: 'sneaking, crafting', Intuition: 'tracking, observing', Nerve: 'climbing, lifting',
  Bows: 'bows & crossbows', Defense: 'dodge & cover', Explosives: 'dynamite & grenades', 'First Aid': 'kits & consumables',
  Forstalls: 'sweeping & bursts', Mechs: 'attachable upgrades', 'Melee Weapons': 'incl. improvised', 'Mounted Weapons': 'incl. artillery',
  Pistols: 'simple & versatile', Rifles: 'accurate at Long Range', Shotguns: 'powerful at Short Range', Traps: 'incl. improvised',
};
// Status list exactly as printed on the official sheet: skill to relieve it + the short rule.
const SHEET_STATUSES = [
  ['Afraid', 'CHA', 'Cannot move closer to source. Attack pools halved.'],
  ['Burned', 'FIN', '−Health equal to Status Severity. Lasting: Max = −2.'],
  ['Dazed', 'INT', 'Roll 1B to determine if the desired Action occurs.'],
  ['Electrocuted', 'NRV', 'Cannot Aim or Dodge. Convert Gold dice to Black.'],
  ['Poisoned', 'NRV', 'Roll −2B with any Skill. Lasting: −1B with any Skill.'],
  ['Trapped', 'F/N', 'Cannot take the Move or Dodge Actions.'],
  ['Unconscious', 'INT', 'Cannot take Actions except to remove this Status.'],
];
// Reputation standing with its Charm modifier, as printed on the sheet.
const REP_OPTIONS = [['Revered', 'Revered (+2B)'], ['Helpful', 'Helpful (+1B)'], ['Neutral', 'Neutral (+0B)'], ['Suspicious', 'Suspicious (−1B)'], ['Hostile', 'Hostile (−2B)']];
// Weapon / gear kinds and the Talent that lets them reroll Spurs.
const WEAPON_TALENT = { Rifles: 'Rifles', Shotguns: 'Shotguns', Pistols: 'Pistols', Bows: 'Bows', Melee: 'Melee Weapons', Mounted: 'Mounted Weapons' };
const GEAR_TALENT = { 'First Aid': 'First Aid', Explosives: 'Explosives', Trap: 'Traps', Traps: 'Traps', Improvised: 'Traps', 'Mech Repair Kits': 'Mechs', 'Shields & Armor': 'Defense' };
const GEAR_SUBS = ['First Aid', 'Explosives', 'Trap', 'Improvised', 'Mech Repair Kits', 'Special Ammo & Arrows', 'Shields & Armor', 'Batteries', 'Tools'];

let meta = null, data = null, poller = null, catalog = [];
let saveField = () => {};   // set per sheet in buildSheet
let vitalsStale = false;    // vitals skipped a redraw while someone typed there
let builtFor = null;        // sheet id currently rendered
let chosenTrade = null;
let kzOptions = [];
let factions = [];          // known factions for the Reputation dropdowns

let saving = 0;
function saveState(text, err) {
  const el = document.querySelector('[data-save-state]');
  if (el) { el.textContent = text; el.classList.toggle('err', !!err); el.classList.toggle('busy', text.startsWith('Saving')); }
}
async function act(body, el) {
  saving++; saveState('Saving…');
  try {
    const res = await api('POST', body, '', EP);
    if (!--saving) saveState('✓ Saved');
    poller.push(res.state);
    if (el) { el.classList.remove('saved'); void el.offsetWidth; el.classList.add('saved'); }
    return res.result ?? true;
  } catch (e) { saving = Math.max(0, saving - 1); saveState('Didn’t save — try again', true); toast(e.message, true); if (el && data) render(); return null; }
}
async function bleedRoll(p, skill) {
  const r = await act({ action: 'pc', id: p.id, op: 'bleedRoll', skill });
  if (!r?.dice) return;
  await rollPopup(r, `${p.name} · Bleeding Out · ${skill} · ${r.pool}`);
  toast(r.outcome === 'dead' ? `No Hits… ${p.name} has died.` : r.outcome === 'last' ? 'Hung on — but no Skills left. First Aid, now!' : `Hung on! ${r.left} Skill${r.left === 1 ? '' : 's'} left.`, r.outcome !== 'alive');
}
// "This is me": each device remembers its player's character and opens straight to it.
const myId = () => store.get('wiw.me') || null;
function setMe(id) {
  store.set('wiw.me', id);
  const pc = id && pcById(id);
  toast(pc ? `Got it — this device opens ${pc.name}’s sheet.` : 'Cleared. This device opens the posse list.');
  render();
}

// ---------- Warden: awards + Jackpot ----------
let warden = false;
function renderAward() {
  const card = $('#award-card');
  card.hidden = !warden;
  if (!warden || card.contains(document.activeElement)) return;
  const alive = data.posse.filter((p) => !p.dead);
  const was = new Set([...card.querySelectorAll('[data-aw]')].filter((c) => !c.checked).map((c) => c.value));
  $('#aw-who').innerHTML = alive.length ? `<label class="check aw-all"><input type="checkbox" id="aw-all" checked> Everyone</label>${alive.map((p) =>
    `<label class="check"><input type="checkbox" data-aw value="${p.id}"${was.has(p.id) ? '' : ' checked'}> ${esc(p.name)}</label>`).join('')}` : '<span class="muted">No characters yet.</span>';
  if ($('#aw-all')) $('#aw-all').checked = !was.size;
  const jp = $('#jp-who').value;
  $('#jp-who').innerHTML = `<option value="">— who? —</option>${alive.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}`;
  $('#jp-who').value = alive.some((p) => p.id === jp) ? jp : '';
}
$('#aw-who').addEventListener('change', (e) => {
  if (e.target.id === 'aw-all') $('#aw-who').querySelectorAll('[data-aw]').forEach((c) => { c.checked = e.target.checked; });
  else $('#aw-all').checked = [...$('#aw-who').querySelectorAll('[data-aw]')].every((c) => c.checked);
});
$('#aw-go').addEventListener('click', async () => {
  const ids = [...$('#aw-who').querySelectorAll('[data-aw]:checked')].map((c) => c.value);
  const body = { action: 'award', ids, prestige: $('#aw-prestige').value, dollars: $('#aw-dollars').value, scrap: $('#aw-scrap').value, item: $('#aw-item').value, reason: $('#aw-reason').value };
  const r = await act(body);
  if (r) { toast(`Awarded ${r.what} to ${r.count} character${r.count > 1 ? 's' : ''}.`); ['#aw-prestige', '#aw-dollars', '#aw-scrap', '#aw-item', '#aw-reason'].forEach((id) => { $(id).value = ''; }); }
});
$('#town-all').addEventListener('click', async () => {
  if (!confirm('Town Rest for the whole posse?')) return;
  const r = await act({ action: 'townRestAll' });
  if (r) toast(`${r.count} character${r.count === 1 ? '' : 's'} rested up in town.`);
});
$('#jp-go').addEventListener('click', async () => {
  const r = await act({ action: 'jackpot', id: $('#jp-who').value, reason: $('#jp-why').value });
  if (r) { toast(`🎰 Jackpot for ${r.name}!`); $('#jp-why').value = ''; }
});
function setWardenUI() {
  $('#warden-btn').textContent = warden ? '⭐ Warden mode · lock' : '⭐ Warden';
  if (data) render();
}
$('#warden-btn').addEventListener('click', async () => {
  if (warden) { warden = false; forgetWarden(); }
  else if (!(warden = await wardenModal(EP))) return;
  setWardenUI();
});

async function deletePc(id) {
  const pc = pcById(id);
  if (!pc || !confirm(`Delete ${pc.name}’s sheet for everyone? This can’t be undone.`)) return;
  if (await act({ action: 'pc', id, op: 'remove' })) { toast(`${pc.name} deleted.`); if (location.hash) location.hash = ''; }
}
const pcById = (id) => data?.posse.find((p) => p.id === id);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const isPool = (s) => /^(\d+[BG])+$/i.test(String(s || '').replace(/\s+/g, ''));
const firstPool = (s) => (String(s || '').toUpperCase().match(/(?:\d+[BG])+/) || [''])[0];
const itemById = (id) => catalog.find((i) => i.id === id);
const diceCount = (pool) => [...String(pool || '').toUpperCase().matchAll(/(\d+)[BG]/g)].reduce((n, m) => n + Number(m[1]), 0);
const randomName = () => `${NPC[Math.random() < 0.5 ? 'first1' : 'first2'][Math.floor(Math.random() * 52)]} ${NPC.last[Math.floor(Math.random() * 52)]}`;

// Equipment Pack contents go at the top of "Other items" under a header line; picking another pack swaps that block.
const PACK_LINE = /^— .+ Pack —$/;
function withPack(text, packs) {
  const packItems = new Set(Object.values(meta.packs).flat());
  const out = []; let skip = false;
  for (const line of String(text || '').split('\n')) {
    // after a pack header, drop only lines that are pack items (anything the player added stays)
    if (PACK_LINE.test(line.trim())) { skip = true; continue; }
    if (skip && (!line.trim() || packItems.has(line.trim()))) continue;
    skip = false;
    out.push(line);
  }
  const rest = out.join('\n').trim();
  const block = packs.filter(Boolean).map((pk) => [`— ${pk} —`, ...meta.packs[pk]].join('\n')).join('\n\n');
  return [block, rest].filter(Boolean).join('\n\n');
}
const packSelect = (attr) => `<select ${attr} aria-label="Equipment Pack"><option value="">— pick an Equipment Pack —</option>${Object.entries(meta.packs).map(([n, items]) =>
  `<option value="${esc(n)}" title="${esc(items.join(', '))}">${esc(n)}</option>`).join('')}</select>`;
const tierOf = (p) => meta.tiers.find((t) => t.name === p.tier) || null;
const tierByPrestige = (n) => [...meta.tiers].reverse().find((t) => (Number(n) || 0) >= t.prestige) || meta.tiers[0];
const RANGED_SUBS = ['Rifles', 'Shotguns', 'Pistols', 'Bows'];
const optList = (items, first) => `<option value="">${first}</option>${groupBy(items).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((it) => `<option value="${esc(it.id)}">${esc(it.name)}</option>`).join('')}</optgroup>`).join('')}`;
const tierLoadout = {}; // unsaved picks per sheet: { ranged, melee, extras: [] }

// ---------- roster ----------
function renderList() {
  const roster = $('#roster');
  const me = myId();
  const list = [...data.posse].sort((a, b) => (b.id === me) - (a.id === me));
  roster.innerHTML = list.length ? list.map((p) => `
    <div class="pc-tile${p.dead ? ' dead' : ''}${p.id === me ? ' mine' : ''}">
      <button type="button" class="me-star" data-me="${p.id}" aria-pressed="${p.id === me}" title="${p.id === me ? 'This is you — tap to unset' : 'This is me'}">${p.id === me ? '★ ME' : '☆ This is me'}</button>
      <a class="pc-open" href="#${p.id}" aria-label="Open ${esc(p.name)}’s sheet">
        <img class="pc-face" src="/img/tokens/trade-${p.trade.toLowerCase()}.webp" alt="">
        <div class="t">THE ${esc(p.trade.toUpperCase())}${p.dead ? ' · FALLEN' : ''}</div>
        <div class="n">${esc(p.name)}</div>${p.player ? `<div class="tile-player">Played by ${esc(p.player)}</div>` : ''}${p.title ? `<div class="tile-title">“${esc(p.title)}”</div>` : ''}
        <div class="hp"><span class="bar"><i style="width:${Math.min(100, (p.health / Math.max(1, p.maxHealth)) * 100)}%"></i></span><span class="num">${p.health}/${p.maxHealth}</span></div>
      </a>
      <div class="tile-actions">${p.done === false
        ? `<span class="tile-wip">BEING CREATED</span><a class="btn small" href="#${p.id}">Finish creating</a>`
        : `<a class="btn small secondary" href="#${p.id}">View</a><a class="btn small secondary" href="#${p.id}/edit">✎ Edit</a>`}<button type="button" class="btn small secondary danger" data-del="${p.id}">Delete</button></div>
    </div>`).join('') : '<p class="empty-note">No one’s signed up yet. Pick a Trade below.</p>';

  roster.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => deletePc(b.dataset.del)));
  roster.querySelectorAll('[data-me]').forEach((b) => b.addEventListener('click', () => setMe(b.dataset.me === myId() ? null : b.dataset.me)));
  renderAward();

  const pick = $('#trade-pick');
  if (!pick.dataset.ready) {
    pick.dataset.ready = '1';
    pick.innerHTML = Object.entries(meta.trades).map(([name, t]) =>
      `<button type="button" data-trade="${name}" aria-pressed="false"><img src="/img/tokens/trade-${name.toLowerCase()}.webp" alt="">${name}<small>${esc(t.abilities[0].name)} · ${esc(t.aces[0].name)}</small></button>`).join('');
    pick.querySelectorAll('[data-trade]').forEach((b) => b.addEventListener('click', () => {
      chosenTrade = b.dataset.trade;
      pick.querySelectorAll('[data-trade]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#new-trade').textContent = chosenTrade;
      $('#new-btn').disabled = false;
    }));
  }
}
$('#new-pc').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!chosenTrade) return toast('Pick a Trade first.', true);
  const sheet = await act({ action: 'addPc', trade: chosenTrade, name: $('#new-name').value, player: $('#new-player').value });
  if (sheet?.id) { $('#new-name').value = ''; $('#new-player').value = ''; location.hash = sheet.id; }
});

// ---------- small builders ----------
const spurIcon = `<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" d="${ICONS.spur}"/></svg>`;
// The sheet's Spur box: ticking it = having that Talent (rerolls Spurs on those rolls).
const spurBox = (talent, extra = '') => talent
  ? `<button type="button" class="spur" data-spur="${esc(talent)}" title="Talent: ${esc(talent)} — reroll Spurs" aria-label="${esc(talent)} Talent"${extra}>${spurIcon}</button>`
  : `<span class="spur off" title="Pick an item first">${spurIcon}</span>`;
const inp = (path, label, opts = {}) => `<label class="f${opts.cls ? ' ' + opts.cls : ''}">${label ? `<span>${label}</span>` : ''}
  ${opts.type === 'select' ? `<select data-path="${path}">${opts.options.map((o) => (Array.isArray(o)
      ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option>${esc(o)}</option>`)).join('')}</select>`
    : opts.type === 'textarea' ? `<textarea data-path="${path}" maxlength="${opts.max || 3000}" placeholder="${esc(opts.ph || '')}"></textarea>`
    : `<input data-path="${path}" type="${opts.type || 'text'}" maxlength="${opts.max || 60}" placeholder="${esc(opts.ph || '')}"${opts.list ? ` list="${opts.list}"` : ''}>`}</label>`;
const box = (title, sub, body, cls = '') => `<section class="sbox ${cls}"${cls ? ` id="sec-${cls}"` : ''}><h3><span>${title}</span></h3>${sub ? `<div class="sbox-sub">${sub}</div>` : ''}<div class="sbox-in">${body}</div></section>`;
const pick = (kind, i, groups, placeholder) => `<select class="pick" data-pick="${kind}" data-i="${i}" aria-label="${placeholder}">
  <option value="">${placeholder}</option>${groups.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((it) => `<option value="${esc(it.id)}">${esc(it.name)}${it.cost != null ? ` — $${it.cost.toFixed(2)}` : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
const groupBy = (items, key = 'sub') => Object.entries(items.reduce((m, i) => ((m[i[key]] ||= []).push(i), m), {}));

// ---------- sheet ----------
function buildSheet(p) {
  const t = meta.trades[p.trade];
  const weapons = catalog.filter((i) => i.cat === 'Weapons');
  const gearItems = catalog.filter((i) => GEAR_SUBS.includes(i.sub) || i.cat === 'Traps');
  const weaponGroups = groupBy(weapons);
  const gearGroups = groupBy(gearItems);

  const weapon = (i) => `<div class="weapon" data-w="${i}">
      <div class="w-top">${pick('weapon', i, weaponGroups, '— pick a weapon from the store list —')}<span data-wspur="${i}"></span><button type="button" class="rm-btn" data-rm-thing="weapon" data-i="${i}" title="Remove this weapon" aria-label="Remove this weapon">✕</button></div>
      <div class="w-grid">
        ${inp(`weapons.${i}.manufacturer`, 'Manufacturer')}${inp(`weapons.${i}.model`, 'Model')}
        ${inp(`weapons.${i}.slots`, 'Upgrade slots', { max: 4, cls: 'narrow' })}${inp(`weapons.${i}.grit`, 'Grit', { max: 8, cls: 'narrow' })}
      </div>
      <div class="ranges">${[['arms', 'Arm’s Reach'], ['short', 'Short Range'], ['long', 'Long Range'], ['distant', 'Distant']].map(([k, l]) =>
        `<div class="range-in"><span class="rl">${l}</span>${poolHTML(`data-pool="weapons.${i}.${k}"`, l)}<button type="button" class="roll-mini" data-roll-path="weapons.${i}.${k}" data-roll-label="${l.toLowerCase()}" data-weapon="${i}" aria-label="Roll ${l}">🎲</button></div>`).join('')}</div>
      <div class="w-grid">${[0, 1, 2, 3].map((u) => inp(`weapons.${i}.upgrades.${u}`, `${u + 1}.`)).join('')}</div>
      <div class="upg" data-upg-box="weapon" data-i="${i}"></div>
      <div class="w-grid ammo">${[0, 1].map((a) => inp(`weapons.${i}.ammo.${a}.name`, 'Sp. Ammo', { list: 'ammo-list', max: 40 }) + `<div class="rds-ctl">${inp(`weapons.${i}.ammo.${a}.rds`, 'rds', { max: 6, cls: 'narrow' })}<button type="button" class="pmb sm" data-rds="${i}.${a}" data-d="-1" aria-label="One less">−</button><button type="button" class="pmb sm" data-rds="${i}.${a}" data-d="1" aria-label="One more">+</button></div>`).join('')}</div>
      <div class="w-info" data-winfo="${i}"></div>
    </div>`;

  const abilities = t.abilities.map((a, i) => `<div class="ab" data-ab="${esc(a.name)}">
      <div class="hd"><input type="checkbox" data-toggle="abilities" value="${esc(a.name)}" aria-label="Unlocked"><b>${esc(a.name)}</b>${i === 0 ? '<span class="cost">STARTING</span>' : `<span class="cost">${a.cost} PRESTIGE</span>`}</div>
      <p>${esc(a.text)}</p>
      ${/\(\d\/day\)/.test(a.text) ? `<div class="uses" data-uses="${esc(a.name)}"></div>` : ''}
    </div>`).join('');
  const aces = t.aces.map((a, i) => `<div class="ab ace" ${i ? 'data-ace2' : ''}>
      <div class="hd">${i ? '<input type="checkbox" data-bool="aceTwo" aria-label="Unlocked">' : ''}<b>${i ? 'ACE-IN-THE-HOLE 2' : 'ACE-IN-THE-HOLE'}</b><span class="cost">${i ? '6 PRESTIGE' : 'STARTING'}</span></div>
      <p><b>${esc(a.name)}.</b> ${esc(a.text)}</p></div>`).join('');

  const gear = (i) => `<div class="gear" data-g="${i}">
      <div class="w-top">${pick('gear', i, gearGroups, '— pick gear —')}<span data-gspur="${i}"></span><button type="button" class="rm-btn" data-rm-thing="gear" data-i="${i}" title="Remove this gear" aria-label="Remove this gear">✕</button></div>
      <div class="w-grid">${inp(`gear.${i}.item`, 'Item')}${inp(`gear.${i}.type`, 'Type', { cls: 'narrow2' })}${inp(`gear.${i}.grit`, 'Grit', { max: 4, cls: 'narrow' })}</div>
      <div class="g-row">${inp(`gear.${i}.notes`, 'Dice / effect')}<button type="button" class="roll-mini" data-gear-roll="${i}" aria-label="Roll this gear">🎲</button></div>
      <div class="row2" data-dyn="gear-${i}"></div></div>`;

  const forstalls = catalog.filter((i) => i.cat === 'Forstalls' && i.sub === 'Models' && i.sweep);
  const mechs = catalog.filter((i) => i.cat === 'Mechs');
  const horses = catalog.filter((i) => i.sub === 'Horse Breeds' || i.sub === 'Legendary Steeds');

  $('#sheet-view').innerHTML = `
    <div class="sheet-bar">
      <a class="btn small secondary" href="#">← All characters</a>
      <span class="save-state" data-save-state></span>
      <button type="button" class="me-star" data-me-bar>☆ This is me</button>
      <span class="mode-tag" data-mode-tag></span>
      <a class="mode-tag turn-tag" data-turn-tag data-jump="fight" href="#${p.id}" hidden>⚔ YOUR TURN</a>
      <a class="mode-tag bleed-tag" data-bleed-tag data-jump="health" href="#${p.id}" hidden>🩸 BLEEDING OUT</a>
      <button class="btn small" type="button" data-mode="edit" hidden>✎ Edit</button>
      <button class="btn small" type="button" data-mode="view" hidden>✓ Done editing</button>
      <button class="btn small" type="button" data-mode="finish" hidden>Save character</button>
      <button class="btn small secondary danger" id="delete-pc" type="button">Delete</button>
      <nav class="sheet-toc" aria-label="Jump to">${[['starter', 'Checklist'], ['fight', 'Fight'], ['skills', 'Skills'], ['health', 'Health'], ['statuses', 'Statuses'], ['weapons', 'Weapons'], ['abilities', 'Abilities'], ['prestige', 'Prestige'], ['talents', 'Talents'], ['achievements', 'Titles'], ['disposition', 'Story'], ['reputation', 'Reputation'], ['gear', 'Gear'], ['inventory', 'Inventory'], ['forstall', 'Forstall'], ['horse', 'Horse'], ['mech', 'Mech']].map(([id, label]) => `<a href="#${p.id}" data-jump="${id}">${label}</a>`).join('')}</nav>
    </div>
    <div class="sheet-head">
      <div class="sh-trade"><small>THE</small>${esc(p.trade.toUpperCase())}</div>
      <img class="sh-logo" src="/img/logo-light.svg" alt="Wild Imaginary West">
      <label class="sh-name"><span>NAME</span><input class="sheet-name" data-path="name" maxlength="40" aria-label="Character name"><em class="sh-title" data-dyn="title"></em></label>
      <label class="sh-player"><span>PLAYER</span><input class="sheet-player" data-path="player" maxlength="40" placeholder="who’s playing?" aria-label="Player name"></label>
      <img class="sh-art" src="/img/trades/${p.trade.toLowerCase()}.webp" alt="The ${esc(p.trade)}">
    </div>

    <section class="fight-panel" data-dyn="fight" id="sec-fight" hidden></section>
    <details class="starter" data-starter id="sec-starter"><summary><b>NEW CHARACTER CHECKLIST</b><small>Guidebook pp. 6–8</small><span class="st-prog" data-dyn="starter-prog"></span></summary>
      <div class="starter-in" data-dyn="starter"></div>
      <div class="st-finish"><button type="button" class="btn" data-mode="finish">Save character</button><span class="muted">Checks that nothing is missing, then locks the sheet for play.</span><ul class="st-errs" data-st-errs></ul></div></details>

    <div class="sheet page1">
      ${box('SKILLS', 'practice &amp; master with Prestige', Object.entries(SKILL_INFO).map(([k, [nm, ds]]) => `<div class="sk">
          ${spurBox(nm)}<div class="sk-name"><b>${nm}</b><small>${ds}</small><em>quick-build: assign ${esc(t.quickBuild[k])}</em></div>
          ${poolHTML(`data-pool="skills.${k}"`, nm)}<button type="button" class="roll-mini" data-roll-path="skills.${k}" data-roll-label="${nm}" data-talent="${nm}" aria-label="Roll ${nm}">🎲</button></div>`).join(''), 'skills')}
      ${box('HEALTH', 'increase max Health with Prestige', '<div data-dyn="vitals"></div>', 'health')}
      ${box('STATUSES', 'relieved by rolling with the associated Skill', '<div data-dyn="statuses"></div>', 'statuses')}
      ${box('WEAPONS', 'each weapon has between 1–4 upgrade slots', [0, 1, 2].map(weapon).join(''), 'weapons')}
      ${box('ABILITIES', 'abilities can be used freely unless otherwise specified', `<div class="abgrid">${abilities}</div>
          <div class="row2 aces" data-dyn="aces"></div><div class="abgrid">${aces}</div>`, 'abilities')}
    </div>

    <div class="page-label">— PAGE TWO —</div>
    <div class="sheet page2">
      ${box('PRESTIGE', 'fame &amp; progression', `<div class="w-grid">${inp('prestige.total', 'Total', { type: 'number' })}${inp('prestige.unclaimed', 'Unclaimed', { type: 'number' })}</div>
        <div class="tier-title" data-dyn="tier-title"></div>
        <div class="spend" data-dyn="spend"></div>`, 'prestige')}
      ${box('ACHIEVEMENTS', 'title rewards for your growing legend', '<div data-dyn="ach"></div>', 'achievements')}
      ${box('TALENTS', 'reroll Spurs when using marked items', `<div class="talents">${meta.talents.map((tl) =>
          `<label><input type="checkbox" data-toggle="talents" value="${esc(tl)}"><span>${esc(tl)} <small>(${esc(TALENT_INFO[tl] || '')})</small></span></label>`).join('')}</div>`, 'talents')}
      ${box('DISPOSITION', 'attitude, worries, &amp; wishes', inp('disposition', '', { type: 'textarea', max: 1000 }), 'disposition')}
      ${box('APPEARANCE', 'age, build, &amp; attire', inp('appearance', '', { type: 'textarea', max: 1000 }), 'appearance')}
      ${box('REPUTATION', 'alters Charm rolls made against a faction', `<div class="reps">${[0, 1, 2, 3].map((i) =>
          `<div class="rep"><label class="f"><span>Faction</span><select data-path="reputation.${i}.faction" data-faction-select></select></label>${inp(`reputation.${i}.level`, '', { type: 'select', options: REP_OPTIONS })}</div>`).join('')}</div>`, 'reputation')}
      ${box('HISTORY', 'how your legend began', inp('history', '', { type: 'textarea' }), 'history')}
      ${box('GEAR ITEMS', 'first aid, explosives, &amp; traps', `<div class="pack-row"><span class="rl">Equipment Pack</span>${packSelect('data-pack')}<span data-pack2-wrap hidden>${packSelect('data-pack="2"')}</span><small class="muted">its gear is written into Inventory → Other items</small></div>${[0, 1, 2].map(gear).join('')}`, 'gear')}
      ${box('INVENTORY', 'loot, trophies, &amp; additional items', `
          <div class="w-grid">${inp('wallet', 'Wallet $', { max: 20 })}${inp('scrap', 'Scrap (pcs)', { max: 20 })}${inp('supplies', 'Supplies', { max: 20 })}</div>
          <div data-dyn="items"></div>${inp('inventory', 'Other items', { type: 'textarea' })}`, 'inventory')}
      ${box('FORSTALL', 'emits energy waves that disturb &amp; repel monstrous creatures', `
          <div class="w-top">${pick('forstall', 0, [['Forstall models', forstalls]], '— pick a model —')}${spurBox('Forstalls')}<button type="button" class="rm-btn" data-rm-thing="forstall" data-i="0" title="Remove the Forstall" aria-label="Remove the Forstall">✕</button></div>
          <div class="w-grid">${inp('forstall.model', 'Model')}${inp('forstall.slots', 'Total upgrade slots', { max: 4, cls: 'narrow2' })}${inp('forstall.range', 'Range', { cls: 'narrow2' })}</div>
          <div class="w-grid">${inp('forstall.grit', 'Grit', { max: 4, cls: 'narrow' })}${inp('forstall.duration', 'Duration (hrs)', { max: 6, cls: 'narrow2' })}
            <div class="range-in full"><span class="rl">Sweep</span>${poolHTML('data-pool="forstall.sweep"', 'Sweep')}<button type="button" class="roll-mini" data-roll-path="forstall.sweep" data-roll-label="Forstall Sweep" data-talent="Forstalls" aria-label="Roll Sweep">🎲</button></div></div>
          <div class="row2" data-dyn="charges"></div>
          <div class="w-grid">${[0, 1, 2, 3].map((u) => inp(`forstall.upgrades.${u}`, `${u + 1}.`)).join('')}</div>
          <div class="upg" data-upg-box="forstall" data-i="0"></div>
          <div class="w-grid">${[0, 1, 2, 3].map((u) => inp(`forstall.kz.${u}`, 'Kurtz Frequency (Kz)', { list: 'kz-list', ph: '0-0-0000' })).join('')}</div>
          <datalist id="kz-list"></datalist>`, 'forstall')}
      ${box('HORSE', 'you’re only as good as your loyal steed', `
          <div class="w-top">${pick('horse', 0, [['Horse breeds', horses]], '— pick a breed —')}<button type="button" class="rm-btn" data-rm-thing="horse" data-i="0" title="Remove the horse" aria-label="Remove the horse">✕</button></div>
          <img class="ride-art" data-art="horse" alt="" hidden>
          <div class="w-grid">${inp('horse.name', 'Name')}${inp('horse.breed', 'Breed')}${inp('horse.breakingPoint', 'Breaking point', { cls: 'narrow2' })}</div>
          <div class="w-grid">${inp('horse.maxHealth', 'Max health', { max: 4, cls: 'narrow' })}${inp('horse.health', 'Health', { max: 4, cls: 'narrow' })}${inp('horse.bond', 'Bond', { type: 'select', options: meta.reputationLevels })}</div>
          <div class="ride-dyn" data-dyn="horse"></div>
          ${inp('horse.breedAbility', 'Breed ability', { type: 'textarea', max: 300, cls: 'wide' })}${inp('horse.disposition', 'Disposition', { type: 'textarea', max: 300, cls: 'wide' })}${inp('horse.appearance', 'Appearance', { type: 'textarea', max: 300, cls: 'wide' })}`, 'horse')}
      ${box('MECH', 'carts, wagons, &amp; cabins given the chance at a new life', `
          <div class="w-top">${pick('mech', 0, [['Mech classes', mechs]], '— pick a class —')}${spurBox('Mechs')}<button type="button" class="rm-btn" data-rm-thing="mech" data-i="0" title="Remove the mech" aria-label="Remove the mech">✕</button></div>
          <img class="ride-art" data-art="mech" alt="" hidden>
          <div class="w-grid">${inp('mech.class', 'Class')}${inp('mech.slots', 'Upgrade slots', { max: 4, cls: 'narrow2' })}${inp('mech.speed', 'Speed', { cls: 'narrow2' })}</div>
          <div class="w-grid">${inp('mech.maxHealth', 'Max health', { max: 4, cls: 'narrow' })}${inp('mech.health', 'Health', { max: 4, cls: 'narrow' })}</div>
          <div class="ride-dyn" data-dyn="mech"></div>
          <div class="range-in mech-def"><span class="rl">Defense</span>${poolHTML('data-pool="mech.defense"', 'Mech defense')}<button type="button" class="roll-mini" data-roll-path="mech.defense" data-roll-label="Mech Defense" data-talent="Mechs" aria-label="Roll mech defense">🎲</button></div>
          <div class="w-grid">${inp('mech.supplies', 'Supply slots', { cls: 'narrow2' })}${inp('mech.cover', 'Player cover', { cls: 'narrow2' })}</div>
          <div class="w-grid">${[0, 1, 2, 3].map((u) => inp(`mech.upgrades.${u}`, `${u + 1}.`)).join('')}</div>
          <div class="upg" data-upg-box="mech" data-i="0"></div>`, 'mech')}
    <datalist id="ammo-list">${catalog.filter((x) => x.sub === 'Special Ammo & Arrows').map((x) => `<option value="${esc(x.name)}">${esc(x.effect || '')} · $${x.cost}</option>`).join('')}</datalist>
    </div>
    <div class="danger-zone"><a class="btn small secondary" href="#">← All characters</a></div>`;

  wireSheet(p);
  packSheet();
}

// Page two packs like a masonry wall: each box spans as many 4px rows as it is tall,
// so short boxes slide up instead of leaving gaps (reading order stays left→right).
let packObs = null;
function packSheet() {
  packObs?.disconnect();
  const grid = document.querySelector('#sheet-view .page2');
  if (!grid) return;
  const fit = (el) => { el.style.gridRowEnd = `span ${Math.ceil((el.getBoundingClientRect().height + 16) / 4)}`; };
  packObs = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
  grid.querySelectorAll(':scope > .sbox').forEach((el) => { fit(el); packObs.observe(el); });
}

let sheetWires = null;
function wireSheet(p) {
  const view = $('#sheet-view');
  // #sheet-view outlives each sheet, so drop the previous sheet's listeners first
  sheetWires?.abort();
  sheetWires = new AbortController();
  const on = (type, fn) => view.addEventListener(type, fn, { signal: sheetWires.signal });
  const timers = new Map();
  saveField = (path, value, el) => {
    clearTimeout(timers.get(path));
    const saved = get(pcById(p.id), path);
    if (String(saved ?? '').toUpperCase() === String(value ?? '').toUpperCase()) return; // nothing new
    return act({ action: 'sheet', id: p.id, path, value }, el);
  };
  const fieldValue = (el) => {
    const dp = el.closest('.dp[data-pool]');
    if (dp) return { path: dp.dataset.pool, value: readPool(dp) };
    const path = el.dataset.path || el.dataset.vpath;
    if (path) return { path, value: el.type === 'number' ? Number(el.value) : el.value };
    return null;
  };
  on('input', (e) => {
    const f = fieldValue(e.target);
    if (!f || e.target.type === 'checkbox' || e.target.tagName === 'SELECT') return;
    clearTimeout(timers.get(f.path));
    timers.set(f.path, setTimeout(() => saveField(f.path, fieldValue(e.target).value, e.target), 600));
  });
  on('click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (!j) return;
    e.preventDefault();
    const el = document.getElementById(`sec-${j.dataset.jump}`);
    if (el?.tagName === 'DETAILS') el.open = true;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  on('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-ks-other]')) { e.preventDefault(); view.querySelector('[data-start="ks-other"]').click(); }
  });
  on('change', (e) => {
    if (e.target.matches('.pick')) return pickItem(p, e.target);
    if (e.target.matches('[data-pack]')) return choosePack(p, e.target.dataset.pack === '2' ? 'pack2' : 'pack', e.target.value);
    if (e.target.matches('[data-dyn="fight"] [data-abp], [data-dyn="fight"] [data-ab]')) {
      const s = (fightSel[p.id] ||= {}); s.ab ||= {};
      if (e.target.dataset.abp) { s.ab = { name: e.target.value }; e.target.blur(); renderFight(view, pcById(p.id)); } else s.ab[e.target.dataset.ab] = e.target.value;
      return;
    }
    if (e.target.matches('[data-fs]')) {
      const s = fightSel[p.id] ||= {}, k = e.target.dataset.fs;
      s[k] = k === 'aim' ? e.target.checked : k === 'w' ? Number(e.target.value) : k === 'dodge' ? Math.max(1, Number(e.target.value) || 1) : e.target.value;
      e.target.blur();
      if (k === 'w' || k === 'aim') renderFight(view, pcById(p.id));
      return;
    }
    if (e.target.matches('[data-topple]')) { e.target.blur(); return act({ action: 'sheet', id: p.id, path: 'mech.toppled', value: e.target.checked }); }
    if (e.target.matches('[data-ach]')) {
      const on = e.target.checked, name = e.target.dataset.ach; e.target.blur();
      return act({ action: 'achieve', id: p.id, name, on }).then((ok) => ok && toast(on ? `🏅 ${name} granted.` : `${name} removed.`));
    }
    if (e.target.matches('[data-ach-title]')) { e.target.blur(); return act({ action: 'sheet', id: p.id, path: 'title', value: e.target.value }); }
    if (e.target.matches('[data-tier]')) {
      e.target.blur();
      const pc = pcById(p.id), f = { tier: e.target.value };
      if (e.target.value === 'Tenderfoot' && !String(pc.wallet || '').trim()) { f.wallet = '5'; if (!String(pc.scrap || '').trim()) f.scrap = '0'; }
      return act({ action: 'sheet', id: p.id, fields: f });
    }
    if (e.target.matches('[data-tl]')) {
      const pc0 = pcById(p.id), lo = (tierLoadout[p.id] ||= { ranged: pc0.tierKit?.[0], melee: pc0.tierKit?.[1], extras: (pc0.tierKit || []).slice(2) }), k = e.target.dataset.tl;
      if (k.startsWith('x')) lo.extras[Number(k.slice(1))] = e.target.value; else lo[k] = e.target.value;
      return;
    }
    if (e.target.matches('[data-ks]')) { e.target.blur(); return toggleKeepsake(p, e.target.value, e.target.checked); }
    if (e.target.matches('[data-faction-select]') && e.target.value === '__other') {
      const v = (prompt('Faction name:') || '').trim().slice(0, 40);
      if (!v) { e.target.value = get(pcById(p.id), e.target.dataset.path) ?? ''; return; }
      if (![...e.target.options].some((o) => o.value === v)) e.target.add(new Option(v, v), e.target.options[e.target.options.length - 1]);
      e.target.value = v;
    }
    const f = fieldValue(e.target);
    if (f && e.target.type !== 'checkbox') saveField(f.path, f.value, e.target);
  });
  on('click', (e) => {
    const s = e.target.closest('[data-spur]');
    if (s) act({ action: 'sheet', id: p.id, list: 'talents', item: s.dataset.spur });
  });
  view.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('change', () => act({ action: 'sheet', id: p.id, list: el.dataset.toggle, item: el.value })));
  view.querySelectorAll('[data-bool]').forEach((el) => el.addEventListener('change', () => act({ action: 'sheet', id: p.id, path: el.dataset.bool, value: el.checked })));

  // rolls: always use the dice on screen (and save them), with Spur rerolls from the linked Talent
  on('click', async (e) => {
    const b = e.target.closest('[data-roll-path], [data-gear-roll]');
    if (!b) return;
    const pc = pcById(p.id);
    let pool, label, talent = b.dataset.talent;
    if (b.dataset.gearRoll !== undefined) {
      const g = pc.gear[b.dataset.gearRoll];
      pool = firstPool(b.closest('.g-row').querySelector('input').value);
      label = g.item || 'Gear';
      talent = GEAR_TALENT[g.type] || null;
    } else {
      const dp = b.parentElement.querySelector(`.dp[data-pool="${b.dataset.rollPath}"]`);
      pool = dp ? readPool(dp) : get(pc, b.dataset.rollPath);
      if (dp && pool !== String(get(pc, b.dataset.rollPath) || '').toUpperCase()) saveField(dp.dataset.pool, pool, null);
      const w = b.dataset.weapon !== undefined ? pc.weapons[b.dataset.weapon] : null;
      label = w ? `${w.model || w.manufacturer || 'Weapon'} — ${b.dataset.rollLabel}` : b.dataset.rollLabel;
      if (w) talent = weaponTalent(w);
    }
    if (!isPool(pool)) return toast('Set how many Black and Gold dice first.', true);
    const spur = !!talent && pc.talents.includes(talent);
    const r = await act({ action: 'roll', who: pc.id, pool, label, spur });
    if (r?.dice) rollPopup(r, `${pc.name} · ${label} · ${r.pool}`);
  });

  on('click', async (e) => {
    const b = e.target.closest('[data-start]');
    if (!b) return;
    b.blur();
    const pc = pcById(p.id), t = meta.trades[pc.trade];
    if (b.dataset.start === 'name') {
      const n = randomName();
      if (await act({ action: 'sheet', id: p.id, path: 'name', value: n })) toast(`Howdy, ${n}.`);
    } else if (b.dataset.start === 'quick') {
      await act({ action: 'sheet', id: p.id, fields: Object.fromEntries(Object.entries(t.quickBuild).map(([k, v]) => [`skills.${k}`, v])) });
    } else if (b.dataset.start === 'weapons') {
      if (await act({ action: 'pc', id: p.id, op: 'startKit' })) toast('Used Pistol and Pocket Knife added to Weapons.');
    } else if (b.dataset.start === 'wallet') {
      if (await act({ action: 'sheet', id: p.id, path: 'wallet', value: '5' })) toast('$5 in the Wallet.');
    } else if (b.dataset.start === 'pack') {
      b.blur(); tapPack(p, b.dataset.packName, tierOf(pc)?.packs || 1);
    } else if (b.dataset.start === 'ks-other') {
      const box = view.querySelector('[data-ks-other]');
      toggleKeepsake(p, box.value, true); box.value = ''; box.blur();
    } else if (b.dataset.start === 'tier') {
      const lo = tierLoadout[p.id] || { extras: [] };
      const r = await act({ action: 'pc', id: p.id, op: 'tierKit', tier: pc.tier, ranged: lo.ranged, melee: lo.melee, extras: lo.extras.filter(Boolean) });
      if (r) { delete tierLoadout[p.id]; toast(`${pc.tier} loadout filled in: ${r.ranged}, ${r.melee}.`); }
    } else if (b.dataset.start === 'basics') {
      await act({ action: 'sheet', id: p.id, fields: { maxHealth: Math.max(10, pc.maxHealth), supplies: pc.supplies || '1' } });
    }
  });

  $('#delete-pc').addEventListener('click', () => deletePc(p.id));
  view.querySelector('[data-me-bar]').addEventListener('click', () => setMe(myId() === p.id ? null : p.id));
  on('click', async (e) => {
    const go = e.target.closest('[data-upg-go]'), rm = e.target.closest('[data-upg-rm]'), rds = e.target.closest('[data-rds]');
    const ub = e.target.closest('[data-upg-box]');
    if (go && ub) {
      const v = ub.querySelector('[data-upg-pick]').value;
      if (!v) return toast('Pick an upgrade first.', true);
      const [item, pay] = v.split('|');
      go.blur();
      if (await act({ action: 'pc', id: p.id, op: 'installUpgrade', target: ub.dataset.upgBox, index: ub.dataset.i, item, pay })) toast('Upgrade installed — it’s in the Table Log.');
    } else if (rm && ub) {
      if (confirm('Take this upgrade off? (No refund.)')) act({ action: 'pc', id: p.id, op: 'removeUpgrade', target: ub.dataset.upgBox, index: ub.dataset.i, slot: rm.dataset.upgRm });
    } else if (e.target.closest('[data-attack]')) {
      e.target.closest('[data-attack]').blur();
      const s = fightSel[p.id];
      const r = await act({ action: 'pc', id: p.id, op: 'attack', weapon: s.w, range: s.r, target: s.t, ammo: s.ammo, aim: s.aim });
      if (r?.dice) {
        s.aim = false;
        await rollPopup(r, `${pcById(p.id).name} → ${r.target} · ${r.pool}`);
        toast(`${r.dmg ? `💥 ${r.dmg} damage to ${r.target}` : `${r.target} shrugs it off`} (${r.hits} Hits − ${r.def} Defense)${r.down ? ' — it’s down!' : ''}`, !r.dmg);
      }
    } else if (e.target.closest('[data-dodge]')) {
      e.target.closest('[data-dodge]').blur();
      const r = await act({ action: 'pc', id: p.id, op: 'dodge', grit: fightSel[p.id]?.dodge || 1 });
      if (r?.dice) { rollPopup(r, `${pcById(p.id).name} · Dodge · ${r.pool}`); toast(`🛡 ${r.banked} Dodge ready for the next hit.`); }
    } else if (e.target.closest('[data-use-ab]')) {
      e.target.closest('[data-use-ab]').blur();
      const s = fightSel[p.id]; view.querySelectorAll('[data-dyn="fight"] [data-ab]').forEach((el) => { s.ab[el.dataset.ab] = el.value; });
      const r = await act(abilityBody(pcById(p.id), s.ab));
      if (r?.dice) rollPopup(r, `${pcById(p.id).name} · ${r.ability} · ${r.pool}`);
      if (r) toast(`✨ ${r.ability}${r.extra ? ` — ${r.extra}` : ''}`);
    } else if (e.target.closest('[data-rl]')) {
      const b = e.target.closest('[data-rl]'), st = b.dataset.rl; b.blur();
      const r = await act({ action: 'pc', id: p.id, op: 'relieve', status: st, dice: view.querySelector(`[data-rl-dice="${st}"]`)?.value, skill: view.querySelector(`[data-rl-skill="${st}"]`)?.value });
      if (r?.dice) { rollPopup(r, `${pcById(p.id).name} · Relieve ${st} · ${r.pool}`); toast(r.left ? `${st} down to [${r.left}].` : `${st} is gone!`); }
    } else if (e.target.closest('[data-rm-thing]')) {
      const b = e.target.closest('[data-rm-thing]'), t = b.dataset.rmThing; b.blur();
      const pc = pcById(p.id), i = Number(b.dataset.i);
      const label = t === 'weapon' ? (pc.weapons[i].model || pc.weapons[i].manufacturer) : t === 'gear' ? pc.gear[i].item : t === 'horse' ? (pc.horse.name || pc.horse.breed) : t === 'mech' ? pc.mech.class : pc.forstall.model;
      if (!label) return toast('That slot is already empty.');
      if (!confirm(`Remove ${label}? Everything in that section is cleared (upgrades, ammo, notes).`)) return;
      if (await act({ action: 'pc', id: p.id, op: 'removeThing', target: t, index: i })) toast(`${label} removed.`);
    } else if (e.target.closest('[data-ck-roll]')) {
      const b = e.target.closest('[data-ck-roll]'); b.blur();
      const r = await act({ action: 'pc', id: p.id, op: 'checkRoll', check: b.dataset.ckRoll });
      if (r?.dice) {
        await rollPopup(r, `${pcById(p.id).name} · ${r.label}`);
        if (r.helping) toast(`🤝 You added ${r.hits} Hit${r.hits === 1 ? '' : 's'} of help.`);
        else if (r.outcome) toast(r.outcome.ok ? `✅ Success — ${r.outcome.total}/${r.target} Hits!` : `❌ Short — ${r.outcome.total}/${r.target} Hits.`, !r.outcome.ok);
        else toast(`${r.hits} Hit${r.hits === 1 ? '' : 's'} — see the Table Log for who won.`);
      }
    } else if (e.target.closest('[data-sheet-undo]')) {
      const b = e.target.closest('[data-sheet-undo]'); b.blur();
      if (b.dataset.sheetUndo === 'turn' && !confirm('Restart this turn? Everything done this turn is undone.')) return;
      const r = await act({ action: 'undo', mode: b.dataset.sheetUndo });
      if (r) toast(`↶ Undone: ${r.labels.join(' · ')}`);
    } else if (e.target.closest('[data-endturn]')) {
      e.target.closest('[data-endturn]').blur();
      if (await act({ action: 'pc', id: p.id, op: 'endTurn' })) toast('Turn ended.');
    } else if (e.target.closest('[data-break]')) {
      e.target.closest('[data-break]').blur();
      const r = await act({ action: 'pc', id: p.id, op: 'breakHorse' });
      if (r?.dice) { await rollPopup(r, `${pcById(p.id).name} · Breaking the horse · ${r.hits} Hits vs ${r.need}`); toast(r.ok ? 'Broken! Bond is now Neutral.' : 'It won’t be broken… this time.', !r.ok); }
    } else if (e.target.closest('[data-rep]')) {
      const b = e.target.closest('[data-rep]'); b.blur();
      const n = view.querySelector('[data-rep-n]').value;
      if (await act({ action: 'pc', id: p.id, op: 'mechRepair', amount: n, pay: b.dataset.rep })) toast('Mech repaired.');
    } else if (rds) {
      const [i, a] = rds.dataset.rds.split('.');
      rds.blur();
      act({ action: 'pc', id: p.id, op: 'ammo', index: i, slot: a, delta: rds.dataset.d });
    }
  });
  on('click', (e) => {
    const b = e.target.closest('[data-spend]');
    if (b) { b.blur(); spendPrestige(view, p, b.dataset.spend); }
  });
  on('click', async (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    b.blur();
    const pc = pcById(p.id);
    if (b.dataset.mode === 'edit') { if (unlockSheet(p)) { hydrate(pc); toast('Editing — tap Done editing when finished.'); } }
    else if (b.dataset.mode === 'view') { editMode.delete(p.id); hydrate(pc); toast('Sheet locked.'); }
    else if (b.dataset.mode === 'finish') {
      renderStarter(view, pc);
      const errs = view.querySelector('[data-st-errs]');
      if (starterMissing.length) {
        errs.innerHTML = `<li class="head">Not quite ready — still missing:</li>${starterMissing.map((m) => `<li>${m}</li>`).join('')}`;
        view.querySelector('[data-starter]').open = true;
        errs.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return toast(`${starterMissing.length} thing${starterMissing.length > 1 ? 's' : ''} still missing.`, true);
      }
      errs.innerHTML = '';
      if (await act({ action: 'pc', id: p.id, op: 'finish' })) { window.scrollTo({ top: 0, behavior: 'smooth' }); toast(`${pc.name} is saved and ready to ride. Tap ✎ Edit to change anything.`); }
    }
  });

}

const weaponTalent = (w) => {
  const it = w.itemId && itemById(w.itemId);
  return WEAPON_TALENT[it?.sub] || (Object.values(WEAPON_TALENT).includes(w.type) ? w.type : null);
};

function choosePack(p, key, pack) {
  const pc = pcById(p.id);
  const next = { pack: pc.pack || '', pack2: pc.pack2 || '', [key]: pack };
  const f = { [key]: pack, inventory: withPack(pc.inventory, [next.pack, next.pack2]) };
  if (!String(pc.supplies || '').trim()) f.supplies = '1';
  act({ action: 'sheet', id: p.id, fields: f }).then((ok) => ok && toast(pack ? `${pack} written into Inventory.` : 'Pack removed from Inventory.'));
}
// Keepsakes live in Other items as "Keepsake: …" lines.
const keepsakesOf = (inv) => [...String(inv || '').matchAll(/^Keepsake: (.+)$/gm)].map((m) => m[1].trim());
function toggleKeepsake(p, k, on) {
  k = String(k || '').replace(/[<>\n]/g, '').trim().slice(0, 120);
  if (!k) return;
  const pc = pcById(p.id), inv = String(pc.inventory || '');
  if (on === keepsakesOf(inv).includes(k)) return;
  const next = on ? `${inv.trim()}\nKeepsake: ${k}`.trim() : inv.split('\n').filter((l) => l.trim() !== `Keepsake: ${k}`).join('\n');
  act({ action: 'sheet', id: p.id, path: 'inventory', value: next }).then((ok) => ok && toast(on ? 'Keepsake added to Inventory.' : 'Keepsake removed.'));
}
// Pack cards in the checklist: tap to pick (tap again to remove; 2-pack tiers fill both).
function tapPack(p, name, max) {
  const pc = pcById(p.id);
  const cur = [pc.pack || '', pc.pack2 || ''];
  if (cur.includes(name)) return choosePack(p, cur[0] === name ? 'pack' : 'pack2', '');
  if (max < 2 || !cur[0]) return choosePack(p, 'pack', name);
  return choosePack(p, 'pack2', name);
}

// Picking from a dropdown fills the matching section in one save.
function pickItem(p, sel) {
  const it = itemById(sel.value);
  const i = sel.dataset.i;
  if (!it) return;
  const f = {};
  const set = (path, v) => { f[path] = v == null ? '' : v; };
  const pool = (v) => (isPool(v) ? String(v).toUpperCase() : '');
  if (sel.dataset.pick === 'weapon') {
    const [manu, ...rest] = it.name.includes(' - ') ? it.name.split(' - ') : ['', it.name];
    set(`weapons.${i}.itemId`, it.id); set(`weapons.${i}.type`, WEAPON_TALENT[it.sub] || it.sub || '');
    set(`weapons.${i}.manufacturer`, manu.trim()); set(`weapons.${i}.model`, rest.join(' - ').trim() || it.name);
    set(`weapons.${i}.slots`, it.slots != null ? String(it.slots) : ''); set(`weapons.${i}.grit`, it.grit2 ? `${it.grit} | ${it.grit2}` : String(it.grit ?? ''));
    ['arms', 'short', 'long', 'distant'].forEach((k) => set(`weapons.${i}.${k}`, pool(it[k])));
  } else if (sel.dataset.pick === 'gear') {
    const notes = [it.benefit, it.effect, it.pool && `Roll ${it.pool}`, it.arms && `Arm’s Reach: ${it.arms}`, it.short && `Short: ${it.short}`, it.defense && `Defense ${it.defense}`].filter(Boolean).join(' · ').slice(0, 80);
    set(`gear.${i}.itemId`, it.id); set(`gear.${i}.item`, it.name.slice(0, 80)); set(`gear.${i}.type`, it.sub === 'Trap' ? 'Trap' : it.sub);
    set(`gear.${i}.grit`, String(it.grit ?? '')); set(`gear.${i}.notes`, notes);
  } else if (sel.dataset.pick === 'forstall') {
    set('forstall.itemId', it.id); set('forstall.model', it.name); set('forstall.slots', String(it.slots ?? '')); set('forstall.range', it.range || '');
    set('forstall.grit', String(it.grit ?? '')); set('forstall.duration', (it.duration || '').replace(/\s*hours?/, '')); set('forstall.sweep', pool(it.sweep));
  } else if (sel.dataset.pick === 'mech') {
    set('mech.itemId', it.id); set('mech.class', it.name.replace(/ Mech$/, '')); set('mech.slots', String(it.slots ?? '')); set('mech.speed', it.speed || '');
    set('mech.maxHealth', String(it.health ?? '')); set('mech.health', String(it.health ?? '')); set('mech.defense', pool(it.defense));
    set('mech.supplies', String(it.supply ?? '')); set('mech.cover', it.cover || '');
  } else if (sel.dataset.pick === 'horse') {
    set('horse.itemId', it.id); set('horse.breed', it.name); set('horse.breakingPoint', String(it.breaking ?? '')); set('horse.breedAbility', it.bond || '');
    set('horse.maxHealth', '12'); set('horse.health', '12');
  }
  sel.value = '';
  act({ action: 'sheet', id: p.id, fields: f }).then((ok) => ok && toast(`${it.name} filled in.`));
}

const pipRow = (label, n, max, attr) => `<span class="lbl">${label}</span><span class="pips">${Array.from({ length: max }, (_, i) =>
  `<button type="button" class="pip${attr === 'aces' ? ' ace' : ''}${i < n ? ' on' : ''}" data-${attr}="${i + 1}" aria-label="${label} ${i + 1}"></button>`).join('')}</span>`;
const nextVal = (b, n) => (b.classList.contains('on') && !b.nextElementSibling?.classList.contains('on') ? n - 1 : n);

// Revolver cylinder for Grit, like the sheet: six chambers, loaded = Grit left.
function cylinder(grit) {
  const ch = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2, x = 50 + Math.cos(a) * 29, y = 50 + Math.sin(a) * 29;
    return `<g class="chamber${i < grit ? ' on' : ''}" data-grit="${i + 1}" role="button" tabindex="0" aria-label="${i + 1} Grit"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${i + 1}</text></g>`;
  }).join('');
  return `<svg class="cyl" viewBox="0 0 100 100" aria-label="Grit ${grit} of 6"><circle class="cyl-body" cx="50" cy="50" r="47"/><circle class="cyl-hub" cx="50" cy="50" r="8"/>${ch}</svg>`;
}

// Spend Prestige (p. 32): each row checks cost and limits; the server applies it.
const SPEND = [
  ['practice', 2, 'Practice Skill', 'Swap 1B for 1G on a Skill'],
  ['health', 2, 'Improve Health', '+1 max Health (up to 5 times)'],
  ['talent', 4, 'Develop Talent', 'Reroll Spurs for that kind of roll'],
  ['ability', 4, 'Unlock Ability', 'A new ability from your Trade'],
  ['master', 6, 'Master Skill', '+1B to a Skill (up to 3 times)'],
  ['ace2', 6, 'Ace-in-the-Hole 2', 'Your second Ace-in-the-Hole'],
];
function renderSpend(view, p) {
  const box = view.querySelector('[data-dyn="spend"]');
  if (!box || box.contains(document.activeElement)) return;
  const t = meta.trades[p.trade], have = p.prestige.unclaimed || 0, pr = p.prestige;
  const skillSel = (k, needBlack) => `<select data-sp="${k}" aria-label="Skill">${meta.skills.map((sk) => {
    const pool = String(p.skills[sk.toLowerCase()] || '').toUpperCase();
    const off = needBlack && !/\d+B/.test(pool);
    return `<option value="${sk}"${off ? ' disabled' : ''}>${sk} (${pool || '—'})</option>`; }).join('')}</select>`;
  const pickers = {
    practice: skillSel('practice', true),
    health: `<span class="muted">${pr.healthUps || 0}/5 used</span>`,
    talent: `<select data-sp="talent" aria-label="Talent">${meta.talents.filter((x) => !p.talents.includes(x)).map((x) => `<option>${esc(x)}</option>`).join('')}</select>`,
    ability: (() => { const left = t.abilities.filter((a) => !p.abilities.includes(a.name)); return left.length ? `<select data-sp="ability" aria-label="Ability">${left.map((a) => `<option>${esc(a.name)}</option>`).join('')}</select>` : '<span class="muted">All unlocked</span>'; })(),
    master: `${skillSel('master')}<span class="muted">${pr.mastered || 0}/3</span>`,
    ace2: p.aceTwo ? '<span class="muted">Unlocked ✓</span>' : `<span class="muted">${esc(t.aces[1]?.name || '')}</span>`,
  };
  const maxed = { health: (pr.healthUps || 0) >= 5, master: (pr.mastered || 0) >= 3, ace2: !!p.aceTwo, ability: t.abilities.every((a) => p.abilities.includes(a.name)), talent: meta.talents.every((x) => p.talents.includes(x)) };
  box.innerHTML = `<div class="sp-have">UNCLAIMED PRESTIGE: <b>${have}</b></div>${SPEND.map(([k, cost, name, desc]) => `
    <div class="sp-row${have < cost || maxed[k] ? ' off' : ''}"><span class="sp-cost">${cost}</span><div class="sp-what"><b>${name}</b><small>${desc}</small></div>
      <div class="sp-pick">${pickers[k]}</div><button type="button" class="btn small" data-spend="${k}" ${have < cost || maxed[k] ? 'disabled' : ''}>Spend ${cost}</button></div>`).join('')}`;
}
async function spendPrestige(view, p, what) {
  const pc = pcById(p.id);
  const val = (k) => view.querySelector(`[data-sp="${k}"]`)?.value;
  const body = { action: 'pc', id: p.id, op: 'spend', what };
  let label = SPEND.find((x) => x[0] === what)[2];
  if (what === 'practice' || what === 'master') { body.skill = val(what); label += ` (${body.skill})`; }
  if (what === 'talent') { body.talent = val('talent'); label += ` (${body.talent})`; }
  if (what === 'ability') { body.ability = val('ability'); label += ` (${body.ability})`; }
  const cost = SPEND.find((x) => x[0] === what)[1];
  if (!confirm(`Spend ${cost} Prestige on ${label} for ${pc.name}?`)) return;
  if (await act(body)) toast(`${label} — done. It’s in the Table Log.`);
}

// Upgrades (pp. 93–100): picker per weapon / Forstall / mech — build with Scrap or buy with $.
const UPG_SINGULAR = { Rifles: 'Rifle', Shotguns: 'Shotgun', Pistols: 'Pistol', Bows: 'Bow' };
const upgType = (it) => String(it.type || '').replace(/^L\d\s+/, '').replace(/\s*\(.*\)$/, '').trim();
function upgFits(it, target, wSub) {
  if (it.cat !== 'Upgrades') return false;
  const to = String(it.appliesTo || '').split(/,\s*/);
  if (target === 'forstall') return it.sub === 'Forstall Upgrades' || (it.sub === 'For Purchase' && to.includes('Forstall'));
  if (target === 'mech') return it.sub === 'Mech Upgrades' || (it.sub === 'For Purchase' && to.includes('Mech'));
  if (wSub === 'Melee') return it.sub === 'Melee Weapon Upgrades' || (it.sub === 'For Purchase' && to.includes('Melee'));
  const one = UPG_SINGULAR[wSub];
  return !!one && (it.sub === 'Ranged Weapon Upgrades' || (it.sub === 'For Purchase' && to.includes(one)));
}
function renderUpgrades(view, p) {
  view.querySelectorAll('[data-upg-box]').forEach((box) => {
    if (box.contains(document.activeElement)) return;
    const target = box.dataset.upgBox, i = Number(box.dataset.i);
    const tgt = target === 'weapon' ? p.weapons[i] : p[target];
    const wSub = target === 'weapon' ? (itemById(tgt.itemId)?.sub || (/melee/i.test(tgt.type) ? 'Melee' : tgt.type)) : null;
    const slots = Math.max(0, Math.min(4, Number(tgt.slots) || 0));
    const ups = (tgt.upgrades || []).slice(0, 4);
    const used = ups.filter((u) => String(u || '').trim()).length;
    const have = new Set((tgt.upgradeIds || []).map((id) => itemById(id)).filter(Boolean).map(upgType));
    if (!slots) { box.innerHTML = target === 'weapon' && !tgt.model ? '' : '<span class="muted upg-none">No upgrade slots.</span>'; return; }
    const opts = catalog.filter((it) => upgFits(it, target, wSub));
    const opt = (it, pay) => { const blocked = upgType(it) !== 'Utility' && have.has(upgType(it));
      return `<option value="${it.id}|${pay}"${blocked ? ' disabled' : ''}>${esc(it.name.replace(/^(Ranged Weapon|Melee Weapon|Forstall|Mech) /, ''))}${it.upgrade && it.upgrade !== 'None' ? ` (${esc(it.upgrade)})` : ''} — ${pay === 'scrap' ? `${it.scrapCost} Scrap` : `$${it.cost}`}${blocked ? ' · already has one' : ''}</option>`; };
    box.innerHTML = `<div class="upg-row"><span class="upg-lbl">UPGRADES ${used}/${slots}</span>
      ${used < slots ? `<select data-upg-pick aria-label="Add an upgrade"><option value="">+ add an upgrade…</option>
        <optgroup label="Build with Scrap">${opts.filter((it) => it.scrapCost).map((it) => opt(it, 'scrap')).join('')}</optgroup>
        <optgroup label="Buy with $">${opts.map((it) => opt(it, 'cash')).join('')}</optgroup></select>
        <button type="button" class="btn small" data-upg-go>Install</button>` : '<span class="muted">All slots full.</span>'}</div>
      ${used ? `<div class="upg-chips">${ups.map((u, k) => (String(u || '').trim() ? `<span class="upg-chip">${esc(u)}<button type="button" data-upg-rm="${k}" aria-label="Remove ${esc(u)}">×</button></span>` : '')).join('')}</div>` : ''}`;
  });
}

// Horse Bond (pp. 104–108) + mech Condition / repairs (pp. 92–94)
const MECH_COND = {
  Functional: ['FULLY-FUNCTIONING', 'No penalties.'],
  Compromised: ['COMPROMISED', 'At half Health or less: the Grit cost to Move is doubled (max 6 Grit).'],
  Totaled: ['TOTALED', 'Everyone inside must get out. Salvage it for Scrap or repair it with Scrap.'],
};
function renderRides(view, p) {
  const hb = view.querySelector('[data-dyn="horse"]'), mb = view.querySelector('[data-dyn="mech"]');
  const h = p.horse || {}, m = p.mech || {};
  if (hb && !hb.contains(document.activeElement)) {
    const revered = h.bond === 'Revered', wild = !h.bond || h.bond === 'Suspicious' || h.bond === 'Hostile';
    const extra = /clydesdale/i.test(h.breed || '') ? 2 : 1;
    hb.innerHTML = h.breed ? `
      <div class="ride-line"><b>REVERED BOND ABILITY</b> ${h.breedAbility ? `<span class="${revered ? 'on' : 'off'}">${revered ? '✓ Active' : `🔒 Unlocks at Revered (now ${esc(h.bond || '—')})`}</span>` : '<span class="muted">none for this breed</span>'}</div>
      <div class="ride-line"><b>SUPPLIES</b> <span>+${extra} Supplies slot${extra > 1 ? 's' : ''} in its pack (you must be within Arm’s Reach)${wild ? ' — once it’s broken' : ''}.</span></div>
      ${wild ? `<div class="ride-line"><button type="button" class="btn small" data-break>🐎 Break this horse</button><span class="muted">Roll all four Skills; total Hits must reach Breaking Point ${esc(h.breakingPoint || '?')}. Bought, gifted or stolen horses don’t need breaking.</span></div>` : ''}
      <p class="muted ride-note">The Warden raises or lowers Bond as you ride together (edit mode).</p>` : '';
  }
  if (mb && !mb.contains(document.activeElement)) {
    const st = m.state || 'Functional', [label, fx] = MECH_COND[st] || MECH_COND.Functional;
    const max = Number(m.maxHealth) || 0, hp = Number(m.health) || 0;
    mb.innerHTML = max ? `
      <div class="ride-line"><b>CONDITION</b> <span class="cond ${st.toLowerCase()}">${label}</span> <span class="muted">${fx}</span></div>
      <label class="ride-line check"><input type="checkbox" data-topple${m.toppled ? ' checked' : ''}> Toppled <span class="muted">— can’t move, mounted weapons won’t fire until it’s righted.</span></label>
      ${hp < max ? `<div class="ride-line repair"><b>REPAIR</b> <input type="number" min="1" max="${max - hp}" value="${max - hp}" data-rep-n aria-label="Health to repair"> Health
        <button type="button" class="btn small secondary" data-rep="scrap">🔧 Use Scrap (1 each)</button><button type="button" class="btn small secondary" data-rep="cash">Mech depot ($2 each)</button>
        <span class="muted">Not during combat.</span></div>` : ''}` : '';
  }
}

// ---------- in the fight: attack, Dodge, relieve Statuses, end turn (pp. 41–49) ----------
const checkSeen = new Set(); let checksPrimed = false;
const RANGES = [['arms', 'Arm’s Reach'], ['short', 'Short Range'], ['long', 'Long Range'], ['distant', 'Distant']];
const fightSel = {}; // per sheet: { w, r, t, ammo, aim, dodge }
let turnSeen = '';
function whoseName(key) {
  if (!key) return '—';
  if (key === 'enemies') return 'the enemies';
  return data.posse.find((x) => x.id === key)?.name || data.enemies.find((e) => e.id === key)?.name || '—';
}
function renderFight(view, p) {
  const box = view.querySelector('[data-dyn="fight"]');
  const c = data.combat || {};
  const mine = c.active && c.current === p.id;
  // turn alert: banner in the bar + a buzz/toast when the turn comes round
  view.querySelector('[data-turn-tag]').hidden = !mine;
  const key = `${c.round}:${c.current}`;
  if (mine && turnSeen !== key) {
    if (turnSeen) { toast(`⚔ ${p.name}, it’s your turn!`); try { navigator.vibrate?.([120, 60, 120]); } catch {} }
    turnSeen = key;
  } else if (!mine) turnSeen = key;
  document.title = `${mine ? '⚔ ' : ''}${p.name} · Posse Sheets`;
  const statuses = Object.entries(p.statuses || {}).filter(([, v]) => v);
  const checks = (data.checks || []).filter((ck) => (ck.who.includes(p.id) ? !ck.rolls[p.id] && !ck.winner : ck.kind !== 'challenge' && !ck.helps[p.id]));
  // a new roll called for this character: buzz once
  checks.filter((ck) => ck.who.includes(p.id)).forEach((ck) => {
    if (!checkSeen.has(ck.id)) { if (checkSeen.size || checksPrimed) { toast(`🎯 The Warden wants a ${ck.skill} roll from ${p.name}!`); try { navigator.vibrate?.(150); } catch {} } checkSeen.add(ck.id); }
  });
  checksPrimed = true;
  const show = (c.active || statuses.length || checks.length) && !p.dead;
  box.hidden = !show;
  if (!show || box.contains(document.activeElement)) return;
  const foes = (data.enemies || []).filter((e) => !e.defeated);
  const weapons = p.weapons.map((w, i) => [w, i]).filter(([w]) => w.model || w.manufacturer);
  const sel = fightSel[p.id] ||= { w: weapons[0]?.[1] ?? 0, r: '', t: '', ammo: '', aim: false, dodge: 1 };
  const w = p.weapons[sel.w] || {};
  const ranges = RANGES.filter(([k]) => /^(\d+[BG])+$/.test(String(w[k] || '')));
  if (!ranges.some(([k]) => k === sel.r)) sel.r = ranges[0]?.[0] || '';
  if (!foes.some((e) => e.id === sel.t)) sel.t = foes[0]?.id || '';
  const loaded = (w.ammo || []).map((a, k) => [a, k]).filter(([a]) => a.name && Number(a.rds) > 0);
  if (!loaded.some(([, k]) => String(k) === String(sel.ammo))) sel.ammo = '';
  const cost = (parseInt(String(w.grit || '').split('|')[0], 10) || 0) + (sel.aim ? 1 : 0);
  const order = c.turnList || [];
  const ahead = c.active && !mine && order.includes(p.id) ? (order.indexOf(p.id) - order.indexOf(c.current) + order.length) % order.length : 0;
  const skillDice = (sk) => { const m = String(p.skills[sk.toLowerCase()] || '').toUpperCase(); return [...m.matchAll(/(\d+)[BG]/g)].reduce((n, x) => n + Number(x[1]), 0); };
  const skillPool = (sk) => String(p.skills[sk.toLowerCase()] || '—').toUpperCase();
  box.innerHTML = `
    ${checks.map((ck) => { const mineCk = ck.who.includes(p.id);
      const vs = ck.kind === 'challenge' ? [...ck.who.filter((x) => x !== p.id).map((x) => data.posse.find((q) => q.id === x)?.name), ck.npc?.name].filter(Boolean).join(' & ') : '';
      return `<div class="ck-prompt${mineCk ? ' mine' : ''}"><div><small>${ck.kind === 'challenge' ? `CHALLENGE${ck.round > 1 ? ` · ROUND ${ck.round} (TIE)` : ''} — MOST HITS WINS` : mineCk ? 'THE WARDEN ASKS YOU TO ROLL' : 'SOMEONE ELSE IS ROLLING — YOU CAN HELP'}</small>
        <b>${esc(ck.skill)}</b> · ${ck.kind === 'challenge' ? `vs ${esc(vs)}` : `${esc(ck.diff)} — ${ck.target} Hit${ck.target === 1 ? '' : 's'}`}${ck.note ? ` · <i>${esc(ck.note)}</i>` : ''}</div>
        <button type="button" class="btn small${mineCk ? '' : ' secondary'}" data-ck-roll="${ck.id}">${mineCk ? `🎲 Roll ${esc(ck.skill)} (${skillPool(ck.skill)})` : '🤝 Help (½ dice)'}</button></div>`; }).join('')}
    ${c.active ? (mine ? `<div class="turn-banner mine">⚔ YOUR TURN · <b>${p.grit}</b> Grit${p.dodge ? ` · 🛡 ${p.dodge} Dodge ready` : ''}<button type="button" class="btn small" data-endturn>End my turn ⏭</button></div>
      ${(p.turnLog || []).length ? `<div class="fp-log">${p.turnLog.map((l) => `<span>${esc(l.text)}${l.grit > 0 ? ` <i>−${l.grit}</i>` : ''}</span>`).join('')}</div>` : ''}
      ${data.undo?.lastIsThisTurn ? `<div class="fp-row"><b class="fp-h">UNDO</b><button type="button" class="btn small secondary" data-sheet-undo="last">↶ Undo: ${esc(data.undo.last)}</button>${data.undo.thisTurn ? '<button type="button" class="btn small secondary" data-sheet-undo="turn">⟲ Restart turn</button>' : ''}</div>` : ''}`
      : `<div class="turn-banner">Round ${c.round || 1} · <b>${esc(whoseName(c.current))}</b>’s turn${ahead ? ` · you’re up in ${ahead}` : ''}${p.dodge ? ` · 🛡 ${p.dodge} Dodge ready` : ''}</div>`) : ''}
    ${c.active && foes.length ? `<div class="fp-row"><b class="fp-h">ATTACK</b>
      <select data-fs="w" aria-label="Weapon">${weapons.map(([x, i]) => `<option value="${i}"${i === sel.w ? ' selected' : ''}>${esc(x.model || x.manufacturer)}</option>`).join('')}</select>
      <select data-fs="r" aria-label="Range">${ranges.map(([k, l]) => `<option value="${k}"${k === sel.r ? ' selected' : ''}>${l} · ${esc(String(w[k]).toUpperCase())}</option>`).join('') || '<option value="">no dice set</option>'}</select>
      <select data-fs="t" aria-label="Target">${foes.map((e) => `<option value="${e.id}"${e.id === sel.t ? ' selected' : ''}>→ ${esc(e.name)}</option>`).join('')}</select>
      <select data-fs="ammo" aria-label="Ammo"><option value="">regular ammo</option>${loaded.map(([a, k]) => `<option value="${k}"${String(k) === String(sel.ammo) ? ' selected' : ''}>${esc(a.name)} (${a.rds})</option>`).join('')}</select>
      <label class="check"><input type="checkbox" data-fs="aim"${sel.aim ? ' checked' : ''}${p.aimed ? ' disabled' : ''}> Aim +1 Grit${p.aimed ? ' (used)' : ''}</label>
      <button type="button" class="btn small" data-attack${sel.r ? '' : ' disabled'}>⚔ Attack · ${cost} Grit</button></div>` : c.active ? '<p class="muted fp-note">No enemies standing.</p>' : ''}
    ${c.active ? (() => { const opts = abilityOptions(p, meta); if (!opts.length) return '';
      const s = (fightSel[p.id] ||= {}); s.ab ||= {};
      if (!opts.some((o) => o.name === s.ab.name)) s.ab.name = opts.find((o) => !o.out)?.name || opts[0].name;
      return `<div class="fp-row"><b class="fp-h">ABILITY</b><select data-abp="name" aria-label="Ability">${opts.map((o) => `<option value="${esc(o.name)}"${o.name === s.ab.name ? ' selected' : ''}${o.out ? ' disabled' : ''}>${esc(o.label)}</option>`).join('')}</select>
        ${abilityTargetsHTML(s.ab.name, p, data.posse, (data.enemies || []).filter((e) => !e.defeated), s.ab)}<button type="button" class="btn small" data-use-ab>✨ Use</button></div>`; })() : ''}
    ${c.active ? `<div class="fp-row"><b class="fp-h">DODGE</b><input type="number" min="1" max="12" value="${sel.dodge}" data-fs="dodge" aria-label="Grit to spend on Dodge"> Grit → roll that many B <button type="button" class="btn small secondary" data-dodge>🛡 Dodge</button><span class="muted">Soaks the next hit; gone at your next turn.</span></div>` : ''}
    ${statuses.length ? `<div class="fp-relieve"><b class="fp-h">RELIEVE A STATUS</b> <span class="muted">${c.active ? '1 Grit per die, once per Status per turn, on your turn.' : 'Out of combat: no Grit, try as often as you like.'}</span>
      ${statuses.map(([st, v]) => {
        const skills = (meta.statuses[st]?.skill || '').split(' or ');
        const sk = skills[0], max = Math.max(0, skillDice(sk) - (p.statuses.Poisoned && st !== 'Poisoned' ? 2 : 0));
        const tried = (p.relieved || []).includes(st) && c.active;
        return `<div class="fp-row"><b>${esc(st)} [${v}]</b>
          ${skills.length > 1 ? `<select data-rl-skill="${st}" aria-label="Skill">${skills.map((s) => `<option>${s}</option>`).join('')}</select>` : `<span class="muted">${sk}</span>`}
          <select data-rl-dice="${st}" aria-label="Dice">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${i + 1 === max ? ' selected' : ''}>${i + 1} ${i ? 'dice' : 'die'}</option>`).join('')}</select>
          <button type="button" class="btn small secondary" data-rl="${st}"${tried || !max ? ' disabled' : ''}>${tried ? 'Tried this turn' : 'Roll to relieve'}</button></div>`;
      }).join('')}</div>` : ''}`;
}

// Achievements & Title Rewards (p. 34)
const earnedTitles = (p) => [...meta.tiers.filter((t) => (p.prestige.total || 0) >= t.prestige).map((t) => t.name), ...(p.achievements || [])];
function renderAch(view, p) {
  const box = view.querySelector('[data-dyn="ach"]');
  view.querySelector('[data-dyn="title"]').textContent = p.title ? `“${p.title}”` : '';
  if (!box || box.contains(document.activeElement)) return;
  const got = new Set(p.achievements || []), titles = earnedTitles(p);
  box.innerHTML = `<div class="ach-tiers">${meta.tiers.map((t) => { const ok = (p.prestige.total || 0) >= t.prestige;
      return `<span class="ach-tier${ok ? ' ok' : ''}" title="Reach ${t.prestige} total Prestige">${ok ? '✓ ' : ''}${t.name} <small>${t.prestige}</small></span>`; }).join('')}</div>
    <ul class="ach-list">${meta.achievements.map((a) => `<li class="${got.has(a.name) ? 'ok' : ''}">
      <label><input type="checkbox" data-ach="${esc(a.name)}"${got.has(a.name) ? ' checked' : ''}${warden ? '' : ' disabled'}><b>${esc(a.name)}</b></label><small>${esc(a.req)}</small></li>`).join('')}</ul>
    <p class="muted ach-note">${warden ? 'Warden: tick an Achievement when they earn it — it’s announced in the Table Log.' : 'The Warden ticks these off when you earn them.'}</p>
    <label class="ach-show">SHOW TITLE UNDER NAME <select data-ach-title><option value="">— none —</option>${titles.map((t) => `<option${t === p.title ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}

// View / edit modes. Finished sheets open locked; play trackers stay live.
let starterMissing = [];
const editMode = new Set();
const isEditing = (p) => p.done === false || editMode.has(p.id);
const PLAY_PATHS = /^(wallet|scrap|supplies|horse\.health|mech\.health|mech\.state|mech\.toppled|weapons\.\d\.ammo\.\d\.(rds|name))$/;
function applyMode(view, p) {
  const locked = !isEditing(p);
  view.classList.toggle('viewing', locked);
  view.querySelectorAll('.sheet input, .sheet select, .sheet textarea, .sheet-head input, .sheet .spur[data-spur]').forEach((el) => {
    if (el.matches('[data-stc]') || el.closest('[data-dyn="spend"], [data-dyn="ach"], [data-upg-box], [data-dyn="horse"], [data-dyn="mech"], [data-dyn="fight"]')) return; // Statuses + Prestige spending stay live
    const path = el.dataset.path || el.dataset.vpath || el.closest('.dp[data-pool]')?.dataset.pool;
    el.disabled = locked && !(path && PLAY_PATHS.test(path));
  });
  const creating = p.done === false;
  view.querySelector('[data-starter]').hidden = !creating;
  view.querySelector('[data-jump="starter"]').hidden = !creating;
  view.querySelector('[data-jump="fight"]').hidden = view.querySelector('[data-dyn="fight"]').hidden;
  view.querySelectorAll('[data-mode="finish"]').forEach((b) => { b.hidden = !creating; });
  view.querySelector('.sheet-bar [data-mode="edit"]').hidden = !locked;
  view.querySelector('.sheet-bar [data-mode="view"]').hidden = creating || locked;
  view.querySelector('[data-mode-tag]').textContent = creating ? 'CREATING' : locked ? 'VIEWING' : 'EDITING';
  view.querySelector('[data-bleed-tag]').hidden = !p.bleeding || p.dead;
  const mine = myId() === p.id, star = view.querySelector('[data-me-bar]');
  star.textContent = mine ? '★ ME' : '☆ This is me'; star.setAttribute('aria-pressed', String(mine));
  view.querySelector('[data-mode-tag]').dataset.m = creating ? 'create' : locked ? 'view' : 'edit';
}
function unlockSheet(p) {
  if (!confirm(`Edit ${pcById(p.id)?.name || 'this character'}’s sheet? Changes save as you type.`)) return false;
  editMode.add(p.id);
  return true;
}

// Character creation checklist (Guidebook pp. 6–8), with one-tap fills.
function renderStarter(view, p) {
  const box = view.querySelector('[data-dyn="starter"]');
  if (box.contains(document.activeElement)) return;
  const t = meta.trades[p.trade];
  const dice = Object.values(p.skills).reduce((n, v) => n + diceCount(v), 0);
  const skillsOk = dice === 12 && Object.values(p.skills).every((v) => diceCount(v) >= 1 && diceCount(v) <= 6);
  const hasStart = ['pistols-used-pistol', 'melee-pocket-knife'].every((id) => p.weapons.some((w) => w.itemId === id));
  const ks = keepsakesOf(p.inventory), keepsakes = ks.length;
  const ksList = [...meta.keepsakes, ...ks.filter((k) => !meta.keepsakes.includes(k))];
  const named = p.name && p.name !== `The ${p.trade}`;
  const story = [p.appearance, p.disposition, p.history].filter((x) => String(x || '').trim()).length;
  const wallet = String(p.wallet || '').trim();
  const tier = tierOf(p), high = tier && tier.prestige > 0, applied = high && p.tierApplied === p.tier;
  const lo = tierLoadout[p.id] || { ranged: p.tierKit?.[0], melee: p.tierKit?.[1], extras: (p.tierKit || []).slice(2) };
  const tierBody = `<select data-tier aria-label="Starting Prestige tier"><option value="">— pick a starting tier —</option>${meta.tiers.map((t) =>
      `<option value="${t.name}"${t.name === p.tier ? ' selected' : ''}>${t.name} · ${t.prestige} Prestige</option>`).join('')}</select>
    <span class="muted">New posse? Tenderfoot. Some expeditions start higher.</span>
    ${tier ? `<div class="tier-kit"><table><tr><th>Ranged</th><th>Melee or Trap</th><th>Scrap</th><th>Wallet</th><th>Packs</th><th>Extra items</th></tr>
      <tr><td>${tier.ranged}</td><td>${tier.melee}</td><td>${tier.scrap}</td><td>$${tier.wallet}</td><td>${tier.packs}</td><td>${tier.extras}</td></tr></table>
      ${high ? `<div class="tier-picks">
        <label>${tier.ranged.toUpperCase()} RANGED WEAPON<select data-tl="ranged">${optList(catalog.filter((i) => i.cat === 'Weapons' && RANGED_SUBS.includes(i.sub) && i.quality === tier.ranged), '— pick one —')}</select></label>
        <label>${tier.melee.toUpperCase()} MELEE WEAPON OR TRAP<select data-tl="melee">${optList(catalog.filter((i) => ((i.cat === 'Weapons' && i.sub === 'Melee') || i.cat === 'Traps') && i.quality === tier.melee), '— pick one —')}</select></label>
        ${Array.from({ length: tier.extras }, (_, i) => `<label>EXTRA ITEM ${i + 1}<select data-tl="x${i}">${optList(catalog.filter((it) => it.cat === 'Gear'), '— pick an item —')}</select></label>`).join('')}
      </div>
      <button type="button" class="btn small" data-start="tier">${applied ? 'Re-apply' : 'Apply'} the ${tier.name} loadout</button>
      <span class="muted">Extra first aid, explosives, armor and special ammo go into Gear Items; the rest into Other items.</span>
      <span class="muted">${applied ? `Applied: ${tier.prestige} Prestige to spend (see page two), $${tier.wallet}, ${tier.scrap} Scrap.` : `Sets ${tier.prestige} unclaimed Prestige, $${tier.wallet} Wallet and ${tier.scrap} Scrap, and swaps out the Used Pistol and Pocket Knife.`}</span>` : `<div class="sb">${hasStart ? '✓ Used Pistol and Pocket Knife are in Weapons.' : '<button type="button" class="btn small secondary" data-start="weapons">Add Used Pistol + Pocket Knife</button>'}
        ${wallet ? `✓ $${esc(wallet)} in the Wallet.` : '<button type="button" class="btn small secondary" data-start="wallet">Set the Wallet to $5</button>'}</div>`}</div>` : ''}`;
  const packs = tier?.packs || 1;
  const steps = [
    [true, 'Pick a Trade', `The ${esc(p.trade)}. Starting Ability <b>${esc(t.abilities[0].name)}</b> and Ace-in-the-Hole <b>${esc(t.aces[0].name)}</b> are already marked.`],
    [!!tier && (high ? applied : hasStart && wallet !== ''), 'Starting Prestige tier &amp; loadout (p. 33)', tierBody],
    [named && story === 3, 'Get to know yourself', `${named ? `Name: <b>${esc(p.name)}</b>. ` : ''}<button type="button" class="btn small secondary" data-start="name">🎲 Random name (p. 204)</button>
      <span class="muted">Then fill in Appearance, Disposition &amp; History on page two (${story}/3 done).</span>`],
    [skillsOk, 'Assign your Skills', `<b>${dice}/12</b> Black dice assigned, 1–6 per Skill. ${skillsOk ? '' : `<button type="button" class="btn small secondary" data-start="quick">Use quick build (${Object.values(t.quickBuild).join(' · ')})</button>`}`],
    [!!p.pack && (packs < 2 || !!p.pack2), `Equipment Pack${packs > 1 ? 's (2)' : ''}`, `<span class="muted">${packs > 1 ? 'Your tier gets two, so tap two packs.' : 'Tap one.'} Its gear goes into Inventory, plus 1 Supplies slot.</span>
      <div class="pack-cards">${Object.entries(meta.packs).map(([n, items]) => { const on = n === p.pack || n === p.pack2;
        return `<button type="button" class="pack-card${on ? ' on' : ''}" data-start="pack" data-pack-name="${esc(n)}" aria-pressed="${on}"><b>${on ? '✓ ' : ''}${esc(n)}</b><ul>${items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul></button>`; }).join('')}</div>`],
    [p.maxHealth >= 10 && String(p.supplies || '').trim() !== '', 'Health, Prestige &amp; Supplies', `Max Health <b>${p.maxHealth}</b> · Prestige <b>${p.prestige.total}</b> (${high ? `a ${tier.name} starts at ${tier.prestige}` : 'a Tenderfoot starts at 0'}) · Supplies <b>${esc(p.supplies || '—')}</b>
      ${p.maxHealth < 10 || !String(p.supplies || '').trim() ? '<button type="button" class="btn small secondary" data-start="basics">Set the starting values</button>' : ''}`],
    [keepsakes > 0, 'Keepsakes', `<span class="muted">${keepsakes ? `${keepsakes} carried.` : 'Check one or two, or write your own.'}</span>
      <div class="ks-grid">${ksList.map((k) => `<label><input type="checkbox" data-ks value="${esc(k)}"${ks.includes(k) ? ' checked' : ''}><span>${esc(k)}</span></label>`).join('')}</div>
      <div class="ks-other"><input data-ks-other maxlength="120" placeholder="Other keepsake…" aria-label="Other keepsake"><button type="button" class="btn small secondary" data-start="ks-other">Add</button></div>`],
  ];
  const done = steps.filter((st) => st[0]).length;
  const why = { 1: tier ? `Apply the ${tier.name} loadout (weapons, Wallet).` : 'Pick a starting Prestige tier.', 2: `${named ? '' : 'Give them a name. '}Fill in Appearance, Disposition &amp; History on page two (${story}/3).`,
    3: `Assign exactly 12 Black dice, 1–6 per Skill (now ${dice}).`, 4: `Pick ${packs > 1 ? 'two Equipment Packs' : 'an Equipment Pack'}.`, 5: 'Set Max Health and Supplies.', 6: 'Check or write at least one keepsake.' };
  starterMissing = steps.map((st, n) => (st[0] ? null : `<b>Step ${n + 1} · ${st[1]}</b> — ${why[n] || ''}`)).filter(Boolean);
  box.innerHTML = `<ol>${steps.map(([ok, title, body], n) => `<li class="${ok ? 'ok' : ''}"><span class="tick">${ok ? '✓' : ''}</span><div><b>Step ${n + 1} · ${title}</b><div class="sb">${body}</div></div></li>`).join('')}</ol>`;
  box.querySelectorAll('[data-pack]').forEach((el) => { el.value = (el.dataset.pack === '2' ? p.pack2 : p.pack) || ''; });
  box.querySelectorAll('[data-tl]').forEach((el) => { const k = el.dataset.tl; el.value = (k.startsWith('x') ? lo.extras[Number(k.slice(1))] : lo[k]) || ''; });
  view.querySelector('[data-dyn="starter-prog"]').textContent = done === steps.length ? 'All set ✓' : `${done}/${steps.length} done`;
  const det = view.querySelector('[data-starter]');
  if (!det.dataset.init) { det.dataset.init = '1'; det.open = done < steps.length; }
}

// Re-render the live bits (and fill inputs nobody is typing in).
function hydrate(p) {
  const view = $('#sheet-view');
  view.querySelectorAll('[data-path]').forEach((el) => { if (el !== document.activeElement) el.value = get(p, el.dataset.path) ?? ''; });
  view.querySelectorAll('select.pick').forEach((el) => {
    if (el === document.activeElement) return;
    const k = el.dataset.pick;
    const id = k === 'weapon' ? p.weapons[el.dataset.i]?.itemId : k === 'gear' ? p.gear[el.dataset.i]?.itemId : p[k]?.itemId;
    el.value = id && el.querySelector(`option[value="${CSS.escape(id)}"]`) ? id : '';
  });
  // Reputation: known factions (+ whatever is already written, + Other…)
  view.querySelectorAll('[data-faction-select]').forEach((el) => {
    if (el === document.activeElement) return;
    const cur = get(p, el.dataset.path) || '';
    const names = factions.map((f) => f.name);
    if (cur && !names.includes(cur)) names.push(cur);
    el.innerHTML = `<option value="">— faction —</option>${names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}<option value="__other">✎ Other…</option>`;
    el.value = cur;
  });
  view.querySelectorAll('[data-pack]').forEach((el) => { if (el !== document.activeElement) el.value = (el.dataset.pack === '2' ? p.pack2 : p.pack) || ''; });
  view.querySelector('[data-pack2-wrap]').hidden = (tierOf(p)?.packs || 1) < 2 && !p.pack2;
  const tt = tierByPrestige(p.prestige.total), nx = meta.tiers[meta.tiers.indexOf(tt) + 1];
  view.querySelector('[data-dyn="tier-title"]').innerHTML = `Prestige tier: <b>${tt.name}</b>${nx ? ` <span class="muted">· ${nx.name} at ${nx.prestige}</span>` : ''}`;
  for (const k of ['horse', 'mech']) {
    const img = view.querySelector(`[data-art="${k}"]`), it = p[k]?.itemId && itemById(p[k].itemId);
    img.hidden = !it?.img;
    if (it?.img && img.dataset.src !== it.img) { img.dataset.src = it.img; img.src = `/img/store/${it.img}.webp`; img.alt = it.name; }
  }
  renderStarter(view, p);
  renderSpend(view, p);
  renderAch(view, p);
  renderUpgrades(view, p);
  renderRides(view, p);
  renderFight(view, p);
  applyMode(view, p);
  view.querySelectorAll('[data-toggle]').forEach((el) => { el.checked = p[el.dataset.toggle].includes(el.value); });
  view.querySelectorAll('[data-ab]').forEach((el) => el.classList.toggle('locked', !p.abilities.includes(el.dataset.ab)));
  view.querySelectorAll('[data-bool]').forEach((el) => { el.checked = !!p[el.dataset.bool]; });
  view.querySelector('[data-ace2]')?.classList.toggle('locked', !p.aceTwo);
  const send = (o) => act({ action: 'pc', id: p.id, ...o });

  // weapon & gear Spur boxes follow each item's Talent
  p.weapons.forEach((w, i) => {
    const t = weaponTalent(w);
    view.querySelector(`[data-wspur="${i}"]`).innerHTML = spurBox(t);
    const it = w.itemId && itemById(w.itemId);
    view.querySelector(`[data-winfo="${i}"]`).innerHTML = it ? `${it.quality ? `<span class="q ${esc(it.quality)}">${esc(it.quality.toUpperCase())}</span> ` : ''}${it.note ? esc(it.note) : ''} <span class="muted">Guidebook p. ${it.page ?? '—'}</span>` : '';
  });
  p.gear.forEach((g, i) => { view.querySelector(`[data-gspur="${i}"]`).innerHTML = spurBox(GEAR_TALENT[g.type] || null); });
  view.querySelectorAll('.spur[data-spur]').forEach((b) => b.classList.toggle('on', p.talents.includes(b.dataset.spur)));

  const vitals = view.querySelector('[data-dyn="vitals"]');
  const typing = vitals.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea, select');
  const pct = Math.max(0, Math.min(100, (p.health / Math.max(1, p.maxHealth)) * 100));
  if (typing) {
    vitalsStale = true;
    vitals.querySelector('.bar i').style.width = `${pct}%`;
    vitals.querySelector('.hp-big').textContent = p.health;
  } else {
    vitalsStale = false;
    vitals.innerHTML = `
      <div class="hp-top"><label class="f narrow"><span>max</span><input data-vpath="maxHealth" type="number" min="1" max="99" value="${p.maxHealth}"></label>
        <div class="hp-mid"><button type="button" class="pmb" data-hp="-1" aria-label="Lose 1 Health">−</button><span class="hp-big">${p.health}</span><button type="button" class="pmb" data-hp="1" aria-label="Gain 1 Health">+</button></div>
        <div class="f hp-def"><span>defense</span>${poolHTML('data-pool="defense"', 'Defense')}</div></div>
      <div class="hp"><span class="bar"><i style="width:${pct}%"></i></span></div>
      <div class="def-spur">${spurBox('Defense')}<span class="muted">Defense Talent (dodge &amp; cover)</span></div>
      <h4>GRIT <small>action points reload on your next turn</small></h4>
      ${cylinder(p.grit)}
      ${bleedPanel(p, meta.skills)}
      ${!p.dead && !p.bleeding && p.health === 0 && p.statuses?.Unconscious > 0 ? '<p class="bleed"><b>UNCONSCIOUS</b> — saved! Relieve Unconscious (roll Intuition) to wake up with 1 Health.</p>' : ''}
      ${p.dead ? '<p class="bleed"><b>FALLEN</b> — this character has died. The Warden can revive them from the Combat page.</p>' : ''}
      ${p.dead ? '' : `<div class="rest-row"><span class="rl">REST</span>
        <select data-camp-skill aria-label="Skill to roll at camp">${meta.skills.map((s) => `<option value="${s}">${s} (${esc(String(p.skills[s.toLowerCase()] || '—').toUpperCase())})</option>`).join('')}</select>
        <button class="btn small secondary" type="button" data-camp title="Roll a Skill; regain Health equal to Hits (p. 52)">🔥 Campfire</button>
        <button class="btn small secondary" type="button" data-town title="Full Health, Statuses cleared, Supplies reset, Forstall recharged (p. 54)">🏨 Town</button></div>`}`;
    vitals.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', () => send({ op: 'health', delta: Number(b.dataset.hp) })));
    vitals.querySelectorAll('[data-bleed-roll]').forEach((b) => b.addEventListener('click', () => bleedRoll(p, b.dataset.bleedRoll)));
    vitals.querySelectorAll('.bleed-panel [data-op]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.op === 'die' && !confirm(`Mark ${p.name} as dead?`)) return;
      send({ op: b.dataset.op });
    }));
    vitals.querySelectorAll('[data-grit]').forEach((g) => {
      const go = () => send({ op: 'grit', value: g.classList.contains('on') && Number(g.dataset.grit) === p.grit ? p.grit - 1 : Number(g.dataset.grit) });
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    vitals.querySelector('[data-camp]')?.addEventListener('click', async () => {
      const skill = vitals.querySelector('[data-camp-skill]').value;
      const r = await send({ op: 'campRest', skill });
      if (r?.dice) { rollPopup(r, `${p.name} · Campfire rest · ${skill} · ${r.pool}`); toast(`Regained ${r.healed} Health by the fire.`); }
    });
    vitals.querySelector('[data-town]')?.addEventListener('click', () => {
      if (confirm('Town Rest? Full Health, Statuses cleared, Supplies reset, Forstall recharged.')) send({ op: 'townRest' });
    });
  }
  vitals.querySelectorAll('.spur[data-spur]').forEach((b) => b.classList.toggle('on', p.talents.includes(b.dataset.spur)));

  const stBox = view.querySelector('[data-dyn="statuses"]');
  stBox.innerHTML = SHEET_STATUSES.map(([s, sk, txt]) => { const v = p.statuses?.[s] || 0; return `<div class="st-row${v ? ' on' : ''}">
      <label class="st-check"><span class="st-sk">${sk}</span><input type="checkbox" data-stc="${s}"${v ? ' checked' : ''}><b>${s}</b></label>
      <span class="st-desc">${esc(txt)}</span>
      <span class="sev">${v ? `<button type="button" data-st="${s}" data-v="${v - 1}" aria-label="Lower ${s}">−</button><b title="Severity">${v}</b><button type="button" data-st="${s}" data-v="${v + 1}" aria-label="Raise ${s}">+</button>` : ''}</span>
    </div>`; }).join('');
  stBox.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => send({ op: 'status', status: b.dataset.st, value: Number(b.dataset.v) })));
  stBox.querySelectorAll('[data-stc]').forEach((c) => c.addEventListener('change', () => send({ op: 'status', status: c.dataset.stc, value: c.checked ? 1 : 0 })));

  const aces = view.querySelector('[data-dyn="aces"]');
  aces.innerHTML = `${pipRow('ACES', p.aces, 6, 'aces')}<span class="muted" style="font-size:14px">${p.aces >= 6 ? 'Ready! Play an Ace-in-the-Hole below.' : 'Roll 6 Aces in combat to unlock your Ace-in-the-Hole.'}</span>`;
  aces.querySelectorAll('[data-aces]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: 'aces', value: nextVal(b, Number(b.dataset.aces)) })));

  view.querySelectorAll('[data-uses]').forEach((el) => {
    const name = el.dataset.uses, used = p.abilityUses?.[name] || 0;
    el.innerHTML = `USES ${Array.from({ length: 2 }, (_, i) => `<button type="button" class="pip${i < used ? ' on' : ''}" data-use="${i + 1}" aria-label="Use ${i + 1}"></button>`).join('')}`;
    el.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: `abilityUses.${name}`, value: nextVal(b, Number(b.dataset.use)) })));
  });
  [0, 1, 2].forEach((i) => {
    const el = view.querySelector(`[data-dyn="gear-${i}"]`);
    el.innerHTML = pipRow('USES', p.gear[i].uses || 0, 6, 'guse');
    el.querySelectorAll('[data-guse]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: `gear.${i}.uses`, value: nextVal(b, Number(b.dataset.guse)) })));
  });
  const ch = view.querySelector('[data-dyn="charges"]');
  ch.innerHTML = `${pipRow('CHARGES', p.forstall.charges ?? 0, Math.max(2, p.forstall.charges ?? 0), 'chg')}<span class="muted" style="font-size:13px">of 2</span>`;
  ch.querySelectorAll('[data-chg]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: 'forstall.charges', value: nextVal(b, Number(b.dataset.chg)) })));

  // bought items (from the Store)
  const itemsBox = view.querySelector('[data-dyn="items"]');
  const items = p.items || [];
  itemsBox.innerHTML = items.length ? `<div class="items-list">${items.map((it, i) => `<div class="inv-item"><span>${esc(it.name)}<small>${esc(it.sub || it.cat || '')}</small></span>
      <span class="qty"><button type="button" data-q="${i}" data-d="-1" aria-label="One fewer">−</button><b>${it.qty}</b><button type="button" data-q="${i}" data-d="1" aria-label="One more">+</button></span>
      <button type="button" class="btn small secondary" data-sell="${esc(it.uid)}">Sell…</button><button type="button" class="rm-btn" data-rm-item="${i}" title="Remove this item" aria-label="Remove ${esc(it.name)}">✕</button></div>`).join('')}</div>`
    : '<p class="muted" style="margin:4px 0;font-size:14px">Nothing from the <a href="/store">Store</a> yet.</p>';
  itemsBox.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    const it = items[b.dataset.q];
    act({ action: 'sheet', id: p.id, path: `items.${b.dataset.q}.qty`, value: it.qty + Number(b.dataset.d) });
  }));
  itemsBox.querySelectorAll('[data-rm-item]').forEach((b) => b.addEventListener('click', () => {
    const it = items[Number(b.dataset.rmItem)];
    if (confirm(`Remove ${it.name} from ${p.name}’s inventory?`)) act({ action: 'sheet', id: p.id, path: `items.${b.dataset.rmItem}.qty`, value: 0 });
  }));
  itemsBox.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', async () => {
    const it = items.find((x) => x.uid === b.dataset.sell);
    const qty = it.qty > 1 ? Number(prompt(`Sell how many? (they have ${it.qty})`, '1')) : 1;
    if (!qty) return;
    try { await api('POST', { action: 'request', kind: 'sell', pc: p.id, uid: it.uid, qty }, '', '/api/shop'); toast('Sale request sent — the Warden sets the price.'); }
    catch (e) { toast(e.message, true); }
  }));

  view.querySelectorAll('.dp[data-pool]').forEach((dp) => fillPool(dp, get(p, dp.dataset.pool)));
  const dl = view.querySelector('#kz-list');
  if (dl && !dl.children.length) dl.innerHTML = kzOptions.map((o) => `<option value="${esc(o.kz)}">${esc(o.name)}</option>`).join('');
}

// ---------- routing & boot ----------
function render() {
  if (!data) return;
  const [id, wants] = location.hash.slice(1).split('/');
  const p = id && pcById(id);
  $('#list-view').hidden = !!p;
  $('#sheet-view').hidden = !p;
  document.body.classList.toggle('on-sheet', !!p);
  if (!p) {
    builtFor = null;
    document.title = 'Posse Sheets · Wild Imaginary West';
    if (id) toast('That character isn’t in the posse anymore.', true);
    renderList();
    return;
  }
  if (builtFor !== p.id) { editMode.clear(); buildSheet(p); builtFor = p.id; window.scrollTo(0, 0); }
  if (wants === 'edit') { history.replaceState(null, '', `#${p.id}`); if (p.done !== false) unlockSheet(p); }
  hydrate(p);
}
window.addEventListener('hashchange', render);
$('#sheet-view').addEventListener('focusout', () => setTimeout(() => { if (vitalsStale) render(); }, 60));

(async () => {
  meta = await api('GET', null, '?view=meta', EP);
  try {
    const [c, shop] = await Promise.all([api('GET', null, '?view=catalog', '/api/shop'), api('GET', null, '?view=player', '/api/shop')]);
    catalog = [...c.catalog, ...(shop.custom || [])];
  } catch { catalog = []; }
  try { factions = (await api('GET', null, '?view=factions', '/api/npcs')).factions || []; } catch {}
  // Decoded frequencies from the Forstall notebook make handy suggestions for the sheet's Kz boxes.
  try {
    const scan = await api('GET', null, '?view=player');
    kzOptions = (scan.notebook || []).filter((e) => e.solved).map((e) => ({ kz: e.kz, name: e.name }));
  } catch {}
  if (savedPin()) warden = await tryWarden(savedPin(), EP);
  setWardenUI();
  let jumped = false;
  poller = startPolling('player', (d) => {
    data = d;
    // open this device's character on arrival (once per visit, only from the bare list)
    if (!jumped) {
      jumped = true;
      const me = myId();
      if (me && !location.hash && pcById(me)) history.replaceState(null, '', `#${me}`);
    }
    render();
  }, (ok) => {
    $('#conn').classList.toggle('off', !ok);
    $('#conn').textContent = ok ? 'Connected' : 'Reconnecting…';
  }, EP);
})();
