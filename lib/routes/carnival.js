import crypto from 'node:crypto';
import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshCarnival, carnivalAction, carnivalView } from '../carnival.js';
import { freshCombat, addLog } from '../combat.js';
import { rollPool, poolLabel } from '../dice.js';
import { hasSpur } from '../sheets.js';
import { money } from '../util.js';
import { poolFor } from './saloon.js';

const KEY = 'carnival';
const withWallet = (v, combat, pc) => { const c = pc && combat?.posse.find((p) => p.id === pc); if (v.me && c) v.me.wallet = money(c.wallet); return v; };

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshCarnival();
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      const pc = String(url.searchParams.get('pc') || '');
      const combat = pc ? (await load('combat')) || freshCombat() : null;
      return send(res, 200, withWallet(carnivalView(state, { pc, warden: asWarden }), combat, pc));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || freshCombat();
    const rolls = [];
    const Cap = (s) => s[0].toUpperCase() + s.slice(1);
    const ctx = {
      warden,
      pc: (id) => combat.posse.find((p) => p.id === id),
      pay: (pc, amount) => { pc.wallet = (money(pc.wallet) + amount).toFixed(2); pc.updated = Date.now(); },
      log: (text) => addLog(combat, { type: 'event', text }),
      // every carnival roll is public, in the Table Log: a character's sheet Skill (Poisoned −2, Talent Spurs) or a plain pool
      roll: (pc, what, label, spurSkill = null, who = null) => {
        const pool = typeof what === 'string' ? poolFor(pc, what) : what;
        const spur = !!pc && hasSpur(pc, spurSkill || (typeof what === 'string' ? Cap(what) : ''));
        const r = rollPool(pool.black, pool.gold, spur);
        const name = pc?.name || who || 'A carnie';
        addLog(combat, { type: 'roll', who: name, label: `Carnival · ${label}`, pool: poolLabel(pool), spur, dice: r.dice, hits: r.hits, aces: r.aces });
        rolls.push({ who: name, label, pool: poolLabel(pool), dice: r.dice, hits: r.hits });
        return r;
      },
      // a prize goes in the Inventory like a Found item (not from the Store)
      give: (pc, name, note) => {
        (pc.items ||= []).push({ uid: crypto.randomUUID().slice(0, 8), itemId: `carnival-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, cat: 'Goods & Services', sub: 'Carnival prize', qty: 1, note });
        pc.updated = Date.now();
      },
    };
    const result = carnivalAction(state, body, ctx) ?? null;
    state.v = (state.v || 0) + 1;
    combat.v = (combat.v || 0) + 1;
    await Promise.all([save(state, KEY), save(combat, 'combat')]);
    return send(res, 200, { result, rolls, state: withWallet(carnivalView(state, { pc: String(body.pc || ''), warden }), combat, String(body.pc || '')) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
