import { load, save } from '../store.js';
import { pinOk, send, readBody, sinceParam } from '../http.js';
import { freshNpcs, npcAction, npcView } from '../npcs.js';
import { freshCombat, addLog } from '../combat.js';
import { BOOK_NPCS } from '../booknpcs.js';
import { X_NPCS, X_GENERIC, X_FACTION_NOTES } from '../expansion-npcs.js';

const KEY = 'npcs';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshNpcs();
    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'book') { // stat blocks are Warden-only (no spoilers)
        if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
        return send(res, 200, { ...BOOK_NPCS, expansions: X_NPCS, xGeneric: X_GENERIC, factionNotes: X_FACTION_NOTES });
      }
      if (url.searchParams.get('view') === 'factions') return send(res, 200, { factions: npcView(state, { warden }).factions });
      if (url.searchParams.get('view') === 'warden' && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (sinceParam(url) === state.v) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, npcView(state, { warden }));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const result = npcAction(state, body, { warden }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    // a change in the posse's standing with a faction the posse knows goes in the Table Log
    if (body.action === 'standing' && result && result.level !== result.was && npcView(state, { warden: false }).factions.some((f) => f.name === result.faction)) {
      const combat = (await load('combat')) || freshCombat();
      addLog(combat, { type: 'event', text: `The posse’s standing with ${result.faction} is now ${result.level} (was ${result.was}).` });
      combat.v = (combat.v || 0) + 1;
      await save(combat, 'combat');
    }
    return send(res, 200, { result, state: npcView(state, { warden }) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
