import { $, esc, api, startPolling, injectDefs, toast, mountNav, poolHTML, readPool, fillPool } from './common.js';
import { mountTableLog } from './tablelog.js';

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

let meta = null;
let data = null;
let poller = null;
let vitalsStale = false;  // vitals skipped a redraw while someone typed there
let builtFor = null;       // sheet id currently rendered
let chosenTrade = null;
let kzOptions = [];

async function act(body, el) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (el) { el.classList.remove('saved'); void el.offsetWidth; el.classList.add('saved'); }
    return res.result ?? true;
  } catch (e) { toast(e.message, true); if (el && data) render(); return null; }
}
const pcById = (id) => data?.posse.find((p) => p.id === id);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const isPool = (s) => /^(\d+[BG])+$/i.test(String(s || '').replace(/\s+/g, ''));

// ---------- roster ----------
function renderList() {
  const roster = $('#roster');
  roster.innerHTML = data.posse.length ? data.posse.map((p) => `
    <a class="pc-tile${p.dead ? ' dead' : ''}" href="#${p.id}">
      <div class="t">THE ${esc(p.trade.toUpperCase())}${p.dead ? ' · FALLEN' : ''}</div>
      <div class="n">${esc(p.name)}</div>
      <div class="hp"><span class="bar"><i style="width:${Math.min(100, (p.health / Math.max(1, p.maxHealth)) * 100)}%"></i></span><span class="num">${p.health}/${p.maxHealth}</span></div>
    </a>`).join('') : '<p class="empty-note">No one’s signed up yet. Pick a Trade below.</p>';

  const pick = $('#trade-pick');
  if (!pick.dataset.ready) {
    pick.dataset.ready = '1';
    pick.innerHTML = Object.entries(meta.trades).map(([name, t]) =>
      `<button type="button" data-trade="${name}" aria-pressed="false">${name}<small>${esc(t.abilities[0].name)} · ${esc(t.aces[0].name)}</small></button>`).join('');
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
  const sheet = await act({ action: 'addPc', trade: chosenTrade, name: $('#new-name').value });
  if (sheet?.id) { $('#new-name').value = ''; location.hash = sheet.id; }
});

// ---------- sheet ----------
const inp = (path, label, opts = {}) => `<label class="f"${opts.style ? ` style="${opts.style}"` : ''}>${label}
  ${opts.type === 'select' ? `<select data-path="${path}">${opts.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`
    : opts.type === 'textarea' ? `<textarea data-path="${path}" maxlength="${opts.max || 3000}" placeholder="${esc(opts.ph || '')}"></textarea>`
    : `<input data-path="${path}" type="${opts.type || 'text'}" maxlength="${opts.max || 60}" placeholder="${esc(opts.ph || '')}"${opts.list ? ` list="${opts.list}"` : ''}>`}</label>`;

function buildSheet(p) {
  const t = meta.trades[p.trade];
  const weapons = [0, 1, 2].map((i) => `<div class="weapon">
      <div class="fr">${inp(`weapons.${i}.manufacturer`, 'MANUFACTURER')}${inp(`weapons.${i}.model`, 'MODEL')}${inp(`weapons.${i}.slots`, 'UPGRADE SLOTS', { max: 4 })}${inp(`weapons.${i}.grit`, 'GRIT', { max: 4 })}</div>
      <div class="ranges">${[['arms', "ARM’S REACH"], ['short', 'SHORT RANGE'], ['long', 'LONG RANGE']].map(([k, l]) =>
        `<div class="range-in"><div class="f">${l}${poolHTML(`data-pool="weapons.${i}.${k}"`, l)}</div><button type="button" class="roll-mini" data-roll-path="weapons.${i}.${k}" data-roll-label="${l.toLowerCase()}" data-weapon="${i}">🎲</button></div>`).join('')}</div>
      <div class="fr">${[0, 1, 2, 3].map((u) => inp(`weapons.${i}.upgrades.${u}`, `UPGRADE ${u + 1}`)).join('')}</div>
      <div class="fr">${[0, 1].map((a) => inp(`weapons.${i}.ammo.${a}.name`, 'SP. AMMO') + inp(`weapons.${i}.ammo.${a}.rds`, 'RDS', { max: 6 })).join('')}</div>
    </div>`).join('');

  const abilities = t.abilities.map((a, i) => `<div class="ab" data-ab="${esc(a.name)}">
      <div class="hd"><input type="checkbox" data-toggle="abilities" value="${esc(a.name)}" aria-label="Unlocked"><b>${esc(a.name)}</b><span class="cost">${i === 0 ? 'STARTING' : `${a.cost} PRESTIGE`}</span></div>
      <p>${esc(a.text)}</p>
      ${/\(\d\/day\)/.test(a.text) ? `<div class="uses" data-uses="${esc(a.name)}"></div>` : ''}
    </div>`).join('');
  const aces = t.aces.map((a, i) => `<div class="ab ace${i ? '' : ''}" ${i ? 'data-ace2' : ''}>
      <div class="hd">${i ? '<input type="checkbox" data-bool="aceTwo" aria-label="Unlocked">' : ''}<b>${i ? 'ACE-IN-THE-HOLE 2' : 'ACE-IN-THE-HOLE'} · ${esc(a.name)}</b><span class="cost">${i ? '6 PRESTIGE' : 'STARTING'}</span></div>
      <p>${esc(a.text)}</p></div>`).join('');

  $('#sheet-view').innerHTML = `
    <div class="sheet-top">
      <a class="back" href="#">← The Posse</a>
      <input class="sheet-name" data-path="name" maxlength="40" aria-label="Character name">
      <span class="trade-badge">THE ${esc(p.trade.toUpperCase())}</span>
    </div>
    <div class="sheet-grid">
      <section class="sec"><h3>SKILLS <small>practice &amp; master with Prestige</small></h3><div class="in">
        ${Object.entries(SKILL_INFO).map(([k, [nm, ds]]) => `<div class="sk"><span class="nm">${nm}</span><span class="ds">${ds}</span>
          ${poolHTML(`data-pool="skills.${k}"`, nm)}<button type="button" class="roll-mini" data-roll-path="skills.${k}" data-roll-label="${nm}" data-talent="${nm}">🎲 Roll</button></div>`).join('')}
      </div></section>
      <section class="sec"><h3>HEALTH &amp; GRIT <small>tracked live in Combat &amp; Dice</small></h3><div class="in" data-dyn="vitals"></div></section>
      <section class="sec w12"><h3>ABILITIES <small>unlock with Prestige · tick the ones you have</small></h3><div class="in">
        <div class="abgrid">${abilities}</div>
        <div class="row2" data-dyn="aces"></div>
        <div class="abgrid">${aces}</div>
      </div></section>
      <section class="sec w12"><h3>WEAPONS <small>each weapon has between 1–4 upgrade slots · 🎲 rolls that range’s dice</small></h3><div class="in">${weapons}</div></section>

      <div class="page-label">— PAGE TWO —</div>
      <section class="sec w4"><h3>PRESTIGE <small>fame &amp; progression</small></h3><div class="in">
        <div class="fr">${inp('prestige.total', 'TOTAL', { type: 'number' })}${inp('prestige.unclaimed', 'UNCLAIMED', { type: 'number' })}</div>
        <ul class="prestige-ref">
          <li><b>2</b> Practice Skill — swap one Black die for Gold</li>
          <li><b>2</b> Increase Health — +1 max Health (max 5 times)</li>
          <li><b>4</b> Develop Talent — reroll Spurs with a Talent</li>
          <li><b>4</b> Unlock Ability — a new Trade ability</li>
          <li><b>6</b> Master Skill — +1B to a Skill (max 3 times)</li>
          <li><b>6</b> Ace-in-the-Hole! 2</li>
        </ul>
      </div></section>
      <section class="sec w8"><h3>TALENTS <small>reroll Spurs when using marked items</small></h3><div class="in"><div class="talents">
        ${meta.talents.map((tl) => `<label><input type="checkbox" data-toggle="talents" value="${esc(tl)}"><span>${esc(tl)} <small>(${esc(TALENT_INFO[tl] || '')})</small></span></label>`).join('')}
      </div></div></section>
      <section class="sec"><h3>REPUTATION <small>alters Charm rolls made against a faction</small></h3><div class="in">
        ${[0, 1, 2, 3].map((i) => `<div class="rep">${inp(`reputation.${i}.faction`, 'FACTION')}${inp(`reputation.${i}.level`, 'STANDING', { type: 'select', options: meta.reputationLevels })}</div>`).join('')}
        <p class="muted" style="margin:0;font-size:14px">Revered +2B · Helpful +1B · Neutral +0B · Suspicious −1B · Hostile −2B</p>
      </div></section>
      <section class="sec"><h3>GEAR ITEMS <small>first aid, explosives, &amp; traps</small></h3><div class="in">
        ${[0, 1, 2].map((i) => `<div class="weapon"><div class="fr">${inp(`gear.${i}.item`, 'ITEM')}${inp(`gear.${i}.type`, 'TYPE')}${inp(`gear.${i}.grit`, 'GRIT', { max: 4 })}</div>
          ${inp(`gear.${i}.notes`, 'DICE / NOTES')}<div class="row2" data-dyn="gear-${i}"></div></div>`).join('')}
      </div></section>
      <section class="sec"><h3>FORSTALL <small>emits energy waves that disturb &amp; repel monsters</small></h3><div class="in">
        <div class="fr">${inp('forstall.model', 'MODEL')}${inp('forstall.slots', 'UPGRADE SLOTS', { max: 4 })}${inp('forstall.range', 'RANGE')}${inp('forstall.grit', 'GRIT', { max: 4 })}${inp('forstall.duration', 'DURATION (HRS)', { max: 6 })}</div>
        <div class="row2" data-dyn="charges"></div>
        <div class="fr">${[0, 1, 2, 3].map((u) => inp(`forstall.upgrades.${u}`, `UPGRADE ${u + 1}`)).join('')}</div>
        <div class="fr">${[0, 1, 2, 3].map((u) => inp(`forstall.kz.${u}`, 'KURTZ FREQUENCY (KZ)', { list: 'kz-list', ph: '0-0-0000' })).join('')}</div>
        <datalist id="kz-list"></datalist>
      </div></section>
      <section class="sec"><h3>HORSE <small>you’re only as good as your loyal steed</small></h3><div class="in">
        <div class="fr">${inp('horse.name', 'NAME')}${inp('horse.breed', 'BREED')}${inp('horse.breakingPoint', 'BREAKING POINT')}</div>
        <div class="fr">${inp('horse.maxHealth', 'MAX HEALTH', { max: 4 })}${inp('horse.health', 'HEALTH', { max: 4 })}${inp('horse.bond', 'BOND', { type: 'select', options: meta.reputationLevels })}</div>
        ${inp('horse.breedAbility', 'BREED ABILITY', { max: 300 })}${inp('horse.disposition', 'DISPOSITION', { max: 300 })}${inp('horse.appearance', 'APPEARANCE', { max: 300 })}
      </div></section>
      <section class="sec"><h3>MECH <small>carts, wagons, &amp; cabins given a new life</small></h3><div class="in">
        <div class="fr">${inp('mech.class', 'CLASS')}${inp('mech.slots', 'UPGRADE SLOTS', { max: 4 })}${inp('mech.speed', 'SPEED')}</div>
        <div class="fr">${inp('mech.maxHealth', 'MAX HEALTH', { max: 4 })}${inp('mech.health', 'HEALTH', { max: 4 })}<div class="f">DEFENSE${poolHTML('data-pool="mech.defense"', 'Mech defense')}</div>${inp('mech.state', 'CONDITION', { type: 'select', options: meta.mechStates })}</div>
        <div class="fr">${inp('mech.supplies', 'SUPPLY SLOTS')}${inp('mech.cover', 'PLAYER COVER')}</div>
        <div class="fr">${[0, 1, 2, 3].map((u) => inp(`mech.upgrades.${u}`, `UPGRADE ${u + 1}`)).join('')}</div>
      </div></section>
      <section class="sec"><h3>INVENTORY <small>loot, trophies, &amp; additional items</small></h3><div class="in">
        <div class="fr">${inp('wallet', 'WALLET $', { max: 20 })}${inp('scrap', 'SCRAP (PCS)', { max: 20 })}${inp('supplies', 'SUPPLIES', { max: 20 })}</div>
        ${inp('inventory', 'ITEMS', { type: 'textarea' })}
      </div></section>
      <section class="sec"><h3>WHO THEY ARE</h3><div class="in">
        ${inp('disposition', 'DISPOSITION — ATTITUDE, WORRIES, & WISHES', { type: 'textarea', max: 1000 })}
        ${inp('appearance', 'APPEARANCE — AGE, BUILD, & ATTIRE', { type: 'textarea', max: 1000 })}
      </div></section>
      <section class="sec w12"><h3>HISTORY <small>how your legend began</small></h3><div class="in">${inp('history', '', { type: 'textarea' })}</div></section>
    </div>
    <div class="danger-zone"><button class="btn small secondary danger" id="delete-pc" type="button">Delete this character</button></div>`;

  const view = $('#sheet-view');
  view.querySelectorAll('[data-path]').forEach((el) => el.addEventListener('change', () => {
    const v = el.type === 'number' ? Number(el.value) : el.value;
    act({ action: 'sheet', id: p.id, path: el.dataset.path, value: v }, el);
  }));
  view.addEventListener('change', (e) => {
    const dp = e.target.closest('.dp[data-pool]');
    if (dp) act({ action: 'sheet', id: p.id, path: dp.dataset.pool, value: readPool(dp) }, e.target);
  });
  view.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('change', () => act({ action: 'sheet', id: p.id, list: el.dataset.toggle, item: el.value })));
  view.querySelectorAll('[data-bool]').forEach((el) => el.addEventListener('change', () => act({ action: 'sheet', id: p.id, path: el.dataset.bool, value: el.checked })));
  view.querySelectorAll('[data-roll-path]').forEach((b) => b.addEventListener('click', async () => {
    const pc = pcById(p.id);
    const pool = get(pc, b.dataset.rollPath);
    if (!isPool(pool)) return toast('Set how many Black and Gold dice first.', true);
    const weapon = b.dataset.weapon !== undefined ? pc.weapons[b.dataset.weapon] : null;
    const label = weapon ? `${weapon.model || weapon.manufacturer || 'Weapon'} — ${b.dataset.rollLabel}` : b.dataset.rollLabel;
    const r = await act({ action: 'roll', who: pc.id, pool, label, spur: b.dataset.talent ? pc.talents.includes(b.dataset.talent) : false });
    if (r?.hits !== undefined) toast(`${label}: ${r.hits} hit${r.hits === 1 ? '' : 's'}${r.aces ? ` (${r.aces} Ace${r.aces > 1 ? 's' : ''})` : ''} — it’s in the Table Log.`);
  }));
  $('#delete-pc').addEventListener('click', async () => {
    if (!confirm(`Delete ${pcById(p.id).name}’s sheet for everyone? This can’t be undone.`)) return;
    if (await act({ action: 'pc', id: p.id, op: 'remove' })) location.hash = '';
  });
}

const pipRow = (label, n, max, attr) => `<span class="lbl">${label}</span><span class="pips">${Array.from({ length: max }, (_, i) =>
  `<button type="button" class="pip${attr === 'aces' ? ' ace' : ''}${i < n ? ' on' : ''}" data-${attr}="${i + 1}" aria-label="${label} ${i + 1}"></button>`).join('')}</span>`;
const nextVal = (b, n) => (b.classList.contains('on') && !b.nextElementSibling?.classList.contains('on') ? n - 1 : n);

// Re-render the live bits (and fill inputs nobody is typing in).
function hydrate(p) {
  const view = $('#sheet-view');
  view.querySelectorAll('[data-path]').forEach((el) => {
    if (el === document.activeElement) return;
    const v = get(p, el.dataset.path);
    el.value = v ?? '';
  });
  view.querySelectorAll('[data-toggle]').forEach((el) => { el.checked = p[el.dataset.toggle].includes(el.value); });
  view.querySelectorAll('[data-ab]').forEach((el) => el.classList.toggle('locked', !p.abilities.includes(el.dataset.ab)));
  view.querySelectorAll('[data-bool]').forEach((el) => { el.checked = !!p[el.dataset.bool]; });
  view.querySelector('[data-ace2]')?.classList.toggle('locked', !p.aceTwo);

  const send = (o) => act({ action: 'pc', id: p.id, ...o });
  const vitals = view.querySelector('[data-dyn="vitals"]');
  // Only hold off re-rendering while someone is typing in a box (checkbox/button focus doesn't count).
  const typing = vitals.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea, select');
  const pct = Math.max(0, Math.min(100, (p.health / Math.max(1, p.maxHealth)) * 100));
  if (typing) {
    vitalsStale = true;
    vitals.querySelector('.bar i').style.width = `${pct}%`;
    vitals.querySelector('.hp .num').textContent = `${p.health}/${p.maxHealth}`;
  } else {
    vitalsStale = false;
    vitals.innerHTML = `
      <div class="hp"><span class="lbl">HEALTH</span><span class="bar"><i style="width:${pct}%"></i></span><span class="num">${p.health}/${p.maxHealth}</span>
        <span class="pm"><button type="button" data-hp="-1" aria-label="Lose 1 Health">−</button><button type="button" data-hp="1" aria-label="Gain 1 Health">+</button></span></div>
      <div class="fr"><label class="f">MAX HEALTH<input data-vpath="maxHealth" type="number" min="1" max="99" value="${p.maxHealth}"></label>
        <div class="f">DEFENSE${poolHTML('data-pool="defense"', 'Defense')}</div></div>
      <div class="row2">${pipRow('GRIT', p.grit, Math.max(6, p.grit), 'grit')}</div>
      <div class="status-list"><div class="lbl">STATUSES <span class="muted">— relieved by rolling with the associated Skill</span></div>
        ${SHEET_STATUSES.map(([s, sk, txt]) => { const v = p.statuses?.[s] || 0; return `<div class="st-row${v ? ' on' : ''}">
          <label class="st-check"><input type="checkbox" data-stc="${s}"${v ? ' checked' : ''}><span class="st-sk">${sk}</span><b>${s}</b></label>
          <span class="st-desc">${esc(txt)}</span>
          <span class="sev">${v ? `<button type="button" data-st="${s}" data-v="${v - 1}" aria-label="Lower ${s}">−</button><b title="Severity">${v}</b><button type="button" data-st="${s}" data-v="${v + 1}" aria-label="Raise ${s}">+</button>` : ''}</span>
        </div>`; }).join('')}
      </div>
      ${p.bleeding ? '<p class="bleed"><b>BLEEDING OUT</b> — handle it on the Combat &amp; Dice page.</p>' : ''}
      ${p.dead ? '<p class="bleed"><b>FALLEN</b></p>' : ''}
      <div><button class="btn small secondary" type="button" data-rest>🔥 Rest at camp / town</button> <span class="muted" style="font-size:13px">full Health, clear Statuses, reset Ace meter</span></div>`;
    vitals.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', () => send({ op: 'health', delta: Number(b.dataset.hp) })));
    vitals.querySelectorAll('[data-vpath]').forEach((el) => el.addEventListener('change', () =>
      act({ action: 'sheet', id: p.id, path: el.dataset.vpath, value: el.type === 'number' ? Number(el.value) : el.value }, el)));
    vitals.querySelectorAll('[data-grit]').forEach((b) => b.addEventListener('click', () => send({ op: 'grit', value: nextVal(b, Number(b.dataset.grit)) })));
    vitals.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => send({ op: 'status', status: b.dataset.st, value: Number(b.dataset.v) })));
    vitals.querySelectorAll('[data-stc]').forEach((c) => c.addEventListener('change', () => send({ op: 'status', status: c.dataset.stc, value: c.checked ? 1 : 0 })));
    vitals.querySelector('[data-rest]').addEventListener('click', () => { if (confirm('Rest up? Health refills, Statuses clear, Ace meter resets.')) send({ op: 'rest' }); });
  }

  const aces = view.querySelector('[data-dyn="aces"]');
  aces.innerHTML = `${pipRow('ACES', p.aces, 6, 'aces')}<span class="muted" style="font-size:14px">${p.aces >= 6 ? 'Ready! Play an Ace-in-the-Hole below.' : 'Roll 6 Aces in combat to unlock your Ace-in-the-Hole.'}</span>`;
  aces.querySelectorAll('[data-aces]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: 'aces', value: nextVal(b, Number(b.dataset.aces)) })));

  view.querySelectorAll('[data-uses]').forEach((el) => {
    const name = el.dataset.uses;
    const used = p.abilityUses?.[name] || 0;
    el.innerHTML = `USED TODAY ${Array.from({ length: 2 }, (_, i) => `<button type="button" class="pip${i < used ? ' on' : ''}" data-use="${i + 1}" aria-label="Use ${i + 1}"></button>`).join('')}`;
    el.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: `abilityUses.${name}`, value: nextVal(b, Number(b.dataset.use)) })));
  });
  [0, 1, 2].forEach((i) => {
    const el = view.querySelector(`[data-dyn="gear-${i}"]`);
    el.innerHTML = pipRow('USES', p.gear[i].uses || 0, 6, 'guse');
    el.querySelectorAll('[data-guse]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: `gear.${i}.uses`, value: nextVal(b, Number(b.dataset.guse)) })));
  });
  const ch = view.querySelector('[data-dyn="charges"]');
  ch.innerHTML = `${pipRow('CHARGES', p.forstall.charges ?? 0, Math.max(2, p.forstall.charges ?? 0), 'chg')}<span class="muted" style="font-size:14px">battery charges (of 2)</span>`;
  ch.querySelectorAll('[data-chg]').forEach((b) => b.addEventListener('click', () => act({ action: 'sheet', id: p.id, path: 'forstall.charges', value: nextVal(b, Number(b.dataset.chg)) })));

  view.querySelectorAll('.dp[data-pool]').forEach((dp) => fillPool(dp, get(p, dp.dataset.pool)));
  const dl = view.querySelector('#kz-list');
  if (dl && !dl.children.length) dl.innerHTML = kzOptions.map((o) => `<option value="${esc(o.kz)}">${esc(o.name)}</option>`).join('');
  document.title = `${p.name} · Posse Sheets`;
}

// ---------- routing & boot ----------
function render() {
  if (!data) return;
  const id = location.hash.slice(1);
  const p = id && pcById(id);
  $('#list-view').hidden = !!p;
  $('#sheet-view').hidden = !p;
  if (!p) {
    builtFor = null;
    document.title = 'Posse Sheets · Wild Imaginary West';
    if (id) toast('That character isn’t in the posse anymore.', true);
    renderList();
    return;
  }
  if (builtFor !== p.id) { buildSheet(p); builtFor = p.id; window.scrollTo(0, 0); }
  hydrate(p);
}
window.addEventListener('hashchange', render);
$('#sheet-view').addEventListener('focusout', () => setTimeout(() => { if (vitalsStale) render(); }, 60));

(async () => {
  meta = await api('GET', null, '?view=meta', EP);
  // Decoded frequencies from the Forstall notebook make handy suggestions for the sheet's Kz boxes.
  try {
    const scan = await api('GET', null, '?view=player');
    kzOptions = (scan.notebook || []).filter((e) => e.solved).map((e) => ({ kz: e.kz, name: e.name }));
  } catch {}
  poller = startPolling('player', (d) => { data = d; render(); }, (ok) => {
    $('#conn').classList.toggle('off', !ok);
    $('#conn').textContent = ok ? 'Connected' : 'Reconnecting…';
  }, EP);
})();
