// Searching and salvaging. The Guidebook (p. 79) says: roll Intuition and the Warden decides what's found; it has no
// loot table, so this is the table's house rule (the user's pick): the find depends on the Hits and on what was searched.
//   0 Hits      nothing
//   1–2 Hits    pocket money or Scrap (or a monster's sellable part)
//   3–4 Hits    a Basic item that fits what was searched
//   5–6 Hits    a Premium item (or Special Ammo)
//   7+  Hits    usually Premium; 1 in 4 an Elite item
// The Warden approves every find before it reaches the character. Salvaging (p. 93) is separate: see salvageDice.
import { CATALOG } from './catalog.js';
import { trophyValue } from './trophies.js';

export const SEARCH_KINDS = {
  human: 'a body',
  monster: 'a downed monster',
  wagon: 'a wagon or mech',
  rubble: 'rubble or a building',
  lair: 'a monster’s lair',
};
// what each kind of place can turn up (catalog sections)
const POOLS = {
  human: ['Pistols', 'Melee', 'Rifles', 'Shotguns', 'Special Ammo & Arrows', 'First Aid', 'Tools', 'General Goods · Clothing'],
  wagon: ['Tools', 'Batteries', 'Mech Repair Kits', 'First Aid', 'Trap', 'General Goods · Cookware', 'General Goods · Bedding', 'General Goods · Lighting', 'Food & Drink · General Perishables'],
  rubble: ['Tools', 'Improvised', 'General Goods · Lighting', 'General Goods · Cookware', 'Batteries'],
  lair: ['Pistols', 'Melee', 'Rifles', 'Shotguns', 'Bows', 'Special Ammo & Arrows', 'Shields & Armor', 'First Aid', 'Trap', 'Explosives'],
};
// pocket money (dollars) for 1–2 Hits
const MONEY = { human: [0.25, 3], wagon: [0.1, 1.5], rubble: [0.05, 0.75], lair: [0.5, 5] };
const PARTS = ['hide', 'teeth', 'claws', 'bones', 'horn'];

// Basic / Premium / Elite: a weapon's own quality, otherwise by price
export function tierOf(it) {
  if (it.quality) return /used/i.test(it.quality) ? 'Basic' : it.quality;
  return it.cost <= 10 ? 'Basic' : it.cost <= 30 ? 'Premium' : 'Elite';
}
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const cents = (n) => Math.round(n * 100) / 100;

export function rollFind(kind, hits, { rand = Math.random, monster = null } = {}) {
  if (hits <= 0) return { text: 'Nothing worth taking.' };
  if (kind === 'monster') { // sellable parts; the signature trophy is taken separately (Spoils)
    const n = hits >= 5 ? 3 : hits >= 3 ? 2 : 1, [lo, hi] = trophyValue('Fair', monster?.size || 'Small') || [0.5, 5];
    const parts = [...PARTS].sort(() => rand() - 0.5).slice(0, n).map((p) => ({ name: `${monster?.name || 'Monster'} ${p}`, note: `Sellable part, worth about $${cents((lo + (hi - lo) * rand()) / 3).toFixed(2)}.` }));
    return { parts, text: parts.map((p) => p.name).join(', ') };
  }
  const k = POOLS[kind] ? kind : 'rubble';
  if (hits <= 2) {
    if (rand() < (k === 'rubble' || k === 'wagon' ? 0.6 : 0.3)) { const scrap = 1 + Math.floor(rand() * 3); return { scrap, text: `${scrap} Scrap` }; }
    const [lo, hi] = MONEY[k]; const money = cents(lo + (hi - lo) * rand());
    return { money, text: `$${money.toFixed(2)}` };
  }
  const want = hits >= 7 && rand() < 0.25 ? 'Elite' : hits >= 5 ? 'Premium' : 'Basic';
  const fits = (it) => POOLS[k].includes(it.sub) && it.cost != null && !it.shop && !it.house && !it.custom;
  let pool = CATALOG.filter((it) => fits(it) && tierOf(it) === want);
  if (!pool.length) pool = CATALOG.filter((it) => fits(it) && tierOf(it) === 'Basic');
  const it = pick(pool, rand);
  const out = { item: { itemId: it.id, name: it.name, tier: want }, text: `${it.name} (${want})` };
  if (k === 'human' && rand() < 0.5) { const [lo, hi] = MONEY.human; out.money = cents(lo + (hi - lo) * rand()); out.text += ` and $${out.money.toFixed(2)}`; }
  return out;
}

// Salvaging (p. 93): 1B–2B small or simple, 3B–4B medium or complex, 5B–6B large or complex
export const SALVAGE = [['Small or simple', [1, 2]], ['Medium or complex', [3, 4]], ['Large or complex', [5, 6]]];
