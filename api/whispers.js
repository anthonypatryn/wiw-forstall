import { load, save } from '../lib/store.js';
import { pinOk, send, readBody } from '../lib/http.js';
import { freshWhispers, whisperAction, whisperView } from '../lib/whispers.js';

const KEY = 'whispers';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshWhispers();
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      const v = `${state.v}`;
      if (url.searchParams.get('since') === v) return send(res, 200, { v, unchanged: true });
      return send(res, 200, whisperView(state, { warden: asWarden, pc: String(url.searchParams.get('pc') || '') }));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || { posse: [] };
    const names = Object.fromEntries((combat.posse || []).filter((p) => !p.dead).map((p) => [p.id, p.name]));
    const result = whisperAction(state, body, { warden, names }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
