// Contests: the horse race (house rules) and the trick-shot contest (Judgment on the Iron Road p. 109, Dobytown).
// Like the carnival: the Warden opens one, every player gets an invite, they enter (the entry fees make the pot)
// and can put a side bet on anyone. The Warden runs it; every roll is public, in the Table Log.
//
// Horse race (house rules, the table's picks): three legs, Hits = ground covered.
//   The start: Finesse · The straight: Nerve · The finish: Finesse or Nerve, the rider's pick.
//   The horse adds dice: its breed (BREED_DICE) and the Bond with its rider (BOND_DICE). No horse? Rent one at the
//   race for a small fee on top of the entry: a plain nag, no dice either way. Most ground wins; a tie is a photo
//   finish (1B each until it's broken).
// Trick shot (p. 109): each round the trick has a target. Step 1: Finesse; meet the target and you earn an Aim
//   (reroll your worst pistol die). Step 2: the pistol's 3G (Adda lends everyone a Finncaster Green to keep it fair).
//   Most Hits wins the round; a tie rerolls the pistol until it isn't. 3–5 rounds, easiest trick first; most rounds
//   wins, a tie goes to another Blindfold Shot.
// Side bets are a pool: whoever backed the winner splits it by stake; if nobody did, the house keeps it.
import { cents, money, clean } from './util.js';
import { parsePool } from './dice.js';

export const KINDS = { race: 'Horse race', trickshot: 'Trick-shot contest' };
export const TOUGH = { Weak: 'npc:Human - Weak Combatant', Moderate: 'npc:Human - Moderate Combatant', Strong: 'npc:Human - Strong Combatant' };
export const LEGS = [['The start', 'finesse'], ['The straight', 'nerve'], ['The finish', null]];
// house rule: what each breed brings to a race (legs: which legs, by index; none = all three)
export const BREED_DICE = {
  'American Quarter Horse': { black: 1, gold: 0, legs: [0], why: 'a quarter-mile sprinter: +1B off the start' },
  'Paint Horse': { black: 0, gold: 0, why: 'a sturdy all-rounder: no extra dice' },
  Appaloosa: { black: 0, gold: 0, why: 'a sturdy all-rounder: no extra dice' },
  Morgan: { black: 1, gold: 0, why: 'quick and willing: +1B every leg' },
  Thoroughbred: { black: 0, gold: 1, why: 'bred to race: +1G every leg' },
  Clydesdale: { black: 0, gold: 1, legs: [1], why: 'slow to start but a steady pull: +1G on the straight' },
  Arabian: { black: 0, gold: 1, why: 'tireless: +1G every leg' },
  'Spanish Mustang': { black: 0, gold: 1, why: 'wild and fast: +1G every leg' },
  'The Firemane': { black: 0, gold: 2, why: 'a legend: +2G every leg' },
  'Silver Mysthorn': { black: 0, gold: 2, why: 'a legend: +2G every leg' },
  'Winged Pinto': { black: 0, gold: 2, why: 'a legend (no flying on the track): +2G every leg' },
};
export const BOND_DICE = { Revered: [0, 1], Helpful: [1, 0], Neutral: [0, 0], Suspicious: [-1, 0], Hostile: [-2, 0] };
const NPC_BREEDS = ['American Quarter Horse', 'Paint Horse', 'Appaloosa', 'Morgan', 'Thoroughbred', 'Arabian'];
export const TRICKS = [
  ['Mirror Shot', 2, 'Shoot a target by aiming through its reflection in a mirror on the table.'],
  ['Candle Snuff', 3, 'Snuff a candle’s flame without breaking the glass or tipping the holder.'],
  ['Bottle Cap Bullseye', 3, 'Knock the cap off a bottle without breaking the glass beneath.'],
  ['Two Targets, One Draw', 4, 'Hit two targets spaced apart in one fluid motion.'],
  ['The Blindfold Shot', 5, 'Blindfolded, spin around, then hit the bell.'],
];
const TRICK_SETS = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
export const PISTOL = { black: 0, gold: 3 };
const MAX = 8;

export const freshContest = () => ({ v: 0, open: false, kind: '', at: 0, where: '', fee: 0, rent: 0.5, rounds: 3, entrants: [], bets: [], result: null });

export function pcPool(pc, skill) { // a character's dice in a Skill (Poisoned: 2 fewer)
  const p = parsePool(pc?.skills?.[skill] || '1B');
  let n = p.black + p.gold;
  if (pc?.statuses?.Poisoned) n = Math.max(0, n - 2);
  const gold = Math.min(p.gold, n);
  return { black: n - gold, gold };
}
const add = (p, b, g) => {
  let black = p.black + b, gold = p.gold + g;
  if (black < 0) { gold = Math.max(0, gold + black); black = 0; } // lose Black dice first
  return { black, gold };
};
export function horseDice(horse, leg) {
  if (!horse || horse.rented) return { black: 0, gold: 0 };
  const b = BREED_DICE[horse.breed] || { black: 0, gold: 0 };
  const on = !b.legs || b.legs.includes(leg);
  const [bb, bg] = BOND_DICE[horse.bond] || [0, 0];
  return { black: (on ? b.black : 0) + bb, gold: (on ? b.gold : 0) + bg };
}

// ctx: warden, pc(id), pay(pc, dollars), log(text), npcPool(entrant, skill) → {black,gold},
//      roll(entrant, pool, label, spurTalent, aim) → {hits, dice, aimed}
export function contestAction(state, a, ctx) {
  const entrant = (key) => state.entrants.find((e) => e.key === key);
  const payTo = (e, amount) => { if (e.kind === 'pc') { const pc = ctx.pc(e.pc); if (pc) ctx.pay(pc, amount); } };
  const refundAll = () => {
    for (const e of state.entrants) payTo(e, e.paid);
    for (const b of state.bets) { const pc = ctx.pc(b.pc); if (pc) ctx.pay(pc, b.amount); }
  };
  if (a.action === 'open' || a.action === 'close') {
    if (!ctx.warden) throw new Error('Warden PIN required.');
    if (state.open && !state.result) refundAll(); // a contest that never ran gives everyone their money back
    if (a.action === 'close') { state.open = false; ctx.log(`The ${KINDS[state.kind]?.toLowerCase() || 'contest'} is over and the crowd drifts off.`); return { open: false }; }
    const kind = KINDS[a.kind] ? a.kind : null;
    if (!kind) throw new Error('Pick a horse race or a trick-shot contest.');
    const npcs = (Array.isArray(a.npcs) ? a.npcs : []).slice(0, 5).map((n, i) => {
      const tough = TOUGH[n?.tough] ? n.tough : 'Moderate';
      return { key: `npc:${i}`, kind: 'npc', name: clean(n?.name, 40) || `Stranger ${i + 1}`, tough, profile: TOUGH[tough], paid: 0,
        ...(kind === 'race' ? { horse: { name: '', breed: NPC_BREEDS[Math.floor(Math.random() * NPC_BREEDS.length)], bond: 'Neutral' }, finish: 'finesse' } : {}) };
    });
    Object.assign(state, freshContest(), { v: state.v, open: true, kind, at: Date.now(), where: clean(a.where, 40) || (kind === 'trickshot' ? 'Dobytown' : 'the fairground'),
      fee: cents(Math.min(20, Math.max(0, Number(a.fee) || 0))), rent: cents(Math.min(5, Math.max(0, Number(a.rent ?? 0.5) || 0))),
      rounds: [3, 4, 5].includes(Number(a.rounds)) ? Number(a.rounds) : 3, entrants: npcs });
    state.entrants.forEach((e) => { e.paid = state.fee; }); // NPCs put in their fee too
    ctx.log(kind === 'race' ? `A horse race at ${state.where}! Entry is $${state.fee.toFixed(2)}${state.rent ? ` (a rented horse is $${state.rent.toFixed(2)} more)` : ''}; the winner takes the pot.`
      : `A trick-shot contest in ${state.where}: ${state.rounds} rounds with Adda’s Finncaster Greens. Entry is $${state.fee.toFixed(2)}; the winner takes the pot.`);
    return { open: true };
  }
  if (!state.open) throw new Error('No contest is running.');
  if (a.action === 'run') {
    if (!ctx.warden) throw new Error('Warden PIN required.');
    if (state.result) throw new Error('This one’s already been run. Open a new contest for another.');
    if (state.entrants.length < 2) throw new Error('It takes at least two to make a contest.');
    state.result = { ...(state.kind === 'race' ? runRace(state, ctx) : runTrickshot(state, ctx)), at: Date.now() };
    settle(state, ctx, payTo);
    return state.result;
  }
  const pc = ctx.pc(clean(a.pc, 12));
  if (!pc || pc.dead) throw new Error('Pick who you’re playing first (the “This is me” star on your sheet).');
  if (state.result) throw new Error('This contest is over.');
  const mine = state.entrants.find((e) => e.pc === pc.id);
  const charge = (amount, what) => {
    if (money(pc.wallet) < amount) throw new Error(`${what} is $${amount.toFixed(2)}, and ${pc.name} has $${money(pc.wallet).toFixed(2)}.`);
    ctx.pay(pc, -amount);
  };
  switch (a.action) {
    case 'enter': {
      if (mine) throw new Error('You’re already in.');
      if (state.entrants.length >= MAX) throw new Error('The field is full.');
      const h = pc.horse || {}, own = !!h.breed && Number(h.health ?? 1) > 0;
      const rent = state.kind === 'race' && !own ? state.rent : 0;
      charge(state.fee + rent, rent ? 'The entry and a rented horse' : 'The entry');
      const e = { key: `pc:${pc.id}`, kind: 'pc', pc: pc.id, name: pc.name, paid: state.fee };
      if (state.kind === 'race') { e.horse = own ? { name: h.name || '', breed: h.breed, bond: h.bond || 'Neutral' } : { name: 'a rented nag', breed: '', bond: 'Neutral', rented: true }; e.finish = a.finish === 'nerve' ? 'nerve' : 'finesse'; }
      state.entrants.push(e);
      ctx.log(`${pc.name} enters the ${KINDS[state.kind].toLowerCase()}${state.kind === 'race' ? ` on ${own ? (h.name ? `${h.name} the ${h.breed}` : `their ${h.breed}`) : 'a rented horse'}` : ''}.`);
      return { entered: true };
    }
    case 'leave': {
      if (!mine) throw new Error('You aren’t entered.');
      state.entrants = state.entrants.filter((e) => e !== mine);
      ctx.pay(pc, mine.paid); // the fee back; a horse rental isn't refunded
      ctx.log(`${pc.name} pulls out of the ${KINDS[state.kind].toLowerCase()}.`);
      return { left: true };
    }
    case 'finish': { // the race's last leg: Finesse or Nerve
      if (!mine || state.kind !== 'race') throw new Error('You aren’t in the race.');
      mine.finish = a.skill === 'nerve' ? 'nerve' : 'finesse';
      return { finish: mine.finish };
    }
    case 'bet': {
      const on = entrant(clean(a.on, 20));
      if (!on) throw new Error('Pick who you’re backing.');
      const amount = cents(Math.min(5, Math.max(0.05, Number(a.amount) || 0)));
      const old = state.bets.find((b) => b.pc === pc.id);
      if (old) { ctx.pay(pc, old.amount); state.bets = state.bets.filter((b) => b !== old); }
      charge(amount, 'That bet');
      state.bets.push({ pc: pc.id, name: pc.name, on: on.key, amount });
      ctx.log(`${pc.name} puts $${amount.toFixed(2)} on ${on.name}.`);
      return { bet: amount };
    }
    case 'unbet': {
      const old = state.bets.find((b) => b.pc === pc.id);
      if (!old) throw new Error('You haven’t placed a bet.');
      ctx.pay(pc, old.amount); state.bets = state.bets.filter((b) => b !== old);
      return { unbet: true };
    }
    default: throw new Error('Unknown action.');
  }
}

function basePool(e, skill, ctx) { return e.kind === 'pc' ? pcPool(ctx.pc(e.pc), skill) : ctx.npcPool(e, skill); }
const Cap = (s) => s[0].toUpperCase() + s.slice(1);
const spurOf = (e, talent, ctx) => (e.kind === 'pc' ? (ctx.pc(e.pc)?.talents || []).includes(talent) : false);

function runRace(state, ctx) {
  const total = Object.fromEntries(state.entrants.map((e) => [e.key, 0]));
  const legs = LEGS.map(([name, fixed], i) => {
    const rolls = {};
    for (const e of state.entrants) {
      const skill = fixed || e.finish || 'finesse';
      const hd = horseDice(e.horse, i), pool = add(basePool(e, skill, ctx), hd.black, hd.gold);
      const r = ctx.roll(e, pool, `Horse race · ${name} · ${Cap(skill)}`, spurOf(e, Cap(skill), ctx));
      rolls[e.key] = { hits: r.hits, skill, dice: r.dice };
      total[e.key] += r.hits;
    }
    return { name, rolls };
  });
  let best = Math.max(...Object.values(total)), lead = state.entrants.filter((e) => total[e.key] === best).map((e) => e.key);
  const photo = [];
  for (let n = 0; lead.length > 1 && n < 10; n += 1) { // photo finish: 1B each until it's broken
    const hits = Object.fromEntries(lead.map((k) => [k, ctx.roll(state.entrants.find((e) => e.key === k), { black: 1, gold: 0 }, 'Horse race · photo finish', false).hits]));
    photo.push(hits);
    const top = Math.max(...Object.values(hits));
    lead = lead.filter((k) => hits[k] === top);
  }
  const order = state.entrants.map((e) => e.key).sort((x, y) => total[y] - total[x]);
  const text = `${lead.map((k) => state.entrants.find((e) => e.key === k).name).join(' and ')} win${lead.length > 1 ? '' : 's'} the race with ${best} lengths${photo.length ? ' after a photo finish' : ''}!`;
  return { kind: 'race', legs, total, order, photo, winners: lead, text };
}

function runTrickshot(state, ctx) {
  const wins = Object.fromEntries(state.entrants.map((e) => [e.key, 0]));
  const shoot = (trick, keys, extra = false) => {
    const [name, target] = trick, shots = {};
    for (const k of keys) {
      const e = state.entrants.find((x) => x.key === k);
      const f = ctx.roll(e, basePool(e, 'finesse', ctx), `Trick shot · ${name} (${target}) · Finesse`, spurOf(e, 'Finesse', ctx));
      const aim = f.hits >= target;
      const p = ctx.roll(e, PISTOL, `Trick shot · ${name} · Finncaster Green${aim ? ' (Aim)' : ''}`, spurOf(e, 'Pistols', ctx), aim);
      shots[k] = { skill: f.hits, aim, hits: p.hits, dice: p.dice };
    }
    let top = Math.max(...keys.map((k) => shots[k].hits)), lead = keys.filter((k) => shots[k].hits === top);
    const rerolls = [];
    for (let n = 0; lead.length > 1 && n < 10; n += 1) { // p. 109: a tie rerolls the pistol until it isn't
      const again = Object.fromEntries(lead.map((k) => [k, ctx.roll(state.entrants.find((x) => x.key === k), PISTOL, `Trick shot · ${name} · tie-breaker`, spurOf(state.entrants.find((x) => x.key === k), 'Pistols', ctx)).hits]));
      rerolls.push(again);
      top = Math.max(...Object.values(again)); lead = lead.filter((k) => again[k] === top);
    }
    if (lead.length === 1) wins[lead[0]] += 1;
    return { trick: name, target, desc: trick[2], shots, rerolls, winner: lead.length === 1 ? lead[0] : null, extra };
  };
  const rounds = TRICK_SETS[state.rounds].map((i) => shoot(TRICKS[i], state.entrants.map((e) => e.key)));
  let most = Math.max(...Object.values(wins)), lead = state.entrants.filter((e) => wins[e.key] === most).map((e) => e.key);
  for (let n = 0; lead.length > 1 && n < 5; n += 1) { // a tie on rounds: another Blindfold Shot between them
    const r = shoot(TRICKS[4], lead, true); rounds.push(r);
    if (r.winner) lead = [r.winner];
  }
  const names = lead.map((k) => state.entrants.find((e) => e.key === k).name);
  return { kind: 'trickshot', rounds, wins, winners: lead, text: `${names.join(' and ')} win${lead.length > 1 ? '' : 's'} the trick-shot contest${lead.length === 1 ? ` with ${wins[lead[0]]} round${wins[lead[0]] === 1 ? '' : 's'} won` : ''}!` };
}

// the pot to the winner(s), the side-bet pool to whoever backed them
function settle(state, ctx, payTo) {
  const r = state.result, win = r.winners.map((k) => state.entrants.find((e) => e.key === k));
  const pot = cents(state.entrants.reduce((s, e) => s + e.paid, 0));
  const share = cents(pot / win.length);
  for (const e of win) payTo(e, share);
  r.pot = pot; r.share = share;
  const pool = cents(state.bets.reduce((s, b) => s + b.amount, 0)), backers = state.bets.filter((b) => r.winners.includes(b.on));
  const backed = backers.reduce((s, b) => s + b.amount, 0);
  r.bets = state.bets.map((b) => ({ ...b, won: backers.includes(b) ? cents(pool * b.amount / backed) : 0 }));
  for (const b of r.bets.filter((x) => x.won)) { const pc = ctx.pc(b.pc); if (pc) ctx.pay(pc, b.won); }
  r.betPool = pool;
  ctx.log(`${r.text} ${pot ? `The pot of $${pot.toFixed(2)} goes to ${win.map((e) => e.name).join(' and ')}.` : ''}${pool ? (backers.length ? ` Side bets: ${r.bets.filter((b) => b.won).map((b) => `${b.name} collects $${b.won.toFixed(2)}`).join(', ')}.` : ' Nobody backed the winner; the bookie keeps the side bets.') : ''}`.trim());
}

export function contestView(state, { pc = '', warden = false } = {}) {
  return {
    v: state.v, open: state.open, kind: state.kind, name: KINDS[state.kind] || '', at: state.at, where: state.where, fee: state.fee, rent: state.rent, rounds: state.rounds,
    entrants: state.entrants.map(({ key, kind, pc: id, name, tough, horse, finish, paid }) => ({ key, kind, pc: id || '', name, tough: tough || '', horse: horse || null, finish: finish || '', paid,
      horseDice: horse ? LEGS.map((_, i) => horseDice(horse, i)) : null })),
    pot: cents(state.entrants.reduce((s, e) => s + e.paid, 0)),
    bets: warden ? state.bets : state.bets.map((b) => ({ on: b.on, amount: b.amount, mine: b.pc === pc, name: b.name })),
    result: state.result, breeds: BREED_DICE, bond: BOND_DICE, tricks: TRICKS, trickSet: TRICK_SETS[state.rounds] || [],
  };
}
