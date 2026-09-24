// Warden session notes: one entry per game night. Warden-only; recaps can be posted to the shared Table Log.
import crypto from 'node:crypto';

const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').slice(0, n);
const id = () => crypto.randomUUID().slice(0, 8);

export function freshSession() {
  return { v: 0, sessions: [] };
}

export function sessionAction(state, a) {
  const find = () => {
    const s = state.sessions.find((x) => x.id === a.id);
    if (!s) throw new Error('No such session.');
    return s;
  };
  switch (a.action) {
    case 'add': {
      const n = state.sessions.length + 1;
      const s = { id: id(), title: clean(a.title, 80) || `Session ${n}`, date: clean(a.date, 20), notes: '', recap: '', at: Date.now() };
      state.sessions.unshift(s);
      return s;
    }
    case 'edit': {
      const s = find();
      if (a.title !== undefined) s.title = clean(a.title, 80);
      if (a.date !== undefined) s.date = clean(a.date, 20);
      if (a.notes !== undefined) s.notes = clean(a.notes, 20000);
      if (a.recap !== undefined) s.recap = clean(a.recap, 2000);
      s.at = Date.now();
      return s;
    }
    case 'remove':
      find();
      state.sessions = state.sessions.filter((x) => x.id !== a.id);
      return;
    default:
      throw new Error('Unknown action.');
  }
}
