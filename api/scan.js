import crypto from 'node:crypto';
import { load, save, storeKind } from '../lib/store.js';
import { freshState, playerView, wardenView, doRoll, doGuess, doNote, wardenAction } from '../lib/game.js';

// Locally (no env var) the Warden PIN defaults to 1234. On Vercel it must be set.
const PIN = process.env.WARDEN_PIN || (process.env.VERCEL ? null : '1234');

function pinOk(given) {
  if (!PIN || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(PIN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    let state = (await load()) || freshState();

    if (req.method === 'GET') {
      const since = url.searchParams.has('since') ? Number(url.searchParams.get('since')) : null;
      if (url.searchParams.get('view') === 'warden') {
        if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
        if (since === state.v) return send(res, 200, { v: state.v, unchanged: true });
        return send(res, 200, { ...wardenView(state), store: storeKind });
      }
      if (since === state.v) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, playerView(state));
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    let result = null;

    switch (body.action) {
      case 'auth':
        return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
      case 'roll': result = doRoll(state, body); break;
      case 'guess': result = doGuess(state, body); break;
      case 'note': doNote(state, body); break;
      default:
        if (!warden) return send(res, 401, { error: 'Warden PIN required.' });
        wardenAction(state, body);
    }

    state.v = (state.v || 0) + 1;
    await save(state);
    return send(res, 200, { result, state: warden ? wardenView(state) : playerView(state) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
