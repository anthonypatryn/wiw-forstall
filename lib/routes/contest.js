// Contests (lib/contests.js): the horse race and the trick-shot contest. Wallets live on the sheets (combat doc),
// so every action saves both docs; wallet changes are booked to Journal → Records.
import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshContest, contestAction, contestView } from '../contests.js';
import { freshCombat, addLog, profileFor } from '../combat.js';
import { rollPool, rollDie, parsePool, poolLabel, HIT_VALUE } from '../dice.js';
import { money } from '../util.js';
import { snapWallets, tally } from '../records.js';

const KEY = 'contest';
const withWallet = (v, combat, pc) => { const c = pc && combat?.posse.find((p) => p.id === pc); if (c) v.wallet = money(c.wallet); return v; };

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    const state = (await load(KEY)) || freshContest();
    if (req.method === 'GET') {
      const asWarden = url.searchParams.get('view') === 'warden';
      if (asWarden && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      if (url.searchParams.get('since') === `${state.v}`) return send(res, 200, { v: state.v, unchanged: true });
      const pc = String(url.searchParams.get('pc') || '');
      const combat = pc ? (await load('combat')) || freshCombat() : null;
      return send(res, 200, withWallet(contestView(state, { pc, warden: asWarden }), combat, pc));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const combat = (await load('combat')) || freshCombat();
    const ctx = {
      warden,
      pc: (id) => combat.posse.find((p) => p.id === id),
      pay: (pc, amount) => { pc.wallet = (money(pc.wallet) + amount).toFixed(2); pc.updated = Date.now(); },
      log: (text) => addLog(combat, { type: 'event', text }),
      npcPool: (e, skill) => parsePool(profileFor(e.profile)?.skills?.[skill] || '3B'),
      // every roll is public; an Aim rerolls the worst die once (a Blank, else a Spur)
      roll: (e, pool, label, spur, aim = false) => {
        const r = rollPool(pool.black, pool.gold, spur);
        if (aim && r.dice.length) {
          let worst = r.dice.findIndex((d) => d.face === 'blank');
          if (worst < 0) worst = r.dice.findIndex((d) => d.face === 'spur');
          if (worst >= 0) {
            const again = rollDie(r.dice[worst].color, spur);
            r.dice[worst] = { ...again, faces: [...r.dice[worst].faces, ...again.faces], aimed: true };
            r.hits = r.dice.reduce((s, d) => s + HIT_VALUE[d.face], 0); r.aces = r.dice.filter((d) => d.face === 'ace').length;
          }
        }
        addLog(combat, { type: 'roll', who: e.name, label, pool: poolLabel(pool), spur, dice: r.dice, hits: r.hits, aces: r.aces });
        return r;
      },
    };
    const game = state.kind, before = snapWallets(combat.posse);
    const result = contestAction(state, body, ctx) ?? null;
    tally(combat, before, game === 'race' || game === 'trickshot' ? game : state.kind);
    state.v = (state.v || 0) + 1;
    combat.v = (combat.v || 0) + 1;
    await Promise.all([save(state, KEY), save(combat, 'combat')]);
    return send(res, 200, { result, state: withWallet(contestView(state, { pc: String(body.pc || ''), warden }), combat, String(body.pc || '')) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
