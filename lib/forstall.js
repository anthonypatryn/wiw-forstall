// Forstalls on the battle map — Wild Imaginary West Official Guidebook pp. 81–87.
// Sweeping (p. 82): monsters in Range lose Grit equal to the Sweep's Hits at the start of their turn and whenever they enter Range.
// Known frequency (p. 83): +1, but only for frequencies programmed into the Forstall's memory slots.
// Range (p. 85) is the same for Sweeping, Scanning and Bursting, measured from the Forstall.
import { PROFILES } from './profiles.js';
import { MONSTERS } from './monsters.js';

const WHOLE_MAP = 999; // Town Forstall: the town perimeter covers the whole board
export const KINDS = {
  backpack: { label: 'Backpack Forstall', range: 'Short', rangeIn: 6, pool: '2B', grit: 4 },
  saddlebag: { label: 'Saddlebag Forstall', range: 'Short', rangeIn: 6, pool: '3B', grit: 4 },
  mech: { label: 'Mech Forstall', range: 'Long', rangeIn: 18, pool: '4B', grit: 4 },
  town: { label: 'Town Forstall', range: 'Town perimeter', rangeIn: WHOLE_MAP, pool: '6B', grit: 6 },
};
export const SLOTS = 4;

const POOL = /^(\d+[BG])+$/i;
const cube = (col, row) => { const q = col - (row - (row & 1)) / 2; return [q, row, -q - row]; };
export const hexDist = (a, b) => { const A = cube(a.col, a.row), B = cube(b.col, b.row); return Math.max(...A.map((v, i) => Math.abs(v - B[i]))); };
const rangeWord = (s) => (/town/i.test(s) ? WHOLE_MAP : /long/i.test(s) ? 18 : /short/i.test(s) ? 6 : /arm/i.test(s) ? 1 : 0);

// A character's Forstall from their sheet: the model picks the kind; the sheet's own dice/Grit/Range win (upgrades live there).
export function kindFromSheet(f) {
  const text = `${f?.model || ''} ${f?.itemId || ''}`;
  const kind = Object.keys(KINDS).find((k) => new RegExp(k, 'i').test(text)) || null;
  const base = KINDS[kind] || { label: f?.model || 'Forstall', range: 'Short', rangeIn: 6, pool: '2B', grit: 4 };
  const rangeIn = rangeWord(f?.range) || base.rangeIn;
  return {
    kind: kind || 'custom',
    range: rangeIn === WHOLE_MAP ? 'Town perimeter' : rangeIn === 18 ? 'Long' : 'Short',
    rangeIn,
    pool: POOL.test(String(f?.sweep || '')) ? String(f.sweep).toUpperCase() : base.pool,
    grit: parseInt(f?.grit, 10) || base.grit,
  };
}

// A memory slot holds "Golden Bear · 6-1-2829" (or an older typed frequency / name). Returns the monster name or null.
export function slotMonster(slot, extra = []) {
  const s = String(slot || '').trim();
  if (!s) return null;
  const all = [...MONSTERS, ...extra];
  const d = s.replace(/\D/g, '');
  if (d.length >= 6) {
    const m = all.find((x) => x.kz.replace(/\D/g, '') === d.slice(0, 6));
    if (m) return m.name;
  }
  const name = s.split('·')[0].trim().toLowerCase();
  return all.find((x) => x.name.toLowerCase() === name)?.name || null;
}
const knownOf = (slots) => new Set((slots || []).map((s) => slotMonster(s)).filter(Boolean));

// Every Forstall in play: each character's (riding on their token) and the Warden's free-standing ones.
export function fields(battle, combat) {
  const toks = battle?.tokens || [];
  const sweeps = combat?.sweeps || {};
  const out = [];
  for (const pc of combat?.posse || []) {
    if (pc.dead || !pc.forstall?.model) continue;
    const t = toks.find((x) => x.kind === 'pc' && x.ref === pc.id);
    const k = kindFromSheet(pc.forstall), key = `pc:${pc.id}`;
    out.push({
      key, owner: pc.id, ownerName: pc.name, name: pc.forstall.model, ...k,
      pos: t ? { col: t.col, row: t.row } : null, tokenId: t?.id || null, hidden: !!t?.hidden,
      slots: (pc.forstall.kz || []).slice(0, SLOTS), known: knownOf(pc.forstall.kz),
      fuse: (pc.forstall.upgrades || []).some((u) => /burst/i.test(u)),
      charges: Number(pc.forstall.charges) || 0, sweep: sweeps[key] || null, jammed: !!combat?.emp?.keys?.includes(key),
      // Heartbeat Sensor (p. 100): hears monsters out to the Forstall's Range + Short while it Sweeps
      heartbeat: [...pc.weapons, pc.forstall].some((w) => (w?.upgrades || []).some((u) => /heartbeat/i.test(u))),
      efficiency: (pc.abilities || []).includes('Forstall Efficiency') ? 2 - (pc.abilityUses?.['Forstall Efficiency'] || 0) : null,
    });
  }
  for (const f of battle?.forstalls || []) {
    const k = KINDS[f.kind] || KINDS.backpack;
    out.push({
      key: f.id, owner: null, ownerName: '', name: f.name || k.label, kind: f.kind, range: k.range, rangeIn: k.rangeIn, pool: k.pool, grit: k.grit,
      pos: { col: f.col, row: f.row }, tokenId: null, hidden: !!f.hidden,
      slots: (f.slots || []).slice(0, SLOTS), known: knownOf(f.slots), fuse: true, charges: null, sweep: sweeps[f.id] || null, jammed: !!combat?.emp?.keys?.includes(f.id),
      heartbeat: false, efficiency: null,
    });
  }
  return out;
}

export const inRange = (f, pos) => !!(f.pos && pos) && (f.rangeIn >= WHOLE_MAP || hexDist(f.pos, pos) <= f.rangeIn);

// Sweep Tolerance from the monster profile, raised by Frenzies (p. 139 profiles). Humans and NPCs aren't affected at all.
export function sweepTolerance(e) {
  const p = PROFILES.find((x) => x.name === e?.profile);
  if (!p) return { monster: false };
  if (e.submerged) return { monster: true, tol: 0, immune: true, why: 'submerged (Forstall waves don’t reach under water)' };
  const m = /Sweep \[([^\]]+)\]/i.exec(p.tolerances || '');
  let tol = m ? (/immune/i.test(m[1]) ? Infinity : Number(m[1]) || 0) : 0;
  let why = m ? `Sweep Tolerance ${m[1]}` : '';
  for (const f of p.frenzy || []) {
    if (!(e.frenzied || []).includes(f.name)) continue;
    if (/immune to Forstall Sweeping/i.test(f.text)) { tol = Infinity; why = `${f.name}: immune`; continue; }
    const to = /Sweep Tolerance increases to (\d+)/i.exec(f.text);
    if (to) { tol = Math.max(tol, Number(to[1])); why = `${f.name}: Tolerance ${tol}`; continue; }
    const by = /Sweep Tolerance (?:increases )?by (\d+)/i.exec(f.text);
    if (by) { tol += Number(by[1]); why = `${f.name}: Tolerance ${tol}`; }
  }
  return { monster: true, tol, immune: tol === Infinity, why };
}

// What one Sweeping Forstall does to one enemy: Hits (+1 if programmed) − Tolerance, never below 0.
export function sweepLoss(f, e) {
  if (!f.sweep) return null;
  const st = sweepTolerance(e);
  if (!st.monster) return null;
  const known = f.known.has(e.profile);
  const raw = f.sweep.hits + (known ? 1 : 0);
  return { loss: st.immune ? 0 : Math.max(0, raw - st.tol), hits: f.sweep.hits, known, tol: st.immune ? 'Immune' : st.tol, why: st.why };
}

// The strongest Sweep reaching an enemy at `pos` (crossed waves are useless anyway — Edison's Rule 1).
export function bestSweep(list, e, pos) {
  let best = null;
  for (const f of list) {
    if (!f.sweep || !inRange(f, pos)) continue;
    const l = sweepLoss(f, e);
    if (l && (!best || l.loss > best.loss)) best = { ...l, f };
  }
  return best;
}
export const lossText = (b) => `${b.hits} Hit${b.hits === 1 ? '' : 's'}${b.known ? ' +1 known' : ''}${b.tol === 'Immune' ? ' · immune' : b.tol ? ` −${b.tol} Tolerance` : ''}`;

// Edison's Rule 1 (p. 85): two Sweeping Forstalls within Range of each other.
export function touching(a, b) {
  if (!a.pos || !b.pos) return false;
  return a.rangeIn >= WHOLE_MAP || b.rangeIn >= WHOLE_MAP || hexDist(a.pos, b.pos) <= Math.max(a.rangeIn, b.rangeIn);
}
export function edisonConflicts(list) {
  const on = list.filter((f) => f.sweep && f.pos), pairs = [];
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) if (touching(on[i], on[j])) pairs.push([on[i].key, on[j].key]);
  return pairs;
}

