// Player-to-player trading. One character offers money and/or things (anything they could sell: inventory rows, starting
// guns, gear, a horse, a mech, a Forstall) and asks for money and/or things back. The other player accepts or declines.
// Accepting runs on copies of both characters first, so a trade either goes through whole or not at all.
// Things carry their sheet section with them: a gun keeps its upgrades and ammo, a horse keeps its Bond and Health.
import { CATALOG } from './catalog.js';
import { sellables } from './shop.js';
import { addLog } from './combat.js';
import { equipItem, unequipItem, placedIn, blankWeapon, blankGear, blankForstall, blankHorse, blankMech } from './sheets.js';
import { clean, cents, money, id } from './util.js';

const STACK = ['Gear', 'Goods & Services', 'Traps'];
const catalogItem = (e) => CATALOG.find((i) => i.id === e.itemId) || { id: e.itemId, name: e.name, cat: e.cat, sub: e.sub };
const emptyWeapon = (w) => !w.model && !w.manufacturer && !w.itemId;
const emptyGear = (g) => !g.item && !g.itemId;
const SOLO = { Forstall: ['forstall', 'model', blankForstall], Horse: ['horse', 'breed', blankHorse], Mech: ['mech', 'class', blankMech] };

// what's in one side of an offer, checked against what the character has right now
function side(pc, s) {
  const list = sellables(pc, { custom: [] });
  const things = (Array.isArray(s?.things) ? s.things : []).slice(0, 12).map((t) => {
    const have = list.find((x) => x.key === clean(t?.key, 40));
    if (!have) throw new Error(`${pc.name} doesn’t have that any more.`);
    const qty = Math.max(1, Math.min(have.qty, Math.round(Number(t.qty) || 1)));
    return { key: have.key, name: have.name, qty };
  });
  return { money: money(s?.money), things };
}
const describe = (s) => [s.money ? `$${s.money.toFixed(2)}` : '', ...s.things.map((t) => `${t.qty > 1 ? `${t.qty}× ` : ''}${t.name}`)].filter(Boolean).join(', ') || 'nothing';

// take one thing off a character → a packet to hand over
function take(pc, key, qty, name) {
  const [kind, ref] = key.split(':');
  if (kind === 'inv') {
    const e = (pc.items || []).find((i) => i.uid === ref);
    if (!e || e.qty < qty) throw new Error(`${pc.name} no longer has ${name}.`);
    const where = placedIn(pc, e), sections = [];
    if (where === 'Weapons') {
      for (let n = 0; n < qty; n++) {
        const k = pc.weapons.map((w, i) => (w.itemId === e.itemId ? i : -1)).filter((i) => i >= 0).pop();
        if (k === undefined) break;
        sections.push({ where, obj: structuredClone(pc.weapons[k]) });
        pc.weapons[k] = blankWeapon();
      }
    } else if (SOLO[where]) {
      const [f, , blank] = SOLO[where];
      sections.push({ where, obj: structuredClone(pc[f]) });
      pc[f] = blank();
    } else if (where === 'Gear' && e.qty === qty && !(pc.items || []).some((i) => i !== e && i.itemId === e.itemId)) {
      const k = pc.gear.findIndex((g) => g.itemId === e.itemId);
      if (k >= 0) { sections.push({ where, obj: structuredClone(pc.gear[k]) }); pc.gear[k] = blankGear(); }
    } else if ((where === 'Ammo' || where === 'Upgrades') && e.qty === qty) unequipItem(pc, e.itemId, e.name);
    e.qty -= qty;
    if (e.qty <= 0) pc.items = pc.items.filter((i) => i !== e);
    return { entry: { ...e, qty }, sections };
  }
  const now = sellables(pc, { custom: [] }).find((x) => x.key === key);
  if (!now || now.name !== name) throw new Error(`${name} is no longer on ${pc.name}’s sheet.`);
  if (kind === 'weapon') { const obj = structuredClone(pc.weapons[Number(ref)]); pc.weapons[Number(ref)] = blankWeapon(); return { sections: [{ where: 'Weapons', obj }] }; }
  if (kind === 'gear') { const obj = structuredClone(pc.gear[Number(ref)]); pc.gear[Number(ref)] = blankGear(); return { sections: [{ where: 'Gear', obj }] }; }
  const where = { forstall: 'Forstall', horse: 'Horse', mech: 'Mech' }[kind];
  const [f, , blank] = SOLO[where];
  const obj = structuredClone(pc[f]); pc[f] = blank();
  return { sections: [{ where, obj }] };
}

// hand a packet to a character: the inventory row, then its sheet section (or let the Store's rules place it)
function give(pc, pk, name) {
  pc.items ||= [];
  if (pk.entry) {
    const same = pc.items.find((i) => i.itemId && i.itemId === pk.entry.itemId);
    if (same && STACK.includes(pk.entry.cat)) same.qty += pk.entry.qty;
    else pc.items.push({ ...pk.entry, uid: id() });
  }
  for (const { where, obj } of pk.sections) {
    if (where === 'Weapons') {
      const k = pc.weapons.findIndex(emptyWeapon);
      if (k < 0) throw new Error(`${pc.name} has no free weapon slot for ${name}.`);
      pc.weapons[k] = obj;
    } else if (where === 'Gear') {
      if (pc.gear.some((g) => g.itemId && g.itemId === obj.itemId)) continue;
      const k = pc.gear.findIndex(emptyGear);
      if (k < 0) { if (!pk.entry) throw new Error(`${pc.name} has no free gear slot for ${name}.`); continue; }
      pc.gear[k] = obj;
    } else {
      const [f, field] = SOLO[where];
      if (pc[f]?.[field]) throw new Error(`${pc.name} already has a ${where.toLowerCase()} (${pc[f][field]}).`);
      pc[f] = obj;
    }
  }
  if (pk.entry && !pk.sections.length) equipItem(pc, catalogItem(pk.entry), pk.entry.qty); // ammo, upgrades, gear they already carry…
}

function move(from, to, s) {
  if (s.money) {
    if (money(from.wallet) < s.money) throw new Error(`${from.name} only has $${money(from.wallet).toFixed(2)}.`);
    from.wallet = cents(money(from.wallet) - s.money).toFixed(2);
    to.wallet = cents(money(to.wallet) + s.money).toFixed(2);
  }
  // take everything first (keys point at slots as they are now), then hand it over
  const packets = s.things.map((t) => [take(from, t.key, t.qty, t.name), t.name]);
  for (const [pk, name] of packets) give(to, pk, name);
}

export function tradeAction(state, a) {
  state.trades ||= [];
  const pcOf = (pid, who) => { const p = state.posse.find((x) => x.id === clean(pid, 12) && !x.dead); if (!p) throw new Error(who); return p; };
  const find = () => { const t = state.trades.find((x) => x.id === a.id); if (!t) throw new Error('That offer is gone.'); return t; };
  switch (a.op) {
    case 'offer': {
      const from = pcOf(a.pc, 'Pick who you’re playing first (the “This is me” star on your sheet).');
      const to = pcOf(a.to, 'Pick who to trade with.');
      if (from.id === to.id) throw new Error('You can’t trade with yourself.');
      const give_ = side(from, a.give), get = side(to, a.get);
      if (!give_.money && !give_.things.length && !get.money && !get.things.length) throw new Error('Put something in the offer.');
      if (give_.money > money(from.wallet)) throw new Error(`You only have $${money(from.wallet).toFixed(2)}.`);
      if (state.trades.filter((t) => t.from === from.id && t.status === 'pending').length >= 3) throw new Error('You already have 3 offers waiting. Cancel one first.');
      const t = { id: id(), from: from.id, fromName: from.name, to: to.id, toName: to.name, give: give_, get, note: clean(a.note, 140), status: 'pending', at: Date.now() };
      state.trades = [t, ...state.trades].slice(0, 30);
      return t;
    }
    case 'answer': {
      const t = find();
      if (t.status !== 'pending') throw new Error('That offer has already been settled.');
      if (clean(a.pc, 12) !== t.to) throw new Error('Only the one it’s offered to can answer it.');
      t.answeredAt = Date.now();
      if (!a.accept) { t.status = 'declined'; return t; }
      const from = pcOf(t.from, `${t.fromName} isn’t around any more.`), to = pcOf(t.to, 'You’re not around any more.');
      // all or nothing: run it on copies, then keep the copies
      const f = structuredClone(from), g = structuredClone(to);
      try {
        move(f, g, t.give);
        move(g, f, t.get);
      } catch (err) {
        t.status = 'failed'; t.why = err.message;
        return t;
      }
      f.updated = g.updated = Date.now();
      Object.assign(from, f); Object.assign(to, g);
      t.status = 'accepted';
      const got = describe(t.get);
      addLog(state, { type: 'event', text: `${t.fromName} traded ${describe(t.give)} to ${t.toName}${got !== 'nothing' ? ` for ${got}` : ''}.` });
      return t;
    }
    case 'cancel': {
      const t = find();
      if (clean(a.pc, 12) !== t.from) throw new Error('Only the one who made the offer can take it back.');
      if (t.status === 'pending') t.status = 'cancelled';
      return t;
    }
    default: throw new Error('Unknown trade.');
  }
}


// ---------- the posse stash: shared money and things anyone can put in or take out (every move is in the Table Log) ----------
const stashOf = (state) => (state.stash ||= { money: 0, items: [] });
export function stashAction(state, a, { warden = false, findItem = () => null } = {}) {
  const st = stashOf(state);
  if (a.op === 'loot') { // the Warden drops loot straight into the stash
    if (!warden) throw new Error('Warden PIN required.');
    const add = money(a.money), qty = Math.max(1, Math.min(99, Math.round(Number(a.qty) || 1)));
    const it = a.itemId ? findItem(clean(a.itemId, 80)) : null;
    if (a.itemId && !it) throw new Error('Unknown item.');
    if (!add && !it) throw new Error('Put some money or an item in.');
    st.money = cents(st.money + add);
    if (it) stashPut(st, { entry: { uid: id(), itemId: it.id, name: it.name, cat: it.cat || '', sub: it.sub || '', qty }, sections: [] }, it.name);
    addLog(state, { type: 'event', text: `The posse stash gets ${[add ? `$${add.toFixed(2)}` : '', it ? `${qty > 1 ? `${qty}× ` : ''}${it.name}` : ''].filter(Boolean).join(' and ')}.` });
    return st;
  }
  const pc = state.posse.find((x) => x.id === clean(a.pc, 12) && !x.dead);
  if (!pc) throw new Error('Pick who you’re playing first (the “This is me” star on your sheet).');
  const copy = structuredClone(pc);
  if (a.op === 'put') {
    const s = side(copy, { money: a.money, things: a.things });
    if (!s.money && !s.things.length) throw new Error('Pick something to put in.');
    if (s.money > money(copy.wallet)) throw new Error(`You only have $${money(copy.wallet).toFixed(2)}.`);
    copy.wallet = cents(money(copy.wallet) - s.money).toFixed(2);
    const packets = s.things.map((t) => [take(copy, t.key, t.qty, t.name), t]);
    st.money = cents(st.money + s.money);
    for (const [pk, t] of packets) stashPut(st, pk, t.name);
    copy.updated = Date.now(); Object.assign(pc, copy);
    addLog(state, { type: 'event', text: `${pc.name} put ${describe(s)} in the posse stash.` });
    return st;
  }
  if (a.op === 'take') {
    const want = money(a.money);
    if (want > st.money) throw new Error(`The stash only has $${st.money.toFixed(2)}.`);
    const item = a.id ? st.items.find((x) => x.id === a.id) : null;
    if (a.id && !item) throw new Error('Somebody already took that.');
    if (!want && !item) throw new Error('Pick something to take.');
    const qty = item ? Math.max(1, Math.min(item.qty, Math.round(Number(a.qty) || 1))) : 0;
    if (item) {
      // part of a stack: hand over that many (a gun per slot keeps its own section); the rest stays in the stash
      const all = qty >= item.qty, pk = item.packet;
      const perUnit = pk.sections.length > 1 && pk.sections.length === item.qty;
      const out = all ? pk : { entry: pk.entry ? { ...pk.entry, qty } : null, sections: perUnit ? pk.sections.slice(0, qty) : [] };
      give(copy, out, item.name);
      if (all) st.items = st.items.filter((x) => x !== item);
      else { item.qty -= qty; if (pk.entry) pk.entry.qty -= qty; if (perUnit) pk.sections = pk.sections.slice(qty); }
    }
    copy.wallet = cents(money(copy.wallet) + want).toFixed(2);
    st.money = cents(st.money - want);
    copy.updated = Date.now(); Object.assign(pc, copy);
    addLog(state, { type: 'event', text: `${pc.name} took ${[want ? `$${want.toFixed(2)}` : '', item ? `${qty > 1 ? `${qty}× ` : ''}${item.name}` : ''].filter(Boolean).join(' and ')} from the posse stash.` });
    return st;
  }
  throw new Error('Unknown stash action.');
}
function stashPut(st, pk, name) {
  const qty = pk.entry?.qty || 1;
  const same = pk.entry?.itemId && STACK.includes(pk.entry.cat) && st.items.find((x) => x.packet.entry?.itemId === pk.entry.itemId);
  if (same) { same.qty += qty; same.packet.entry.qty += qty; if (!same.packet.sections.length) same.packet.sections = pk.sections; return; }
  st.items.push({ id: id(), name: pk.entry?.name || name, qty, where: pk.sections[0]?.where || '', packet: pk, at: Date.now() });
}
