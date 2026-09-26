// Blackjack (vingt-et-un) at the saloon: the posse plays against an NPC dealer who banks the game.
// Rules: a two-deck shoe. Place a bet (table minimum = the ante, house limit = 5 × the bet size), then two cards each; the
// dealer shows one and keeps one face down (the hole card). Get closer to 21 than the dealer without going over. Face cards
// count 10, Aces 1 or 11. Hit (take a card), stand, or double down on your first two cards (double the bet, exactly one more
// card). A blackjack (Ace + a ten-card on the deal) pays 3 to 2. The dealer checks for blackjack when showing an Ace or a
// ten-card, then draws to 16 and stands on every 17. Ties push (the bet comes back). No splitting at this table.
// Skill moves (house rules): Count the cards (Intuition vs the dealer's Finesse) tells you whether the next card is high,
// low or middling; Use a shiner (Finesse vs the dealer's Intuition, a little mirror) shows you the hole card — get caught
// and your bet is forfeit and you're out of the round. Each once a round.
import { newDeck, label } from './lockpick.js';

const cents = (n) => Math.round(n * 100) / 100;
const money = (v) => Math.max(0, cents(Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0));
const say = (B, text) => { B.log.push(text); B.log = B.log.slice(-40); };
const seatOf = (t, k) => t.seats.find((s) => s.key === k);
const dealerOf = (t) => t.seats.find((s) => s.kind === 'npc');

function walletOf(seat, ctx) { return seat.kind === 'npc' ? seat.bank : money(ctx.posse.find((p) => p.id === seat.pc)?.wallet); }
function add(seat, amount, ctx) {
  amount = cents(amount);
  if (seat.kind === 'npc') seat.bank = cents(seat.bank + amount);
  else { const pc = ctx.posse.find((p) => p.id === seat.pc); pc.wallet = (money(pc.wallet) + amount).toFixed(2); pc.updated = Date.now(); }
  seat.net = cents((seat.net || 0) + amount);
}

// the best total for a hand (Aces drop from 11 to 1 as needed); soft = an Ace still counting 11
export function bjTotal(cards) {
  let n = 0, aces = 0;
  for (const c of cards) { if (c.r === 14) { aces++; n += 11; } else n += Math.min(10, c.r); }
  while (n > 21 && aces) { n -= 10; aces--; }
  return { n, soft: aces > 0 };
}
const isBlackjack = (cards) => cards.length === 2 && bjTotal(cards).n === 21;
const band = (c) => (c.r >= 10 ? 'high (a ten-card or an Ace)' : c.r <= 6 ? 'low (Two to Six)' : 'middling (Seven to Nine)');

function shoe(ctx) { return [...(ctx.deck?.() || newDeck()), ...(ctx.deck?.() || newDeck())]; }
function draw(B, ctx) { B.counts = {}; if (!B.shoe.length) { B.shoe = shoe(ctx); say(B, 'The dealer shuffles a fresh shoe.'); } return B.shoe.pop(); }

// a new round: bets first (the shoe carries over until it runs low)
export function newBjRound(t, ctx) {
  const old = t.bj;
  const keep = old?.shoe?.length >= 20 ? old.shoe : null;
  t.bj = { round: (old?.round || 0) + 1, shoe: keep || shoe(ctx), phase: 'bets', bets: {}, hands: {}, dealer: [], order: [], turn: null, used: {}, counts: {}, holes: {}, results: {}, log: [] };
  if (!keep) say(t.bj, 'A fresh two-deck shoe.');
  say(t.bj, `Round ${t.bj.round}: place your bets.`);
}

// put a stake down (or change it; 0 takes it back) before the cards come out
export function bjBet(t, seat, a, ctx, log) {
  const B = t.bj;
  if (!B || B.phase !== 'bets') throw new Error('Bets go down before the deal.');
  const amt = money(a.amount), had = B.bets[seat.key] || 0;
  if (amt && amt < t.stakes.ante) throw new Error(`The table minimum is $${t.stakes.ante.toFixed(2)}.`);
  if (amt > t.stakes.bet * 5) throw new Error(`The house limit is $${(t.stakes.bet * 5).toFixed(2)}.`);
  const diff = cents(amt - had);
  if (diff > 0 && walletOf(seat, ctx) < diff) throw new Error('Not enough money for that.');
  add(seat, -diff, ctx);
  if (amt) B.bets[seat.key] = amt; else delete B.bets[seat.key];
  // everyone at the table has a bet down: deal
  const pcs = t.seats.filter((s) => s.kind === 'pc');
  if (amt && pcs.every((s) => B.bets[s.key])) bjDeal(t, ctx, log);
  return B.bets[seat.key] || 0;
}

export function bjDeal(t, ctx, log) {
  const B = t.bj, dealer = dealerOf(t);
  if (!B || B.phase !== 'bets') throw new Error('Bets go down before the deal.');
  B.order = t.seats.filter((s) => s.kind === 'pc' && B.bets[s.key]).map((s) => s.key);
  if (!B.order.length) throw new Error('Nobody has a bet down yet.');
  for (const k of B.order) B.hands[k] = { cards: [], bet: B.bets[k], done: false, doubled: false };
  for (let n = 0; n < 2; n++) { for (const k of B.order) B.hands[k].cards.push(draw(B, ctx)); B.dealer.push(draw(B, ctx)); }
  B.phase = 'play';
  say(B, `${dealer.name} deals. The dealer shows the ${label(B.dealer[0])}.`);
  for (const k of B.order) if (isBlackjack(B.hands[k].cards)) { B.hands[k].done = true; say(B, `${seatOf(t, k).name} has blackjack!`); }
  // the dealer peeks under an Ace or a ten-card
  if (B.dealer[0].r >= 10 && isBlackjack(B.dealer)) { say(B, `${dealer.name} turns over the ${label(B.dealer[1])}: blackjack.`); return settle(t, ctx, log); }
  return next(t, ctx, log);
}

function next(t, ctx, log) {
  const B = t.bj;
  B.turn = B.order.find((k) => !B.hands[k].done) || null;
  if (!B.turn) dealerPlays(t, ctx, log);
}

export function bjMove(t, seat, move, ctx, log) {
  const B = t.bj;
  if (!B || B.phase !== 'play') throw new Error('No hand being played.');
  if (B.turn !== seat.key) throw new Error('Not your turn.');
  const h = B.hands[seat.key];
  if (move === 'double') {
    if (h.cards.length !== 2) throw new Error('You can only double down on your first two cards.');
    if (walletOf(seat, ctx) < h.bet) throw new Error('Not enough money to double.');
    add(seat, -h.bet, ctx);
    h.bet = cents(h.bet * 2); h.doubled = true;
    const c = draw(B, ctx);
    h.cards.push(c); h.done = true;
    const n = bjTotal(h.cards).n;
    say(B, `${seat.name} doubles down and draws the ${label(c)}: ${n > 21 ? `${n}, bust` : n}.`);
  } else if (move === 'hit') {
    const c = draw(B, ctx);
    h.cards.push(c);
    const n = bjTotal(h.cards).n;
    if (n >= 21) h.done = true;
    say(B, `${seat.name} takes the ${label(c)}: ${n > 21 ? `${n}, bust` : n}.`);
  } else if (move === 'stand') {
    h.done = true;
    say(B, `${seat.name} stands on ${bjTotal(h.cards).n}.`);
  } else throw new Error('Hit, stand or double.');
  next(t, ctx, log);
  return { total: bjTotal(h.cards).n };
}

// the dealer turns the hole card and draws to 16, standing on every 17
function dealerPlays(t, ctx, log) {
  const B = t.bj, dealer = dealerOf(t);
  say(B, `${dealer.name} turns over the ${label(B.dealer[1])}: ${bjTotal(B.dealer).n}.`);
  const live = B.order.some((k) => !B.hands[k].caught && bjTotal(B.hands[k].cards).n <= 21 && !isBlackjack(B.hands[k].cards));
  if (live) while (bjTotal(B.dealer).n < 17) { const c = draw(B, ctx); B.dealer.push(c); say(B, `The dealer draws the ${label(c)}: ${bjTotal(B.dealer).n > 21 ? `${bjTotal(B.dealer).n}, bust` : bjTotal(B.dealer).n}.`); }
  settle(t, ctx, log);
}

function settle(t, ctx, log) {
  const B = t.bj, dealer = dealerOf(t);
  const d = bjTotal(B.dealer).n, dealerBj = isBlackjack(B.dealer);
  const out = [];
  for (const k of B.order) {
    const s = seatOf(t, k), h = B.hands[k];
    if (!s) continue;
    const n = bjTotal(h.cards).n, bj = isBlackjack(h.cards) && !h.doubled;
    let win = 0, text;
    if (h.caught) { add(dealer, h.bet, ctx); text = 'caught with a shiner — bet forfeit'; win = -h.bet; }
    else if (n > 21) { add(dealer, h.bet, ctx); text = `bust with ${n}`; win = -h.bet; }
    else if (bj && !dealerBj) { win = cents(h.bet * 1.5); add(s, h.bet + win, ctx); add(dealer, -win, ctx); text = 'blackjack, paid 3 to 2'; }
    else if (dealerBj && !bj) { add(dealer, h.bet, ctx); text = 'the dealer has blackjack'; win = -h.bet; }
    else if (d > 21 || n > d) { win = h.bet; add(s, h.bet * 2, ctx); add(dealer, -win, ctx); text = d > 21 ? `the dealer busts (${n})` : `${n} beats ${d}`; }
    else if (n === d) { add(s, h.bet, ctx); text = `push at ${n}, bet back`; }
    else { add(dealer, h.bet, ctx); text = `${n} loses to ${d}`; win = -h.bet; }
    B.results[k] = { text, win };
    out.push(`${s.name} ${win > 0 ? `wins $${win.toFixed(2)}` : win < 0 ? `loses $${(-win).toFixed(2)}` : 'pushes'}`);
    say(B, `${s.name}: ${text}${win > 0 ? ` (+$${win.toFixed(2)})` : win < 0 ? ` (−$${(-win).toFixed(2)})` : ''}.`);
  }
  B.phase = 'done'; B.turn = null; B.bets = {};
  t.handsPlayed = (t.handsPlayed || 0) + 1;
  log(`Blackjack at ${t.where}, round ${B.round}: the dealer ${d > 21 ? 'busts' : dealerBj ? 'has blackjack' : `stands on ${d}`}. ${out.join(', ')}.`);
}

// Intuition vs the dealer's Finesse: is the next card high, low or middling?
export function bjCount(t, seat, ctx, challenge) {
  const B = t.bj;
  if (!t.hooks.count) throw new Error('The Warden isn’t using that rule at this table.');
  if (!B || B.phase === 'done') throw new Error('Wait for the next round.');
  if (B.used[`count:${seat.key}`]) throw new Error('You’ve counted this round already.');
  B.used[`count:${seat.key}`] = true;
  const won = challenge(seat, dealerOf(t), 'intuition', 'finesse', ctx);
  if (!won) return { won: false };
  if (!B.shoe.length) B.shoe = shoe(ctx);
  B.counts[seat.key] = band(B.shoe[B.shoe.length - 1]);
  return { won: true, next: B.counts[seat.key] };
}
// Finesse vs the dealer's Intuition, on your turn: a shiner shows the hole card; get caught and you're out
export function bjShiner(t, seat, ctx, challenge, log) {
  const B = t.bj, dealer = dealerOf(t);
  if (!t.hooks.shiner) throw new Error('The Warden isn’t using that rule at this table.');
  if (!B || B.phase !== 'play' || B.turn !== seat.key) throw new Error('Use it on your turn.');
  if (B.used[`shiner:${seat.key}`]) throw new Error('Once a round is pushing your luck already.');
  B.used[`shiner:${seat.key}`] = true;
  const won = challenge(seat, dealer, 'finesse', 'intuition', ctx);
  if (won) { B.holes[seat.key] = label(B.dealer[1]); return { won: true, card: B.holes[seat.key] }; }
  const h = B.hands[seat.key];
  h.caught = true; h.done = true;
  say(B, `${dealer.name} spots ${seat.name}’s shiner! ${seat.name}’s bet is forfeit.`);
  log(`${dealer.name} catches ${seat.name} cheating at blackjack!`);
  ctx.caught?.(seat, dealer);
  next(t, ctx, log);
  return { won: false, by: dealer.name };
}

// stakes still on the table go home (leaving, a kick, or the table closing)
export function bjRefund(t, seat, ctx) {
  const B = t.bj;
  if (!B || B.phase === 'done') return;
  for (const s of seat ? [seat] : t.seats) {
    const amt = B.phase === 'bets' ? B.bets[s.key] : B.hands[s.key]?.bet;
    if (amt) add(s, amt, ctx);
    delete B.bets[s.key];
    if (B.hands[s.key]) { delete B.hands[s.key]; B.order = B.order.filter((k) => k !== s.key); }
  }
  if (!seat) { B.phase = 'done'; B.turn = null; }
}
// after someone leaves mid-round: carry on with whoever's left (or end the round if nobody is)
export function bjResume(t, ctx, log) {
  const B = t.bj;
  if (!B || B.phase !== 'play') return;
  if (!B.order.length) { B.phase = 'done'; B.turn = null; return; }
  next(t, ctx, log);
}
export const bjBusy = (t, seat) => t.bj && t.bj.phase === 'play' && t.bj.hands[seat.key] && !t.bj.hands[seat.key].done;

export function bjView(t, { warden, mine }) {
  const B = t.bj;
  if (!B) return null;
  const showHole = B.phase === 'done' || warden;
  const dealer = B.dealer.map((c, i) => (i === 1 && !showHole ? (B.holes[mine] ? `${B.holes[mine]}` : null) : label(c)));
  return {
    round: B.round, phase: B.phase, turn: B.turn, order: B.order, bets: B.bets, log: B.log, results: B.results, left: B.shoe.length,
    dealer, dealerTotal: B.phase === 'done' || warden ? bjTotal(B.dealer).n : B.dealer.length ? bjTotal([B.dealer[0]]).n : 0, holeSeen: !!B.holes[mine] && !showHole,
    hands: Object.fromEntries(Object.entries(B.hands).map(([k, h]) => [k, { cards: h.cards.map(label), total: bjTotal(h.cards).n, soft: bjTotal(h.cards).soft, bet: h.bet, done: h.done, doubled: h.doubled, caught: !!h.caught, blackjack: isBlackjack(h.cards) && !h.doubled }])),
    used: mine ? Object.keys(B.used).filter((k) => k.endsWith(`:${mine}`)).map((k) => k.split(':')[0]) : [],
    count: B.counts[mine] || '', canDouble: !!(mine && B.turn === mine && B.hands[mine]?.cards.length === 2),
  };
}
