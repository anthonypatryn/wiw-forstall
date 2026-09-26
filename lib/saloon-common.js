// What the saloon games (faro, Liar's Dice, blackjack, the drinking contest) share: seats, the table log, and money
// moving between a character's wallet and an NPC's bankroll.
import { cents, money } from './util.js';

export const seatOf = (t, key) => t.seats.find((s) => s.key === key);
export const pcOf = (seat, ctx) => ctx.posse.find((p) => p.id === seat.pc);
// a game's own running log (last 40 lines)
export const say = (game, text) => { game.log.push(text); game.log = game.log.slice(-40); };
// what a seat can put in: a character's wallet, or the NPC's bankroll
export function walletOf(seat, ctx) { return seat.kind === 'npc' ? seat.bank : money(pcOf(seat, ctx)?.wallet); }
// pay a seat (negative = take from it); tracks the seat's net for the tally
export function add(seat, amount, ctx) {
  amount = cents(amount);
  if (seat.kind === 'npc') seat.bank = cents(seat.bank + amount);
  else { const pc = pcOf(seat, ctx); pc.wallet = (money(pc.wallet) + amount).toFixed(2); pc.updated = Date.now(); }
  seat.net = cents((seat.net || 0) + amount);
}
