import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshBattle, battleAction, battleView, hexDist, clampHex, autoSync, roughOnPath } from '../battle.js';
import { chargeMove, undoMove, pushUndo, checkHoldTriggers, sweepHit } from '../combat.js';
import { fields, inRange, slotMonster } from '../forstall.js';

const KEY = 'battle';
const IMG_KEY = 'battle-img';
const MAX_IMG = 3_000_000; // base64 chars (~2.2 MB image) — the page shrinks uploads well below this

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);

    // Uploaded background image, versioned by ?v= so it can be cached forever.
    if (req.method === 'GET' && url.searchParams.get('view') === 'img') {
      const img = await load(IMG_KEY);
      if (!img?.data) { res.statusCode = 404; return res.end('No image'); }
      res.statusCode = 200;
      res.setHeader('Content-Type', img.type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(Buffer.from(img.data, 'base64'));
    }

    const [stored, combat] = await Promise.all([load(KEY), load('combat')]);
    const state = stored || freshBattle();
    const view = () => battleView(state, { warden, combat });
    if (autoSync(state, combat)) { state.v = (state.v || 0) + 1; await save(state, KEY); }

    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'warden' && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      const v = view();
      if (url.searchParams.get('since') === v.v) return send(res, 200, { v: v.v, unchanged: true });
      return send(res, 200, v);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });

    if (body.action === 'upload') {
      if (!warden) return send(res, 401, { error: 'Warden PIN required.' });
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
      if (!m) throw new Error('That doesn’t look like an image.');
      if (m[2].length > MAX_IMG) throw new Error('Image is too large — try a smaller one.');
      await save({ type: m[1], data: m[2] }, IMG_KEY);
      body.action = 'uploaded';
    }

    // a player programming a placed Forstall: only frequencies the posse has fully decoded on the Scanner (p. 83)
    if (body.action === 'programForstall' && !warden && String(body.value || '').trim()) {
      const sc = (await load()) || { notebook: {}, custom: [] }; // the Scanner's notebook (the default document)
      const m = slotMonster(String(body.value), sc.custom || []);
      if (!m || !sc.notebook?.[m]?.solved) throw new Error('Only frequencies the posse has fully decoded on the Forstall Scanner can go in a memory slot.');
    }
    // Moving in combat spends the mover's Grit (p. 41), which lives in the combat document.
    let combatDirty = false, moveResult = null;
    const moving = body.action === 'move' ? state.tokens.find((x) => x.id === body.id) : null;
    const movedFrom = moving ? { col: moving.col, row: moving.row } : null;
    if (body.action === 'move' && combat?.combat?.active) {
      const t = state.tokens.find((x) => x.id === body.id);
      if (t && t.ref && (t.kind === 'pc' || t.kind === 'enemy')) {
        const from = { col: t.col, row: t.row }, to = clampHex(state, body.col, body.row);
        pushUndo(combat, `${t.name}: move ${hexDist(from, to)}″`, { token: { id: t.id, col: from.col, row: from.row } });
        moveResult = chargeMove(combat, { kind: t.kind, ref: t.ref, inches: hexDist(from, to), rough: !!body.rough || roughOnPath(state, from, to), warden, tokenId: t.id, from, to });
        if (moveResult.cost > 0) combatDirty = true; else combat.undoStack.pop(); // free Warden repositioning isn't an action
      }
    }
    if (body.action === 'undoMove') {
      if (!combat) throw new Error('Nothing to undo.');
      const lm = undoMove(combat, String(body.ref || ''));
      const t = state.tokens.find((x) => x.id === lm.tokenId);
      if (t) { t.col = lm.from.col; t.row = lm.from.row; }
      combatDirty = true;
      body.action = 'noop';
    }
    const result = body.action === 'noop' ? null : (battleAction(state, body, { warden, combat }) ?? null);
    // an enemy just moved: does that set off anyone's prepared Action? (p. 42)
    if (body.action === 'move' && combat?.combat?.active) {
      const t = state.tokens.find((x) => x.id === body.id);
      if (t?.kind === 'enemy' && t.ref && (combat.posse || []).some((p) => p.hold)) {
        const distTo = {};
        state.tokens.filter((x) => x.kind === 'pc' && x.ref).forEach((x) => { distTo[x.ref] = hexDist(t, x); });
        const before = JSON.stringify(combat.posse.map((p) => p.hold?.triggeredBy || null));
        checkHoldTriggers(combat, { type: 'enemyMoved', enemy: t.ref, name: t.name, distTo });
        if (JSON.stringify(combat.posse.map((p) => p.hold?.triggeredBy || null)) !== before) combatDirty = true;
      }
    }
    // a monster walking into a Sweeping Forstall's Range loses Grit and cries out (p. 82)
    if (moving?.kind === 'enemy' && moving.ref && combat) {
      const entered = fields(state, combat).filter((f) => f.sweep && !inRange(f, movedFrom) && inRange(f, moving));
      if (entered.length && sweepHit(combat, entered, state.tokens, moving.ref, 'enter')) combatDirty = true;
    }
    if (combatDirty) { combat.v = (combat.v || 0) + 1; await save(combat, 'combat'); }
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    return send(res, 200, { result: moveResult || result, state: view() });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
