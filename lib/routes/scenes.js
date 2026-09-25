import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshScenes, sceneAction } from '../scenes.js';

const KEY = 'scenes';

// Warden only: scenes are the Warden's prep and never reach players
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    if (!pinOk(req.headers['x-warden-pin'])) return send(res, 401, { error: 'Wrong PIN.' });
    const state = (await load(KEY)) || freshScenes();
    if (req.method === 'GET') {
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, state);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, 200, { ok: true });
    const result = sceneAction(state, body, { warden: true }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
