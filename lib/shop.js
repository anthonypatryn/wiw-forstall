// General store: the Guidebook catalog + Warden-made items, and buy/sell requests the Warden approves.
import crypto from 'node:crypto';
import { CATALOG } from './catalog.js';
import { addLog } from './combat.js';
import { equipItem } from './sheets.js';

const clean = (s, n = 80) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const money = (v) => Math.max(0, Math.round((Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0) * 100) / 100);
const id = () => crypto.randomUUID().slice(0, 8);
const POOL = /^(\d+[BG])+$/;
const pool = (v) => { const s = String(v || '').toUpperCase().replace(/\s+/g, ''); return POOL.test(s) ? s : clean(v, 60); };
export const CATEGORIES = ['Weapons', 'Traps', 'Gear', 'Forstalls', 'Mechs', 'Upgrades', 'Horses & Mounts', 'Goods & Services'];
export const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

export function freshShop() { return { v: 0, custom: [], requests: [] }; }

export const allItems = (shop) => [...CATALOG, ...shop.custom];
export const findItem = (shop, itemId) => allItems(shop).find((i) => i.id === itemId) || null;
const walletOf = (pc) => money(pc.wallet);

// ---------- player requests ----------
export function shopAction(shop, combat, a, { warden }) {
  const pcOf = (pid) => { const p = combat.posse.find((x) => x.id === pid); if (!p) throw new Error('Pick a character.'); return p; };
  switch (a.action) {
    case 'request': {
      const pc = pcOf(a.pc);
      const qty = Math.max(1, Math.min(99, Math.round(Number(a.qty) || 1)));
      let item, unit, name;
      if (a.kind === 'sell') {
        const owned = (pc.items || []).find((i) => i.uid === a.uid);
        if (!owned) throw new Error('That item isn’t in their inventory.');
        item = findItem(shop, owned.itemId);
        name = owned.name; unit = item?.cost != null ? item.cost / 2 : 0; // suggest half price; the Warden decides
        if (qty > owned.qty) throw new Error(`They only have ${owned.qty}.`);
      } else {
        item = findItem(shop, a.itemId);
        if (!item) throw new Error('Unknown item.');
        if (item.cost == null) throw new Error('That one isn’t for sale.');
        name = item.name; unit = item.cost;
      }
      const req = { id: id(), kind: a.kind === 'sell' ? 'sell' : 'buy', pc: pc.id, pcName: pc.name, itemId: item?.id || null, uid: a.uid || null,
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
        const owned = pc.items.find((i) => i.uid === r.uid);
        if (!owned || owned.qty < r.qty) throw new Error('They no longer have that item.');
        owned.qty -= r.qty;
        if (owned.qty <= 0) pc.items = pc.items.filter((i) => i !== owned);
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
    case 'removeCustom': shop.custom = shop.custom.filter((x) => x.id !== a.id); return;
    case 'clearHistory': shop.requests = shop.requests.filter((r) => r.status === 'pending'); return;
    default: throw new Error('Unknown action.');
  }
}

const isStackable = (item) => !!item && ['Gear', 'Goods & Services', 'Traps'].includes(item.cat);

export function gearNotes(item) {
  return [item.benefit, item.effect, item.pool && `Roll ${item.pool}`, item.arms && `Arm’s Reach: ${item.arms}`, item.short && `Short: ${item.short}`].filter(Boolean).join(' · ').slice(0, 80);
}

export function shopView(shop, { warden, combat }) {
  return {
    v: `${shop.v}.${combat?.v || 0}`,
    custom: shop.custom,
    requests: shop.requests.filter((r) => warden || r.status === 'pending' || Date.now() - (r.decidedAt || r.at) < 86400000 * 3),
    posse: (combat?.posse || []).map((p) => ({ id: p.id, name: p.name, trade: p.trade, wallet: walletOf(p), items: p.items || [] })),
  };
}
