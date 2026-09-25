// One Vercel function for the whole API (the Hobby plan allows 12): /api/<area> runs lib/routes/<area>.js.
// Static imports so Vercel bundles every route; add new areas here.
import backup from '../lib/routes/backup.js';
import battle from '../lib/routes/battle.js';
import combat from '../lib/routes/combat.js';
import handouts from '../lib/routes/handouts.js';
import image from '../lib/routes/image.js';
import lockpick from '../lib/routes/lockpick.js';
import map from '../lib/routes/map.js';
import npcs from '../lib/routes/npcs.js';
import scan from '../lib/routes/scan.js';
import session from '../lib/routes/session.js';
import shop from '../lib/routes/shop.js';
import wanted from '../lib/routes/wanted.js';
import whispers from '../lib/routes/whispers.js';

const ROUTES = { backup, battle, combat, handouts, image, lockpick, map, npcs, scan, session, shop, wanted, whispers };

export default function handler(req, res) {
  const area = new URL(req.url, 'http://x').pathname.split('/')[2] || '';
  const route = Object.hasOwn(ROUTES, area) ? ROUTES[area] : null;
  if (!route) { res.statusCode = 404; return res.end('Not found'); }
  return route(req, res);
}
