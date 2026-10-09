// Campaign (Warden only): the story layer over everything else. A thread is one storyline ("The Baron's land grab"):
// what's really going on, what the posse knows so far, the next beat, a clock that ticks toward trouble if it's
// ignored, and links to the NPCs, factions, quests, clues, posters, towns and Prep scenes it touches.
// The links point at things that live in their own documents; a link whose thing is gone is just skipped on the page.
// Notes are the Warden's notebook pages: free text (saved as it's typed) with game things pinned to them.
// Drafts are handouts written ahead of time; handing one out (handouts `send`) swaps its pins for the real handout.
import { clean, cleanKeepSpaces, int, id } from './util.js';

export const freshCampaign = () => ({ v: 0, threads: [], notes: [], drafts: [] });
export const STATUSES = ['brewing', 'active', 'resolved', 'dropped'];
export const LINK_KINDS = ['npc', 'faction', 'quest', 'clue', 'poster', 'town', 'scene', 'handout', 'draft', 'item'];
export const CLOCK_SIZES = [0, 4, 6, 8]; // 0 = no clock
const MAX_THREADS = 80, MAX_LINKS = 40, MAX_NOTES = 120, MAX_DRAFTS = 40;

function tidyLinks(v) {
  const seen = new Set();
  return (Array.isArray(v) ? v : []).map((l) => ({ kind: LINK_KINDS.includes(l?.kind) ? l.kind : '', id: clean(l?.id, l?.kind === 'faction' || l?.kind === 'item' ? 60 : 40) }))
    .filter((l) => l.kind && l.id && !seen.has(`${l.kind}:${l.id}`) && seen.add(`${l.kind}:${l.id}`)).slice(0, MAX_LINKS);
}

function tidy(a) {
  const size = CLOCK_SIZES.includes(Number(a.clock?.size)) ? Number(a.clock.size) : 0;
  return {
    title: clean(a.title, 90),
    status: STATUSES.includes(a.status) ? a.status : 'brewing',
    truth: clean(a.truth, 4000), known: clean(a.known, 3000), nextBeat: clean(a.nextBeat, 1000),
    clock: { size, filled: size ? int(a.clock?.filled || 0, 0, size) : 0, doom: clean(a.clock?.doom, 300) },
    links: tidyLinks(a.links),
  };
}

export function campaignAction(state, a, { warden }) {
  if (!warden) throw new Error('Warden PIN required.');
  state.notes ||= []; state.drafts ||= [];
  const find = () => { const t = state.threads.find((x) => x.id === a.id); if (!t) throw new Error('That thread is gone.'); return t; };
  const note = () => { const n = state.notes.find((x) => x.id === a.id); if (!n) throw new Error('That note is gone.'); return n; };
  switch (a.action) {
    // ---- notes ----
    case 'noteNew': {
      if (state.notes.length >= MAX_NOTES) throw new Error(`That’s ${MAX_NOTES} notes. Delete an old one first.`);
      const n = { id: id(), title: clean(a.title, 90) || 'New note', text: cleanKeepSpaces(a.text, 20000), links: tidyLinks(a.links), at: Date.now(), updated: Date.now() };
      state.notes = [n, ...state.notes];
      return n;
    }
    case 'noteText': { // autosaves while typing (no Undo entry for each pause)
      const n = note();
      if (a.title !== undefined) n.title = cleanKeepSpaces(a.title, 90);
      if (a.text !== undefined) n.text = cleanKeepSpaces(a.text, 20000);
      n.updated = Date.now();
      return n;
    }
    case 'noteLinks': { const n = note(); n.links = tidyLinks(a.links); n.updated = Date.now(); return n; }
    case 'noteRemove': note(); state.notes = state.notes.filter((x) => x.id !== a.id); return;
    // ---- handouts written ahead ----
    case 'draftSave': {
      const d = { kind: a.draft?.kind === 'note' ? 'note' : 'item', title: clean(a.draft?.title, 80), text: clean(a.draft?.text, 4000) };
      if (!d.title && !d.text) throw new Error(d.kind === 'note' ? 'Write the note first.' : 'Name the item.');
      if (a.id) { const x = state.drafts.find((y) => y.id === a.id); if (!x) throw new Error('That handout is gone.'); Object.assign(x, d); return x; }
      if (state.drafts.length >= MAX_DRAFTS) throw new Error(`That’s ${MAX_DRAFTS} handouts waiting. Hand some out first.`);
      const x = { id: id(), ...d, at: Date.now() };
      state.drafts = [x, ...state.drafts];
      return x;
    }
    case 'draftRemove': state.drafts = state.drafts.filter((x) => x.id !== a.id); return;
    case 'draftUsed': { // it was handed out: the pins now point at the real handout
      const handout = clean(a.handout, 40);
      state.drafts = state.drafts.filter((x) => x.id !== a.id);
      for (const x of [...state.notes, ...state.threads]) {
        x.links = tidyLinks(x.links.map((l) => (l.kind === 'draft' && l.id === a.id ? (handout ? { kind: 'handout', id: handout } : null) : l)).filter(Boolean));
      }
      return;
    }
    // ---- threads ----
    case 'save': {
      const body = tidy(a.thread || {});
      if (!body.title) throw new Error('Give the thread a name.');
      if (a.id) { const t = find(); Object.assign(t, body, { updated: Date.now() }); return t; }
      if (state.threads.length >= MAX_THREADS) throw new Error(`That’s ${MAX_THREADS} threads. Delete a dropped one first.`);
      const t = { id: id(), ...body, at: Date.now(), updated: Date.now() };
      state.threads = [t, ...state.threads];
      return t;
    }
    case 'tick': { // the clock moves on (by +1 / -1, or to an exact `to`); saved straight away, even mid-edit
      const t = find();
      if (!t.clock?.size) throw new Error('That thread has no clock.');
      const to = a.to !== undefined ? Number(a.to) : t.clock.filled + (Number(a.by) < 0 ? -1 : 1);
      t.clock.filled = int(to, 0, t.clock.size); t.updated = Date.now();
      return t;
    }
    case 'status': { const t = find(); if (!STATUSES.includes(a.status)) throw new Error('Unknown status.'); t.status = a.status; t.updated = Date.now(); return t; }
    case 'remove': find(); state.threads = state.threads.filter((x) => x.id !== a.id); return;
    default: throw new Error('Unknown action.');
  }
}
