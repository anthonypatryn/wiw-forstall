import { load } from '../store.js';
import { pinOk, send } from '../http.js';

// Warden-only: every saved document in one JSON file (download from the Session page).
// Keep this in step with every document the app saves (grep lib/ for load('…') / KEY = '…'). Photos (img-* keys) aren't included.
const KEYS = ['state', 'combat', 'map', 'battle', 'battle-img', 'npcs', 'shop', 'session', 'handouts', 'whispers', 'locks', 'saloon', 'wanted', 'papers', 'journal', 'scenes'];

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
