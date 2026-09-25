import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshSaloon, saloonAction, saloonView } from '../saloon.js';
import { freshCombat, addLog, profileFor } from '../combat.js';
import { rollPool, parsePool, poolLabel } from '../dice.js';
import { hasSpur } from '../sheets.js';

const KEY = 'saloon';
const GAME = { poker: 'Poker', faro: 'Faro', liars: 'Liar’s Dice', blackjack: 'Blackjack', drinking: 'Drinking contest' };
const SKILLS = ['charm', 'finesse', 'intuition', 'nerve'];
// the dice a character actually rolls: Poisoned takes 2 off (p. 48), gold dice go last
export function poolFor(pc, skill) {
  const p = parsePool(pc?.skills?.[skill] || '1B');
  let n = p.black + p.gold;
  if (pc?.statuses?.Poisoned) n = Math.max(0, n - 2);
  const gold = Math.min(p.gold, n);
  return { black: n - gold, gold };
}
// add what each side rolls for the Skill moves: every NPC's pools, and yours (Poisoned already counted)
function decorate(view, state, combat, pcId) {
  const t = view.table;
  if (!t) return view;
  const npcs = Object.fromEntries((state.table?.seats || []).filter((s) => s.kind === 'npc').map((s) => [s.key, profileFor(s.profile)?.skills || {}]));
  t.seats = t.seats.map((s) => (s.kind === 'npc' ? { ...s, skills: Object.fromEntries(SKILLS.map((k) => [k, npcs[s.key]?.[k] || '2B'])) } : s));
  const pc = pcId && combat.posse.find((p) => p.id === pcId);
  if (pc) t.me = { poisoned: !!pc.statuses?.Poisoned, skills: Object.fromEntries(SKILLS.map((k) => [k, poolLabel(poolFor(pc, k))])), grit: Number(pc.grit) || 0, health: Number(pc.health) || 0, maxHealth: Number(pc.maxHealth) || 0 };
  return view;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshSaloon();
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      const pc = String(url.searchParams.get('pc') || '');
      const combat = (await load('combat')) || freshCombat();
      return send(res, 200, decorate(saloonView(state, { warden: asWarden, pc }), state, combat, pc));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || freshCombat();
    const Cap = (s) => s[0].toUpperCase() + s.slice(1);
    const npcSkills = (seat) => profileFor(seat.profile)?.skills || {};
    const rolls = [];
    const ctx = {
      warden, posse: combat.posse, npcSkills,
      log: (text) => addLog(combat, { type: 'event', text }),
      // the dice a seat has in a Skill (a character's sheet with Poisoned counted, or the NPC's profile)
      poolOf: (seat, skill) => { const pc = seat.kind === 'pc' && combat.posse.find((x) => x.id === seat.pc); return pc ? poolFor(pc, skill) : parsePool(npcSkills(seat)[skill] || '2B'); },
      npcHealth: (seat) => Number(profileFor(seat.profile)?.health) || 10,
      status: (pc, name, sev) => { if (!pc) return; pc.statuses ||= {}; pc.statuses[name] = Math.max(pc.statuses[name] || 0, sev); pc.updated = Date.now(); },
      // a Skill roll at the table goes in the Table Log like any other (Spurs reroll with the matching Talent; Poisoned −2 dice)
      roll: (seat, skill, pool) => {
        const pc = seat.kind === 'pc' && combat.posse.find((x) => x.id === seat.pc);
        const p = typeof pool === 'object' && pool ? pool : pc ? poolFor(pc, skill) : parsePool(pool); // a game can hand over the exact dice
        const talents = seat.kind === 'npc' ? ((profileFor(seat.profile)?.features || []).find((f) => /^Talents:/.test(f)) || '') : '';
        const spur = pc ? hasSpur(pc, Cap(skill)) : talents.includes(Cap(skill));
        const r = p.black + p.gold ? rollPool(p.black, p.gold, spur) : { dice: [], hits: 0, aces: 0 };
        addLog(combat, { type: 'roll', who: seat.name, label: `${GAME[state.table?.game] || 'Cards'} · ${Cap(skill)}`, pool: poolLabel(p), spur, dice: r.dice, hits: r.hits, aces: r.aces });
        rolls.push({ key: seat.key, who: seat.name, skill: Cap(skill), pool: poolLabel(p), spur, dice: r.dice, hits: r.hits, aces: r.aces });
        return r;
      },
    };
    const result = saloonAction(state, body, ctx) ?? null;
    state.v = (state.v || 0) + 1;
    combat.v = (combat.v || 0) + 1;
    await Promise.all([save(state, KEY), save(combat, 'combat')]);
    const pc = String(body.pc || '');
    return send(res, 200, { result, rolls, state: decorate(saloonView(state, { warden, pc }), state, combat, pc) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
