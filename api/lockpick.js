import { load, save } from '../lib/store.js';
import { pinOk, send, readBody } from '../lib/http.js';
import { freshLocks, lockAction, lockView } from '../lib/lockpick.js';
import { freshCombat, addLog } from '../lib/combat.js';
import { rollPool, parsePool, poolLabel } from '../lib/dice.js';

const KEY = 'locks';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshLocks();
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      const v = `${state.v}`;
      if (url.searchParams.get('since') === v) return send(res, 200, { v, unchanged: true });
      return send(res, 200, lockView(state, { warden: asWarden, pc: String(url.searchParams.get('pc') || '') }));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || freshCombat();
    const names = Object.fromEntries(combat.posse.filter((p) => !p.dead).map((p) => [p.id, p.name]));
    let logged = false;
    const log = (text, secret) => { if (!text && !secret) return; addLog(combat, text ? { type: 'event', text } : { type: 'event', text: secret, hidden: true }); logged = true; };
    // Finesse from the sheet: Poisoned rolls 2 fewer dice; the Finesse Talent rerolls Spurs (pp. 12, 48)
    const rollFinesse = (pid) => {
      const pc = combat.posse.find((p) => p.id === pid);
      const p = parsePool(pc?.skills?.finesse || '1B');
      let n = p.black + p.gold;
      if (pc?.statuses?.Poisoned) n = Math.max(0, n - 2);
      const g = Math.min(p.gold, n), b = n - g, spur = (pc?.talents || []).includes('Finesse');
      const r = n ? rollPool(b, g, spur) : { dice: [], hits: 0, aces: 0 };
      addLog(combat, { type: 'roll', who: pc?.name || '?', label: 'Finesse · lock pick (peeks)', pool: poolLabel({ black: b, gold: g }), spur, dice: r.dice, hits: r.hits, aces: r.aces });
      logged = true;
      return { ...r, pool: poolLabel({ black: b, gold: g }) };
    };
    const result = lockAction(state, body, { warden, names, rollFinesse, log }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    if (logged) { combat.v = (combat.v || 0) + 1; await save(combat, 'combat'); }
    return send(res, 200, { result, state: lockView(state, { warden, pc: String(body.pc || '') }) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
