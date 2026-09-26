import { load, save } from '../store.js';
import { pinOk, send, readBody, sinceParam } from '../http.js';
import { freshSession, sessionAction, sessionEntries, plainSummary, withSummary } from '../session.js';
import { freshCombat, addLog } from '../combat.js';

const KEY = 'session';

// Everything here is Warden-only.
// Claude writes the session up. Returns { summary, recap } or null (falls back to the plain list).
async function aiSummary(entries, combat) {
  const cast = (combat.posse || []).map((p) => `${p.name} (the ${p.trade}${p.player ? `, played by ${p.player}` : ''})`).join('; ');
  const lines = entries.map((l) => `[${new Date(l.at).toISOString().slice(11, 16)}] ${l.text}${l.secret ? ` [Warden only: ${l.secret}]` : ''}`).join('\n').slice(-60000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.SUMMARY_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1400,
        system: 'You help the Warden (game master) of a Wild Imaginary West session — a Wild West tabletop RPG about monster hunting with Forstall devices. From the Table Log of one game night, write the Warden a clear, compact summary in plain text (no markdown symbols, no emoji). Use these short sections in capitals: STORY SO FAR (what happened, in order, 4–8 sentences), FIGHTS (who fought what and how it went), LOOT & REWARDS, PEOPLE & PLACES (NPCs, factions, places mentioned), LOOSE ENDS (open threads, injuries, things to follow up). Skip a section if there is nothing for it. Do not invent events that are not in the log. Then write a line that is exactly RECAP: followed by a 2–3 sentence spoiler-free recap the Warden can read to the players (leave out anything marked Warden only).',
        messages: [{ role: 'user', content: `The posse: ${cast || 'unknown'}.\n\nTable Log for the session, oldest first:\n${lines}` }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    if (!text) return null;
    const [summary, recap] = text.split(/\n?RECAP:\s*/);
    return { summary: summary.trim(), recap: (recap || '').trim() || null };
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    // the one public piece: the latest session's player recap (never the Warden's notes) for "Previously on…"
    if (req.method === 'GET' && url.searchParams.get('view') === 'recap') {
      const st = (await load(KEY)) || freshSession();
      const s = [...(st.sessions || [])].filter((x) => x.recap && x.recap.trim()).sort((a, b) => (b.ended || b.at || 0) - (a.ended || a.at || 0))[0];
      return send(res, 200, s ? { id: s.id, title: s.title, date: s.date || '', ended: s.ended || null, recap: s.recap } : { id: null });
    }
    if (!pinOk(req.headers['x-warden-pin'])) return send(res, 401, { error: 'Wrong PIN.' });
    const state = (await load(KEY)) || freshSession();
    if (req.method === 'GET') {
      if (sinceParam(url) === state.v) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, state);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, 200, { ok: true });
    if (body.action === 'summarize') { // write up this session from the Table Log archive
      const s = state.sessions.find((x) => x.id === body.id);
      if (!s) throw new Error('No such session.');
      const combat = (await load('combat')) || freshCombat();
      const entries = sessionEntries(state, s, combat.archive);
      if (!entries.length) throw new Error('Nothing has been logged since this session started.');
      let summary = null, recap = null, by = 'plain list — add an Anthropic API key for a written summary';
      if (process.env.ANTHROPIC_API_KEY) {
        const out = await aiSummary(entries, combat);
        if (out) { summary = out.summary; recap = out.recap; by = 'written by Claude'; }
      }
      summary ||= plainSummary(entries);
      s.notes = withSummary(s.notes, summary, `${by}, ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      if (recap && !String(s.recap || '').trim()) s.recap = recap.slice(0, 2000);
      s.at = Date.now();
      state.v = (state.v || 0) + 1;
      await save(state, KEY);
      return send(res, 200, { result: { entries: entries.length, ai: by.startsWith('written') }, state });
    }
    if (body.action === 'postRecap') { // share a recap with the players via the Table Log
      const s = state.sessions.find((x) => x.id === body.id);
      const text = String(s?.recap || '').replace(/[<>]/g, '').trim();
      if (!text) throw new Error('Write a recap first.');
      const combat = (await load('combat')) || freshCombat();
      addLog(combat, { type: 'event', text: `${s.title}${s.date ? ` (${s.date})` : ''} — ${text}` });
      combat.v = (combat.v || 0) + 1;
      await save(combat, 'combat');
      return send(res, 200, { result: true, state });
    }
    const result = sessionAction(state, body) ?? null;
    if (body.action === 'end') { // tell the table it's a wrap
      const combat = (await load('combat')) || freshCombat();
      addLog(combat, { type: 'event', text: `That’s the end of ${result.title}. Thanks for riding, posse.` });
      combat.v = (combat.v || 0) + 1;
      await save(combat, 'combat');
    }
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
