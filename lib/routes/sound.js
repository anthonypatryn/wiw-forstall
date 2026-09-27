// The Warden's soundboard: a sound effect played on everyone's screen (a cue), and a background loop that keeps
// playing for the whole table until the Warden stops it. Players only read it; every change is the Warden's.
import crypto from 'node:crypto';
import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { clean } from '../util.js';

const KEY = 'sound';
const fresh = () => ({ v: 0, cues: [], loop: null });
const view = (s) => ({ v: s.v, now: Date.now(), cues: s.cues, loop: s.loop });

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || fresh();
    if (req.method === 'GET') {
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, view(state));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    if (!warden) throw new Error('Warden PIN required.');
    let result = null;
    if (body.action === 'cue') { // one sound, once, on every screen
      const name = clean(body.name, 30);
      if (!name) throw new Error('Pick a sound.');
      result = { id: clean(body.id, 12) || crypto.randomUUID().slice(0, 8), name, arg: clean(body.arg, 20), at: Date.now() };
      state.cues = [...state.cues, result].slice(-10);
    } else if (body.action === 'loop') { // start (or change) the table's background loop; name '' stops it
      const name = clean(body.name, 30);
      state.loop = name ? { name, at: Date.now() } : null;
      result = state.loop;
    } else throw new Error('Unknown action.');
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state: view(state) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
