// Faro — the Old West's bank game, at the saloon table. An NPC dealer banks; the posse bets on ranks (Ace to King) on the layout.
// Rules: the first card (soda) and the last (hock) have no action. Each turn deals two: the banker's card (bets on that rank
// lose) then the player's card (bets on that rank win even money). "Coppering" a bet reverses it. A pair in one turn is a
// split: the bank takes half. With three cards left you may "call the turn" (their exact order): 4 to 1, or 2 to 1 if two
// of them pair (a cat-hop). Stakes stay on the layout until they lose, you take them back, or the deal ends.
// House rule: a crooked dealing box (secretly set by the Warden) now and then stacks the banker's card against the biggest
// bet; Intuition vs the dealer's Finesse spots it.
import { newDeck, label } from './lockpick.js';
import { cents, money } from './util.js';
import { say, walletOf, add } from './saloon-common.js';

const RANK_NAMES = { 14: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King' };
export const LAYOUT = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const banker = (t) => t.seats.find((s) => s.kind === 'npc');

export function newFaroDeal(t, ctx) {
  const deck = ctx.deck?.() || newDeck();
  const soda = deck.pop();
  t.faro = { deal: (t.faro?.deal || 0) + 1, deck, soda, turns: [], case: { [soda.r]: 1 }, bets: {}, calls: {}, watched: {}, crooked: !!t.crooked, log: [], over: false };
  say(t.faro, `A fresh deal. The soda card is the ${label(soda)} — no action on it.`);
}

// put money on a rank (or change/take back what's there); the stake leaves your wallet while it's on the layout
export function faroBet(t, seat, a, ctx) {
  const f = t.faro;
  if (!f || f.over) throw new Error('Wait for the next deal.');
  const r = Number(a.rank);
  if (!LAYOUT.includes(r)) throw new Error('Pick a card on the layout.');
  if ((f.case[r] || 0) >= 4) throw new Error(`All four ${RANK_NAMES[r]}s are gone — that one’s dead.`);
  const mine = (f.bets[seat.key] ||= {});
  const had = mine[r]?.amt || 0, amt = money(a.amount);
  if (amt && amt < t.stakes.ante) throw new Error(`The table minimum is $${t.stakes.ante.toFixed(2)}.`);
  if (amt > t.stakes.bet * 5) throw new Error(`The house limit is $${(t.stakes.bet * 5).toFixed(2)} a card.`);
  const diff = cents(amt - had);
  if (diff > 0 && walletOf(seat, ctx) < diff) throw new Error('Not enough money for that.');
  add(seat, -diff, ctx);
  if (amt) mine[r] = { amt, copper: !!a.copper }; else delete mine[r];
  return mine[r] || null;
}
// with three cards left: call their order (banker's card, player's card, hock)
export function faroCall(t, seat, a, ctx) {
  const f = t.faro;
  if (!f || f.over || f.deck.length !== 3) throw new Error('You can only call the turn when three cards are left.');
  const order = (Array.isArray(a.order) ? a.order : []).map(Number);
  if (order.length !== 3 || !order.every((r) => LAYOUT.includes(r))) throw new Error('Call all three cards in order.');
  const left = {};
  LAYOUT.forEach((r) => { left[r] = 4 - (f.case[r] || 0); });
  const need = {};
  order.forEach((r) => { need[r] = (need[r] || 0) + 1; });
  if (Object.entries(need).some(([r, n]) => left[r] < n)) throw new Error('That call can’t come up — check the casekeeper.');
  const amt = money(a.amount) || t.stakes.ante;
  if (f.calls[seat.key]) add(seat, f.calls[seat.key].amt, ctx);
  if (walletOf(seat, ctx) < amt) throw new Error('Not enough money for that.');
  add(seat, -amt, ctx);
  f.calls[seat.key] = { order, amt };
  return f.calls[seat.key];
}

// deal a turn: banker's card, then player's card; settle the layout; the hock ends the deal
export function faroTurn(t, ctx, log) {
  const f = t.faro, bank = banker(t);
  if (!f || f.over) throw new Error('Shuffle up a new deal first.');
  // the crooked box: now and then the dealer slides the card that beats the biggest bet to the top
  if (f.crooked && ctx.rand() < 0.3) {
    const exposure = {};
    for (const bets of Object.values(f.bets)) for (const [r, b] of Object.entries(bets)) if (!b.copper) exposure[r] = (exposure[r] || 0) + b.amt;
    const target = Object.entries(exposure).sort((x, y) => y[1] - x[1])[0]?.[0];
    const i = target ? f.deck.findIndex((c) => String(c.r) === target) : -1;
    if (i >= 0 && i !== f.deck.length - 1) { const [c] = f.deck.splice(i, 1); f.deck.push(c); f.cheats = (f.cheats || 0) + 1; }
  }
  const lastTurn = f.deck.length === 3;
  const loser = f.deck.pop(), winner = f.deck.pop();
  [loser, winner].forEach((c) => { f.case[c.r] = (f.case[c.r] || 0) + 1; });
  f.turns.push({ loser: label(loser), winner: label(winner) });
  const split = loser.r === winner.r;
  const results = [];
  for (const [key, bets] of Object.entries(f.bets)) {
    const seat = t.seats.find((s) => s.key === key);
    if (!seat) continue;
    let delta = 0;
    for (const r of [loser.r, winner.r]) {
      const b = bets[r];
      if (!b) continue;
      if (split) { add(seat, b.amt / 2, ctx); add(bank, b.amt / 2, ctx); delta -= b.amt / 2; delete bets[r]; continue; }
      const wins = (r === winner.r) !== b.copper;
      if (wins) { add(seat, b.amt, ctx); add(bank, -b.amt, ctx); delta += b.amt; } // paid even money; the stake stays down
      else { add(bank, b.amt, ctx); delta -= b.amt; delete bets[r]; }
    }
    if (delta) results.push(`${seat.name} ${delta > 0 ? `wins $${delta.toFixed(2)}` : `loses $${(-delta).toFixed(2)}`}`);
  }
  say(f, `${bank.name} deals: the ${label(loser)} loses, the ${label(winner)} wins${split ? ' — a split! The bank takes half' : ''}.${results.length ? ` ${results.join(', ')}.` : ''}`);
  if (lastTurn) {
    const hock = f.deck.pop();
    f.case[hock.r] = (f.case[hock.r] || 0) + 1;
    f.hock = label(hock);
    const order = [loser.r, winner.r, hock.r];
    const cat = new Set(order).size < 3;
    for (const [key, c] of Object.entries(f.calls)) {
      const seat = t.seats.find((s) => s.key === key);
      if (!seat) continue;
      if (c.order.every((r, i) => r === order[i])) { const win = c.amt * (cat ? 2 : 4); add(seat, c.amt + win, ctx); add(bank, -win, ctx); say(f, `${seat.name} called the turn! Paid $${win.toFixed(2)}${cat ? ' (a cat-hop, 2 to 1)' : ' (4 to 1)'}.`); }
      else { add(bank, c.amt, ctx); say(f, `${seat.name} missed the call.`); }
    }
    // the deal is over: everything still on the layout goes home
    for (const [key, bets] of Object.entries(f.bets)) { const seat = t.seats.find((s) => s.key === key); if (seat) for (const b of Object.values(bets)) add(seat, b.amt, ctx); }
    f.bets = {}; f.calls = {}; f.over = true;
    say(f, `The hock card is the ${f.hock}. That’s the deal — stakes come off the layout.`);
    const tally = t.seats.filter((s) => s.kind === 'pc' && s.net).map((s) => `${s.name} ${s.net > 0 ? `+$${s.net.toFixed(2)}` : `−$${(-s.net).toFixed(2)}`}`);
    log(`Faro at ${t.where}: the deal runs out.${tally.length ? ` ${tally.join(', ')}.` : ''}`);
    t.handsPlayed = (t.handsPlayed || 0) + 1;
  }
  return { loser: label(loser), winner: label(winner), split };
}

// Intuition vs the dealer's Finesse: is the box square?
export function faroWatch(t, seat, ctx, challenge, log) {
  const f = t.faro;
  if (!f || f.over) throw new Error('Wait for a deal.');
  if (f.watched[seat.key]) throw new Error('You’ve had your look this deal.');
  f.watched[seat.key] = true;
  const won = challenge(seat, banker(t), 'intuition', 'finesse', ctx);
  if (!won) return { won: false };
  if (f.crooked) {
    f.crooked = false; t.crooked = false;
    say(f, `${seat.name} catches ${banker(t).name} working a crooked dealing box!`);
    log(`${seat.name} catches the faro dealer at ${t.where} with a crooked box!`);
    ctx.caught?.(banker(t), seat);
    return { won: true, crooked: true };
  }
  return { won: true, crooked: false };
}

// everything a seat has on the layout goes back to them (leaving, or the table closing)
export function faroRefund(t, seat, ctx) {
  const f = t.faro;
  if (!f || f.over) return;
  const seats = seat ? [seat] : t.seats;
  for (const s of seats) {
    for (const b of Object.values(f.bets[s.key] || {})) add(s, b.amt, ctx);
    if (f.calls[s.key]) add(s, f.calls[s.key].amt, ctx);
    delete f.bets[s.key]; delete f.calls[s.key];
  }
}

export function faroView(t, { warden, mine }) {
  const f = t.faro;
  if (!f) return null;
  return {
    deal: f.deal, soda: label(f.soda), turns: f.turns.slice(-26), left: f.deck.length, over: f.over, hock: f.hock || '', case: f.case, log: f.log,
    bets: Object.fromEntries(Object.entries(f.bets).map(([k, b]) => [k, b])), calls: Object.fromEntries(Object.entries(f.calls).filter(([k]) => warden || k === mine)),
    canCall: !f.over && f.deck.length === 3, watched: !!f.watched[mine], crooked: warden ? !!f.crooked : undefined, cheats: warden ? f.cheats || 0 : undefined,
  };
}
