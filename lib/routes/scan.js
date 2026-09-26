import { load, save, storeKind } from '../store.js';
import { pinOk, send, readBody, sinceParam } from '../http.js';
import { freshState, playerView, wardenView, doRoll, doGuess, doNote, wardenAction } from '../game.js';
import { freshCombat, addLog, claimOperator } from '../combat.js';
import { poolLabel, parsePool } from '../dice.js';
import { hasSpur } from '../sheets.js';
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

// ---------- Scanning in a fight (from the Battle Map) ----------
// p. 83: Step 1 — spend 3 Grit, roll Intuition, one digit per Hit; Step 2 — one guess, answered with green/yellow/red.
// p. 84: the monster must be alive and in the Forstall's Range; one Scanner per round; nobody can Help.
// p. 84 Warden's tip: with digit positions shown (the Scanner's "Warden's aid" house rule) a Scan costs 5 Grit.
export const scanCost = (state) => (state.settings?.easyMode ? 5 : 3);
const intuitionPool = (pc) => { // the sheet's Intuition, Poisoned = 2 fewer dice (Gold kept)
  const p = parsePool(pc?.skills?.intuition || '1B');
  let n = p.black + p.gold;
  if (pc?.statuses?.Poisoned) n = Math.max(0, n - 2);
  const gold = Math.min(p.gold, n);
  return { black: n - gold, gold };
};
async function inFight() { const c = await load('combat'); return c?.combat?.active ? c : null; }

async function combatScan(state, body) {
  const [combat, battle] = await Promise.all([load('combat'), load('battle')]);
  const c = combat?.combat;
  if (!c?.active) throw new Error('No fight running. Scan from the Forstall Scanner page.');
  const pc = combat.posse.find((p) => p.id === String(body.pc || ''));
  if (!pc) throw new Error('Pick who’s Scanning.');
  if (c.current !== pc.id) throw new Error(`Scan on ${pc.name}’s own turn.`);
  if (pc.dead || pc.bleeding || pc.statuses?.Unconscious) throw new Error(`${pc.name} can’t work a Forstall right now.`);
  const key = String(body.key || `pc:${pc.id}`);
  const f = fields(battle || { tokens: [] }, combat).find((x) => x.key === key);
  if (!f) throw new Error('No Forstall there.');
  if (!operates(f, pc, battle)) throw new Error(f.owner ? 'That’s someone else’s Forstall.' : `Get within Arm’s Reach (1″) of the ${f.name} to work it.`);
  if (!f.pos) throw new Error('Put the Forstall on the map first.');
  if (!f.owner) claimOperator(combat, f, pc); // one operator per placed Forstall per round
  if (combat.emp?.keys?.includes(key)) throw new Error('Scrambled by a Natural EMP. No Scanning until the monster’s next turn.');
  const name = String(body.monster || '');
  const foes = (combat.enemies || []).filter((e) => e.profile === name && !e.defeated)
    .map((e) => (battle?.tokens || []).find((t) => t.kind === 'enemy' && t.ref === e.id)).filter(Boolean);
  if (!foes.length) throw new Error('That monster isn’t on the board.');
  if (!foes.some((t) => inRange(f, t))) {
    const d = Math.min(...foes.map((t) => hexDist(f.pos, t)));
    throw new Error(`The ${name} is ${d}″ away, out of the ${f.name}’s ${f.range} Range (${f.rangeIn}″).`);
  }
  const sr = combat.scanRound;
  if (sr && sr.round === c.round && sr.by !== pc.id) throw new Error(`${sr.name} already Scanned this round. Only one character can Scan per round.`);
  if (state.pending?.pc === pc.id) throw new Error('Make your guess from the last Scan first.');
  const cost = scanCost(state);
  if ((pc.grit || 0) < cost) throw new Error(`Scanning costs ${cost} Grit. ${pc.name} has ${pc.grit || 0}.`);
  state.active = name; // the Scanner follows whatever the posse Scans in a fight
  const pool = intuitionPool(pc);
  const spur = hasSpur(pc, 'Intuition');
  const r = doRoll(state, { black: pool.black, gold: pool.gold, spurTalent: spur });
  pc.grit -= cost;
  (pc.turnLog ||= []).push({ id: crypto.randomUUID().slice(0, 8), text: `scanned the ${name}`, grit: cost });
  combat.scanRound = { round: c.round, by: pc.id, name: pc.name };
  // the digits can't be un-learned: Restart turn / Undo can't reach back past a Scan
  const tk = `${c.round}:${c.current}`;
  combat.undoStack = (combat.undoStack || []).filter((e) => e.turnKey !== tk);
  addLog(combat, { type: 'roll', who: pc.name, label: `Forstall Scan · Intuition — scanning the ${name}${r.halved ? ' (half pool)' : ''}`, pool: poolLabel(r.pool), spur, dice: r.dice, hits: r.hits, aces: r.dice.filter((d) => d.face === 'ace').length });
  combat.v = (combat.v || 0) + 1;
  await save(combat, 'combat');
  state.pending = { pc: pc.id, name, forstall: f.name, at: Date.now() };
  return { ...r, name, cost, who: pc.name, pool: poolLabel(r.pool), label: `Scanning the ${name}` };
}

async function combatGuess(state, body) {
  const p = state.pending;
  if (!p || p.pc !== String(body.pc || '')) throw new Error('Scan first. Each Scan earns one guess.');
  state.active = p.name;
  const r = doGuess(state, body);
  state.pending = null;
  const n = (k) => r.result.filter((x) => x === k).length;
  await tableLog({ type: 'event', text: r.solved ? `The posse decoded the ${p.name}’s Kurtz Frequency!` : `Forstall guess on the ${p.name}: ${n('green')} green, ${n('yellow')} yellow, ${n('red')} red.` });
  return { ...r, name: p.name };
}

// who may work a Forstall: your own (it's on your sheet); a placed one when you're within Arm's Reach (Chunk B)
function operates(f, pc, battle) {
  if (f.owner) return f.owner === pc.id;
  const t = (battle?.tokens || []).find((x) => x.kind === 'pc' && x.ref === pc.id);
  return !!(t && f.pos && hexDist(f.pos, t) <= 1);
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
      case 'roll': // in a fight, players Scan from the Battle Map (Grit, turn and Range are checked there)
        if (!warden && await inFight()) throw new Error('A fight is on. Scan from the Battle Map on your turn: the Forstall tile.');
        result = doRoll(state, body); break;
      case 'guess':
        if (!warden && await inFight()) throw new Error('A fight is on. Each Scan on the Battle Map earns one guess.');
        result = doGuess(state, body); break;
      case 'combatScan': result = await combatScan(state, body); break;
      case 'combatGuess': result = await combatGuess(state, body); break;
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
