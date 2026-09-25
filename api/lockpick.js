import { load, save } from '../lib/store.js';
import { pinOk, send, readBody } from '../lib/http.js';
import { freshLocks, lockAction, lockView } from '../lib/lockpick.js';
import { freshCombat, addLog, publicAction } from '../lib/combat.js';
import { equipItem } from '../lib/sheets.js';
import { findItem, freshShop } from '../lib/shop.js';
import { rollPool, parsePool, poolLabel } from '../lib/dice.js';

const KEY = 'locks';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshLocks();
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      const v = `${state.v}`;
      if (url.searchParams.get('since') === v) return send(res, 200, { v, unchanged: true });
      return send(res, 200, lockView(state, { warden: asWarden, pc: String(url.searchParams.get('pc') || '') }));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || freshCombat();
    const names = Object.fromEntries(combat.posse.filter((p) => !p.dead).map((p) => [p.id, p.name]));
    let logged = false;
    const log = (text, secret) => { if (!text && !secret) return; addLog(combat, text ? { type: 'event', text } : { type: 'event', text: secret, hidden: true }); logged = true; };
    // Finesse from the sheet: Poisoned rolls 2 fewer dice; the Finesse Talent rerolls Spurs (pp. 12, 48)
    const rollFinesse = (pid) => {
      const pc = combat.posse.find((p) => p.id === pid);
      const p = parsePool(pc?.skills?.finesse || '1B');
      // Locksmith (Trapper, 2/day): +2B to Finesse rolls made to pick locks
      const smith = (pc?.abilities || []).includes('Locksmith') && (pc.abilityUses?.Locksmith || 0) < 2;
      if (smith) { p.black += 2; pc.abilityUses = { ...(pc.abilityUses || {}), Locksmith: (pc.abilityUses?.Locksmith || 0) + 1 }; }
      let n = p.black + p.gold;
      if (pc?.statuses?.Poisoned) n = Math.max(0, n - 2);
      const g = Math.min(p.gold, n), b = n - g, spur = (pc?.talents || []).includes('Finesse');
      const r = n ? rollPool(b, g, spur) : { dice: [], hits: 0, aces: 0 };
      addLog(combat, { type: 'roll', who: pc?.name || '?', label: `Finesse · lock pick (peeks)${smith ? ' + Locksmith' : ''}`, pool: poolLabel({ black: b, gold: g }), spur, dice: r.dice, hits: r.hits, aces: r.aces });
      logged = true;
      return { ...r, pool: poolLabel({ black: b, gold: g }) };
    };
    // the lock opened: spring its trap and hand over what's inside (Money/Scrap to the sheet, items to the inventory)
    const shop = body.action === 'guess' ? (await load('shop')) || freshShop() : null;
    const onOpen = (a, what) => {
      const pc = combat.posse.find((p) => p.id === a.pc);
      if (!pc) return;
      if (what === 'trap') {
        if (a.trap.damage) publicAction(combat, { action: 'pc', id: pc.id, op: 'health', delta: -a.trap.damage }, { warden: true });
        if (a.trap.status) publicAction(combat, { action: 'pc', id: pc.id, op: 'status', status: a.trap.status, value: Math.min(6, (pc.statuses?.[a.trap.status] || 0) + a.trap.sev) }, { warden: true });
        return;
      }
      const l = a.loot, money = (v) => Number(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
      if (l.kind === 'money') pc.wallet = (money(pc.wallet) + l.amount).toFixed(2);
      else if (l.kind === 'scrap') pc.scrap = String(money(pc.scrap) + l.amount);
      else {
        const it = l.kind === 'item' ? findItem(shop, l.itemId) : null;
        if (it) l.name = it.name;
        pc.items ||= [];
        pc.items.push({ uid: Math.random().toString(36).slice(2, 10), itemId: it?.id || `found-${a.id}`, name: it?.name || l.name, cat: it?.cat || 'Goods & Services', sub: it?.sub || 'Found', qty: 1, ...(l.desc ? { note: l.desc } : {}) });
        if (it) equipItem(pc, it, 1);
      }
      pc.updated = Date.now();
      logged = true;
    };
    // a retry that costs a lockpick takes one out of their inventory
    if (body.action === 'retry') {
      const a = state.list.find((l) => l.id === body.id), pc = a && combat.posse.find((p) => p.id === a.pc);
      if (pc && /lock ?picks?/i.test(a.retryCost || '') && a.status === 'failed' && a.retriesLeft > 0) {
        const pick = (pc.items || []).find((i) => /lock ?pick/i.test(i.name) && (Number(i.qty) || 0) > 0);
        if (!pick) throw new Error('You’re out of lockpicks — buy more at the Store.');
        pick.qty = (Number(pick.qty) || 1) - 1;
        if (!pick.qty) pc.items = pc.items.filter((i) => i !== pick);
        pc.updated = Date.now(); logged = true;
      }
    }
    const result = lockAction(state, body, { warden, names, rollFinesse, log, onOpen }) ?? null;
    state.v = (state.v || 0) + 1;
    await save(state, KEY);
    if (logged) { combat.v = (combat.v || 0) + 1; await save(combat, 'combat'); }
    return send(res, 200, { result, state: lockView(state, { warden, pc: String(body.pc || '') }) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
