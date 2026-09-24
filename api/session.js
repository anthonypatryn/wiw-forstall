import { load, save } from '../lib/store.js';
import { pinOk, send, readBody, sinceParam } from '../lib/http.js';
import { freshSession, sessionAction } from '../lib/session.js';
import { freshCombat, addLog } from '../lib/combat.js';

const KEY = 'session';

// Everything here is Warden-only.
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    if (!pinOk(req.headers['x-warden-pin'])) return send(res, 401, { error: 'Wrong PIN.' });
    const state = (await load(KEY)) || freshSession();
    if (req.method === 'GET') {
      if (sinceParam(url) === state.v) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, state);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, 200, { ok: true });
    if (body.action === 'postRecap') { // share a recap with the players via the Table Log
      const s = state.sessions.find((x) => x.id === body.id);
      const text = String(s?.recap || '').replace(/[<>]/g, '').trim();
      if (!text) throw new Error('Write a recap first.');
      const combat = (await load('combat')) || freshCombat();
      addLog(combat, { type: 'event', text: `📜 ${s.title}${s.date ? ` (${s.date})` : ''} — ${text}` });
      combat.v = (combat.v || 0) + 1;
      await save(combat, 'combat');
      return send(res, 200, { result: true, state });
    }
    const result = sessionAction(state, body) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
