import {
  $, esc, api, startPolling, toast, store, mountNav, tryWarden, forgetWarden, savedPin, wardenModal, injectDefs,
  poolIcons, poolHTML, readPool, ask, askText, tell } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';

const EP = '/api/shop';
injectDefs();
mountTableLog();
mountNav('/store');

let catalog = [], categories = [], data = null, warden = false, poller = null;
let cat = store.get('wiw.storeCat', 'Weapons');
const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
const POOL = /^(\d+[BG])+$/i;
const show = (v) => (POOL.test(String(v || '').replace(/\s/g, '')) ? poolIcons(String(v).toUpperCase().replace(/\s/g, '')) : esc(v));

async function act(body, okMsg) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (okMsg) toast(okMsg);
    return res.result ?? true;
  } catch (e) { toast(e.message, true); return null; }
}
const items = () => [...catalog, ...(data?.custom || [])];
// after a buy/give: say where it landed on the sheet, or explain why it couldn't go on
async function placedNote(r, done) {
  if (r === null) return;
  if (r?.warning) await tell(`No room on the sheet

${r.warning}`);
  else toast(r?.placed ? `${done} — added to the sheet (${r.placed}).` : `${done} — it’s in their inventory.`);
}

// ---------- catalog browsing ----------
function renderTabs() {
  const counts = {};
  items().forEach((i) => { counts[i.cat] = (counts[i.cat] || 0) + 1; });
  const tabs = [...categories.filter((c) => counts[c]), 'All'];
  $('#cat-tabs').innerHTML = tabs.map((c) => `<button type="button" role="tab" aria-selected="${c === cat}" data-cat="${esc(c)}">${esc(c)}<small>${c === 'All' ? items().length : counts[c]}</small></button>`).join('');
  $('#cat-tabs').querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    cat = b.dataset.cat; store.set('wiw.storeCat', cat); $('#sub').value = ''; renderTabs(); renderSubs(); renderItems();
  }));
}
function renderSubs() {
  const subs = [...new Set(items().filter((i) => cat === 'All' || i.cat === cat).map((i) => i.sub))].sort((a, b) => a.localeCompare(b));
  const cur = $('#sub').value;
  $('#sub').innerHTML = `<option value="">All sections</option>${subs.map((s) => `<option>${esc(s)}</option>`).join('')}`;
  $('#sub').value = subs.includes(cur) ? cur : '';
}

const STAT_LABELS = [['quality', null], ['grit', 'GRIT'], ['slots', 'SLOTS'], ['arms', 'ARM’S REACH'], ['short', 'SHORT'], ['long', 'LONG'], ['distant', 'DISTANT'],
  ['pool', 'DICE'], ['setup', 'SET UP'], ['defense', 'DEFENSE'], ['range', 'RANGE'], ['sweep', 'SWEEP'], ['battery', 'BATTERY'], ['duration', 'DURATION'],
  ['health', 'HEALTH'], ['speed', 'SPEED'], ['cover', 'COVER'], ['capacity', 'CAPACITY'], ['supply', 'SUPPLY SLOTS'], ['breaking', 'BREAKING PT'],
  ['upgrade', 'UPGRADE'], ['scrapCost', 'SCRAP'], ['type', 'TYPE'], ['appliesTo', 'FOR']];

function itemCard(i) {
  const stats = STAT_LABELS.filter(([k]) => k !== 'quality' && i[k] != null && i[k] !== '')
    .map(([k, l]) => `<div><span>${l}</span><b>${k === 'grit' && i.grit2 ? `${esc(i.grit)} · ${esc(i.grit2)} (2 ops)` : show(i[k])}</b></div>`).join('');
  const text = [i.benefit, i.effect, i.bond && `Revered bond: ${i.bond}`, i.desc, i.note, i.scrap && `Kitbash: ${i.scrap}`].filter(Boolean);
  const shopper = $('#shopper').value;
  return `<article class="item${i.custom ? ' custom' : ''}" data-id="${esc(i.id)}">
    ${i.img ? `<div class="pic"><img src="/img/store/${esc(i.img)}.webp" alt="" loading="lazy"></div>` : ''}
    <div class="top"><div><div class="sub">${esc(i.sub)}${i.quality ? ` · <span class="q ${esc(i.quality)}">${esc(i.quality.toUpperCase())}</span>` : ''}</div><div class="nm">${esc(i.name)}</div></div>
      <div class="price${i.cost == null ? ' none' : ''}">${i.cost == null ? 'not for sale' : money(i.cost)}</div></div>
    ${stats ? `<div class="stats">${stats}</div>` : ''}
    ${text.map((t) => `<p>${esc(t)}</p>`).join('')}
    <div class="src">${i.custom ? 'Warden-made' : i.house ? 'House item' : `Guidebook p. ${i.page}`}</div>
    <div class="actions">
      ${i.cost != null ? `<input type="number" min="1" max="99" value="1" aria-label="Quantity" data-qty><button class="btn small" data-buy type="button"${shopper ? '' : ' disabled'}>Ask to buy</button>` : ''}
      ${warden ? `<button class="btn small secondary" data-give type="button"${shopper ? '' : ' disabled'} title="Hand it over free — loot, rewards">Give</button>` : ''}
      ${warden && i.custom ? '<button class="btn small secondary" data-edit type="button">Edit</button><button aria-label="Delete this item" title="Delete this item" class="rm-btn" data-rm type="button">×</button>' : ''}
    </div></article>`;
}

function renderItems() {
  const q = $('#q').value.trim().toLowerCase();
  const sub = $('#sub').value;
  let list = items().filter((i) => (cat === 'All' || i.cat === cat) && (!sub || i.sub === sub)
    && (!q || [i.name, i.sub, i.benefit, i.effect, i.desc, i.note].join(' ').toLowerCase().includes(q)));
  const s = $('#sort').value;
  if (s === 'cheap') list = [...list].sort((a, b) => (a.cost ?? 1e9) - (b.cost ?? 1e9));
  if (s === 'dear') list = [...list].sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1));
  if (s === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  $('#count').textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
  const box = $('#items');
  box.innerHTML = list.map(itemCard).join('') || '<p class="empty-note">Nothing on these shelves matches.</p>';
  box.querySelectorAll('.item').forEach((card) => {
    const iid = card.dataset.id;
    const qty = () => Number(card.querySelector('[data-qty]')?.value) || 1;
    card.querySelector('[data-buy]')?.addEventListener('click', () => act({ action: 'request', kind: 'buy', pc: $('#shopper').value, itemId: iid, qty: qty() }, 'Request sent to the Warden.'));
    card.querySelector('[data-give]')?.addEventListener('click', async () => placedNote(await act({ action: 'give', pc: $('#shopper').value, itemId: iid, qty: qty() }), 'Given'));
    card.querySelector('[data-rm]')?.addEventListener('click', async () => { if (await ask('Remove this item from the store?')) act({ action: 'removeCustom', id: iid }); });
    card.querySelector('[data-edit]')?.addEventListener('click', () => fillCreate(items().find((i) => i.id === iid)));
  });
}
['#q', '#sub', '#sort'].forEach((s) => $(s).addEventListener(s === '#q' ? 'input' : 'change', renderItems));

// ---------- shopper, requests, inventory ----------
function renderSide() {
  const sel = $('#shopper');
  const cur = sel.value || store.get('wiw.shopper', '');
  sel.innerHTML = '<option value="">— pick a character —</option>' + data.posse.map((p) => `<option value="${p.id}">${esc(p.name)} (The ${esc(p.trade)})</option>`).join('');
  sel.value = data.posse.some((p) => p.id === cur) ? cur : '';
  const pc = data.posse.find((p) => p.id === sel.value);
  $('#wallet').innerHTML = pc ? `WALLET <b>${money(pc.wallet)}</b>` : '<span class="muted">Pick who’s shopping.</span>';

  const reqRow = (r, controls) => `<div class="req" data-id="${r.id}">
    <div class="top"><span><span class="kind ${r.kind}">${r.kind.toUpperCase()}</span> ${r.qty > 1 ? `${r.qty}× ` : ''}${esc(r.name)}</span><span class="st ${r.status}">${r.status.toUpperCase()}</span></div>
    <div class="muted fine">${esc(r.pcName)} · ${money(r.price)}${r.note ? ` · ${esc(r.note)}` : ''}</div>${controls || ''}</div>`;
  const mine = data.requests.filter((r) => !pc || r.pc === pc.id);
  $('#my-requests').innerHTML = mine.length ? mine.slice(0, 20).map((r) => reqRow(r, r.status === 'pending' ? '<div class="ctrl"><button class="btn small secondary" data-cancel type="button">Cancel</button></div>' : '')).join('')
    : '<p class="empty-note">No requests yet.</p>';
  $('#my-requests').querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => act({ action: 'cancel', id: b.closest('.req').dataset.id })));

  $('#queue-card').hidden = !warden;
  $('#create-card').hidden = !warden;
  if (warden) {
    const pending = data.requests.filter((r) => r.status === 'pending');
    $('#queue').innerHTML = pending.length ? pending.map((r) => reqRow(r, `<div class="ctrl">
        <label class="muted fine">${r.kind === 'sell' ? 'Pay out' : 'Charge'} $<input type="number" min="0" step="0.01" value="${r.price.toFixed(2)}" data-price></label>
        <button class="btn small" data-yes type="button">Approve</button><button class="btn small secondary danger" data-no type="button">Deny</button></div>`)).join('')
      : '<p class="empty-note">Nobody at the counter.</p>';
    $('#queue').querySelectorAll('.req').forEach((row) => {
      row.querySelector('[data-yes]').addEventListener('click', async () => placedNote(await act({ action: 'decide', id: row.dataset.id, approve: true, price: row.querySelector('[data-price]').value }), 'Done'));
      row.querySelector('[data-no]').addEventListener('click', () => act({ action: 'decide', id: row.dataset.id, approve: false }));
    });
  }

  // everything they could sell: Store buys, plus starting weapons, packs, a horse or mech already on their sheet
  const inv = pc?.sell || [];
  $('#inventory').innerHTML = !pc ? '<p class="empty-note">Pick a character to see what they carry.</p>'
    : inv.length ? inv.map((i) => `<div class="inv-row" data-key="${esc(i.key)}"><span>${i.qty > 1 ? `${i.qty}× ` : ''}${esc(i.name)}<small>${i.where ? `on sheet: ${esc(i.where)}` : 'inventory'}${i.unit ? ` · worth about ${money(i.unit)}` : ''}</small></span>
        <button class="btn small secondary" data-sell type="button">Sell…</button></div>`).join('')
    : '<p class="empty-note">Nothing to sell yet.</p>';
  $('#inventory').querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', async () => {
    const it = inv.find((x) => x.key === b.closest('.inv-row').dataset.key);
    const qty = it.qty > 1 ? Number(await askText(`Sell how many? (they have ${it.qty})`, '1')) : 1;
    if (!qty) return;
    if (it.where && !await ask(`Sell ${it.name}?

Once the Warden approves, it comes off ${pc.name}’s sheet (${it.where}).`, { ok: 'Ask to sell it', danger: false })) return;
    act({ action: 'request', kind: 'sell', pc: pc.id, key: it.key, qty }, 'Sale request sent — the Warden sets the price.');
  }));
}
$('#shopper').addEventListener('change', (e) => { store.set('wiw.shopper', e.target.value); renderSide(); renderItems(); });
$('#clear-history').addEventListener('click', () => act({ action: 'clearHistory' }));
$('#equip-all').addEventListener('click', async () => {
  const r = await act({ action: 'equipAll' });
  if (!r) return;
  const done = r.placed.length ? `Filled in ${r.placed.length}: ${r.placed.join(' · ')}.` : 'Nothing new to fill in.';
  await tell(`Sheets updated\n\n${done}${r.noRoom.length ? ` Still no room: ${r.noRoom.join(' ')}` : ''}`);
});

// ---------- Warden: make an item ----------
function buildCreate() {
  const f = $('#create');
  f.innerHTML = `
    <label>CATEGORY<select name="cat">${categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
    <label>SECTION<input name="sub" maxlength="40" list="sub-list" placeholder="Pick or type a new one"></label><datalist id="sub-list"></datalist>
    <label class="full">NAME<input name="name" maxlength="80" required></label>
    <label>COST ($)<input name="cost" type="number" min="0" step="0.01" placeholder="blank = not sold"></label>
    <label data-for="quality">QUALITY<select name="quality"><option value="">—</option><option>Used</option><option>Basic</option><option>Premium</option><option>Elite</option></select></label>
    <label data-for="grit">GRIT<input name="grit" maxlength="10"></label>
    <label data-for="slots">UPGRADE SLOTS<input name="slots" type="number" min="0" max="4"></label>
    <div class="full dice-set" data-for="dice"><span class="ds-title">DICE <small>Black · Gold</small></span>
      ${[['arms', 'Arm’s Reach'], ['short', 'Short Range'], ['long', 'Long Range'], ['distant', 'Distant']].map(([k, l]) =>
        `<div class="ds-row" data-for="${k}"><span>${l}</span>${poolHTML(`data-f="${k}"`, l)}</div>`).join('')}</div>
    <label class="full" data-for="effect">EFFECT<input name="effect" maxlength="200" placeholder="e.g. Trapped [2B] + Damage [1]"></label>
    <label class="full">DESCRIPTION<textarea name="desc" maxlength="600"></textarea></label>
    <input type="hidden" name="id">
    <div class="full btn-row"><button class="btn small" type="submit" id="create-go">Add to the store</button><button class="btn small secondary" type="reset" id="create-reset">Clear</button></div>`;
  // show only the fields that kind of item uses (the book's price list as the guide)
  const USES = {
    Weapons: ['quality', 'grit', 'slots', 'dice', 'arms', 'short', 'long', 'distant'],
    Traps: ['quality', 'grit', 'slots', 'dice', 'arms', 'short', 'effect'],
    Gear: ['quality', 'grit', 'dice', 'arms', 'short', 'effect'],
    Forstalls: ['grit', 'slots', 'effect'],
    Mechs: ['slots', 'effect'],
    Upgrades: ['effect'],
  };
  const sync = () => {
    const use = USES[f.cat.value] || ['effect'];
    f.querySelectorAll('[data-for]').forEach((el) => { el.hidden = !use.includes(el.dataset.for); });
    const subs = [...new Set(catalog.filter((i) => i.cat === f.cat.value).map((i) => i.sub).filter(Boolean))];
    $('#sub-list').innerHTML = subs.map((s) => `<option value="${esc(s)}">`).join('');
  };
  f.cat.addEventListener('change', sync);
  sync();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f));
    f.querySelectorAll('.dp[data-f]').forEach((dp) => { fd[dp.dataset.f] = readPool(dp); });
    const editing = !!fd.id;
    const r = await act({ action: editing ? 'editCustom' : 'addCustom', ...fd }, editing ? 'Item updated.' : 'Item added to the store.');
    if (r) { f.reset(); f.id.value = ''; $('#create-go').textContent = 'Add to the store'; cat = r.cat; renderTabs(); renderSubs(); renderItems(); }
  });
  f.addEventListener('reset', () => { setTimeout(() => { f.id.value = ''; $('#create-go').textContent = 'Add to the store'; sync(); }); });
  f.syncFields = sync;
}
function fillCreate(i) {
  const f = $('#create');
  ['cat', 'sub', 'name', 'cost', 'quality', 'grit', 'slots', 'effect', 'desc', 'id'].forEach((k) => { if (f[k]) f[k].value = i[k] ?? ''; });
  f.querySelectorAll('.dp[data-f]').forEach((dp) => {
    const m = String(i[dp.dataset.f] || '').match(/^(?:(\d+)B)?(?:(\d+)G)?$/) || [];
    dp.querySelector('[data-c="B"]').value = m[1] || ''; dp.querySelector('[data-c="G"]').value = m[2] || '';
  });
  f.syncFields?.();
  $('#create-go').textContent = 'Save changes';
  f.scrollIntoView({ behavior: 'smooth' });
}

// ---------- boot ----------
function onState(d) { data = d; renderTabs(); renderSubs(); renderSide(); renderItems(); }
function connect() {
  poller?.stop();
  poller = startPolling(warden ? 'warden' : 'player', onState, (ok, e) => { if (e?.status === 401) { warden = false; forgetWarden(); setWarden(); connect(); } }, EP);
}
function setWarden() { $('#warden-btn').innerHTML = `${gl('star')} ${warden ? 'Warden mode · lock' : 'Warden'}`; if (data) onState(data); }
$('#warden-btn').addEventListener('click', async () => {
  if (warden) { warden = false; forgetWarden(); } else if (!(warden = await wardenModal(EP))) return;
  setWarden(); connect();
});
(async () => {
  const c = await api('GET', null, '?view=catalog', EP);
  catalog = c.catalog; categories = c.categories;
  buildCreate();
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWarden();
  connect();
})();
