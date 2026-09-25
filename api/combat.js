import { load, save, storeKind } from '../lib/store.js';
import { pinOk, send, readBody, sinceParam } from '../lib/http.js';
import { freshCombat, publicAction, playerCombatView, wardenCombatView, logView, META, autoAchievements, isUndoable, pushUndo, undoLabel, undoCombat, applyMapRange, sweepHit } from '../lib/combat.js';
import { fields } from '../lib/forstall.js';

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
    if (body.action === 'undo') { // step back one action, or restart the whole turn (token moves go back too)
      const r = undoCombat(state, { warden, mode: body.mode === 'turn' ? 'turn' : 'last' });
      if (r.tokens.length) {
        const battle = await load('battle');
        if (battle) {
          r.tokens.forEach((t) => { const tok = battle.tokens.find((x) => x.id === t.id); if (tok) { tok.col = t.col; tok.row = t.row; } });
          battle.v = (battle.v || 0) + 1;
          await save(battle, 'battle');
        }
      }
      state.v = (state.v || 0) + 1;
      await save(state, KEY);
      return send(res, 200, { result: r, state: view() });
    }
    // the battle map matters in a fight (range, Forstalls) and for any Forstall action
    const battle = state.combat?.active || body.action === 'forstall' || body.action === 'start' ? await load('battle') : null;
    const ctx = () => ({ list: fields(battle, state), tokens: battle?.tokens || [], cave: !!battle?.cave });
    // attacks use the real distance when both tokens are on the battle map
    if (state.combat?.active && ((body.action === 'pc' && (body.op === 'attack' || body.op === 'fireHold')) || body.action === 'enemyAttack')) {
      applyMapRange(state, battle?.tokens, body, warden);
    }
    const undoable = isUndoable(state, body);
    if (undoable) pushUndo(state);
    const turnBefore = state.combat?.active ? state.combat.current : null;
    const result = publicAction(state, body, { warden, ctx: ctx() }) ?? null;
    // a monster starting its turn inside a Sweeping Forstall's Range loses Grit (p. 82)
    if (battle && state.combat?.active && state.combat.current && state.combat.current !== turnBefore) {
      sweepHit(state, ctx().list, battle.tokens, state.combat.current, 'start');
    }
    if (undoable) state.undoStack[state.undoStack.length - 1].label = undoLabel(state, body);
    autoAchievements(state);
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result: warden || !result?.hidden ? result : null, state: view() });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
