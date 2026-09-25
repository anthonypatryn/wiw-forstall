import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshMap, mapAction, mapView, MAP_META } from '../map.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    if (req.method === 'GET' && url.searchParams.get('view') === 'meta') return send(res, 200, MAP_META);

    const [state, combat] = await Promise.all([load('map'), load('combat')]);
    const map = state || freshMap();
    const posse = combat?.posse || [];
    // Tokens and names come from two documents, so version on both.
    const version = () => `${map.v}.${combat?.v || 0}`;
    const view = () => ({ ...mapView(map, { warden, posse }), v: version() });

    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'warden' && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === version()) return send(res, 200, { v: version(), unchanged: true });
      return send(res, 200, view());
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const result = mapAction(map, body, { warden }) ?? null;
    map.v = (map.v || 0) + 1;
    await save(map, 'map');
    return send(res, 200, { result, state: view() });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
