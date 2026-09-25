import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshJournal, journalAction, journalView } from '../journal.js';
import { freshWanted, allTowns } from '../wanted.js';

const KEY = 'journal';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshJournal();
    // names for the links: NPCs the posse has met (all of them for the Warden) and every town
    const extras = async (asWarden) => {
      const [npcs, wanted, map] = await Promise.all([load('npcs'), load('wanted'), load('map')]);
      return {
        npcs: (npcs?.npcs || []).filter((n) => asWarden || n.known).map((n) => ({ id: n.id, name: n.name })),
        towns: allTowns(wanted || freshWanted(), (map?.pins || []).filter((p) => asWarden || p.shared)).map((t) => ({ id: t.id, name: t.name })),
      };
    };
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, { ...journalView(state, { warden: asWarden }), ...(await extras(asWarden)) });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const result = journalAction(state, body, { warden }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state: { ...journalView(state, { warden }), ...(await extras(warden)) } });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
