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
      const s = { id: id(), title: clean(a.title, 80) || `Session ${n}`, date: clean(a.date, 20), notes: '', recap: '', at: Date.now(), created: Date.now() };
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

// ---------- the write-up: what happened this session, from the Table Log archive ----------
const START = '=== SUMMARY ===', END = '=== MY NOTES ===';
// The session's window: from when its notes were started (or its date) until the next session began.
export function sessionEntries(state, s, archive) {
  const starts = state.sessions.map((x) => x.created || (Date.parse(x.date) || x.at) - 12 * 3600e3).sort((a, b) => a - b);
  const from = s.created || (Date.parse(s.date) || s.at) - 12 * 3600e3;
  const to = starts.find((t) => t > from) || Infinity;
  return (archive || []).filter((l) => l.at >= from && l.at < to && l.text);
}
const NOISE = /^(Round \d+|↶ Undone|.* joins the fight!$|.* is out of the fight\.$)/;
// No AI key? A plain list of what happened, oldest first.
export function plainSummary(entries) {
  const moments = entries.filter((l) => !/ rolled /.test(l.text) && !NOISE.test(l.text)).map((l) => `- ${l.text}${l.secret ? ` (${l.secret})` : ''}`);
  const rolls = entries.filter((l) => / rolled /.test(l.text)).length;
  return [`${entries.length} things were logged, including ${rolls} roll${rolls === 1 ? '' : 's'}.`, '', 'WHAT HAPPENED', ...(moments.length ? moments.slice(-60) : ['- Nothing but dice rolls.'])].join('\n');
}
// Put the summary at the top of the notes and keep the Warden's own notes underneath (a second run replaces the old summary).
export function withSummary(notes, summary, label) {
  const mine = String(notes || '').includes(END) ? String(notes).split(END).slice(1).join(END).replace(/^\n+/, '') : String(notes || '');
  return `${START} (${label})\n${summary.trim()}\n\n${END}\n${mine}`.slice(0, 20000);
}
