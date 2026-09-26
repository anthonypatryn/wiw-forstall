import { cents, money } from './util.js';
import { say, seatOf, pcOf, walletOf, add } from './saloon-common.js';
// A drinking contest at the saloon (house rules on p. 12's difficulty and p. 13's rolls). Everyone pays in; the last one
// upright takes the pot, and the first to pass out pays the bar tab ($0.10 a shot poured).
// Each round every drinker takes a shot: roll Nerve and get at least as many Hits as the round number (1, 2, 3…).
// Before rolling you may spend up to 3 Grit off your sheet (+1 Black die each; it stays spent until you rest).
// A miss adds a Drunk level (−1 die on later shots) and costs 1 Health; the contest never kills (you pass out at 1).
// Three Drunk and you pass out, waking up Dazed [1]. Poisoned still takes its 2 dice; a Nerve Talent rerolls Spurs.
// Skill moves (once a contest): Spittoon trick (Finesse vs the sharpest NPC's Intuition) skips your shot — caught means a
// double (two rolls, both must pass); Needle them (Charm vs an NPC's Nerve) takes 2 dice off that NPC's next shot.

const SHOT = 0.1; // the catalog's whiskey, per pour
const PASS_OUT = 3;
const NPC_GRIT = { Weak: 2, Moderate: 4, Strong: 6 };

const upright = (D) => D.order.filter((k) => !D.out[k]);
// Nerve dice for this shot: the sheet's Nerve (Poisoned counted by ctx.poolOf), minus Drunk levels and a needle, plus Grit
export function shotPool(base, { drunk = 0, needled = 0, grit = 0 }) {
  let n = Math.max(0, base.black + base.gold - drunk - needled);
  const gold = Math.min(base.gold, n);
  return { black: n - gold + grit, gold };
}

export function newContest(t, ctx, log) {
  const fee = t.stakes.ante;
  const players = t.seats.filter((s) => walletOf(s, ctx) >= fee);
  if (players.length < 2 || !players.some((s) => s.kind === 'pc')) throw new Error('Need at least one of the posse and one other drinker who can pay the entry.');
  const D = t.drink = { game: (t.drink?.game || 0) + 1, round: 0, phase: 'ready', order: players.map((s) => s.key), pot: 0, drunk: {}, out: {}, hp: {}, grit: {}, drank: {}, shots: {},
    needled: {}, spit: {}, double: {}, used: {}, poured: 0, firstOut: null, outRound: {}, log: [], over: false, winners: [] };
  for (const s of players) {
    add(s, -fee, ctx); D.pot = cents(D.pot + fee); D.drunk[s.key] = 0;
    if (s.kind === 'npc') { const tough = /Weak/.test(s.profile) ? 'Weak' : /Strong/.test(s.profile) ? 'Strong' : 'Moderate'; D.grit[s.key] = NPC_GRIT[tough]; D.hp[s.key] = ctx.npcHealth?.(s) || 10; }
  }
  say(D, `Contest ${D.game}: ${players.map((s) => s.name).join(', ')} line up at the bar. $${D.pot.toFixed(2)} in the pot.`);
  log(`A drinking contest starts at ${t.where}: ${players.length} drinkers, $${D.pot.toFixed(2)} to the last one standing.`);
}

// pour a round: NPCs drink straight away; players drink when they're ready
export function pour(t, ctx, log, challenge) {
  const D = t.drink;
  if (!D || D.over) throw new Error('Start a contest first.');
  if (D.phase === 'pouring') throw new Error('Everyone still has a full glass.');
  D.round += 1; D.phase = 'pouring'; D.drank = {};
  const up = upright(D);
  D.poured += up.length;
  say(D, `Round ${D.round}: the bartender pours ${up.length} shots. You need ${D.round} Hit${D.round > 1 ? 's' : ''} to keep it down.`);
  for (const k of up) { const s = seatOf(t, k); if (s?.kind === 'npc') drinkShot(t, s, 0, ctx); }
  return endRound(t, ctx, log);
}

// one drinker takes their shot (a double means two rolls, both must pass; a dumped shot passes without a roll)
function drinkShot(t, seat, grit, ctx) {
  const D = t.drink, k = seat.key, need = D.round;
  if (seat.kind === 'npc') { // NPCs spend Grit when their dice look short of what they need
    const base = ctx.poolOf(seat, 'nerve'), p = shotPool(base, { drunk: D.drunk[k], needled: D.needled[k] || 0 });
    const expect = p.black * 0.67 + p.gold * 0.83;
    grit = Math.min(3, D.grit[k] || 0, Math.max(0, Math.ceil((need - expect) / 0.67)));
    D.grit[k] = (D.grit[k] || 0) - grit;
  }
  const rolls = [];
  if (D.spit[k]) { D.spit[k] = false; say(D, `${seat.name} tips the glass into the spittoon when nobody’s looking.`); }
  else {
    for (let n = 0; n < (D.double[k] ? 2 : 1); n++) {
      const p = shotPool(ctx.poolOf(seat, 'nerve'), { drunk: D.drunk[k], needled: n ? 0 : D.needled[k] || 0, grit: n ? 0 : grit });
      rolls.push(ctx.roll(seat, 'nerve', p).hits);
    }
  }
  D.needled[k] = 0;
  const doubled = D.double[k]; D.double[k] = false;
  const ok = rolls.every((h) => h >= need);
  (D.shots[k] ||= []).push({ round: D.round, hits: rolls, need, ok, grit });
  D.drank[k] = true;
  if (ok) { if (rolls.length) say(D, `${seat.name} knocks back ${doubled ? 'a double' : 'the shot'}${grit ? ` (steadied with ${grit} Grit)` : ''}: ${rolls.join(' and ')} Hit${rolls.length === 1 && rolls[0] === 1 ? '' : 's'}.`); return { ok, rolls }; }
  D.drunk[k] += 1;
  // rotgut burns: 1 Health, but a contest never kills — at 1 Health you just pass out
  let hp;
  if (seat.kind === 'npc') hp = D.hp[k] = Math.max(1, D.hp[k] - 1);
  else { const pc = pcOf(seat, ctx); hp = pc.health = Math.max(1, (Number(pc.health) || 1) - 1); pc.updated = Date.now(); }
  const outNow = D.drunk[k] >= PASS_OUT || hp <= 1;
  say(D, `${seat.name} ${rolls.length ? `gets ${rolls.join(' and ')} Hit${rolls.length === 1 && rolls[0] === 1 ? '' : 's'} and ` : ''}sputters${doubled ? ' on the double' : ''}. Drunk ${D.drunk[k]}.${outNow ? ` ${seat.name} slides off the stool and passes out.` : ''}`);
  if (outNow) {
    D.out[k] = true; D.outRound[k] = D.round;
    if (!D.firstOut) D.firstOut = k;
    if (seat.kind === 'pc') ctx.status?.(pcOf(seat, ctx), 'Dazed', 1); // the hangover
  }
  return { ok, rolls, out: outNow };
}

// everyone upright has drunk: the round is over; maybe the contest too
function endRound(t, ctx, log) {
  const D = t.drink;
  if (upright(D).some((k) => !D.drank[k])) return null; // someone still has a full glass
  D.phase = 'ready';
  const up = upright(D);
  if (up.length > 1) return null;
  // the contest is over: the last one up wins; if the last few all went down together, they split it
  const winners = up.length ? up : D.order.filter((k) => D.outRound[k] === D.round);
  const share = Math.floor((D.pot / winners.length) * 100) / 100;
  winners.forEach((k) => add(seatOf(t, k), share, ctx));
  const tab = cents(D.poured * SHOT), first = seatOf(t, D.firstOut);
  if (first && tab) add(first, -Math.min(tab, walletOf(first, ctx)), ctx);
  D.winners = winners; D.over = true; D.phase = 'over';
  const names = winners.map((k) => seatOf(t, k)?.name).join(' and ');
  say(D, `${up.length ? `${names} is the last one standing` : `${names} go down together and split it`}: $${D.pot.toFixed(2)}. ${first ? `${first.name} passed out first and pays the bar tab, $${tab.toFixed(2)}.` : ''}`);
  log(`Drinking contest at ${t.where}: ${up.length ? `${names} drinks everyone under the table` : `${names} pass out together`} after ${D.round} round${D.round > 1 ? 's' : ''} and takes $${D.pot.toFixed(2)}.${first ? ` ${first.name} pays the tab.` : ''}`);
  t.handsPlayed = (t.handsPlayed || 0) + 1;
  D.pot = 0;
  return { winners: winners.map((k) => seatOf(t, k)?.name) };
}

export function drink(t, seat, a, ctx, log) {
  const D = t.drink, k = seat.key;
  if (!D || D.phase !== 'pouring') throw new Error('Wait for the bartender to pour.');
  if (!D.order.includes(k) || D.out[k]) throw new Error('You’re out of this contest.');
  if (D.drank[k]) throw new Error('You’ve had this round. Wait for the others.');
  const pc = pcOf(seat, ctx), grit = Math.max(0, Math.min(3, Math.round(Number(a.grit) || 0)));
  if (grit > (Number(pc.grit) || 0)) throw new Error(`You only have ${Number(pc.grit) || 0} Grit.`);
  if (grit) { pc.grit = (Number(pc.grit) || 0) - grit; pc.updated = Date.now(); }
  const r = drinkShot(t, seat, grit, ctx);
  return { ...r, need: D.round, drunk: D.drunk[k], end: endRound(t, ctx, log) };
}

// Finesse vs the sharpest NPC's Intuition: dump your shot this round. Caught = you drink a double
export function spittoon(t, seat, ctx, challenge) {
  const D = t.drink, k = seat.key;
  if (!t.hooks.spittoon) throw new Error('The Warden isn’t using that rule at this table.');
  if (!D || D.phase !== 'pouring' || D.drank[k] || D.out[k]) throw new Error('Try it while your glass is full.');
  if (D.used[`spittoon:${k}`]) throw new Error('Once a contest is pushing your luck already.');
  D.used[`spittoon:${k}`] = true;
  const dice = (pool) => String(pool || '').match(/\d+/g)?.reduce((n, d) => n + Number(d), 0) || 0;
  const eye = upright(D).map((x) => seatOf(t, x)).filter((s) => s?.kind === 'npc').sort((x, y) => dice(ctx.npcSkills(y).intuition) - dice(ctx.npcSkills(x).intuition))[0];
  if (!eye) throw new Error('Nobody left to fool.');
  const won = challenge(seat, eye, 'finesse', 'intuition', ctx);
  if (won) D.spit[k] = true;
  else { D.double[k] = true; say(D, `${eye.name} catches ${seat.name} eyeing the spittoon. “Drink a double, cheat.”`); }
  return { won, by: eye.name };
}

// Charm vs an NPC's Nerve: they roll 2 fewer dice on their next shot
export function needle(t, seat, a, ctx, challenge) {
  const D = t.drink, k = seat.key, target = seatOf(t, String(a.target || ''));
  if (!t.hooks.needle) throw new Error('The Warden isn’t using that rule at this table.');
  if (!D || D.over || D.out[k]) throw new Error('You’re not in a contest.');
  if (!target || target.kind !== 'npc' || D.out[target.key]) throw new Error('Pick an NPC still upright.');
  if (D.phase === 'pouring' && D.drank[target.key]) throw new Error(`${target.name} already drank this round. Needle them before the next pour.`);
  if (D.used[`needle:${k}`]) throw new Error('You’ve had your say this contest.');
  D.used[`needle:${k}`] = true;
  const won = challenge(seat, target, 'charm', 'nerve', ctx);
  if (won) { D.needled[target.key] = 2; say(D, `${seat.name} gets under ${target.name}’s skin.`); }
  return { won, seat: target.name };
}

// the pot goes back evenly (the table closing, or someone leaving mid-contest)
export function drinkRefund(t, ctx) {
  const D = t.drink;
  if (!D || D.over || !D.pot) return;
  const share = Math.floor((D.pot / D.order.length) * 100) / 100;
  D.order.forEach((k) => { const s = seatOf(t, k); if (s) add(s, share, ctx); });
  D.pot = 0; D.over = true; D.phase = 'over';
}
export const drinkBusy = (t, seat) => t.drink && !t.drink.over && t.drink.order.includes(seat.key) && !t.drink.out[seat.key];

export function drinkView(t, { warden, mine }) {
  const D = t.drink;
  if (!D) return null;
  return {
    game: D.game, round: D.round, phase: D.phase, need: D.phase === 'pouring' ? D.round : D.round + 1, order: D.order, pot: D.pot, drunk: D.drunk, out: D.out,
    drank: D.drank, poured: D.poured, tab: cents(D.poured * SHOT), firstOut: D.firstOut, over: D.over, winners: D.winners, log: D.log,
    hp: D.hp, grit: warden ? D.grit : undefined, needled: Object.keys(D.needled).filter((k) => D.needled[k]),
    last: Object.fromEntries(Object.entries(D.shots).map(([k, list]) => [k, list[list.length - 1] || null])),
    used: mine ? Object.keys(D.used).filter((k) => k.endsWith(`:${mine}`)).map((k) => k.split(':')[0]) : [],
    myDouble: !!D.double[mine], mySpit: !!D.spit[mine],
  };
}
