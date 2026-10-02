import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';

// The Problems log: script errors from anyone's browser land here so the Warden hears about bugs from the app itself.
// Players can only add; the Warden reads and clears. Same message on the same page within a day just counts up.
const KEY = 'problems', MAX = 80, DAY = 24 * 3600 * 1000, MAX_BUGS = 150;
// Bug reports (Menu → Report a bug): anyone files one, numbered BUG-1, BUG-2…; the Warden copies it for whoever fixes
// things, and the fix marks it done (`bugFix {no, note}` with the PIN).
export const BUG_AREAS = ['Battle Map', 'Character sheet', 'Rolls & dice', 'Saloon games', 'Carnival & contests', 'Lock Pick', 'Store', 'Journal & Wanted', 'Map of the West', 'NPCs', 'Run the Game', 'Something else'];
export const BUG_KINDS = ['Broken', 'Looks wrong', 'Confusing', 'Idea'];
const clip = (s, n) => String(s || '').replace(/[<>]/g, '').slice(0, n);

export default async function handler(req, res) {
  try {
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || { list: [], seenAt: 0 };
    if (req.method === 'GET') {
      if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
      return send(res, 200, { list: state.list, seenAt: state.seenAt || 0, bugs: state.bugs || [] });
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
    if (body.action === 'bug') {
      const what = clip(body.what, 1500).trim();
      if (!what) throw new Error('Say what went wrong.');
      const no = (state.bugNo || 0) + 1;
      const b = { no, area: BUG_AREAS.includes(body.area) ? body.area : 'Something else', kind: BUG_KINDS.includes(body.kind) ? body.kind : 'Broken',
        what, expected: clip(body.expected, 800), steps: clip(body.steps, 800), always: !!body.always, blocking: !!body.blocking,
        page: clip(body.page, 120), who: clip(body.who, 60), role: body.role === 'warden' ? 'warden' : 'player', ua: clip(body.ua, 160), screen: clip(body.screen, 20),
        at: Date.now(), status: 'open', fixedAt: 0, fixNote: '' };
      state.bugNo = no;
      state.bugs = [b, ...(state.bugs || [])].slice(0, MAX_BUGS);
      await save(state, KEY);
      return send(res, 200, { no });
    }
    if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
    if (['bugFix', 'bugReopen', 'bugRemove'].includes(body.action)) { // one (`no`) or several at once (`nos`, e.g. a batch fix)
      const nos = (Array.isArray(body.nos) ? body.nos : [body.no]).map((n) => Number(String(n ?? '').replace(/\D/g, ''))).filter(Boolean);
      const hit = (state.bugs || []).filter((x) => nos.includes(x.no));
      if (!hit.length) throw new Error(`No BUG-${nos[0] || '?'}.`);
      for (const b of hit) {
        if (body.action === 'bugFix') Object.assign(b, { status: 'fixed', fixedAt: Date.now(), fixNote: clip(body.note, 400) });
        if (body.action === 'bugReopen') Object.assign(b, { status: 'open', fixedAt: 0 });
      }
      if (body.action === 'bugRemove') state.bugs = state.bugs.filter((x) => !hit.includes(x));
      await save(state, KEY);
      return send(res, 200, { bugs: hit.map((b) => b.no) });
    }
    if (body.action === 'seen') { state.seenAt = Date.now(); await save(state, KEY); return send(res, 200, { ok: true }); }
    if (body.action === 'clear') { state.list = []; state.seenAt = Date.now(); await save(state, KEY); return send(res, 200, { ok: true }); }
    throw new Error('Unknown action.');
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
