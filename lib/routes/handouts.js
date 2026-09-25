import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshHandouts, handoutAction, handoutView } from '../handouts.js';
import { freshCombat, addLog } from '../combat.js';

const KEY = 'handouts';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshHandouts();
    const pc = String(url.searchParams.get('pc') || '').slice(0, 12);
    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'warden' && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      const v = `${state.v}`;
      if (url.searchParams.get('since') === v) return send(res, 200, { v, unchanged: true });
      return send(res, 200, handoutView(state, { warden: warden && url.searchParams.get('view') === 'warden', pc }));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || freshCombat();
    const names = Object.fromEntries(combat.posse.filter((p) => !p.dead).map((p) => [p.id, p.name]));
    let logged = false;
    // public line for the Table Log; the second argument is a Warden-only note
    const log = (text, secret) => { if (!text && !secret) return; addLog(combat, text ? { type: 'event', text } : { type: 'event', text: secret, hidden: true }); logged = true; };
    const result = handoutAction(state, body, { warden, names, log }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    if (logged) { combat.v = (combat.v || 0) + 1; await save(combat, 'combat'); }
    return send(res, 200, { result, state: handoutView(state, { warden, pc: String(body.pc || '') }) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
