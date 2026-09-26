// Liar's Dice at the saloon — classic six-sided (the user's pick). Everyone antes into the pot and rolls five dice under a cup.
// Bids name a quantity and a face (2–6) across ALL dice on the table; ones are wild. Each bid must go up: more dice, or the
// same number of a higher face. Call "Liar!" and every cup lifts: if there are fewer than bid, the bidder loses a die;
// otherwise the caller does. The loser starts the next round. Out of dice, out of the game; the last one holding dice takes the pot.
// Skill moves (house rules): Peek (Intuition vs the NPC's Finesse) shows one of their dice; Stare down (Charm vs Intuition,
// on your bid) makes the next NPC raise instead of calling you a liar. Each once a round.
import crypto from 'node:crypto';
import { cents, money } from './util.js';
import { say, seatOf, walletOf, add } from './saloon-common.js';

const d6 = (ctx) => (ctx.d6 ? ctx.d6() : crypto.randomInt(6) + 1);
const FACE = { 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes' };
export const bidText = (b) => `${b.qty} ${b.qty === 1 ? FACE[b.face].replace(/s$/, '').replace(/xe$/, 'x') : FACE[b.face]}`;

const alive = (L) => L.order.filter((k) => L.counts[k] > 0);
const total = (L) => alive(L).reduce((n, k) => n + L.counts[k], 0);
const matches = (dice, face) => dice.filter((d) => d === face || d === 1).length;
export const legalRaise = (bid, qty, face) => !bid || qty > bid.qty || (qty === bid.qty && face > bid.face);

function roll(L, ctx) {
  for (const k of alive(L)) L.dice[k] = Array.from({ length: L.counts[k] }, () => d6(ctx)).sort();
  L.bid = null; L.peeks = {}; L.used = {}; L.stared = null; L.round += 1;
}
function nextAlive(L, k) {
  const i = L.order.indexOf(k);
  for (let n = 1; n <= L.order.length; n++) { const c = L.order[(i + n) % L.order.length]; if (L.counts[c] > 0) return c; }
  return null;
}

export function newLiarsGame(t, ctx, log) {
  const players = t.seats.filter((s) => walletOf(s, ctx) >= t.stakes.ante);
  if (players.length < 2 || !players.some((s) => s.kind === 'pc')) throw new Error('Need at least one of the posse and one NPC who can cover the ante.');
  const L = { game: (t.liars?.game || 0) + 1, order: players.map((s) => s.key), counts: {}, dice: {}, pot: 0, round: 0, turn: null, bid: null, last: null, log: [], over: false, winner: null };
  for (const s of players) { add(s, -t.stakes.ante, ctx); L.pot = cents(L.pot + t.stakes.ante); L.counts[s.key] = 5; }
  t.liars = L;
  roll(L, ctx);
  L.turn = L.order[(t.dealer = ((t.dealer || 0) + 1) % L.order.length)];
  say(L, `Game ${L.game}: everyone antes $${t.stakes.ante.toFixed(2)} and shakes five dice under a cup.`);
  advance(t, ctx, log);
}

function lift(t, callerKey, ctx, log) {
  const L = t.liars, b = L.bid, bidder = seatOf(t, b.by), caller = seatOf(t, callerKey);
  const count = alive(L).reduce((n, k) => n + matches(L.dice[k], b.face), 0);
  const loser = count >= b.qty ? caller : bidder;
  L.last = { bid: { ...b }, by: bidder.name, caller: caller.name, count, loser: loser.name, dice: Object.fromEntries(alive(L).map((k) => [k, L.dice[k].slice()])) };
  L.counts[loser.key] -= 1;
  say(L, `${caller.name} calls ${bidder.name} a liar! There ${count === 1 ? 'is' : 'are'} ${count} (bid: ${bidText(b)}). ${loser.name} loses a die${L.counts[loser.key] ? '' : ' and is out'}.`);
  const left = alive(L);
  if (left.length === 1) {
    const w = seatOf(t, left[0]);
    add(w, L.pot, ctx);
    L.over = true; L.winner = w.key; L.turn = null;
    const text = `${w.name} is the last one holding dice and takes the pot ($${L.pot.toFixed(2)}).`;
    say(L, text); log(`Liar’s Dice at ${t.where}: ${text}`);
    t.handsPlayed = (t.handsPlayed || 0) + 1;
    return;
  }
  roll(L, ctx);
  L.turn = L.counts[loser.key] > 0 ? loser.key : nextAlive(L, loser.key);
  say(L, `Round ${L.round}: cups down. ${seatOf(t, L.turn).name} bids first.`);
}

function bid(t, seat, qty, face) {
  const L = t.liars;
  qty = Math.round(Number(qty)); face = Math.round(Number(face));
  if (!(face >= 2 && face <= 6)) throw new Error('Bid on twos through sixes (ones are wild).');
  if (!(qty >= 1 && qty <= total(L))) throw new Error(`There are only ${total(L)} dice on the table.`);
  if (!legalRaise(L.bid, qty, face)) throw new Error(`Go higher than ${bidText(L.bid)}: more dice, or the same number of a higher face.`);
  L.bid = { qty, face, by: seat.key };
  say(L, `${seat.name} bids ${bidText(L.bid)}.`);
  L.turn = nextAlive(L, seat.key);
}

// NPCs: how many of that face should be out there? Call a liar when the bid is too far past it; else raise on their best face.
function npcTurn(t, seat, ctx, log) {
  const L = t.liars, mine = L.dice[seat.key], others = total(L) - mine.length;
  const edge = { tight: 0.5, loose: 1.5, bluffer: 2 }[seat.style] ?? 1;
  const stared = L.stared === seat.key;
  if (L.bid) {
    const expect = matches(mine, L.bid.face) + others / 3;
    if (!stared && L.bid.qty > expect + edge) { lift(t, seat.key, ctx, log); return; }
  }
  if (stared) L.stared = null;
  const best = [2, 3, 4, 5, 6].map((f) => [matches(mine, f), f]).sort((a, b) => b[0] - a[0] || b[1] - a[1])[0][1];
  let qty = L.bid ? L.bid.qty : Math.max(1, Math.round(matches(mine, best) + others / 3) - 1);
  let face = best;
  if (L.bid && !legalRaise(L.bid, qty, face)) qty += 1;
  if (seat.style === 'bluffer' && ctx.rand() < 0.3) qty += 1;
  if (qty > total(L)) { lift(t, seat.key, ctx, log); return; } // nowhere left to go
  bid(t, seat, qty, face);
}
export function advance(t, ctx, log) {
  const L = t.liars;
  for (let guard = 0; guard < 80 && !L.over; guard++) {
    const seat = seatOf(t, L.turn);
    if (!seat || seat.kind !== 'npc') return;
    npcTurn(t, seat, ctx, log);
  }
}

export function liarsBid(t, seat, a, ctx, log) {
  const L = t.liars;
  if (!L || L.over) throw new Error('No game going — start one.');
  if (L.turn !== seat.key) throw new Error('Not your turn.');
  bid(t, seat, a.qty, a.face);
  if (L.stared === seat.key) L.stared = null; // they raised: the stare is spent
  advance(t, ctx, log);
  return L.bid;
}
export function liarsCall(t, seat, ctx, log) {
  const L = t.liars;
  if (!L || L.over) throw new Error('No game going — start one.');
  if (L.turn !== seat.key) throw new Error('Not your turn.');
  if (!L.bid) throw new Error('Nobody has bid yet — open the bidding.');
  if (L.stared === seat.key) throw new Error(`${seatOf(t, L.bid.by)?.name || 'They'} stared you down. You have to raise this turn.`);
  lift(t, seat.key, ctx, log);
  advance(t, ctx, log);
  return L.last;
}
// Intuition vs anyone's Finesse: see one of their dice
export function liarsPeek(t, seat, a, ctx, challenge) {
  const L = t.liars, target = seatOf(t, String(a.target || ''));
  if (!t.hooks.peek) throw new Error('The Warden isn’t using that rule at this table.');
  if (!L || L.over || !(L.counts[seat.key] > 0)) throw new Error('You’re not in this game.');
  if (L.used[`peek:${seat.key}`]) throw new Error('One peek a round.');
  if (!target || target.key === seat.key || !(L.counts[target.key] > 0)) throw new Error('Pick someone still holding dice.');
  L.used[`peek:${seat.key}`] = true;
  const won = challenge(seat, target, 'intuition', 'finesse', ctx);
  if (!won) return { won, seat: target.name };
  const seen = (L.peeks[seat.key] ||= []).filter((p) => p.seat === target.key).length;
  const die = L.dice[target.key][seen % L.dice[target.key].length];
  L.peeks[seat.key].push({ seat: target.key, die });
  return { won, seat: target.name, die };
}
// Charm vs the next player's Intuition (posse or NPC), on your turn: they have to raise, not call
export function liarsStare(t, seat, ctx, challenge) {
  const L = t.liars;
  if (!t.hooks.stare) throw new Error('The Warden isn’t using that rule at this table.');
  if (!L || L.over) throw new Error('No game going.');
  if (L.turn !== seat.key) throw new Error('Stare them down on your turn, then bid.');
  if (L.used[`stare:${seat.key}`]) throw new Error('Once a round.');
  const next = seatOf(t, nextAlive(L, seat.key));
  if (!next || next.key === seat.key) throw new Error('Nobody plays after you.');
  L.used[`stare:${seat.key}`] = true;
  const won = challenge(seat, next, 'charm', 'intuition', ctx);
  if (won) L.stared = next.key;
  return { won, seat: next.name };
}
export function liarsRefund(t, ctx) {
  const L = t.liars;
  if (!L || L.over) return;
  const players = L.order.map((k) => seatOf(t, k)).filter(Boolean);
  const each = Math.floor((L.pot / players.length) * 100) / 100;
  players.forEach((s, i) => add(s, i === 0 ? cents(L.pot - each * (players.length - 1)) : each, ctx));
  L.pot = 0; L.over = true; L.turn = null;
}

export function liarsView(t, { warden, mine }) {
  const L = t.liars;
  if (!L) return null;
  return {
    game: L.game, round: L.round, pot: L.pot, turn: L.turn, bid: L.bid, counts: L.counts, order: L.order, total: total(L), over: L.over, winner: L.winner, log: L.log,
    last: L.last, mine: L.dice[mine] || null, peeks: warden ? [] : (L.peeks[mine] || []), used: Object.keys(L.used).filter((k) => k.endsWith(`:${mine}`)).map((k) => k.split(':')[0]),
    all: warden ? L.dice : undefined, stared: warden ? L.stared : undefined, staredMe: !!mine && L.stared === mine,
  };
}
