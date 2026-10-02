// The Bestiary (Journal → Bestiary): what the posse has learned about each monster, unlocked by play.
//   fought  (a fight started with it, or it joined one)  → name, size, Health, Defense, Speed, attacks
//   scanned (a Forstall Scanner notebook entry) → the Scanned tag; decoded (the whole frequency solved) → Tolerances, features, Frenzy
//   trophy  (someone took its trophy)                      → the trophy and what it sells for
//   defeated (a tally)                                     → "brought down N times"
// The Warden sees every entry and can show one to the posse outright (shown) or hide it (hidden).
import { PROFILES } from './profiles.js';
import { TROPHIES, trophyValue, CONDITIONS } from './trophies.js';
import { TERRAIN } from './encounters.js';

export const isMonster = (name) => PROFILES.some((p) => p.name === name);
export function learn(state, name, what) {
  if (!isMonster(name)) return;
  const b = ((state.bestiary ||= {})[name] ||= {});
  if (what === 'defeated') b.defeated = (b.defeated || 0) + 1;
  else if (!b[what]) b[what] = Date.now();
}
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function bestiaryView(combat, notebook = {}, { warden = false } = {}) {
  const known = combat?.bestiary || {};
  const entries = PROFILES.map((p) => {
    const b = known[p.name] || {}, nb = notebook[p.name];
    const scanned = !!nb || !!b.shown, decoded = !!nb?.solved;
    const fought = !!b.fought || !!b.shown, trophy = !!b.trophy || !!b.shown;
    const open = warden || !b.hidden;
    const any = fought || scanned || trophy || (b.defeated || 0) > 0;
    const e = { name: p.name, known: open && any, fought, scanned, decoded, trophied: trophy, defeated: b.defeated || 0, shown: !!b.shown, hidden: !!b.hidden,
      book: p.book || 'Guidebook', page: p.page, img: `/img/tokens/monster-${slug(p.name)}.webp` }; // only some monsters have art: the page falls back to a claw mark
    if (warden || (open && fought)) Object.assign(e, { size: p.size, health: p.health, defense: p.defense, speed: p.speed, terrain: TERRAIN[p.name] || [],
      attacks: (p.attacks || []).map((a) => ({ name: a.name, range: a.range, grit: a.grit, effect: a.effect })) });
    // Tolerances, features and Frenzy only once the Scanner has the whole frequency (a partial Scan isn't enough)
    if (warden || (open && (decoded || b.shown))) Object.assign(e, { tolerances: p.tolerances, features: p.features || [], frenzy: p.frenzy || [] });
    if (warden || (open && trophy)) Object.assign(e, { trophy: TROPHIES[p.name] || '', value: Object.fromEntries(CONDITIONS.map((c) => [c, trophyValue(c, p.size)])) });
    return e;
  });
  return warden ? { entries } : { entries: entries.filter((e) => e.known), unknown: entries.filter((e) => !e.known).length };
}
