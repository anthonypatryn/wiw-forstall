// One Vercel function for the whole API (the Hobby plan allows 12): /api/<area> runs lib/routes/<area>.js.
// Static imports so Vercel bundles every route; add new areas here.
import backup from '../lib/routes/backup.js';
import battle from '../lib/routes/battle.js';
import combat from '../lib/routes/combat.js';
import handouts from '../lib/routes/handouts.js';
import image from '../lib/routes/image.js';
import journal from '../lib/routes/journal.js';
import lockpick from '../lib/routes/lockpick.js';
import map from '../lib/routes/map.js';
import npcs from '../lib/routes/npcs.js';
import papers from '../lib/routes/papers.js';
import pulse from '../lib/routes/pulse.js';
import saloon from '../lib/routes/saloon.js';
import scan from '../lib/routes/scan.js';
import scenes from '../lib/routes/scenes.js';
import session from '../lib/routes/session.js';
import shop from '../lib/routes/shop.js';
import wanted from '../lib/routes/wanted.js';
import whispers from '../lib/routes/whispers.js';

const ROUTES = { backup, battle, combat, handouts, image, journal, lockpick, map, npcs, papers, pulse, saloon, scan, scenes, session, shop, wanted, whispers };

import { transaction, counter, bump } from '../lib/store.js';
import { pinOk } from '../lib/http.js';

// The Warden PIN is short, so wrong guesses are counted per connection: after BAD_PIN_LIMIT in BAD_PIN_WINDOW seconds,
// that connection is treated as a player (even with the right PIN) until the window passes.
const BAD_PIN_LIMIT = 30, BAD_PIN_WINDOW = 15 * 60;
async function guardPin(req) {
  const pin = req.headers['x-warden-pin'];
  if (!pin) return;
  const who = `badpin:${String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()}`;
  if (await counter(who) >= BAD_PIN_LIMIT) { delete req.headers['x-warden-pin']; return; }
  if (!pinOk(pin)) await bump(who, BAD_PIN_WINDOW);
}

// A stand-in response: the route writes here, and it only reaches the real response once its saves are committed.
function heldResponse() {
  const r = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k] = v; }, getHeader(k) { return this.headers[k]; }, end(b) { this.body = b; } };
  return r;
}

export default async function handler(req, res) {
  const area = new URL(req.url, 'http://x').pathname.split('/')[2] || '';
  const route = Object.hasOwn(ROUTES, area) ? ROUTES[area] : null;
  if (!route) { res.statusCode = 404; return res.end('Not found'); }
  if (area !== 'pulse') await guardPin(req);
  // read the body once, so a retried request sees it again (readBody uses req.body when it's there)
  if (req.method !== 'GET' && req.body === undefined) { let raw = ''; for await (const chunk of req) raw += chunk; req.body = raw; }
  // every request is a transaction (lib/store.js): if two land at once, the later one re-runs on fresh data
  for (let attempt = 0; attempt < 5; attempt++) {
    const held = heldResponse();
    try {
      await transaction(() => route(req, held));
    } catch (err) {
      if (!err.conflict) throw err;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
      continue;
    }
    res.statusCode = held.statusCode;
    for (const [k, v] of Object.entries(held.headers)) res.setHeader(k, v);
    return res.end(held.body);
  }
  res.statusCode = 409;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'The table is busy — try that again.' }));
}
