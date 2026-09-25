// Uploaded pictures: character portraits (headshot + full) and, later, handout photos.
// Stored like the battle-map image: base64 in the store under `img-<ns>-<id>-<size>`; served with ?v= so browsers can cache forever.
import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshCombat } from '../combat.js';

const LIMIT = { head: 300_000, full: 2_000_000 }; // base64 characters (the page shrinks images well below this)
const NS = new Set(['pc', 'handout', 'wanted']);
const clean = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
const key = (ns, id, size) => `img-${ns}-${id}-${size}`;

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    if (req.method === 'GET') {
      const ns = clean(url.searchParams.get('ns')), id = clean(url.searchParams.get('id')), size = url.searchParams.get('size') === 'full' ? 'full' : 'head';
      if (!NS.has(ns) || !id) { res.statusCode = 404; return res.end('No image'); }
      const img = await load(key(ns, id, size));
      if (!img?.data) { res.statusCode = 404; return res.end('No image'); }
      res.statusCode = 200;
      res.setHeader('Content-Type', img.type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(Buffer.from(img.data, 'base64'));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    const ns = clean(body.ns), id = clean(body.id);
    if (!NS.has(ns) || !id) throw new Error('Unknown picture.');
    if ((ns === 'handout' || ns === 'wanted') && !warden) return send(res, 401, { error: 'Warden PIN required.' });
    const parse = (s, size) => {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
      if (!m) throw new Error('That doesn’t look like a picture.');
      if (m[2].length > LIMIT[size]) throw new Error('That picture is too large — try a smaller one.');
      return { type: m[1], data: m[2] };
    };
    let v = null;
    if (body.action === 'upload') {
      const head = parse(body.head, 'head'), full = body.full ? parse(body.full, 'full') : head;
      await Promise.all([save(head, key(ns, id, 'head')), save(full, key(ns, id, 'full'))]);
      v = Date.now();
    } else if (body.action === 'clear') {
      await Promise.all([save({}, key(ns, id, 'head')), save({}, key(ns, id, 'full'))]);
    } else throw new Error('Unknown action.');
    // a character's portrait is noted on the sheet so every page knows to show it
    if (ns === 'pc') {
      const combat = (await load('combat')) || freshCombat();
      const pc = combat.posse.find((p) => p.id === id);
      if (!pc) throw new Error('No such character.');
      if (v) pc.portrait = { v }; else delete pc.portrait;
      pc.updated = Date.now();
      combat.v = (combat.v || 0) + 1;
      await save(combat, 'combat');
    }
    // a Wanted poster's picture is noted on the poster
    if (ns === 'wanted') {
      const ws = (await load('wanted')) || { v: 0, posters: [] };
      const p = ws.posters.find((x) => x.id === id);
      if (p) { p.img = v; ws.v = (ws.v || 0) + 1; await save(ws, 'wanted'); }
    }
    // a handout's photo is noted on the handout
    if (ns === 'handout') {
      const hs = (await load('handouts')) || { v: 0, list: [] };
      const h = hs.list.find((x) => x.id === id);
      if (h) { h.img = v; hs.v = (hs.v || 0) + 1; await save(hs, 'handouts'); }
    }
    return send(res, 200, { result: { v } });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
