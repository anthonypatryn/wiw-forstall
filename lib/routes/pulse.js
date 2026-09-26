import { versions } from '../store.js';
import { send } from '../http.js';

// GET /api/pulse → { v: { combat: 12, saloon: 3, … } }: every document's change counter in one small read.
// Pages poll this (common.js startPolling / onChange) and only fetch a document's view when its counter moved.
export const DOCS = ['state', 'combat', 'battle', 'map', 'npcs', 'shop', 'session', 'handouts', 'whispers', 'locks', 'saloon', 'wanted', 'papers', 'journal', 'scenes'];

export default async function handler(req, res) {
  try { return send(res, 200, { v: await versions(DOCS) }); } catch (err) { return send(res, 500, { error: err.message || String(err) }); }
}
