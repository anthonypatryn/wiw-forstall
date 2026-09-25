// The saloon: card games at a table with NPCs, played with real money from the posse's wallets.
// Five-card draw poker (house rules on top of p. 12's Challenge Roll): ante → deal 5 → bet → draw (up to 3, or 4 keeping an Ace)
// → bet (double) → showdown. Fixed limit, 3 raises a round. NPCs play by hand strength, style and a little luck.
// Skill moves (the Warden turns each on or off): read a tell (Intuition vs Charm → see one NPC card), bluff (Charm vs
// Intuition → NPCs without two pair fold), palm a card (Finesse vs Intuition → swap in a better card; caught = folded out).
import crypto from 'node:crypto';
import { newDeck, label } from './lockpick.js';

const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const cents = (n) => Math.round(n * 100) / 100;
export const money = (v) => Math.max(0, cents(Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0));
export const freshSaloon = () => ({ v: 0, table: null });
export const STYLES = ['tight', 'loose', 'bluffer'];
const RANKS = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two' };
const plural = (r) => (r === 6 ? 'Sixes' : `${RANKS[r]}s`);

// ---------- hand ranking ----------
// → { cat 0–8, name, key: [cat, ...tiebreakers] } (higher key wins; Ace plays low in A-2-3-4-5)
export function rankHand(cards) {
  const rs = cards.map((c) => c.r).sort((a, b) => b - a);
  const counts = {};
  rs.forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
  const groups = Object.entries(counts).map(([r, n]) => [n, Number(r)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(rs)];
  let high = 0;
  if (uniq.length === 5 && uniq[0] - uniq[4] === 4) high = uniq[0];
  if (uniq.join() === '14,5,4,3,2') high = 5; // the wheel
  const kick = groups.map((g) => g[1]);
  if (high && flush) return { cat: 8, name: high === 14 ? 'Royal Flush' : 'Straight Flush', key: [8, high] };
  if (groups[0][0] === 4) return { cat: 7, name: `Four ${plural(groups[0][1])}`, key: [7, ...kick] };
  if (groups[0][0] === 3 && groups[1][0] === 2) return { cat: 6, name: `Full House, ${plural(groups[0][1])} over ${plural(groups[1][1])}`, key: [6, ...kick] };
  if (flush) return { cat: 5, name: 'Flush', key: [5, ...rs] };
  if (high) return { cat: 4, name: `Straight to the ${RANKS[high]}`, key: [4, high] };
  if (groups[0][0] === 3) return { cat: 3, name: `Three ${plural(groups[0][1])}`, key: [3, ...kick] };
  if (groups[0][0] === 2 && groups[1][0] === 2) return { cat: 2, name: `Two Pair, ${plural(groups[0][1])} and ${plural(groups[1][1])}`, key: [2, ...kick] };
  if (groups[0][0] === 2) return { cat: 1, name: `Pair of ${plural(groups[0][1])}`, key: [1, ...kick] };
  return { cat: 0, name: `${RANKS[rs[0]]} high`, key: [0, ...rs] };
}
export const compareHands = (a, b) => { for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) { const d = (a.key[i] || 0) - (b.key[i] || 0); if (d) return d; } return 0; };
// 0–1: how good a hand is (for the NPCs)
const strength = (cards) => { const h = rankHand(cards); return Math.min(1, (h.cat + (h.key[1] || 0) / 15) / 6); };
// which cards an NPC throws away: keep made hands, chase four to a flush/straight, else keep the high cards
function npcDiscards(cards) {
  const h = rankHand(cards);
  if (h.cat >= 4) return [];
  const count = {};
  cards.forEach((c) => { count[c.r] = (count[c.r] || 0) + 1; });
  if (h.cat >= 1) return cards.map((c, i) => (count[c.r] >= 2 ? -1 : i)).filter((i) => i >= 0).slice(0, 3);
  const suit = Object.entries(cards.reduce((m, c) => ({ ...m, [c.s]: (m[c.s] || 0) + 1 }), {})).find(([, n]) => n === 4);
  if (suit) return [cards.findIndex((c) => c.s !== suit[0])];
  const order = cards.map((c, i) => [c.r, i]).sort((a, b) => a[0] - b[0]);
  return order.slice(0, cards.some((c) => c.r === 14) ? 4 : 3).map(([, i]) => i);
}
export const drawLimit = (cards) => (cards.some((c) => c.r === 14) ? 4 : 3);

// ---------- the table ----------
const seatOf = (t, key) => t.seats.find((s) => s.key === key);
const inHand = (t) => t.seats.filter((s) => t.hand?.cards[s.key] && !t.hand.folded[s.key]);
function say(t, text) { t.hand.log.push(text); t.hand.log = t.hand.log.slice(-40); }

// what a seat can put in: a character's wallet, or the NPC's bankroll
function purse(t, seat, ctx) {
  if (seat.kind === 'npc') return seat.bank;
  return money(ctx.posse.find((p) => p.id === seat.pc)?.wallet);
}
function pay(t, seat, amount, ctx) {
  amount = cents(amount);
  if (seat.kind === 'npc') seat.bank = cents(seat.bank - amount);
  else { const pc = ctx.posse.find((p) => p.id === seat.pc); pc.wallet = (money(pc.wallet) - amount).toFixed(2); pc.updated = Date.now(); }
  t.hand.pot = cents(t.hand.pot + amount);
  t.hand.put[seat.key] = cents((t.hand.put[seat.key] || 0) + amount);
  seat.net = cents((seat.net || 0) - amount);
}
function collect(t, seat, amount, ctx) {
  amount = cents(amount);
  if (seat.kind === 'npc') seat.bank = cents(seat.bank + amount);
  else { const pc = ctx.posse.find((p) => p.id === seat.pc); pc.wallet = (money(pc.wallet) + amount).toFixed(2); pc.updated = Date.now(); }
  seat.net = cents((seat.net || 0) + amount);
}

// betting: whose turn next, and is the round over?
const betSize = (t) => (t.hand.phase === 'bet2' ? t.stakes.bet * 2 : t.stakes.bet);
const toCall = (t, key) => cents(t.hand.high - (t.hand.bets[key] || 0));
function nextActor(t, from) {
  const order = t.hand.order, live = order.filter((k) => !t.hand.folded[k]);
  if (live.length < 2) return null;
  const done = live.every((k) => t.hand.acted[k] && toCall(t, k) === 0);
  if (done) return null;
  let i = order.indexOf(from);
  for (let n = 0; n < order.length; n++) {
    i = (i + 1) % order.length;
    const k = order[i];
    if (!t.hand.folded[k] && (!t.hand.acted[k] || toCall(t, k) > 0)) return k;
  }
  return null;
}
function startRound(t, phase) {
  Object.assign(t.hand, { phase, bets: {}, high: 0, raises: 0, acted: {} });
  t.hand.turn = t.hand.order.find((k) => !t.hand.folded[k]);
  if (phase === 'draw') t.hand.drawn = {};
}

function endHand(t, ctx, log) {
  const h = t.hand, live = inHand(t);
  let winners, text;
  if (live.length === 1) {
    winners = live;
    text = `${live[0].name} takes the pot ($${h.pot.toFixed(2)}) — everyone else folded.`;
    h.shown = {};
  } else {
    const ranked = live.map((s) => ({ s, r: rankHand(h.cards[s.key]) }));
    ranked.sort((a, b) => compareHands(b.r, a.r));
    winners = ranked.filter((x) => compareHands(x.r, ranked[0].r) === 0).map((x) => x.s);
    h.shown = Object.fromEntries(ranked.map((x) => [x.s.key, { cards: h.cards[x.s.key], name: x.r.name }]));
    text = `${winners.map((w) => w.name).join(' and ')} ${winners.length > 1 ? 'split' : 'wins'} the pot ($${h.pot.toFixed(2)}) with ${ranked[0].r.name}.`;
  }
  const share = Math.floor((h.pot / winners.length) * 100) / 100;
  winners.forEach((w, i) => collect(t, w, i === 0 ? cents(h.pot - share * (winners.length - 1)) : share, ctx));
  h.winners = winners.map((w) => w.key);
  h.phase = 'over'; h.turn = null; h.result = text;
  say(t, text);
  log(`Poker: ${text}`);
  t.handsPlayed = (t.handsPlayed || 0) + 1;
}

// move on after an action: next bettor, next phase, NPC turns, showdown
function advance(t, ctx, log) {
  const h = t.hand;
  for (let guard = 0; guard < 60 && h.phase !== 'over'; guard++) {
    if (inHand(t).length < 2) return endHand(t, ctx, log);
    if (h.phase === 'draw') {
      const next = h.order.find((k) => !h.folded[k] && h.drawn[k] === undefined);
      if (!next) { startRound(t, 'bet2'); continue; }
      h.turn = next;
      const seat = seatOf(t, next);
      if (seat.kind !== 'npc') return;
      doDraw(t, seat, npcDiscards(h.cards[next]), ctx);
      continue;
    }
    // betting rounds
    if (!h.turn) {
      if (h.phase === 'bet1') { startRound(t, 'draw'); continue; }
      h.phase = 'showdown'; return endHand(t, ctx, log);
    }
    const seat = seatOf(t, h.turn);
    if (seat.kind !== 'npc') return;
    npcBet(t, seat, ctx);
  }
}

function doBet(t, seat, move, ctx) {
  const h = t.hand, k = seat.key, owe = toCall(t, k), size = betSize(t);
  if (move === 'fold') { h.folded[k] = true; say(t, `${seat.name} folds.`); }
  else if (move === 'check') { if (owe > 0) throw new Error('You have to call, raise or fold.'); say(t, `${seat.name} checks.`); }
  else if (move === 'call') {
    if (owe <= 0) throw new Error('Nothing to call — check instead.');
    if (purse(t, seat, ctx) < owe) throw new Error(`Not enough money to call $${owe.toFixed(2)} — fold, or ask the Warden for a stake.`);
    pay(t, seat, owe, ctx); h.bets[k] = h.high; say(t, `${seat.name} calls $${owe.toFixed(2)}.`);
  } else if (move === 'bet' || move === 'raise') {
    if (h.raises >= 3) throw new Error('Three raises is the limit this round.');
    const put = cents(owe + size);
    if (purse(t, seat, ctx) < put) throw new Error(`Not enough money — that’s $${put.toFixed(2)}.`);
    pay(t, seat, put, ctx); h.high = cents(h.high + size); h.bets[k] = h.high; h.raises += 1;
    h.acted = { [k]: true }; // everyone else has to answer the raise
    say(t, `${seat.name} ${owe > 0 || h.raises > 1 ? 'raises' : 'bets'} $${size.toFixed(2)}.`);
  } else throw new Error('Check, bet, call, raise or fold.');
  h.acted[k] = true;
  h.turn = nextActor(t, k);
}
function npcBet(t, seat, ctx) {
  const h = t.hand, st = strength(h.cards[seat.key]) + (seat.bluffed ? -0.5 : 0), owe = toCall(t, seat.key), r = ctx.rand();
  const style = seat.style, can = (amt) => purse(t, seat, ctx) >= amt;
  let move;
  if (owe > 0) {
    const callBar = style === 'tight' ? 0.3 : style === 'loose' ? 0.12 : 0.2;
    if (st > 0.55 && h.raises < 3 && can(owe + betSize(t)) && r < 0.6) move = 'raise';
    else if ((st >= callBar || (style !== 'tight' && r < 0.25)) && can(owe)) move = 'call';
    else move = 'fold';
  } else {
    const betBar = style === 'tight' ? 0.4 : style === 'loose' ? 0.25 : 0.3;
    move = (st >= betBar || (style === 'bluffer' && r < 0.35)) && h.raises < 3 && can(betSize(t)) ? 'bet' : 'check';
  }
  doBet(t, seat, move, ctx);
}
function doDraw(t, seat, discard, ctx) {
  const h = t.hand, cards = h.cards[seat.key];
  const idx = [...new Set((discard || []).map(Number))].filter((i) => i >= 0 && i < 5);
  const keepsAce = cards.some((c, i) => c.r === 14 && !idx.includes(i));
  if (idx.length > 4 || (idx.length === 4 && !keepsAce)) throw new Error('You can swap up to 3 cards — or 4 if you keep an Ace.');
  idx.forEach((i) => { cards[i] = h.deck.pop(); });
  h.drawn[seat.key] = idx.length;
  say(t, `${seat.name} ${idx.length ? `draws ${idx.length}` : 'stands pat'}.`);
}

// roll a Skill for a seat (characters: their sheet; NPCs: their profile), Spurs rerolled with the Talent
function skillRoll(seat, skill, ctx) {
  const pool = seat.kind === 'npc' ? (ctx.npcSkills(seat)[skill] || '2B') : (ctx.posse.find((p) => p.id === seat.pc)?.skills?.[skill] || '1B');
  return ctx.roll(seat, skill, pool);
}
// p. 13: most Hits wins; a tie rolls again
function challenge(a, b, skillA, skillB, ctx) {
  for (let n = 0; n < 6; n++) {
    const ra = skillRoll(a, skillA, ctx), rb = skillRoll(b, skillB, ctx);
    if (ra.hits !== rb.hits) return ra.hits > rb.hits;
  }
  return false;
}

export function saloonAction(state, a, ctx) {
  const { warden, log = () => {} } = ctx;
  ctx.rand ||= () => crypto.randomInt(1_000_000) / 1_000_000;
  const t = state.table;
  const me = () => { if (!t) throw new Error('No table is open.'); const s = t.seats.find((x) => x.pc && x.pc === clean(a.pc, 12)); if (!s) throw new Error('You’re not sitting at this table.'); return s; };
  switch (a.action) {
    case 'open': { // the Warden opens a table
      if (!warden) throw new Error('Warden PIN required.');
      if (t && t.status !== 'closed') throw new Error('A table is already open — close it first.');
      const npcs = (Array.isArray(a.npcs) ? a.npcs : []).slice(0, 4).map((n, i) => ({ key: `npc:${i}`, kind: 'npc', name: clean(n?.name, 40) || `Stranger ${i + 1}`, profile: clean(n?.profile, 80) || 'npc:Human - Moderate Combatant', style: STYLES.includes(n?.style) ? n.style : 'loose', bank: money(n?.bank) || 50, net: 0 }));
      if (!npcs.length) throw new Error('Seat at least one NPC at the table.');
      state.table = {
        id: crypto.randomUUID().slice(0, 8), game: 'poker', status: 'open', where: clean(a.where, 60) || 'the saloon',
        stakes: { ante: money(a.ante) || 1, bet: money(a.bet) || 2 }, hooks: { tell: a.tell !== false, bluff: a.bluff !== false, palm: a.palm !== false },
        invite: (Array.isArray(a.invite) ? a.invite : []).map((x) => clean(x, 12)), seats: npcs, dealer: 0, hand: null, handsPlayed: 0, at: Date.now(),
      };
      log(`A card table opens at ${state.table.where}: five-card draw, $${state.table.stakes.ante.toFixed(2)} ante. Pull up a chair.`);
      return state.table;
    }
    case 'join': {
      if (!t || t.status === 'closed') throw new Error('No table is open.');
      const pc = ctx.posse.find((p) => p.id === clean(a.pc, 12) && !p.dead);
      if (!pc) throw new Error('Pick who you’re playing first (the “This is me” star on your sheet).');
      if (t.seats.some((s) => s.pc === pc.id)) return;
      if (t.seats.length >= 8) throw new Error('The table is full.');
      t.seats.push({ key: `pc:${pc.id}`, kind: 'pc', pc: pc.id, name: pc.name, net: 0 });
      return;
    }
    case 'leave': {
      const s = me();
      if (t.hand && t.hand.phase !== 'over' && t.hand.cards[s.key] && !t.hand.folded[s.key]) throw new Error('Finish or fold this hand first.');
      t.seats = t.seats.filter((x) => x !== s);
      log(`${s.name} leaves the card table ${s.net >= 0 ? `$${s.net.toFixed(2)} up` : `$${(-s.net).toFixed(2)} down`}.`);
      return;
    }
    case 'deal': { // the Warden (or any seated player) deals the next hand
      if (!t || t.status === 'closed') throw new Error('No table is open.');
      if (!warden) me();
      if (t.hand && t.hand.phase !== 'over') throw new Error('Finish this hand first.');
      const playing = t.seats.filter((s) => purse(t, s, ctx) >= t.stakes.ante);
      if (playing.length < 2 || !playing.some((s) => s.kind === 'pc')) throw new Error('Need at least one of the posse and one NPC who can cover the ante.');
      t.dealer = (t.dealer + 1) % t.seats.length;
      const order = [...t.seats.slice(t.dealer + 1), ...t.seats.slice(0, t.dealer + 1)].filter((s) => playing.includes(s)).map((s) => s.key);
      const deck = ctx.deck?.() || newDeck();
      t.hand = { no: (t.handsPlayed || 0) + 1, deck, order, cards: {}, folded: {}, pot: 0, bets: {}, high: 0, raises: 0, acted: {}, drawn: {}, peeks: {}, used: {}, put: {}, log: [], phase: 'bet1', turn: null };
      t.seats.forEach((s) => { delete s.bluffed; });
      t.status = 'playing';
      for (const k of order) { pay(t, seatOf(t, k), t.stakes.ante, ctx); t.hand.cards[k] = []; }
      for (let n = 0; n < 5; n++) for (const k of order) t.hand.cards[k].push(deck.pop());
      say(t, `Hand ${t.hand.no}: everyone antes $${t.stakes.ante.toFixed(2)}.`);
      startRound(t, 'bet1');
      advance(t, ctx, log);
      return;
    }
    case 'move': { // check / bet / call / raise / fold
      const s = me(), h = t.hand;
      if (!h || !['bet1', 'bet2'].includes(h.phase)) throw new Error('No betting right now.');
      if (h.turn !== s.key) throw new Error('Not your turn.');
      doBet(t, s, a.move, ctx);
      advance(t, ctx, log);
      return;
    }
    case 'draw': {
      const s = me(), h = t.hand;
      if (!h || h.phase !== 'draw' || h.turn !== s.key) throw new Error('Not your turn to draw.');
      doDraw(t, s, a.discard, ctx);
      advance(t, ctx, log);
      return;
    }
    case 'tell': { // Intuition vs the NPC's Charm: win and you see one of their cards
      const s = me(), h = t.hand, target = seatOf(t, clean(a.target, 20));
      if (!t.hooks.tell) throw new Error('The Warden isn’t using that rule at this table.');
      if (!h || h.phase === 'over' || h.folded[s.key]) throw new Error('You’re not in this hand.');
      if (h.used[`tell:${s.key}`]) throw new Error('One tell per hand.');
      if (!target || target.kind !== 'npc' || h.folded[target.key]) throw new Error('Pick an NPC still in the hand.');
      h.used[`tell:${s.key}`] = true;
      const won = challenge(s, target, 'intuition', 'charm', ctx);
      if (won) {
        const unseen = h.cards[target.key].filter((c) => !(h.peeks[s.key] || []).some((p) => p.card === label(c)));
        const c = unseen[Math.floor(ctx.rand() * unseen.length)];
        (h.peeks[s.key] ||= []).push({ seat: target.key, card: label(c) });
        return { won, seat: target.name, card: label(c) };
      }
      return { won, seat: target.name };
    }
    case 'bluff': { // Charm vs each NPC's Intuition: the ones you beat fold unless they hold two pair or better
      const s = me(), h = t.hand;
      if (!t.hooks.bluff) throw new Error('The Warden isn’t using that rule at this table.');
      if (!h || !['bet1', 'bet2'].includes(h.phase) || h.turn !== s.key) throw new Error('Bluff on your turn to bet.');
      if (h.used[`bluff:${s.key}`]) throw new Error('One bluff per hand.');
      h.used[`bluff:${s.key}`] = true;
      const out = [];
      for (const n of inHand(t).filter((x) => x.kind === 'npc')) {
        const won = challenge(s, n, 'charm', 'intuition', ctx);
        if (won && rankHand(h.cards[n.key]).cat < 2) { n.bluffed = true; out.push(n.name); }
      }
      say(t, `${s.name} stares down the table${out.length ? ` — ${out.join(' and ')} look${out.length === 1 ? 's' : ''} rattled` : ''}.`);
      return { rattled: out };
    }
    case 'palm': { // Finesse vs the sharpest NPC's Intuition, on your draw: swap one card for the better of two from the deck
      const s = me(), h = t.hand;
      if (!t.hooks.palm) throw new Error('The Warden isn’t using that rule at this table.');
      if (!h || h.phase !== 'draw' || h.turn !== s.key) throw new Error('Palm a card on your turn to draw.');
      if (h.used[`palm:${s.key}`]) throw new Error('Once a hand is pushing your luck already.');
      const i = int(a.card, 0, 4);
      h.used[`palm:${s.key}`] = true;
      const watchers = inHand(t).filter((x) => x.kind === 'npc');
      const dice = (pool) => String(pool || '').match(/\d+/g)?.reduce((n, d) => n + Number(d), 0) || 0;
      const eye = watchers.sort((x, y) => dice(ctx.npcSkills(y).intuition) - dice(ctx.npcSkills(x).intuition))[0];
      if (!eye) throw new Error('Nobody left to fool.');
      const won = challenge(s, eye, 'finesse', 'intuition', ctx);
      if (!won) {
        h.folded[s.key] = true;
        say(t, `${eye.name} catches ${s.name} palming a card! ${s.name}’s hand is thrown in.`);
        log(`${eye.name} catches ${s.name} cheating at cards!`);
        ctx.caught?.(s, eye);
        advance(t, ctx, log);
        return { won: false, by: eye.name };
      }
      const cards = h.cards[s.key], options = [h.deck.pop(), h.deck.pop()];
      const best = options.map((c) => { const tryCards = cards.slice(); tryCards[i] = c; return { c, r: rankHand(tryCards) }; }).sort((x, y) => compareHands(y.r, x.r))[0];
      h.deck.unshift(options.find((c) => c !== best.c));
      cards[i] = best.c;
      return { won: true, card: label(best.c) };
    }
    case 'kick': {
      if (!warden) throw new Error('Warden PIN required.');
      if (!t) return;
      const s = seatOf(t, clean(a.key, 20));
      if (!s) return;
      if (t.hand && t.hand.phase !== 'over' && t.hand.cards[s.key]) { t.hand.folded[s.key] = true; advance(t, ctx, log); }
      t.seats = t.seats.filter((x) => x !== s);
      return;
    }
    case 'close': {
      if (!warden) throw new Error('Warden PIN required.');
      if (!t) return;
      if (t.hand && t.hand.phase !== 'over') { // an unfinished hand: everyone gets back what they put in
        for (const [k, amt] of Object.entries(t.hand.put || {})) { const seat = seatOf(t, k); if (seat && amt) collect(t, seat, amt, ctx); }
        t.hand.pot = 0; t.hand.phase = 'over'; t.hand.result = 'The hand was called off; bets went back.';
      }
      const tally = t.seats.filter((s) => s.kind === 'pc' && s.net).map((s) => `${s.name} ${s.net > 0 ? `+$${s.net.toFixed(2)}` : `−$${(-s.net).toFixed(2)}`}`);
      log(`The card game at ${t.where} breaks up after ${t.handsPlayed || 0} hand${t.handsPlayed === 1 ? '' : 's'}.${tally.length ? ` ${tally.join(', ')}.` : ''}`);
      t.status = 'closed';
      return;
    }
    default: throw new Error('Unknown action.');
  }
}

// what each viewer may see: their own cards, peeks they've earned, everyone's cards at the showdown; the Warden sees all
export function saloonView(state, { warden, pc }) {
  const t = state.table;
  if (!t) return { v: state.v, table: null };
  const h = t.hand, mine = pc ? `pc:${pc}` : '';
  const hand = h && {
    no: h.no, phase: h.phase, pot: h.pot, turn: h.turn, high: h.high, raises: h.raises, bets: h.bets, folded: h.folded, drawn: h.drawn, log: h.log, result: h.result || '', winners: h.winners || [],
    order: h.order, owe: mine ? toCall(t, mine) : 0, betSize: ['bet1', 'bet2'].includes(h.phase) ? betSize(t) : 0,
    mine: mine && h.cards[mine] ? h.cards[mine].map(label) : null, myRank: mine && h.cards[mine] ? rankHand(h.cards[mine]).name : '',
    drawLimit: mine && h.cards[mine] ? drawLimit(h.cards[mine]) : 3,
    peeks: warden ? {} : h.peeks[mine] || [], used: mine ? Object.keys(h.used).filter((k) => k.endsWith(`:${mine}`)).map((k) => k.split(':')[0]) : [],
    shown: h.phase === 'over' ? Object.fromEntries(Object.entries(h.shown || {}).map(([k, v]) => [k, { cards: v.cards.map(label), name: v.name }])) : {},
    all: warden ? Object.fromEntries(Object.entries(h.cards).map(([k, c]) => [k, { cards: c.map(label), name: rankHand(c).name }])) : undefined,
  };
  return {
    v: state.v,
    table: { id: t.id, game: t.game, status: t.status, where: t.where, stakes: t.stakes, hooks: t.hooks, invite: t.invite, handsPlayed: t.handsPlayed, dealer: t.dealer,
      seats: t.seats.map((s) => ({ key: s.key, kind: s.kind, pc: s.pc, name: s.name, style: warden ? s.style : undefined, bank: s.kind === 'npc' ? s.bank : undefined, net: s.net || 0 })), hand },
  };
}
