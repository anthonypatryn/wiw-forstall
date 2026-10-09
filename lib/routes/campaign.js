import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshCampaign, campaignAction } from '../campaign.js';

const KEY = 'campaign';

// Warden only: the campaign (threads, the truth behind them) never reaches players
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    if (!pinOk(req.headers['x-warden-pin'])) return send(res, 401, { error: 'Wrong PIN.' });
    const state = (await load(KEY)) || freshCampaign();
    if (req.method === 'GET') {
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, state);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, 200, { ok: true });
    const result = campaignAction(state, body, { warden: true }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
