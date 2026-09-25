import { load, save, storeKind } from '../lib/store.js';
import { pinOk, send, readBody, sinceParam } from '../lib/http.js';
import { freshCombat, publicAction, playerCombatView, wardenCombatView, logView, META, autoAchievements } from '../lib/combat.js';

const KEY = 'combat';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshCombat();
    const view = () => (warden ? { ...wardenCombatView(state), store: storeKind } : playerCombatView(state));

    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'meta') return send(res, 200, META);
      if (url.searchParams.get('view') === 'warden' && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (sinceParam(url) === state.v) return send(res, 200, { v: state.v, unchanged: true });
      if (url.searchParams.get('view') === 'log') return send(res, 200, logView(state));
      return send(res, 200, view());
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const result = publicAction(state, body, { warden }) ?? null;
    autoAchievements(state);
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result: warden || !result?.hidden ? result : null, state: view() });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
