import { load } from '../lib/store.js';
import { pinOk, send } from '../lib/http.js';

// Warden-only: every saved document in one JSON file (download from the Session page).
const KEYS = ['state', 'combat', 'map', 'battle', 'npcs', 'shop', 'session'];

export default async function handler(req, res) {
  try {
    if (!pinOk(req.headers['x-warden-pin'])) return send(res, 401, { error: 'Wrong PIN.' });
    const data = {};
    for (const k of KEYS) data[k] = await load(k);
    return send(res, 200, { app: 'wiw-forstall', savedAt: new Date().toISOString(), data });
  } catch (err) {
    return send(res, 500, { error: err.message || String(err) });
  }
}
