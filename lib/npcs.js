// Shared NPC ledger: strangers dealt from the name deck, with posse notes and private Warden notes.
import crypto from 'node:crypto';
import { BOOK_NPCS } from './booknpcs.js';
import { cleanKeepSpaces as clean } from './util.js'; // notes autosave while typed: keep their spaces

// Factions: the Guidebook's seven (pp. 120–133) plus any the Warden invents.
// A Warden-made faction stays secret until they mark the posse as knowing it.
const BOOK_FACTIONS = BOOK_NPCS.factions.map((f) => ({ id: `book-${f.page}`, name: f.faction, page: f.page, book: true, known: true, desc: '' }));
const allFactions = (state) => [...BOOK_FACTIONS, ...(state.factions || [])];

const MAX = 200;

export function freshNpcs() { return { v: 0, npcs: [], factions: [] }; }

export function npcAction(state, a, { warden }) {
  const find = () => { const n = state.npcs.find((x) => x.id === a.id); if (!n) throw new Error('No such NPC.'); return n; };
  switch (a.action) {
    case 'posseNote': { const n = find(); if (!n.known && !warden) throw new Error('No such NPC.'); n.posseNotes = clean(a.text, 3000); return; }
    case 'where': { const n = find(); if (!n.known && !warden) throw new Error('No such NPC.'); n.where = clean(a.text, 80); return; }
  }
  if (!warden) throw new Error('Warden PIN required.');
  switch (a.action) {
    case 'add': {
      const name = clean(a.name, 60).trim();
      if (!name) throw new Error('Name required.');
      const npc = {
        id: crypto.randomUUID().slice(0, 8), name,
        personality: clean(a.personality, 140), physical: clean(a.physical, 180),
        where: clean(a.where, 80), posseNotes: clean(a.posseNotes, 3000), wardenNotes: clean(a.wardenNotes, 3000),
        faction: clean(a.faction, 60), img: clean(a.img, 60),
        // A Warden prepping NPCs keeps them hidden until the posse meets them.
        known: a.known !== false, at: Date.now(),
      };
      state.npcs = [npc, ...state.npcs].slice(0, MAX);
      return npc;
    }
    case 'wardenNote': find().wardenNotes = clean(a.text, 3000); return;
    case 'known': find().known = !!a.value; return;
    case 'rename': { const n = find(); n.name = clean(a.name, 60).trim() || n.name; return; }
    case 'remove': state.npcs = state.npcs.filter((x) => x.id !== a.id); return;
    case 'setFaction': { // put an NPC in a faction ('' = none)
      const n = find(), f = clean(a.faction, 60).trim();
      if (f && !allFactions(state).some((x) => x.name === f)) throw new Error('Unknown faction.');
      n.faction = f; return;
    }
    case 'addFaction': {
      const name = clean(a.name, 60).trim();
      if (!name) throw new Error('Name the faction.');
      if (allFactions(state).some((x) => x.name.toLowerCase() === name.toLowerCase())) throw new Error('That faction already exists.');
      const f = { id: crypto.randomUUID().slice(0, 8), name, desc: clean(a.desc, 1000), known: a.known !== false, at: Date.now() };
      (state.factions ||= []).push(f);
      return f;
    }
    case 'editFaction': {
      const f = (state.factions || []).find((x) => x.id === a.id);
      if (!f) throw new Error('Only factions you made can be edited.');
      if (a.desc !== undefined) f.desc = clean(a.desc, 1000);
      if (a.known !== undefined) f.known = !!a.known;
      return;
    }
    case 'removeFaction': {
      const f = (state.factions || []).find((x) => x.id === a.id);
      if (!f) throw new Error('Only factions you made can be removed.');
      state.factions = state.factions.filter((x) => x !== f);
      state.npcs.forEach((n) => { if (n.faction === f.name) n.faction = ''; });
      return;
    }
    default: throw new Error('Unknown action.');
  }
}

export function npcView(state, { warden }) {
  const factions = allFactions(state).filter((f) => warden || f.known);
  const public_ = new Set(factions.map((f) => f.name));
  return {
    v: state.v,
    factions,
    npcs: warden ? state.npcs : state.npcs.filter((n) => n.known).map(({ wardenNotes, ...n }) => ({ ...n, faction: public_.has(n.faction) ? n.faction : '' })),
  };
}
