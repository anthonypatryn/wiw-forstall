// Shared NPC ledger: strangers dealt from the name deck, with posse notes and private Warden notes.
import crypto from 'node:crypto';

const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').slice(0, n);
const MAX = 200;

export function freshNpcs() { return { v: 0, npcs: [] }; }

export function npcAction(state, a, { warden }) {
  const find = () => { const n = state.npcs.find((x) => x.id === a.id); if (!n) throw new Error('No such NPC.'); return n; };
  switch (a.action) {
    case 'add': {
      const name = clean(a.name, 60).trim();
      if (!name) throw new Error('Name required.');
      const npc = {
        id: crypto.randomUUID().slice(0, 8), name,
        personality: clean(a.personality, 60), physical: clean(a.physical, 80),
        where: warden ? clean(a.where, 80) : '', posseNotes: clean(a.posseNotes, 3000), wardenNotes: warden ? clean(a.wardenNotes, 3000) : '',
        faction: clean(a.faction, 60), img: warden ? clean(a.img, 60) : '',
        // A Warden prepping NPCs keeps them hidden until the posse meets them.
        known: warden ? a.known !== false : true, at: Date.now(),
      };
      state.npcs = [npc, ...state.npcs].slice(0, MAX);
      return npc;
    }
    case 'posseNote': { const n = find(); if (!n.known && !warden) throw new Error('No such NPC.'); n.posseNotes = clean(a.text, 3000); return; }
    case 'where': { const n = find(); if (!n.known && !warden) throw new Error('No such NPC.'); n.where = clean(a.text, 80); return; }
  }
  if (!warden) throw new Error('Warden PIN required.');
  switch (a.action) {
    case 'wardenNote': find().wardenNotes = clean(a.text, 3000); return;
    case 'known': find().known = !!a.value; return;
    case 'rename': { const n = find(); n.name = clean(a.name, 60).trim() || n.name; return; }
    case 'remove': state.npcs = state.npcs.filter((x) => x.id !== a.id); return;
    default: throw new Error('Unknown action.');
  }
}

export function npcView(state, { warden }) {
  return {
    v: state.v,
    npcs: warden ? state.npcs : state.npcs.filter((n) => n.known).map(({ wardenNotes, ...n }) => n),
  };
}
