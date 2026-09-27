// The Traveling Carnival of Wild Oddities and Western Curiosities (Judgment on the Iron Road pp. 62–67, Omaha).
// The Warden opens it; each character buys a $0.25 ticket, plays the games with their own sheet's dice, wins prize
// vouchers (small / medium / large) and trades them at the prize booth for a knick-knack in their Inventory.
// House rules where the book leaves a gap: Archery and the Pie Eating Contest pit you against carnies (the book wants
// two or three players at once); the High Striker's first swing comes with the ticket; the Greased Pig Chase (narrative in
// the book) is three grabs at Finesse needing 3 Hits each, a small voucher if you catch it.
import { cents, money, clean } from './util.js';

export const TICKET = 0.25, STRIKER_RETRY = 0.25;
export const PRIZES = {
  small: [['Tin Sheriff’s Star', 'Bent at one corner, but still shines proud. Might even earn a free drink in the right saloon.'],
    ['Wooden Whistle', 'Carved like a coyote or snake. Loud enough to annoy, not loud enough to save you.'],
    ['Candy Twist', 'A striped stick of hardened molasses and spice, wrapped in wax paper. Surprisingly good.']],
  medium: [['Pocket Compass', 'Points north …most of the time. Housed in scratched brass with initials carved on the back.'],
    ['Stuffed Jackalope Doll', 'Handmade from burlap and buttons. One ear’s a bit lopsided. Kids love ’em. Adults ain’t sure.'],
    ['Snake Oil Sampler', 'Three tiny glass vials with suspiciously colored liquids labeled “Luck,” “Courage,” and “Vigor.” Who knows what they do?']],
  large: [['Sombrero con Campanas', 'A wide-brimmed sombrero with colorful tassels, each ending in a tiny brass bell that jingles with every step or nod.'],
    ['Monster Fang Necklace', 'A hand-carved replica of a Sabertooth Mountain Lion fang but much smaller. A great conversation starter.'],
    ['Two-Pound Turkey Leg', 'A massive, slow-roasted turkey leg slathered in spiced glaze and wrapped in wax paper. Smells like victory!']],
};
// Wheel of Fortune (p. 64): 2B, the payout as a multiple of the stake (0 = lose it)
const WHEEL = { 'blank,blank': 0, 'blank,hit': 0, 'blank,spur': 2, 'ace,blank': 2, 'hit,spur': 2, 'hit,hit': 2, 'ace,hit': 2, 'spur,spur': 3, 'ace,spur': 3, 'ace,ace': 4 };
export const wheelPayout = (faces) => WHEEL[[...faces].sort().join(',')] ?? 0;
export const FORTUNES = {
  good: ['“You’ll come across someone soon who owes you more than they let on. Could be money, could be gratitude. Whatever the case, they’ll pay up.”',
    '“A risky move you’ve been considerin’ is gonna work out better than you thought. Don’t wait too long to make it.”',
    '“You’ll find somethin’ valuable soon. Might be tucked in a saddlebag, buried in the dirt, or sittin’ in plain sight.”',
    '“You’re fixin’ to earn respect from someone important. When it happens, keep ’em close and they’ll open doors.”'],
  bad: ['“Someone’s talkin’ about you behind your back and it ain’t friendly. Watch who you trust these next few days.”',
    '“There’s trouble waitin’ at the next stop. Gun trouble, maybe worse. Best be ready for a fight.”',
    '“You’re gonna lose somethin’ small that causes a big problem. Could be a map, a letter, or even a few wrong words.”',
    '“You’ll recognize someone soon, but they won’t recognize you and that’s gonna hurt.”'],
};
const FACE_ROW = { blank: 0, spur: 1, hit: 2, ace: 3 };
const CARNIES = ['Big Hal', 'Peg-Leg Lou'];
const SIZES = ['small', 'medium', 'large'];

export const freshCarnival = () => ({ v: 0, open: false, where: 'Omaha', at: 0, tickets: {}, vouchers: {}, swung: {}, last: {} });

// ctx: pc(id) → character, pay(pc, dollars) (negative = charge), roll(pc, skill | {black,gold}, label, spurSkill) → {hits, dice},
//      give(pc, name, note) → inventory row, log(text)
export function carnivalAction(state, a, ctx) {
  if (a.action === 'open' || a.action === 'close') {
    if (!ctx.warden) throw new Error('Warden PIN required.');
    if (a.action === 'open') {
      Object.assign(state, freshCarnival(), { v: state.v, open: true, where: clean(a.where, 40) || 'Omaha', at: Date.now() });
      ctx.log(`The Traveling Carnival of Wild Oddities and Western Curiosities opens in ${state.where}! Tickets are $0.25.`);
    } else { state.open = false; ctx.log('The carnival packs up its tents.'); }
    return { open: state.open };
  }
  if (!state.open) throw new Error('The carnival isn’t in town.');
  const pc = ctx.pc(clean(a.pc, 12));
  if (!pc || pc.dead) throw new Error('Pick who you’re playing first (the “This is me” star on your sheet).');
  const v = (state.vouchers[pc.id] ||= { small: 0, medium: 0, large: 0 });
  const win = (size, why) => { v[size] += 1; ctx.log(`${pc.name} wins a ${size} prize voucher at the ${why}!`); };
  const done = (game, text, extra = {}) => { state.last[pc.id] = { game, text, at: Date.now(), ...extra }; return state.last[pc.id]; };
  const charge = (amount, what) => {
    if (money(pc.wallet) < amount) throw new Error(`${what} costs $${amount.toFixed(2)}, and ${pc.name} has $${money(pc.wallet).toFixed(2)}.`);
    ctx.pay(pc, -amount);
  };
  if (a.action === 'ticket') {
    if (state.tickets[pc.id]) throw new Error('You already have a ticket.');
    charge(TICKET, 'A ticket');
    state.tickets[pc.id] = true;
    ctx.log(`${pc.name} buys a carnival ticket.`);
    return done('ticket', 'Ticket in hand. Step right up!');
  }
  if (a.action === 'prize' || a.action === 'swap') { // the prize booth
    if (a.action === 'swap') {
      const from = SIZES.indexOf(a.from), to = SIZES.indexOf(a.to);
      if (from < 0 || to < 0 || Math.abs(from - to) !== 1) throw new Error('Swap two small for a medium, two medium for a large, or back down.');
      const cost = to > from ? 2 : 1, get = to > from ? 1 : 2;
      if (v[a.from] < cost) throw new Error(`You need ${cost} ${a.from} voucher${cost > 1 ? 's' : ''}.`);
      v[a.from] -= cost; v[a.to] += get;
      return done('booth', `Swapped ${cost} ${a.from} for ${get} ${a.to}.`);
    }
    const size = SIZES.find((s) => PRIZES[s].some(([n]) => n === a.prize));
    if (!size) throw new Error('Pick a prize.');
    if (!v[size]) throw new Error(`That takes a ${size} voucher.`);
    v[size] -= 1;
    const [name, note] = PRIZES[size].find(([n]) => n === a.prize);
    ctx.give(pc, name, note);
    ctx.log(`${pc.name} trades a ${size} voucher for a ${name}.`);
    return done('booth', `${name} is in your Inventory.`);
  }
  if (!state.tickets[pc.id]) throw new Error('Buy a ticket first ($0.25).');
  switch (a.action) {
    case 'horseshoe': { // p. 64: Finesse three times, targets 2, 3, 4; all three = a small voucher
      const tosses = [2, 3, 4].map((target, i) => ({ target, hits: ctx.roll(pc, 'finesse', `Horseshoe Toss ${i + 1} · Finesse`).hits }));
      const all = tosses.every((t) => t.hits >= t.target);
      if (all) win('small', 'Horseshoe Toss');
      return done('horseshoe', all ? 'Three ringers! A small prize voucher.' : `${tosses.filter((t) => t.hits >= t.target).length} of 3 ringers. No prize this time.`, { tosses });
    }
    case 'wheel': { // p. 64: pay $0.05–$1.00, roll 2B
      const stake = cents(Math.min(1, Math.max(0.05, Number(a.stake) || 0.05)));
      charge(stake, 'That spin');
      const r = ctx.roll(pc, { black: 2, gold: 0 }, 'Wheel of Fortune');
      const mult = wheelPayout(r.dice.map((d) => d.face));
      if (mult) ctx.pay(pc, stake * mult);
      ctx.log(`${pc.name} spins the Wheel of Fortune for $${stake.toFixed(2)}: ${mult ? `${['', '', 'double', 'triple', 'quadruple'][mult]} their money ($${(stake * mult).toFixed(2)})` : 'loses it'}.`);
      const faces = r.dice.map((d) => d.face);
      return done('wheel', mult ? `${['', '', 'Double', 'Triple', 'Quadruple'][mult]} your money: $${(stake * mult).toFixed(2)}!` : 'The arrow lands on a loser. The money’s gone.', { mult, stake, faces });
    }
    case 'archery': { // p. 65: 3B a shot, five shots, most Hits wins a medium voucher (house rule: against a carnie)
      let me = 0, carnie = 0;
      const shots = [], shoot = (label) => {
        const a = ctx.roll(pc, { black: 3, gold: 0 }, label, 'Bows').hits, b = ctx.roll(null, { black: 3, gold: 0 }, label, null, CARNIES[0]).hits;
        me += a; carnie += b; shots.push({ me: a, carnie: b });
      };
      for (let i = 0; i < 5; i += 1) shoot(`Archery shot ${i + 1}`);
      while (me === carnie && shots.length < 15) shoot('Archery shoot-off');
      if (me > carnie) win('medium', 'Archery Competition');
      return done('archery', me > carnie ? `${me} Hits to ${CARNIES[0]}’s ${carnie}. A medium prize voucher!` : `${me} Hits to ${CARNIES[0]}’s ${carnie}. ${CARNIES[0]} tips his hat.`, { me, carnie, shots });
    }
    case 'striker': { // p. 65: Nerve, 5 Hits rings the bell (large voucher); another try is $0.25
      if (state.swung[pc.id]) charge(STRIKER_RETRY, 'Another swing');
      state.swung[pc.id] = true;
      const r = ctx.roll(pc, 'nerve', 'High Striker · Nerve');
      if (r.hits >= 5) win('large', 'High Striker');
      return done('striker', r.hits >= 5 ? `DING! ${r.hits} Hits rings the bell. A large prize of your choice!` : `${r.hits} Hit${r.hits === 1 ? '' : 's'}. The puck falls short. Another swing is $0.25.`, { hits: r.hits });
    }
    case 'fortune': { // p. 65: Hit/Ace = a positive fortune, Blank/Spur = negative; then 1B picks it
      const pick = ctx.roll(pc, { black: 1, gold: 0 }, 'Fortune Teller');
      const good = ['hit', 'ace'].includes(pick.dice[0]?.face);
      const which = ctx.roll(pc, { black: 1, gold: 0 }, 'Fortune Teller');
      const text = FORTUNES[good ? 'good' : 'bad'][FACE_ROW[which.dice[0]?.face] ?? 0];
      ctx.log(`The fortune teller reads ${pc.name}’s palm: ${text}`);
      return done('fortune', text, { good });
    }
    case 'pie': { // p. 66: Nerve each round, target 2 then +1 a round; the last one(s) left win a medium voucher (house rule: two carnies eat too)
      let target = 2, left = [pc.name, ...CARNIES];
      const rounds = [];
      while (left.length > 1 && target < 12) {
        const hits = Object.fromEntries(left.map((who) => [who, ctx.roll(who === pc.name ? pc : null, who === pc.name ? 'nerve' : { black: 3, gold: 0 }, `Pie Eating (needs ${target}) · Nerve`, null, who === pc.name ? null : who).hits]));
        const ok = left.filter((who) => hits[who] >= target);
        rounds.push({ target, hits, ok });
        if (!ok.length) break; // everyone left went down together: they share the win
        left = ok; target += 1;
      }
      const won = left.includes(pc.name);
      if (won) win('medium', 'Pie Eating Contest');
      return done('pie', won ? `${left.length > 1 ? 'You tie for the win' : 'Last one eating'} after ${rounds.length} round${rounds.length === 1 ? '' : 's'} of strawberry rhubarb pie. A medium prize voucher!` : `Out in round ${rounds.findIndex((r) => !r.ok.includes(pc.name)) + 1}. ${left.join(' and ')} keep${left.length > 1 ? '' : 's'} eating.`, { rounds, eaters: [pc.name, ...CARNIES], left });
    }
    case 'pig': { // house rule: three grabs at the greased pig, Finesse needing 3 Hits; catch it for a small voucher
      const grabs = [];
      for (let i = 0; i < 3; i += 1) { const h = ctx.roll(pc, 'finesse', `Greased Pig grab ${i + 1} · Finesse`).hits; grabs.push(h); if (h >= 3) break; }
      const caught = grabs.at(-1) >= 3;
      if (caught) win('small', 'Greased Pig Chase');
      return done('pig', caught ? `Got it on grab ${grabs.length}! Covered in grease, but a small prize voucher is yours.` : 'Three grabs and the pig squirts free every time. The crowd howls.', { grabs, caught });
    }
    default: throw new Error('Unknown game.');
  }
}

export function carnivalView(state, { pc = '', warden = false } = {}) {
  const mine = (id) => ({ ticket: !!state.tickets[id], vouchers: state.vouchers[id] || { small: 0, medium: 0, large: 0 }, swung: !!state.swung[id], last: state.last[id] || null });
  return { v: state.v, open: state.open, where: state.where, at: state.at, prizes: PRIZES, ticket: TICKET, retry: STRIKER_RETRY,
    me: pc ? mine(pc) : null, ...(warden ? { all: Object.fromEntries(Object.keys({ ...state.tickets, ...state.vouchers }).map((id) => [id, mine(id)])) } : {}) };
}
