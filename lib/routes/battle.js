import crypto from 'node:crypto';
import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshBattle, battleAction, battleView, hexDist, clampHex, autoSync, roughOnPath, hexLine } from '../battle.js';
import { chargeMove, undoMove, pushUndo, checkHoldTriggers, sweepHit, addLog, freshCombat, joinLate } from '../combat.js';
import { fields, inRange, slotMonster, gapBetween } from '../forstall.js';
import { searchBody, trapOnPath } from '../props.js';
import { freshLocks, lockAction, lootText } from '../lockpick.js';
import { giveLoot, springTrap } from '../give.js';
import { freshShop } from '../shop.js';
import { journalAction } from '../journal.js';
import { rollPool, parsePool, poolLabel } from '../dice.js';
import { hasSpur } from '../sheets.js';

const KEY = 'battle';
const IMG_KEY = 'battle-img';
const MAX_IMG = 3_000_000; // base64 chars (~2.2 MB image) — the page shrinks uploads well below this
const MAX_THUMB = 300_000;
// each saved map's picture has its own key (and a small thumbnail); 'battle-img' is the old single upload slot
const imgKey = (id) => (/^[a-z0-9]{1,12}$/.test(id || '') ? `${IMG_KEY}-${id}` : IMG_KEY);
const IMG_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

// width and height from a JPEG's frame header or a PNG's IHDR (the upload page makes JPEGs)
function imageSize(b) {
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const mk = b[i + 1], len = b.readUInt16BE(i + 2);
    if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);

    // Uploaded background image, versioned by ?v= so it can be cached forever.
    if (req.method === 'GET' && url.searchParams.get('view') === 'img') {
      const key = imgKey(url.searchParams.get('id'));
      const img = (url.searchParams.get('thumb') && key !== IMG_KEY && await load(`${key}-t`)) || await load(key);
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
      const m = IMG_RE.exec(String(body.data || ''));
      if (!m) throw new Error('That doesn’t look like an image.');
      if (m[2].length > MAX_IMG) throw new Error('Image is too large — try a smaller one.');
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8), t = IMG_RE.exec(String(body.thumb || ''));
      await save({ type: m[1], data: m[2] }, imgKey(id));
      if (t && t[2].length <= MAX_THUMB) await save({ type: t[1], data: t[2] }, `${imgKey(id)}-t`);
      body.action = 'uploaded'; body.mapId = id; body.thumb = !!(t && t[2].length <= MAX_THUMB); delete body.data;
    }
    if (body.action === 'keepUpload') { // copy the old single upload into My maps
      if (!warden) return send(res, 401, { error: 'Warden PIN required.' });
      const img = await load(IMG_KEY);
      if (!img?.data) throw new Error('There’s no uploaded map to keep.');
      const size = imageSize(Buffer.from(img.data, 'base64'));
      if (!size) throw new Error('Couldn’t read that map’s size.');
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      await save(img, imgKey(id));
      Object.assign(body, { mapId: id, w: size.w, h: size.h });
    }

    // using something on the map (a chest, a body, a note): the player's own token within Arm's Reach (1″)
    if (body.action === 'useProp') {
      const p = (state.props || []).find((x) => x.id === String(body.id || ''));
      if (!p || (!warden && p.hidden)) throw new Error('That isn’t on the map any more.');
      const cb = combat || freshCombat(), pc = cb.posse.find((x) => x.id === String(body.pc || ''));
      if (!pc) throw new Error('Tap “This is me” on your character sheet first.');
      const tok = state.tokens.find((t) => t.kind === 'pc' && t.ref === pc.id);
      if (!warden && (!tok || gapBetween(tok, p) > 1)) throw new Error(`Get within Arm’s Reach (1″) of ${p.name.toLowerCase()} first.`);
      let out;
      if (p.kind === 'door' && (p.open || !p.locked || p.unlocked)) {
        p.open = !p.open;
        addLog(cb, { type: 'event', text: `${pc.name} ${p.open ? 'opens' : 'shuts'} ${p.name.toLowerCase()}.` });
        out = { kind: 'door', open: p.open };
      } else if (p.kind === 'chest' || p.kind === 'door') {
        if (p.opened) throw new Error(`${p.name} is already open. Nothing left inside.`);
        const locks = (await load('locks')) || freshLocks();
        const cur = p.picking && locks.list.find((l) => l.id === p.picking.lockId);
        const working = cur && !cur.closed && ['finesse', 'ace', 'playing', 'failed'].includes(cur.status) && !(cur.status === 'failed' && !cur.retriesLeft);
        if (working && cur.pc !== pc.id) throw new Error(`${cb.posse.find((x) => x.id === cur.pc)?.name || 'Someone'} is already working on that lock.`);
        if (working) out = { kind: 'chest', lockId: cur.id, again: true };
        else if (locks.list.some((l) => l.prop === p.id && l.pc === pc.id && l.status !== 'picked' && (l.at || 0) > (p.resetAt || 0))) throw new Error(`${pc.name} couldn’t get ${p.name.toLowerCase()} open. Someone else can try.`); // one go each (with its retries)
        else {
          const names = { [pc.id]: pc.name };
          const r = lockAction(locks, { action: 'start', to: [pc.id], difficulty: p.difficulty, retries: p.retries, retryCost: p.retryCost, what: p.name, loot: p.loot, trap: p.trap, prop: p.id }, { warden: true, names, log: () => {} });
          p.picking = { pc: pc.id, lockId: r.ids[0] };
          locks.v = (locks.v || 0) + 1;
          await save(locks, 'locks');
          addLog(cb, { type: 'event', text: `${pc.name} starts working the lock on ${p.name.toLowerCase()}.` });
          out = { kind: 'chest', lockId: r.ids[0] };
        }
      } else if (p.kind === 'body') {
        if ((p.searchedBy || []).includes(pc.id)) throw new Error('You’ve already searched this one.');
        const sp = parsePool(pc.skills?.intuition || '1B');
        let n = sp.black + sp.gold;
        if (pc.statuses?.Poisoned) n = Math.max(0, n - 2);
        const g = Math.min(sp.gold, n), b = n - g, spur = hasSpur(pc, 'Intuition');
        const r = n ? rollPool(b, g, spur) : { dice: [], hits: 0, aces: 0 };
        addLog(cb, { type: 'roll', who: pc.name, label: `Searches ${p.name.toLowerCase()} · Intuition`, pool: poolLabel({ black: b, gold: g }), spur, dice: r.dice, hits: r.hits, aces: r.aces });
        const roll = cb.log[0];
        const found = searchBody(p, pc.id, r.hits);
        const shop = found.some((f) => f.kind === 'item') ? (await load('shop')) || freshShop() : null;
        found.forEach((f) => giveLoot(pc, f, shop, p.id));
        addLog(cb, { type: 'event', text: found.length ? `${pc.name} finds ${found.map(lootText).join(', ')} on ${p.name.toLowerCase()}.` : `${pc.name} finds nothing on ${p.name.toLowerCase()}.` });
        out = { kind: 'body', ...roll, found: found.map(lootText) };
      } else if (p.kind === 'clue') {
        p.readBy = [...new Set([...(p.readBy || []), pc.id])];
        if (p.clueId) { // reveal the linked Journal clue to the posse
          const j = await load('journal');
          if (j) { try { journalAction(j, { action: 'reveal', kind: 'clue', id: p.clueId, value: true }, { warden: true }); j.v = (j.v || 0) + 1; await save(j, 'journal'); } catch { /* the clue was deleted */ } }
        }
        addLog(cb, { type: 'event', text: `${pc.name} finds ${p.name.toLowerCase()}.` });
        out = { kind: 'clue', name: p.name, text: p.text || '', clue: !!p.clueId };
      } else throw new Error('Nothing to do with that one.');
      state.v = (state.v || 0) + 1;
      cb.v = (cb.v || 0) + 1;
      await Promise.all([save(state, KEY), save(cb, 'combat')]);
      return send(res, 200, { result: out, state: view() });
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
    // a character walking over (or onto) a hidden trap sets it off
    let sprung = null;
    if (moving?.kind === 'pc' && moving.ref && combat && movedFrom) {
      const trap = trapOnPath(state, hexLine(movedFrom, moving));
      const pc = trap && combat.posse.find((p) => p.id === moving.ref);
      if (pc) {
        trap.sprung = pc.name;
        springTrap(combat, pc, trap.trap);
        const hurt = [trap.trap?.damage ? `−${trap.trap.damage} Health` : '', trap.trap?.status ? `${trap.trap.status} [${trap.trap.sev}]` : ''].filter(Boolean).join(', ');
        addLog(combat, { type: 'event', text: `${pc.name} sets off ${trap.name.toLowerCase()}!${hurt ? ` ${hurt}.` : ''}` });
        sprung = { name: trap.name, hurt };
        combatDirty = true;
      }
    }
    // the Warden reveals a hidden enemy that was sitting the fight out: it joins, at the bottom of the turn order
    let joined = null;
    if (body.action === 'tokenEdit' && body.hidden === false && warden && combat?.combat?.active) {
      const t = state.tokens.find((x) => x.id === body.id);
      const e = t?.kind === 'enemy' && t.ref ? (combat.enemies || []).find((x) => x.id === t.ref) : null;
      if (e && e.out && !e.defeated) {
        joinLate(combat, e);
        addLog(combat, { type: 'event', text: `${e.name} joins the fight!` });
        joined = e.name; combatDirty = true;
      }
    }
    if (body.action === 'removeMap' && result) { await save(null, imgKey(result.id)); await save(null, `${imgKey(result.id)}-t`); }
    // an enemy just moved: does that set off anyone's prepared Action? (p. 42)
    if (body.action === 'move' && combat?.combat?.active) {
      const t = state.tokens.find((x) => x.id === body.id);
      if (t?.kind === 'enemy' && t.ref && (combat.posse || []).some((p) => p.hold)) {
        const distTo = {};
        state.tokens.filter((x) => x.kind === 'pc' && x.ref).forEach((x) => { distTo[x.ref] = gapBetween(t, x); }); // edge to edge
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
    return send(res, 200, { result: joined ? { joined } : sprung ? { ...(moveResult || {}), sprung } : moveResult || result, state: view() });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
