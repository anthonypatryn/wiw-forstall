// Wanted posters, pinned up town by town. The Warden adds, edits, moves, hides and pays them out; the posse reads them.
// A poster's town is a Map place id (a Guidebook town/settlement, or a Warden pin) or one of the Warden's own towns here.
import crypto from 'node:crypto';
import { PLACES } from './places.js';
import { bountyQuest, bountySync } from './journal.js';

const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const id = () => crypto.randomUUID().slice(0, 8);
export const TERMS = ['Dead or Alive', 'Alive only', 'Dead only'];
export const STATUS = ['wanted', 'captured', 'dead', 'claimed'];
const BOOK_TOWNS = PLACES.filter((p) => ['town', 'settlement', 'rail'].includes(p.kind)).map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y }));
export const freshWanted = () => ({ v: 0, posters: [], towns: [] });
const money = (v) => Math.max(0, Math.round((Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0) * 100) / 100);

// every town a poster can hang in: the book's, the Warden's map pins, and towns made here
export function allTowns(state, pins = []) {
  return [...BOOK_TOWNS, ...pins.map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, shared: p.shared })), ...(state.towns || [])];
}

export function wantedAction(state, a, { warden, towns = [], posse = [], log = () => {}, journal = null }) {
  if (a.action === 'take') { // a player takes the bounty: the first taker makes it a Journal quest, others join it
    const p = state.posters.find((x) => x.id === a.id && !x.hidden);
    if (!p) throw new Error('That poster is gone.');
    if (p.status !== 'wanted') throw new Error('Somebody already brought them in.');
    const pc = posse.find((c) => c.id === clean(a.pc, 12) && !c.dead);
    if (!pc) throw new Error('Pick who you’re playing first (the “This is me” star on your sheet).');
    p.takenBy ||= [];
    if (p.takenBy.includes(pc.id)) return p;
    p.takenBy.push(pc.id);
    const townName = towns.find((t) => t.id === p.town)?.name || 'town';
    if (journal && !(journal.quests || []).some((q) => q.bounty === p.id)) p.quest = bountyQuest(journal, p, townName).id;
    log(`${pc.name} takes the bounty on ${p.name}${p.reward ? ` ($${p.reward})` : ''}. It’s in the Journal.`);
    return p;
  }
  if (!warden) throw new Error('Warden PIN required.');
  const find = () => { const p = state.posters.find((x) => x.id === a.id); if (!p) throw new Error('That poster is gone.'); return p; };
  const town = (t) => { const tid = clean(t, 40); if (!towns.some((x) => x.id === tid)) throw new Error('Pick a town for the poster.'); return tid; };
  const fields = (p) => {
    if (a.name !== undefined) p.name = clean(a.name, 60);
    if (a.alias !== undefined) p.alias = clean(a.alias, 60);
    if (a.crime !== undefined) p.crime = clean(a.crime, 300);
    if (a.reward !== undefined) p.reward = money(a.reward);
    if (a.terms !== undefined) p.terms = TERMS.includes(a.terms) ? a.terms : 'Dead or Alive';
    if (a.town !== undefined) p.town = town(a.town);
    if (a.npcId !== undefined) p.npcId = clean(a.npcId, 12);
    if (a.pcId !== undefined) p.pcId = clean(a.pcId, 12);
    if (a.wardenNote !== undefined) p.wardenNote = clean(a.wardenNote, 1000);
    if (a.hidden !== undefined) p.hidden = !!a.hidden;
    if (a.status !== undefined) p.status = STATUS.includes(a.status) ? a.status : 'wanted';
  };
  switch (a.action) {
    case 'addTown': {
      const name = clean(a.name, 60);
      if (!name) throw new Error('Name the town.');
      const t = { id: `wt-${id()}`, name };
      state.towns = [...(state.towns || []), t];
      return t;
    }
    case 'removeTown':
      if (state.posters.some((p) => p.town === a.id)) throw new Error('Move or remove its posters first.');
      state.towns = (state.towns || []).filter((t) => t.id !== a.id);
      return;
    case 'add': {
      const p = { id: id(), name: '', alias: '', crime: '', reward: 0, terms: 'Dead or Alive', town: town(a.town), npcId: '', pcId: '', img: null, status: 'wanted', claimedBy: '', wardenNote: '', hidden: false, at: Date.now() };
      fields(p);
      if (!p.name) throw new Error('Who’s wanted? Give them a name.');
      state.posters = [p, ...state.posters].slice(0, 300);
      if (!p.hidden) log(`A new WANTED poster goes up in ${towns.find((t) => t.id === p.town)?.name || 'town'}: ${p.name}${p.reward ? `, $${p.reward} reward` : ''}.`);
      return p;
    }
    case 'edit': {
      const p = find(), wasHidden = p.hidden;
      fields(p);
      if (!p.name) throw new Error('A poster needs a name.');
      if (journal) bountySync(journal, p);
      if (wasHidden && !p.hidden) log(`A new WANTED poster goes up in ${towns.find((t) => t.id === p.town)?.name || 'town'}: ${p.name}${p.reward ? `, $${p.reward} reward` : ''}.`);
      return p;
    }
    case 'remove': { const p = find(); if (journal) bountySync(journal, p, true); state.posters = state.posters.filter((x) => x.id !== a.id); return; }
    // split the reward between the chosen characters; Cut of the Profit (Gunslinger ability) adds 20% to theirs
    case 'payout': {
      const p = find();
      if (p.status === 'claimed') throw new Error('That bounty has already been paid.');
      const who = (Array.isArray(a.to) ? a.to : []).map((x) => posse.find((c) => c.id === x && !c.dead)).filter(Boolean);
      if (!who.length) throw new Error('Pick who collects the bounty.');
      if (!p.reward) throw new Error('This poster has no reward to pay.');
      const share = Math.floor((p.reward / who.length) * 100) / 100;
      const bonus = new Set(Array.isArray(a.bonus) ? a.bonus : []);
      const paid = who.map((c) => {
        const amt = Math.round(share * (bonus.has(c.id) ? 1.2 : 1) * 100) / 100;
        c.wallet = (money(c.wallet) + amt).toFixed(2);
        c.updated = Date.now();
        return { id: c.id, name: c.name, amount: amt, bonus: bonus.has(c.id) };
      });
      Object.assign(p, { status: 'claimed', claimedBy: paid.map((x) => x.name).join(', '), paid, claimedAt: Date.now() });
      if (journal) bountySync(journal, p);
      log(`Bounty paid on ${p.name}: ${paid.map((x) => `${x.name} $${x.amount.toFixed(2)}${x.bonus ? ' (Cut of the Profit)' : ''}`).join(', ')}.`);
      return paid;
    }
    default: throw new Error('Unknown action.');
  }
}

// the posse sees posters that are up (not hidden), without the Warden's notes
export function wantedView(state, { warden, towns = [] }) {
  const posters = warden ? state.posters : state.posters.filter((p) => !p.hidden).map(({ wardenNote, ...p }) => p);
  return { v: state.v, posters, towns: towns.filter((t) => warden || t.shared !== false) };
}
