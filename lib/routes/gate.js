// POST /api/gate {password}: the splash page's check. The right password sets the site cookie (lib/gate.js) for a year.
// Wrong guesses are counted per connection like the Warden PIN: after 30 in 15 minutes, it stops listening for a while.
import { send, readBody } from '../http.js';
import { counter, bump } from '../store.js';
import { passwordOk, cookieHeader } from '../gate.js';

const LIMIT = 30, WINDOW = 15 * 60;
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const who = `badgate:${String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()}`;
    if (await counter(who) >= LIMIT) return send(res, 429, { error: 'Too many wrong guesses. Try again in a few minutes.' });
    const body = await readBody(req);
    if (!passwordOk(body.password)) { await bump(who, WINDOW); return send(res, 401, { error: 'That ain’t it, partner.' }); }
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(String(req.headers.host || ''));
    res.setHeader('Set-Cookie', await cookieHeader(!local)); // Secure everywhere but plain-http localhost
    return send(res, 200, { ok: true });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
