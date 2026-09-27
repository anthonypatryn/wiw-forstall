import { undoList, undoApply } from '../store.js';
import { pinOk, send, readBody } from '../http.js';

// The Warden's Undo for any change made through the site (lib/store.js keeps the last few). A fight has its own Undo.
export default async function handler(req, res) {
  try {
    if (!pinOk(req.headers['x-warden-pin'])) return send(res, 401, { error: 'Wrong PIN.' });
    if (req.method === 'GET') return send(res, 200, { list: await undoList() });
    const body = await readBody(req);
    if (body.action !== 'undo') throw new Error('Unknown action.');
    return send(res, 200, { result: await undoApply(String(body.id || '')) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
