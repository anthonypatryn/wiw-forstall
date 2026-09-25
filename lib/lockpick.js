// Lock picking — a High/Low card game. The deck lives only on the server; players see just their current card.
// Rules (from the user): standard 52-card deck, no jokers. Guess Higher or Lower than the current card.
// Strictly higher/lower wins; a TIE LOSES. After a win the new card is the current card and you guess again.
// Win `need` rounds in a row (the Warden's difficulty, 1–5) and the lock opens; one wrong guess and it doesn't.
// Aces: an Ace as the first (starter) card → the player chooses high or low; an Ace drawn as the next card is always high.
// Extras: before the cards, roll Finesse — each Hit is one peek at the next card's color. After a failure the player may
// try again by paying the cost the Warden set (up to the Warden's retry limit): fresh deck, peeks re-rolled.
import crypto from 'node:crypto';

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const int = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
export const freshLocks = () => ({ v: 0, list: [] });
export const red = (c) => c.s === '♥' || c.s === '♦';
export const label = (c) => `${RANK[c.r] || c.r}${c.s}`;

export function newDeck(rand = (n) => crypto.randomInt(n)) {
  const d = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push({ r, s }); // 14 = Ace
  for (let i = d.length - 1; i > 0; i--) { const j = rand(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// deal the starter card; an Ace here waits for the player to call it high or low
function deal(a, deck) {
  a.deck = deck; a.cur = a.deck.pop(); a.curVal = a.cur.r; a.wins = 0; a.history = []; a.peek = null;
  a.status = a.cur.r === 14 ? 'ace' : 'playing';
}

export function lockAction(state, x, { warden, names = {}, rollFinesse, log = () => {}, deck }) {
  const find = () => { const a = state.list.find((l) => l.id === x.id); if (!a) throw new Error('That lock is gone.'); return a; };
  const mine = (a) => { if (!warden && a.pc !== clean(x.pc, 12)) throw new Error('That’s someone else’s lock.'); };
  switch (x.action) {
    case 'start': { // the Warden hands one or more players a lock
      if (!warden) throw new Error('Warden PIN required.');
      const who = x.to === 'all' ? Object.keys(names) : (Array.isArray(x.to) ? x.to.filter((p) => names[p]) : []);
      if (!who.length) throw new Error('Pick who picks the lock.');
      const need = int(x.difficulty, 1, 5), retries = int(x.retries, 0, 5), cost = clean(x.retryCost, 60), what = clean(x.what, 60) || 'a lock';
      const made = who.map((pc) => ({ id: crypto.randomUUID().slice(0, 8), pc, name: names[pc], what, need, retriesLeft: retries, retryCost: cost, tries: 1, peeks: 0, status: 'finesse', at: Date.now(), wins: 0, history: [] }));
      state.list = [...made, ...state.list].slice(0, 60);
      log(null, `Lock pick sent to ${made.map((a) => a.name).join(', ')}: ${what}, ${need} in a row`);
      return { ids: made.map((a) => a.id) };
    }
    case 'finesse': { // roll Finesse first: each Hit = one peek at the next card's color
      const a = find(); mine(a);
      if (a.status !== 'finesse') throw new Error('Already rolled.');
      const r = rollFinesse(a.pc);
      a.peeks = r.hits;
      deal(a, deck?.() || newDeck());
      return { roll: r, peeks: a.peeks };
    }
    case 'ace': { // the starter card is an Ace: call it high or low
      const a = find(); mine(a);
      if (a.status !== 'ace') throw new Error('No Ace to call.');
      a.curVal = x.value === 'low' ? 1 : 14; a.status = 'playing';
      return { value: a.curVal };
    }
    case 'peek': {
      const a = find(); mine(a);
      if (a.status !== 'playing') throw new Error('Nothing to peek at.');
      if (a.peek) return { color: a.peek };
      if (a.peeks < 1) throw new Error('No peeks left.');
      a.peeks -= 1; a.peek = red(a.deck[a.deck.length - 1]) ? 'red' : 'black';
      return { color: a.peek };
    }
    case 'guess': {
      const a = find(); mine(a);
      if (a.status !== 'playing') throw new Error('Not your move right now.');
      const dir = x.dir === 'lower' ? 'lower' : 'higher';
      const next = a.deck.pop(), nextVal = next.r; // an Ace drawn next is always high (14)
      const ok = dir === 'higher' ? nextVal > a.curVal : nextVal < a.curVal; // ties lose
      a.history.push({ from: a.cur, fromVal: a.curVal, dir, card: next, ok });
      a.peek = null;
      if (!ok) {
        a.status = 'failed';
        log(`${a.name}’s pick slips on ${a.what} — ${a.wins} of ${a.need} pins set.${a.retriesLeft ? ' They can try again.' : ''}`);
        return { ok, card: next, status: a.status };
      }
      a.wins += 1; a.cur = next; a.curVal = nextVal;
      if (a.wins >= a.need) { a.status = 'picked'; log(`Click! ${a.name} picks ${a.what} (${a.need} in a row).`); }
      return { ok, card: next, status: a.status, wins: a.wins };
    }
    case 'retry': {
      const a = find(); mine(a);
      if (a.status !== 'failed') throw new Error('Nothing to retry.');
      if (a.retriesLeft < 1) throw new Error('No more tries on this one.');
      a.retriesLeft -= 1; a.tries += 1; a.status = 'finesse'; a.peeks = 0; a.wins = 0; a.history = []; a.cur = null; a.deck = null;
      log(`${a.name} ${a.retryCost ? `pays ${a.retryCost} and ` : ''}tries ${a.what} again.`);
      return;
    }
    case 'giveUp': { const a = find(); mine(a); if (['picked', 'failed'].includes(a.status)) a.closed = true; else { a.status = 'failed'; a.closed = true; log(`${a.name} leaves ${a.what} be.`); } return; }
    case 'clear': if (!warden) throw new Error('Warden PIN required.'); state.list = state.list.filter((a) => a.id !== x.id); return;
    default: throw new Error('Unknown action.');
  }
}

// players never see the deck — only their current card, progress and history
export function lockView(state, { warden, pc }) {
  const pub = ({ deck, ...a }) => ({ ...a, left: deck ? deck.length : null });
  return { v: state.v, list: state.list.filter((a) => warden || (a.pc === pc && !a.closed)).map(pub) };
}
