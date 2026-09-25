import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshPapers, papersAction, papersView, paperName } from '../papers.js';
import { freshSession, sessionEntries } from '../session.js';
import { freshCombat, addLog } from '../combat.js';
import { freshWanted, allTowns } from '../wanted.js';

const KEY = 'papers';
const NOISE = /^(Round \d+|↶ Undone|.* joins the fight!$|.* is out of the fight\.$)/;

// Claude sets the type: a front page in an 1880s frontier-newspaper voice, from what the posse could know (no Warden-only lines)
async function aiFrontPage(lines, cast, paper, town) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.SUMMARY_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: `You are the editor of ${paper}, a frontier newspaper in ${town || 'the Wild Imaginary West'} (a Wild West world of monsters, mechs and electric Forstall devices). From one night's Table Log of a tabletop game, write the front page in a lively 1880s newspaper voice: dramatic, a little florid, but clear. Only report what the log shows; do not invent events, deaths or names. Refer to the player characters by name. No emoji, no markdown. Reply with JSON only, exactly this shape: {"headline": "short, punchy, max 8 words", "subhead": "one line", "lead": "the main story, 2 short paragraphs separated by a blank line", "stories": [{"head": "short", "text": "2-4 sentences"}], "quote": "one memorable line someone might have said, attributed like — Name", "ads": ["two short period advertisements for goods or services in this world"]}. Give 2 or 3 stories.`,
        messages: [{ role: 'user', content: `The posse: ${cast}.\n\nTable Log, oldest first:\n${lines}` }],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}
// no AI key: a plain front page from the recap and the night's biggest moments
function plainFrontPage(entries, recap) {
  const moments = entries.filter((l) => !/ rolled /.test(l.text) && !NOISE.test(l.text)).map((l) => l.text);
  const first = (recap || moments[0] || 'The posse rode out again.').split(/(?<=[.!?])\s/)[0];
  return {
    headline: first.length < 60 ? first.replace(/[.!]$/, '') : 'Posse Rides Again',
    subhead: `${moments.length} happenings reported by our correspondent`,
    lead: recap || moments.slice(0, 4).join(' '),
    stories: moments.slice(-9).reduce((out, t, i) => { if (i % 3 === 0) out.push({ head: 'Also Reported', text: '' }); out[out.length - 1].text += `${t} `; return out; }, []).map((s) => ({ ...s, text: s.text.trim() })),
    quote: '', ads: ['Dr. Bramble’s Electric Tonic: cures what ails ya, or your money back (terms apply).'],
  };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshPapers();
    const combat = () => load('combat').then((c) => c || freshCombat());
    const withFaces = async (v) => {
      const c = await combat();
      return { ...v, posse: c.posse.map((p) => ({ id: p.id, name: p.name, trade: p.trade, portrait: p.portrait?.v || null })) };
    };
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, await withFaces(papersView(state, { warden: asWarden })));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    let c = null, result;
    if (body.action === 'draft') { // set the type for a session's front page
      if (!warden) throw new Error('Warden PIN required.');
      const [sess, wanted, map] = await Promise.all([load('session'), load('wanted'), load('map')]);
      const ss = sess || freshSession(), s = ss.sessions.find((x) => x.id === body.sessionId);
      if (!s) throw new Error('No such session.');
      c = await combat();
      const entries = sessionEntries(ss, s, c.archive).filter((l) => !l.hidden);
      if (!entries.length) throw new Error('Nothing has been logged this session yet.');
      const w = wanted || freshWanted(), towns = allTowns(w, map?.pins || []);
      const town = towns.find((t) => t.id === body.town);
      const paper = paperName(town?.name);
      const cast = c.posse.map((p) => `${p.name} (the ${p.trade})`).join('; ');
      const lines = entries.map((l) => l.text).join('\n').slice(-40000);
      let page = process.env.ANTHROPIC_API_KEY ? await aiFrontPage(lines, cast, paper, town?.name) : null;
      const ai = !!page;
      page ||= plainFrontPage(entries, s.recap);
      const text = [page.headline, page.lead, ...(page.stories || []).map((x) => x.text)].join(' ');
      const faces = c.posse.filter((p) => !p.dead && text.includes(p.name.split(/\s+/)[0])).slice(0, 2).map((p) => p.id);
      const classifieds = w.posters.filter((p) => p.town === body.town && p.status === 'wanted' && !p.hidden).slice(0, 4).map((p) => ({ name: p.name, reward: p.reward, crime: p.crime }));
      const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      result = papersAction(state, { action: 'save', sessionId: s.id, town: town?.id || '', townName: town?.name || '', paper, date, ...page, faces, classifieds }, { warden });
      result = { ...result, ai };
    } else {
      let logged = false;
      const combatDoc = body.action === 'publish' ? await combat() : null;
      const log = (text) => { if (combatDoc) { addLog(combatDoc, { type: 'event', text }); logged = true; } };
      result = papersAction(state, body, { warden, log });
      if (logged) { combatDoc.v = (combatDoc.v || 0) + 1; await save(combatDoc, 'combat'); }
    }
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result, state: await withFaces(papersView(state, { warden })) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
