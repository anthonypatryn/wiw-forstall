import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshSaloon, saloonAction, saloonView } from '../saloon.js';
import { freshCombat, addLog, profileFor } from '../combat.js';
import { rollPool, parsePool, poolLabel } from '../dice.js';
import { hasSpur } from '../sheets.js';

const KEY = 'saloon';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshSaloon();
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, saloonView(state, { warden: asWarden, pc: String(url.searchParams.get('pc') || '') }));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || freshCombat();
    const Cap = (s) => s[0].toUpperCase() + s.slice(1);
    const npcSkills = (seat) => profileFor(seat.profile)?.skills || {};
    const ctx = {
      warden, posse: combat.posse, npcSkills,
      log: (text) => addLog(combat, { type: 'event', text }),
      // a Skill roll at the table goes in the Table Log like any other (Spurs reroll with the matching Talent)
      roll: (seat, skill, pool) => {
        const p = parsePool(pool);
        const pc = seat.kind === 'pc' && combat.posse.find((x) => x.id === seat.pc);
        const talents = seat.kind === 'npc' ? ((profileFor(seat.profile)?.features || []).find((f) => /^Talents:/.test(f)) || '') : '';
        const spur = pc ? hasSpur(pc, Cap(skill)) : talents.includes(Cap(skill));
        const r = rollPool(p.black, p.gold, spur);
        addLog(combat, { type: 'roll', who: seat.name, label: `Poker · ${Cap(skill)}`, pool: poolLabel(p), spur, dice: r.dice, hits: r.hits, aces: r.aces });
        return r;
      },
    };
    const result = saloonAction(state, body, ctx) ?? null;
    state.v = (state.v || 0) + 1;
    combat.v = (combat.v || 0) + 1;
    await Promise.all([save(state, KEY), save(combat, 'combat')]);
    return send(res, 200, { result, state: saloonView(state, { warden, pc: String(body.pc || '') }) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
