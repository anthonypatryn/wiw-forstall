import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';

// The Problems log: script errors from anyone's browser land here so the Warden hears about bugs from the app itself.
// Players can only add; the Warden reads and clears. Same message on the same page within a day just counts up.
const KEY = 'problems', MAX = 80, DAY = 24 * 3600 * 1000;
const clip = (s, n) => String(s || '').replace(/[<>]/g, '').slice(0, n);

export default async function handler(req, res) {
  try {
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || { list: [], seenAt: 0 };
    if (req.method === 'GET') {
      if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
      return send(res, 200, { list: state.list, seenAt: state.seenAt || 0 });
    }
    const body = await readBody(req);
    if (body.action === 'report') {
      const p = { msg: clip(body.msg, 300), where: clip(body.where, 160), page: clip(body.page, 80), who: clip(body.who, 40), ua: clip(body.ua, 120) };
      if (!p.msg) return send(res, 200, { ok: true });
      const now = Date.now();
      const same = state.list.find((x) => x.msg === p.msg && x.page === p.page && now - x.last < DAY);
      if (same) { same.count += 1; same.last = now; if (p.who && !same.who.includes(p.who)) same.who = `${same.who}${same.who ? ', ' : ''}${p.who}`.slice(0, 120); }
      else state.list.unshift({ id: now.toString(36), ...p, count: 1, first: now, last: now });
      state.list = state.list.slice(0, MAX);
      await save(state, KEY);
      return send(res, 200, { ok: true });
    }
    if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
    if (body.action === 'seen') { state.seenAt = Date.now(); await save(state, KEY); return send(res, 200, { ok: true }); }
    if (body.action === 'clear') { state.list = []; state.seenAt = Date.now(); await save(state, KEY); return send(res, 200, { ok: true }); }
    throw new Error('Unknown action.');
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
