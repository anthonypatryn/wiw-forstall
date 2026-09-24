import { load, save } from '../lib/store.js';
import { pinOk, send, readBody, sinceParam } from '../lib/http.js';
import { freshNpcs, npcAction, npcView } from '../lib/npcs.js';
import { BOOK_NPCS } from '../lib/booknpcs.js';

const KEY = 'npcs';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshNpcs();
    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'book') { // stat blocks are Warden-only (no spoilers)
        if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
        return send(res, 200, BOOK_NPCS);
      }
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
    return send(res, 200, { result, state: npcView(state, { warden }) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
