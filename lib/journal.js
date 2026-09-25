// The Journal: quests (with step checklists) and clues (pinned notes linked to NPCs, towns and quests).
// The Warden writes and reveals them; players see only what's revealed and can add the posse's own notes.
import crypto from 'node:crypto';

const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const id = () => crypto.randomUUID().slice(0, 8);
const ids = (v, n = 8) => (Array.isArray(v) ? v.map((x) => clean(x, 40)).filter(Boolean).slice(0, n) : []);
export const freshJournal = () => ({ v: 0, quests: [], clues: [], news: [] });
const STATUS = ['open', 'done', 'failed'];

// something the posse should hear about now (pops up on their screens)
function announce(state, kind, ref, text) {
  state.news = [{ id: id(), kind, ref, text, at: Date.now() }, ...(state.news || [])].slice(0, 40);
}

export function journalAction(state, a, { warden }) {
  const list = a.kind === 'clue' ? state.clues : state.quests;
  const find = () => { const x = list.find((q) => q.id === a.id); if (!x) throw new Error('That’s gone from the Journal.'); return x; };
  if (a.action === 'posseNote') { // anyone: the posse's own notes on something they can see
    const x = find();
    if (!x.revealed && !warden) throw new Error('That’s gone from the Journal.');
    x.posseNotes = clean(a.text, 3000); x.updated = Date.now();
    return;
  }
  if (!warden) throw new Error('Warden PIN required.');
  switch (a.action) {
    case 'saveQuest': {
      const q = a.id ? find() : { id: id(), title: '', text: '', giver: '', where: '', reward: '', steps: [], status: 'open', revealed: false, posseNotes: '', at: Date.now() };
      if (a.title !== undefined) q.title = clean(a.title, 90);
      if (!q.title) throw new Error('Give the quest a name.');
      if (a.text !== undefined) q.text = clean(a.text, 3000);
      if (a.giver !== undefined) q.giver = clean(a.giver, 12);
      if (a.where !== undefined) q.where = clean(a.where, 40);
      if (a.reward !== undefined) q.reward = clean(a.reward, 120);
      if (Array.isArray(a.steps)) q.steps = a.steps.slice(0, 20).map((s) => ({ id: clean(s.id, 12) || id(), text: clean(s.text, 200), done: !!s.done, hidden: !!s.hidden })).filter((s) => s.text);
      const wasRevealed = q.revealed;
      if (a.revealed !== undefined) q.revealed = !!a.revealed;
      if (!a.id) state.quests = [q, ...state.quests].slice(0, 100);
      if (q.revealed && !wasRevealed) announce(state, 'quest', q.id, `New quest: ${q.title}`);
      q.updated = Date.now();
      return q;
    }
    case 'step': { // tick a step, or show a hidden one to the posse
      const q = find(), s = q.steps.find((x) => x.id === a.step);
      if (!s) throw new Error('No such step.');
      if (a.done !== undefined) { s.done = !!a.done; if (s.done && q.revealed && !s.hidden) announce(state, 'quest', q.id, `${q.title}: ${s.text} ✓`); }
      if (a.hidden !== undefined) { const was = s.hidden; s.hidden = !!a.hidden; if (was && !s.hidden && q.revealed) announce(state, 'quest', q.id, `${q.title}: a new step — ${s.text}`); }
      q.updated = Date.now();
      return q;
    }
    case 'status': {
      const q = find();
      q.status = STATUS.includes(a.status) ? a.status : 'open';
      if (q.revealed && q.status !== 'open') announce(state, 'quest', q.id, `Quest ${q.status === 'done' ? 'complete' : 'failed'}: ${q.title}`);
      q.updated = Date.now();
      return q;
    }
    case 'saveClue': {
      const c = a.id ? find() : { id: id(), title: '', text: '', img: null, npcs: [], places: [], quest: '', revealed: false, posseNotes: '', at: Date.now() };
      if (a.title !== undefined) c.title = clean(a.title, 90);
      if (a.text !== undefined) c.text = clean(a.text, 2000);
      if (!c.title && !c.text) throw new Error('Write the clue first.');
      if (a.npcs !== undefined) c.npcs = ids(a.npcs);
      if (a.places !== undefined) c.places = ids(a.places);
      if (a.quest !== undefined) c.quest = clean(a.quest, 12);
      const wasRevealed = c.revealed;
      if (a.revealed !== undefined) c.revealed = !!a.revealed;
      if (!a.id) state.clues = [c, ...state.clues].slice(0, 200);
      if (c.revealed && !wasRevealed) announce(state, 'clue', c.id, `New lead: ${c.title || c.text.slice(0, 60)}`);
      c.updated = Date.now();
      return c;
    }
    case 'reveal': { // show or hide a quest or clue
      const x = find(), was = x.revealed;
      x.revealed = !!a.value;
      if (x.revealed && !was) announce(state, a.kind === 'clue' ? 'clue' : 'quest', x.id, a.kind === 'clue' ? `New lead: ${x.title || x.text.slice(0, 60)}` : `New quest: ${x.title}`);
      x.updated = Date.now();
      return x;
    }
    case 'remove': {
      find();
      if (a.kind === 'clue') state.clues = state.clues.filter((x) => x.id !== a.id);
      else { state.quests = state.quests.filter((x) => x.id !== a.id); state.clues.forEach((c) => { if (c.quest === a.id) c.quest = ''; }); }
      state.news = (state.news || []).filter((n) => n.ref !== a.id);
      return;
    }
    default: throw new Error('Unknown action.');
  }
}

// a player took a Wanted poster: it becomes a quest the whole posse can see
export function bountyQuest(state, poster, townName) {
  const money = poster.reward ? `$${Number(poster.reward).toFixed(2).replace(/\.00$/, '')}` : '';
  const q = { id: id(), title: clean(`Bounty: ${poster.name}`, 90), text: clean(poster.crime || `Wanted in ${townName}.`, 3000), giver: '', where: clean(poster.town, 40),
    reward: clean([money, poster.terms].filter(Boolean).join(' · '), 120), bounty: poster.id, status: 'open', revealed: true, posseNotes: '', at: Date.now(), updated: Date.now(),
    steps: [`Track down ${poster.name}`, `Bring them in (${(poster.terms || 'Dead or Alive').toLowerCase()})`, `Collect the reward in ${townName}`].map((text) => ({ id: id(), text: clean(text, 200), done: false, hidden: false })) };
  state.quests = [q, ...state.quests].slice(0, 100);
  announce(state, 'quest', q.id, `New quest: ${q.title}`);
  return q;
}
// the poster changed: captured/dead ticks the first two steps, paid ticks them all and finishes the quest, torn down fails it
export function bountySync(state, poster, removed = false) {
  const q = state.quests.find((x) => x.bounty === poster.id);
  if (!q || q.status !== 'open') return;
  if (removed) { q.status = 'failed'; announce(state, 'quest', q.id, `Quest failed: ${q.title}`); q.updated = Date.now(); return; }
  const upto = poster.status === 'claimed' ? 3 : ['captured', 'dead'].includes(poster.status) ? 2 : 0;
  q.steps.slice(0, upto).forEach((s) => { s.done = true; });
  if (poster.status === 'claimed') { q.status = 'done'; announce(state, 'quest', q.id, `Quest complete: ${q.title}`); }
  q.updated = Date.now();
}

// players: only what's revealed; hidden quest steps stay hidden
export function journalView(state, { warden }) {
  if (warden) return { v: state.v, quests: state.quests, clues: state.clues, news: state.news || [] };
  const quests = state.quests.filter((q) => q.revealed).map((q) => ({ ...q, steps: q.steps.filter((s) => !s.hidden) }));
  const seen = new Set([...quests.map((q) => q.id), ...state.clues.filter((c) => c.revealed).map((c) => c.id)]);
  const clues = state.clues.filter((c) => c.revealed).map((c) => ({ ...c, quest: seen.has(c.quest) ? c.quest : '' }));
  return { v: state.v, quests, clues, news: (state.news || []).filter((n) => seen.has(n.ref)) };
}
