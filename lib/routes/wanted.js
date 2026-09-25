import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshWanted, wantedAction, wantedView, allTowns, TERMS } from '../wanted.js';
import { freshCombat, addLog } from '../combat.js';
import { freshMap } from '../map.js';
import { freshJournal } from '../journal.js';

const KEY = 'wanted';
const NEAR = 55; // map px, same as the Map page: a token this close to a town is "in" it

// where the posse is: the town nearest the middle of their Map tokens (if they're in one)
function hereTown(towns, map, posse) {
  const pts = posse.filter((p) => !p.dead).map((p) => map.tokens?.[p.id]).filter(Boolean);
  if (!pts.length) return null;
  const x = pts.reduce((s, t) => s + t.x, 0) / pts.length, y = pts.reduce((s, t) => s + t.y, 0) / pts.length;
  let best = null, bd = Infinity;
  for (const t of towns.filter((t) => t.x != null)) { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } }
  return bd < NEAR * 1.6 ? best.id : null;
}
// the picture on a poster: an uploaded one, else the character's portrait, else the NPC's token art
function photoOf(p, posse, npcs) {
  if (p.img) return `/api/image?ns=wanted&id=${p.id}&size=full&v=${p.img}`;
  const pc = p.pcId && posse.find((c) => c.id === p.pcId);
  if (pc?.portrait) return `/api/image?ns=pc&id=${pc.id}&size=full&v=${pc.portrait.v}`;
  const n = p.npcId && npcs.find((x) => x.id === p.npcId);
  return n?.img ? `/img/tokens/${n.img}.webp` : null;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const [state, map, combat, npcDoc] = await Promise.all([load(KEY), load('map'), load('combat'), load('npcs')]).then(([a, b, c, d]) => [a || freshWanted(), b || freshMap(), c || freshCombat(), d || { npcs: [] }]);
    const towns = allTowns(state, map.pins || []);
    const view = (asWarden) => {
      const v = wantedView(state, { warden: asWarden, towns });
      return {
        ...v, v: `${state.v}.${map.v || 0}`, here: hereTown(towns, map, combat.posse), terms: TERMS, names: Object.fromEntries(combat.posse.map((p) => [p.id, p.name])),
        posters: v.posters.map((p) => ({ ...p, photo: photoOf(p, combat.posse, npcDoc.npcs || []) })),
        ...(asWarden ? {
          posse: combat.posse.filter((p) => !p.dead).map((p) => ({ id: p.id, name: p.name, cut: [...(p.abilities || []), ...(p.talents || [])].includes('Cut of the Profit') })),
          npcs: (npcDoc.npcs || []).map((n) => ({ id: n.id, name: n.name })),
        } : {}),
      };
    };
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === `${state.v}.${map.v || 0}`) return send(res, 200, { v: `${state.v}.${map.v || 0}`, unchanged: true });
      return send(res, 200, view(asWarden));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    let touched = false;
    const log = (text) => { addLog(combat, { type: 'event', text }); touched = true; };
    const journal = (await load('journal')) || freshJournal(), jv = journal.v || 0;
    const jBefore = JSON.stringify(journal.quests);
    const result = wantedAction(state, body, { warden, towns: allTowns(state, map.pins || []), posse: combat.posse, log, journal }) ?? null;
    if (body.action === 'payout') touched = true;
    if (JSON.stringify(journal.quests) !== jBefore) { journal.v = jv + 1; await save(journal, 'journal'); }
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    if (touched) { combat.v = (combat.v || 0) + 1; await save(combat, 'combat'); }
    return send(res, 200, { result, state: view(warden) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
