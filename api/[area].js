// One Vercel function for the whole API (the Hobby plan allows 12): /api/<area> runs lib/routes/<area>.js.
// Static imports so Vercel bundles every route; add new areas here.
import backup from '../lib/routes/backup.js';
import battle from '../lib/routes/battle.js';
import carnival from '../lib/routes/carnival.js';
import combat from '../lib/routes/combat.js';
import contest from '../lib/routes/contest.js';
import handouts from '../lib/routes/handouts.js';
import image from '../lib/routes/image.js';
import journal from '../lib/routes/journal.js';
import lockpick from '../lib/routes/lockpick.js';
import map from '../lib/routes/map.js';
import npcs from '../lib/routes/npcs.js';
import papers from '../lib/routes/papers.js';
import problems from '../lib/routes/problems.js';
import pulse from '../lib/routes/pulse.js';
import saloon from '../lib/routes/saloon.js';
import scan from '../lib/routes/scan.js';
import scenes from '../lib/routes/scenes.js';
import session from '../lib/routes/session.js';
import shop from '../lib/routes/shop.js';
import sound from '../lib/routes/sound.js';
import wanted from '../lib/routes/wanted.js';
import whispers from '../lib/routes/whispers.js';
import undo from '../lib/routes/undo.js';
import tv from '../lib/routes/tv.js';

const ROUTES = { backup, battle, carnival, combat, contest, handouts, image, journal, lockpick, map, npcs, papers, problems, pulse, saloon, scan, scenes, session, shop, sound, tv, undo, wanted, whispers };

import { transaction, counter, bump } from '../lib/store.js';
import { pinOk } from '../lib/http.js';

// The Warden PIN is short, so wrong guesses are counted per connection: after BAD_PIN_LIMIT in BAD_PIN_WINDOW seconds,
// that connection is treated as a player (even with the right PIN) until the window passes.
const BAD_PIN_LIMIT = 30, BAD_PIN_WINDOW = 15 * 60;
const MAX_BODY = 6_000_000; // characters; photo uploads are the biggest thing sent
async function guardPin(req) {
  const pin = req.headers['x-warden-pin'];
  if (!pin) return;
  const who = `badpin:${String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()}`;
  if (await counter(who) >= BAD_PIN_LIMIT) { delete req.headers['x-warden-pin']; return; }
  if (!pinOk(pin)) await bump(who, BAD_PIN_WINDOW);
}

// What a change was, for the Warden's Undo list ("Sheet: wallet", "Store: decide"…). Only successful POSTs that
// change something count; noise (pings, error reports, backups, photos, the undo itself) never does.
const NO_UNDO_AREAS = new Set(['pulse', 'problems', 'backup', 'image', 'undo', 'sound', 'tv']);
const NO_UNDO_ACTIONS = new Set(['ping', 'report', 'auth', 'seen', 'here']);
const AREA_NAME = { combat: '', battle: 'Battle Map', shop: 'Store', journal: 'Journal', npcs: 'NPCs', wanted: 'Wanted', handouts: 'Handouts', whispers: 'Whisper', lockpick: 'Lock pick', saloon: 'Saloon', scan: 'Scanner', scenes: 'Prep', session: 'Session notes', map: 'Map', papers: 'Newspaper' };
const words = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').trim().toLowerCase();
function undoLabel(area, req, held) {
  if (req.method !== 'POST' || held.statusCode >= 400 || NO_UNDO_AREAS.has(area)) return null;
  let b = {};
  try { b = JSON.parse(req.body || '{}'); } catch {}
  if (NO_UNDO_ACTIONS.has(b.action)) return null;
  const ACT = { next: 'next turn', pc: '', sheet: 'sheet', addPc: 'new character', addEnemy: 'add enemy', end: 'end combat', start: 'start combat', decide: 'approve or deny a request', give: 'give an item' };
  const what = [Object.hasOwn(ACT, b.action) ? ACT[b.action] : words(b.action), b.op ? words(b.op) : '', b.path ? words(b.path) : ''].filter(Boolean).join(' · ');
  const label = `${AREA_NAME[area] ?? words(area)}${AREA_NAME[area] === '' ? '' : ': '}${what || 'change'}`.replace(/^: /, '');
  return { label: label.charAt(0).toUpperCase() + label.slice(1), who: pinOk(req.headers['x-warden-pin']) ? 'Warden' : 'a player' };
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
  if (req.method !== 'GET' && req.body === undefined) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > MAX_BODY) { res.statusCode = 413; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ error: 'That’s too big to send.' })); } }
    req.body = raw;
  }
  // every request is a transaction (lib/store.js): if two land at once, the later one re-runs on fresh data
  for (let attempt = 0; attempt < 5; attempt++) {
    const held = heldResponse();
    try {
      await transaction(() => route(req, held), { undo: () => undoLabel(area, req, held) });
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
