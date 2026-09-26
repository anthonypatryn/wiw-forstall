import { versions, markHere, whoIsHere } from '../store.js';
import { send } from '../http.js';

// GET /api/pulse → { v: { combat: 12, saloon: 3, … } }: every document's change counter in one small read.
// Pages poll this (common.js startPolling / onChange) and only fetch a document's view when its counter moved.
// ?here=<pc> marks that player as connected; ?who=<pc,pc> also returns which of them are (Run the Game's dots).
export const DOCS = ['state', 'combat', 'battle', 'map', 'npcs', 'shop', 'session', 'handouts', 'whispers', 'locks', 'saloon', 'wanted', 'papers', 'journal', 'scenes'];

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x'), id = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12);
    const here = id(url.searchParams.get('here'));
    if (here) await markHere(here); // "I'm here" from a player's tab (every ~20 s)
    const who = (url.searchParams.get('who') || '').split(',').map(id).filter(Boolean).slice(0, 20);
    return send(res, 200, { v: await versions(DOCS), ...(who.length ? { here: await whoIsHere(who) } : {}) });
  } catch (err) { return send(res, 500, { error: err.message || String(err) }); }
}
