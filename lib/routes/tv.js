// The TV table screen (/tv): what the Warden puts up for the whole table to read (a scene's read-aloud, a handout).
// Everyone may read it; only the Warden changes it.
import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { clean } from '../util.js';

const KEY = 'tv';
const fresh = () => ({ v: 0, show: null });

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || fresh();
    if (req.method === 'GET') {
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, state);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    if (!warden) throw new Error('Warden PIN required.');
    if (body.action === 'show') {
      const title = clean(body.title, 90), text = clean(body.text, 4000), img = /^(\/|https:\/\/|data:image\/)/.test(String(body.img || '')) ? String(body.img).slice(0, 400_000) : '';
      if (!title && !text && !img) throw new Error('Nothing to show.');
      state.show = { title, text, img, at: Date.now() };
    } else if (body.action === 'clear') state.show = null;
    else throw new Error('Unknown action.');
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result: state.show, state });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
