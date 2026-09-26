// General store: the Guidebook catalog + Warden-made items, and buy/sell requests the Warden approves.
import { CATALOG } from './catalog.js';
import { addLog } from './combat.js';
import { equipItem, isPlaced, placedIn, unequipItem, blankWeapon, blankGear, blankForstall, blankHorse, blankMech } from './sheets.js';
import { money, id, clean as cleanText } from './util.js';

const clean = (s, n = 80) => cleanText(s, n);
const POOL = /^(\d+[BG])+$/;
const pool = (v) => { const s = String(v || '').toUpperCase().replace(/\s+/g, ''); return POOL.test(s) ? s : clean(v, 60); };
export const CATEGORIES = ['Weapons', 'Traps', 'Gear', 'Forstalls', 'Mechs', 'Upgrades', 'Horses & Mounts', 'Goods & Services'];
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

export function freshShop() { return { v: 0, custom: [], requests: [] }; }

const allItems = (shop) => [...CATALOG, ...shop.custom];
export const findItem = (shop, itemId) => allItems(shop).find((i) => i.id === itemId) || null;
const walletOf = (pc) => money(pc.wallet);

// Everything a character can sell: the inventory, plus what's on the sheet but never went through the Store
// (starting weapons, packs, a horse or mech filled in by hand). key: 'inv:<uid>' | 'weapon:<i>' | 'gear:<i>' | 'forstall' | 'horse' | 'mech'
export function sellables(pc, shop) {
  const items = pc.items || [], out = [];
  const byName = (n) => (n ? allItems(shop).find((i) => i.name.toLowerCase() === String(n).toLowerCase()) : null);
  const half = (it) => (it?.cost != null ? Math.round(it.cost * 50) / 100 : 0); // suggested: half the Store price; the Warden decides
  const inInv = (itemId, name) => items.some((i) => (itemId && i.itemId === itemId) || (name && i.name === name));
  for (const i of items) out.push({ key: `inv:${i.uid}`, name: i.name, qty: Number(i.qty) || 1, where: placedIn(pc, i) || '', unit: half(findItem(shop, i.itemId)) });
  const count = {}, seen = {};
  items.forEach((i) => { if (i.itemId) count[i.itemId] = (count[i.itemId] || 0) + (Number(i.qty) || 1); });
  (pc.weapons || []).forEach((w, k) => {
    const name = [w.manufacturer, w.model].filter(Boolean).join(' - ');
    if (!name) return;
    if (w.itemId && (seen[w.itemId] = (seen[w.itemId] || 0) + 1) <= (count[w.itemId] || 0)) return; // this one is an inventory row already
    out.push({ key: `weapon:${k}`, name, qty: 1, where: 'Weapons', unit: half(findItem(shop, w.itemId) || byName(name) || byName(w.model)) });
  });
  (pc.gear || []).forEach((g, k) => {
    if (!g.item || inInv(g.itemId, g.item)) return;
    out.push({ key: `gear:${k}`, name: g.item, qty: 1, where: 'Gear', unit: half(findItem(shop, g.itemId) || byName(g.item)) });
  });
  const f = pc.forstall;
  if (f?.model && !inInv(f.itemId, f.model)) out.push({ key: 'forstall', name: f.model, qty: 1, where: 'Forstall', unit: half(findItem(shop, f.itemId) || byName(f.model)) });
  const h = pc.horse;
  if ((h?.breed || h?.name) && !inInv(h.itemId, h.breed)) out.push({ key: 'horse', name: h.name && h.breed ? `${h.name} (${h.breed})` : h.name || h.breed, qty: 1, where: 'Horse', unit: half(findItem(shop, h.itemId) || byName(h.breed)) });
  const m = pc.mech;
  if (m?.class && !inInv(m.itemId, m.class)) out.push({ key: 'mech', name: m.class, qty: 1, where: 'Mech', unit: half(findItem(shop, m.itemId) || byName(m.class)) });
  return out;
}
// take a sold thing off the character (and off the sheet, if it was on it)
function removeSold(pc, key, qty, name) {
  const [kind, ref] = key.split(':');
  if (kind === 'inv') {
    const owned = (pc.items || []).find((i) => i.uid === ref);
    if (!owned || owned.qty < qty) throw new Error('They no longer have that item.');
    const where = placedIn(pc, owned);
    owned.qty -= qty;
    if (owned.qty <= 0) { pc.items = pc.items.filter((i) => i !== owned); if (where) unequipItem(pc, owned.itemId, owned.name); }
    return;
  }
  const now = sellables(pc, { custom: [] }).find((x) => x.key === key);
  if (!now || now.name !== name) throw new Error('That’s no longer on their sheet.');
  if (kind === 'weapon') pc.weapons[Number(ref)] = blankWeapon();
  else if (kind === 'gear') pc.gear[Number(ref)] = blankGear();
  else if (kind === 'forstall') pc.forstall = blankForstall();
  else if (kind === 'horse') pc.horse = blankHorse();
  else if (kind === 'mech') pc.mech = blankMech();
}

// ---------- player requests ----------
export function shopAction(shop, combat, a, { warden }) {
  const pcOf = (pid) => { const p = combat.posse.find((x) => x.id === pid); if (!p) throw new Error('Pick a character.'); return p; };
  switch (a.action) {
    case 'request': {
      const pc = pcOf(a.pc);
      const qty = Math.max(1, Math.min(99, Math.round(Number(a.qty) || 1)));
      let item, unit, name;
      let key = null;
      if (a.kind === 'sell') {
        key = a.key || (a.uid ? `inv:${a.uid}` : '');
        const thing = sellables(pc, shop).find((x) => x.key === key);
        if (!thing) throw new Error('They don’t have that any more.');
        if (qty > thing.qty) throw new Error(`They only have ${thing.qty}.`);
        name = thing.name; unit = thing.unit;
        const owned = key.startsWith('inv:') ? pc.items.find((i) => `inv:${i.uid}` === key) : null;
        item = owned ? findItem(shop, owned.itemId) : null;
      } else {
        item = findItem(shop, a.itemId);
        if (!item) throw new Error('Unknown item.');
        if (item.cost == null) throw new Error('That one isn’t for sale.');
        name = item.name; unit = item.cost;
      }
      const req = { id: id(), kind: a.kind === 'sell' ? 'sell' : 'buy', pc: pc.id, pcName: pc.name, itemId: item?.id || null, key,
        name, qty, unit, price: Math.round(unit * qty * 100) / 100, note: clean(a.note, 200), status: 'pending', at: Date.now() };
      shop.requests = [req, ...shop.requests].slice(0, 200);
      addLog(combat, { type: 'event', text: `${pc.name} wants to ${req.kind} ${qty > 1 ? `${qty}× ` : ''}${name} (${fmt(req.price)}) — waiting on the Warden.` });
      return req;
    }
    case 'equip': { // "Put on sheet" for something already in the inventory
      const pc = pcOf(a.pc);
      const owned = (pc.items || []).find((i) => i.uid === a.uid);
      if (!owned) throw new Error('That item isn’t in their inventory.');
      const r = equipItem(pc, findItem(shop, owned.itemId) || { id: owned.itemId, name: owned.name, cat: owned.cat, sub: owned.sub }, owned.qty);
      if (r.warning) throw new Error(r.warning);
      if (!r.placed) throw new Error(`${owned.name} doesn’t have a place on the sheet — it stays in the inventory.`);
      pc.updated = Date.now();
      return r;
    }
    case 'cancel': {
      const r = shop.requests.find((x) => x.id === a.id && x.status === 'pending');
      if (!r) throw new Error('No such request.');
      r.status = 'cancelled';
      return;
    }
  }
  if (!warden) throw new Error('Warden PIN required.');
  switch (a.action) {
    case 'decide': {
      const r = shop.requests.find((x) => x.id === a.id && x.status === 'pending');
      if (!r) throw new Error('That request was already handled.');
      if (!a.approve) { r.status = 'denied'; r.decidedAt = Date.now(); addLog(combat, { type: 'event', text: `The Warden turned down ${r.pcName}’s ${r.kind} of ${r.name}.` }); return; }
      const pc = pcOf(r.pc);
      let placed = null;
      const price = a.price !== undefined ? money(a.price) : r.price;
      pc.items = pc.items || [];
      if (r.kind === 'buy') {
        if (walletOf(pc) < price) throw new Error(`${pc.name} only has ${fmt(walletOf(pc))}.`);
        pc.wallet = (walletOf(pc) - price).toFixed(2);
        const item = findItem(shop, r.itemId);
        const have = pc.items.find((i) => i.itemId === r.itemId);
        if (have && isStackable(item)) have.qty += r.qty;
        else pc.items.push({ uid: id(), itemId: r.itemId, name: r.name, cat: item?.cat || '', sub: item?.sub || '', qty: r.qty });
        placed = equipItem(pc, item, r.qty);
      } else {
        removeSold(pc, r.key || `inv:${r.uid}`, r.qty, r.name);
        pc.wallet = (walletOf(pc) + price).toFixed(2);
      }
      r.status = 'approved'; r.price = price; r.decidedAt = Date.now();
      pc.updated = Date.now();
      addLog(combat, { type: 'event', text: `${pc.name} ${r.kind === 'buy' ? 'bought' : 'sold'} ${r.qty > 1 ? `${r.qty}× ` : ''}${r.name} for ${fmt(price)}.${placed?.warning ? ` ${placed.warning}` : ''}` });
      return placed;
    }
    case 'give': { // Warden hands out loot directly (no money changes hands)
      const pc = pcOf(a.pc);
      const item = findItem(shop, a.itemId);
      if (!item) throw new Error('Unknown item.');
      const qty = Math.max(1, Math.min(99, Math.round(Number(a.qty) || 1)));
      pc.items = pc.items || [];
      const have = pc.items.find((i) => i.itemId === item.id);
      if (have && isStackable(item)) have.qty += qty;
      else pc.items.push({ uid: id(), itemId: item.id, name: item.name, cat: item.cat, sub: item.sub, qty });
      const placed = equipItem(pc, item, qty);
      pc.updated = Date.now();
      addLog(combat, { type: 'event', text: `${pc.name} received ${qty > 1 ? `${qty}× ` : ''}${item.name}.${placed.warning ? ` ${placed.warning}` : ''}` });
      return placed;
    }
    case 'addCustom': case 'editCustom': {
      const cat = CATEGORIES.includes(a.cat) ? a.cat : 'Gear';
      const item = {
        id: a.action === 'editCustom' ? a.id : `custom-${id()}`, custom: true, cat, sub: clean(a.sub, 40) || 'Homebrew', name: clean(a.name, 80),
        cost: a.cost === '' || a.cost == null ? null : money(a.cost), page: null,
        quality: clean(a.quality, 20), grit: clean(a.grit, 10), slots: a.slots === '' || a.slots == null ? undefined : Math.max(0, Math.min(4, Math.round(Number(a.slots) || 0))),
        arms: pool(a.arms), short: pool(a.short), long: pool(a.long), distant: pool(a.distant),
        effect: clean(a.effect, 200), desc: clean(a.desc, 600),
      };
      if (!item.name) throw new Error('Name the item.');
      Object.keys(item).forEach((k) => (item[k] === '' || item[k] === undefined) && delete item[k]);
      if (a.action === 'editCustom') {
        const i = shop.custom.findIndex((x) => x.id === a.id);
        if (i < 0) throw new Error('No such item.');
        shop.custom[i] = item;
      } else shop.custom.push(item);
      return item;
    }
    case 'equipAll': { // one sweep: everything in every inventory that isn't on its sheet yet
      const placed = [], noRoom = [];
      for (const pc of combat.posse.filter((p) => !p.dead)) {
        for (const entry of [...(pc.items || [])]) {
          if (isPlaced(pc, entry)) continue;
          const r = equipItem(pc, findItem(shop, entry.itemId) || { id: entry.itemId, name: entry.name, cat: entry.cat, sub: entry.sub }, entry.qty);
          if (r.placed) { placed.push(`${pc.name}: ${entry.name}`); pc.updated = Date.now(); }
          else if (r.warning) noRoom.push(r.warning);
        }
      }
      if (placed.length) addLog(combat, { type: 'event', text: `The Warden filled in the sheets: ${placed.join(', ')}.` });
      return { placed, noRoom };
    }
    case 'removeCustom': shop.custom = shop.custom.filter((x) => x.id !== a.id); return;
    case 'clearHistory': shop.requests = shop.requests.filter((r) => r.status === 'pending'); return;
    default: throw new Error('Unknown action.');
  }
}

const isStackable = (item) => !!item && ['Gear', 'Goods & Services', 'Traps'].includes(item.cat);

export function shopView(shop, { warden, combat }) {
  return {
    v: `${shop.v}.${combat?.v || 0}`,
    custom: shop.custom,
    requests: shop.requests.filter((r) => warden || r.status === 'pending' || Date.now() - (r.decidedAt || r.at) < 86400000 * 3),
    posse: (combat?.posse || []).map((p) => ({ id: p.id, name: p.name, trade: p.trade, wallet: walletOf(p), items: (p.items || []).map((it) => ({ ...it, placed: placedIn(p, it) })), sell: sellables(p, shop) })),
  };
}
