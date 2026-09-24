import { load, save } from '../lib/store.js';
import { pinOk, send, readBody } from '../lib/http.js';
import { freshBattle, battleAction, battleView } from '../lib/battle.js';

const KEY = 'battle';
const IMG_KEY = 'battle-img';
const MAX_IMG = 3_000_000; // base64 chars (~2.2 MB image) — the page shrinks uploads well below this

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);

    // Uploaded background image, versioned by ?v= so it can be cached forever.
    if (req.method === 'GET' && url.searchParams.get('view') === 'img') {
      const img = await load(IMG_KEY);
      if (!img?.data) { res.statusCode = 404; return res.end('No image'); }
      res.statusCode = 200;
      res.setHeader('Content-Type', img.type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(Buffer.from(img.data, 'base64'));
    }

    const [stored, combat] = await Promise.all([load(KEY), load('combat')]);
    const state = stored || freshBattle();
    const view = () => battleView(state, { warden, combat });

    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'warden' && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      const v = view();
      if (url.searchParams.get('since') === v.v) return send(res, 200, { v: v.v, unchanged: true });
      return send(res, 200, v);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });

    if (body.action === 'upload') {
      if (!warden) return send(res, 401, { error: 'Warden PIN required.' });
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
      if (!m) throw new Error('That doesn’t look like an image.');
      if (m[2].length > MAX_IMG) throw new Error('Image is too large — try a smaller one.');
      await save({ type: m[1], data: m[2] }, IMG_KEY);
      body.action = 'uploaded';
    }

    const result = battleAction(state, body, { warden, combat }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state: view() });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
