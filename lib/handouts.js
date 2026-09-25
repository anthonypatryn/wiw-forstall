// Handouts: items (a photo + description) and notes (handwritten on old paper) the Warden gives to players.
// Story props — they live in the Backpack (shared with the posse) or the recipient's private view, never on sheets.
import crypto from 'node:crypto';

const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const id = () => crypto.randomUUID().slice(0, 8);
export function freshHandouts() { return { v: 0, list: [] }; }

// who can see it: everyone once shared (or sent to all), otherwise only the people it was handed to
export const canSee = (h, pc) => h.shared || h.to === 'all' || (Array.isArray(h.to) && h.to.includes(pc));
const toNames = (h, names) => (h.to === 'all' ? 'the posse' : h.to.map((pid) => names[pid] || '?').join(' & '));

export function handoutAction(state, a, { warden, names = {}, log = () => {} }) {
  const find = () => { const h = state.list.find((x) => x.id === a.id); if (!h) throw new Error('That handout is gone.'); return h; };
  switch (a.action) {
    case 'send': {
      if (!warden) throw new Error('Warden PIN required.');
      const kind = a.kind === 'note' ? 'note' : 'item';
      const title = clean(a.title, 80), text = clean(a.text, 4000);
      if (!title && !text) throw new Error(kind === 'note' ? 'Write the note first.' : 'Name the item.');
      const to = a.to === 'all' ? 'all' : (Array.isArray(a.to) ? a.to.map((x) => clean(x, 12)).filter((x) => names[x]) : []);
      if (to !== 'all' && !to.length) throw new Error('Pick who gets it.');
      const h = { id: id(), kind, title: title || (kind === 'note' ? 'A note' : 'An item'), text, img: null, to, shared: to === 'all', sharedBy: null, at: Date.now(), seen: [] };
      state.list.unshift(h);
      state.list = state.list.slice(0, 200);
      log(to === 'all' ? `The Warden hands the posse ${kind === 'note' ? 'a note' : 'something'}: ${h.title}.` : null, `Handed to ${toNames(h, names)}: ${h.title}`);
      return h;
    }
    case 'edit': {
      if (!warden) throw new Error('Warden PIN required.');
      const h = find();
      if (a.title !== undefined) h.title = clean(a.title, 80) || h.title;
      if (a.text !== undefined) h.text = clean(a.text, 4000);
      if (a.shared !== undefined) h.shared = !!a.shared;
      return h;
    }
    case 'remove':
      if (!warden) throw new Error('Warden PIN required.');
      find(); state.list = state.list.filter((x) => x.id !== a.id);
      return;
    case 'share': { // a player shows the posse something only they were given
      const h = find(), pc = clean(a.pc, 12);
      if (!warden && !(Array.isArray(h.to) && h.to.includes(pc))) throw new Error('Only the person who has it can show it around.');
      if (h.shared) return h;
      h.shared = true; h.sharedBy = names[pc] || 'The Warden';
      log(`${h.sharedBy} shows the posse ${h.kind === 'note' ? 'a note' : 'something'}: ${h.title}. It’s in the Backpack.`);
      return h;
    }
    case 'seen': { // the pop-up was dismissed on this character's device
      const h = find(), pc = clean(a.pc, 12);
      if (pc && canSee(h, pc) && !h.seen.includes(pc)) h.seen.push(pc);
      return;
    }
    default: throw new Error('Unknown action.');
  }
}

export function handoutView(state, { warden, pc }) {
  const list = warden ? state.list : state.list.filter((h) => canSee(h, pc));
  return { v: state.v, list: list.map(({ seen, ...h }) => ({ ...h, seenByMe: pc ? seen.includes(pc) : true, seenBy: warden ? seen : undefined })) };
}
