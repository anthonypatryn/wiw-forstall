// Whispers: a player's secret message to the Warden, and the Warden's one-line reply. No chat history —
// each whisper is a pop-up on the other side, then it's done.
import crypto from 'node:crypto';
import { clean } from './util.js';

export function freshWhispers() { return { v: 0, list: [] }; }

export function whisperAction(state, a, { warden, names = {} }) {
  const find = () => { const w = state.list.find((x) => x.id === a.id); if (!w) throw new Error('That whisper is gone.'); return w; };
  switch (a.action) {
    case 'send': {
      const pc = clean(a.pc, 12), text = clean(a.text, 500);
      if (!names[pc]) throw new Error('Pick who you’re playing first (the “This is me” star on your sheet).');
      if (!text) throw new Error('Write something first.');
      const w = { id: crypto.randomUUID().slice(0, 8), pc, name: names[pc], text, at: Date.now(), read: false, reply: '', replyAt: null, replySeen: false, done: false };
      state.list.unshift(w);
      state.list = state.list.slice(0, 100);
      return { id: w.id };
    }
    case 'wardenSend': { // the Warden starts a whisper to one, some or all of the posse
      if (!warden) throw new Error('Warden PIN required.');
      const text = clean(a.text, 300);
      if (!text) throw new Error('Write the whisper first.');
      const to = a.to === 'all' ? Object.keys(names) : (Array.isArray(a.to) ? a.to.filter((x) => names[x]) : []);
      if (!to.length) throw new Error('Pick who to whisper to.');
      const at = Date.now();
      for (const pc of to) state.list.unshift({ id: crypto.randomUUID().slice(0, 8), pc, name: names[pc], text: '', fromWarden: true, at, read: true, reply: text, replyAt: at, replySeen: false, done: true });
      state.list = state.list.slice(0, 100);
      return { count: to.length };
    }
    case 'read': if (!warden) throw new Error('Warden PIN required.'); find().read = true; return;
    case 'reply': {
      if (!warden) throw new Error('Warden PIN required.');
      const w = find(), text = clean(a.text, 200);
      if (!text) throw new Error('Write the reply first.');
      Object.assign(w, { read: true, reply: text, replyAt: Date.now(), replySeen: false, done: true });
      return;
    }
    case 'done': if (!warden) throw new Error('Warden PIN required.'); Object.assign(find(), { read: true, done: true }); return;
    case 'replySeen': { const w = find(); if (w.pc === clean(a.pc, 12)) w.replySeen = true; return; }
    default: throw new Error('Unknown action.');
  }
}
export function whisperView(state, { warden, pc }) {
  if (warden) return { v: state.v, list: state.list.filter((w) => !w.fromWarden && (!w.done || (w.reply && !w.replySeen))) };
  // a player only ever gets back their own replies that haven't popped up yet
  return { v: state.v, list: state.list.filter((w) => w.pc === pc && w.reply && !w.replySeen).map(({ id, text, reply, replyAt, fromWarden }) => ({ id, text, reply, replyAt, fromWarden: !!fromWarden })) };
}
