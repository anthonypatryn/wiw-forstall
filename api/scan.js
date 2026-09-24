import { load, save, storeKind } from '../lib/store.js';
import { pinOk, send, readBody, sinceParam } from '../lib/http.js';
import { freshState, playerView, wardenView, doRoll, doGuess, doNote, wardenAction } from '../lib/game.js';
import { freshCombat, addLog } from '../lib/combat.js';
import { poolLabel } from '../lib/dice.js';

// Scanner rolls and breakthroughs also go in the shared Table Log (combat document).
async function tableLog(entry) {
  try {
    const c = (await load('combat')) || freshCombat();
    addLog(c, entry);
    c.v = (c.v || 0) + 1;
    await save(c, 'combat');
  } catch { /* the scan itself already succeeded */ }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    let state = (await load()) || freshState();

    if (req.method === 'GET') {
      const since = sinceParam(url);
      if (url.searchParams.get('view') === 'warden') {
        if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
        if (since === state.v) return send(res, 200, { v: state.v, unchanged: true });
        return send(res, 200, { ...wardenView(state), store: storeKind });
      }
      if (since === state.v) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, playerView(state));
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    let result = null;

    switch (body.action) {
      case 'auth':
        return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
      case 'roll': result = doRoll(state, body); break;
      case 'guess': result = doGuess(state, body); break;
      case 'note': doNote(state, body); break;
      default:
        if (!warden) return send(res, 401, { error: 'Warden PIN required.' });
        wardenAction(state, body);
    }

    state.v = (state.v || 0) + 1;
    await save(state);
    if (body.action === 'roll') {
      const who = String(body.who || '').replace(/[<>]/g, '').trim().slice(0, 40);
      await tableLog({ type: 'roll', who: who || 'Forstall Scan', label: `${who ? 'Forstall Scan · ' : ''}Intuition — scanning the ${state.active}${result.halved ? ' (half pool)' : ''}`,
        pool: poolLabel(result.pool), spur: result.spurTalent, dice: result.dice, hits: result.hits, aces: result.dice.filter((d) => d.face === 'ace').length });
    } else if (body.action === 'guess' && result.solved) {
      await tableLog({ type: 'event', text: `📡 The posse decoded the ${state.active}’s Kurtz Frequency!` });
    }
    return send(res, 200, { result, state: warden ? wardenView(state) : playerView(state) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
