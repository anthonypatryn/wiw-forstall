import { load, save, storeKind } from '../store.js';
import { pinOk, send, readBody, sinceParam } from '../http.js';
import { freshState, playerView, wardenView, doRoll, doGuess, doNote, wardenAction } from '../game.js';
import { freshCombat, addLog } from '../combat.js';
import { poolLabel } from '../dice.js';
import { fields, inRange, hexDist } from '../forstall.js';

// Scanner rolls and breakthroughs also go in the shared Table Log (combat document).
async function tableLog(entry) {
  try {
    const c = (await load('combat')) || freshCombat();
    addLog(c, entry);
    c.v = (c.v || 0) + 1;
    await save(c, 'combat');
  } catch { /* the scan itself already succeeded */ }
}

const SCAN_GRIT = 3;

// p. 83: the monster has to be within the Forstall's Range. Only checked when both are on the Battle Map in a fight.
async function scanRange(state, body) {
  if (!state.active || !body.whoId) return;
  const [combat, battle] = await Promise.all([load('combat'), load('battle')]);
  if (!combat?.combat?.active) return;
  const f = fields(battle || { tokens: [] }, combat).find((x) => x.key === `pc:${body.whoId}` && x.pos);
  const foes = (combat.enemies || []).filter((e) => e.profile === state.active && !e.defeated)
    .map((e) => (battle?.tokens || []).find((t) => t.kind === 'enemy' && t.ref === e.id)).filter(Boolean);
  // p. 83: Scanning costs 3 Grit — only counted in a fight, like every other Action
  const scanner = (combat.posse || []).find((p) => p.id === body.whoId);
  if (scanner) {
    if (scanner.statuses?.Unconscious) throw new Error(`${scanner.name} is Unconscious — they can only try to relieve it.`);
    if ((scanner.grit || 0) < SCAN_GRIT) throw new Error(`Scanning costs ${SCAN_GRIT} Grit — ${scanner.name} has ${scanner.grit || 0}.`);
  }
  if (combat.emp?.keys?.includes(`pc:${body.whoId}`)) throw new Error('Your Forstall is scrambled by a Natural EMP — no Scanning until the monster’s next turn.');
  // p. 84: one operator per Forstall — only one character can Scan each round
  const sr = combat.scanRound;
  if (sr && sr.round === combat.combat.round && sr.by !== body.whoId) throw new Error(`${sr.name} already Scanned this round — only one character can Scan per round.`);
  if (f && foes.length && !foes.some((t) => inRange(f, t))) {
    const d = Math.min(...foes.map((t) => hexDist(f.pos, t)));
    throw new Error(`The ${state.active} is ${d}″ away — out of ${f.name}’s ${f.range} Range (${f.rangeIn}″). Get closer to Scan it.`);
  }
  // mark this round's Scan only once the roll actually happens
  return async () => {
    const c = (await load('combat')) || combat;
    const p = c.posse.find((x) => x.id === body.whoId);
    if (p) p.grit = Math.max(0, (p.grit || 0) - SCAN_GRIT);
    c.scanRound = { round: c.combat.round, by: body.whoId, name: p?.name || 'Someone' };
    c.v = (c.v || 0) + 1;
    await save(c, 'combat');
  };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    let state = (await load()) || freshState();

    if (req.method === 'GET') {
      const since = sinceParam(url);
      if (url.searchParams.get('view') === 'warden') {
        if (!warden) return send(res, 401, { error: 'Wrong PIN.' });
        if (since === state.v) return send(res, 200, { v: state.v, unchanged: true });
        return send(res, 200, { ...wardenView(state), store: storeKind });
      }
      if (since === state.v) return send(res, 200, { v: state.v, unchanged: true });
      return send(res, 200, playerView(state));
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    let result = null;

    switch (body.action) {
      case 'auth':
        return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
      case 'roll': { const mark = await scanRange(state, body); result = doRoll(state, body); await mark?.(); break; }
      case 'guess': result = doGuess(state, body); break;
      case 'note': doNote(state, body); break;
      default:
        if (!warden) return send(res, 401, { error: 'Warden PIN required.' });
        wardenAction(state, body);
    }

    state.v = (state.v || 0) + 1;
    await save(state);
    if (body.action === 'roll') {
      const who = String(body.who || '').replace(/[<>]/g, '').trim().slice(0, 40);
      await tableLog({ type: 'roll', who: who || 'Forstall Scan', label: `${who ? 'Forstall Scan · ' : ''}Intuition — scanning the ${state.active}${result.halved ? ' (half pool)' : ''}`,
        pool: poolLabel(result.pool), spur: result.spurTalent, dice: result.dice, hits: result.hits, aces: result.dice.filter((d) => d.face === 'ace').length });
    } else if (body.action === 'guess' && result.solved) {
      await tableLog({ type: 'event', text: `The posse decoded the ${state.active}’s Kurtz Frequency!` });
    }
    return send(res, 200, { result, state: warden ? wardenView(state) : playerView(state) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
