// The newspaper: a front page for each session, written from the Table Log, edited by the Warden, then printed for the posse.
import crypto from 'node:crypto';
import { clean } from './util.js';

export const freshPapers = () => ({ v: 0, issues: [] });
const NAMES = ['Gazette', 'Clarion', 'Dispatch', 'Chronicle', 'Bugle', 'Sentinel', 'Courier', 'Herald'];
// "The Dodge Clarion" — the same town always gets the same paper
export function paperName(town) {
  if (!town) return 'The Frontier Gazette';
  const h = [...town].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `The ${town.replace(/^The\s+/i, '')} ${NAMES[h % NAMES.length]}`;
}

function fill(issue, a) {
  const f = (k, n) => { if (a[k] !== undefined) issue[k] = clean(a[k], n); };
  f('paper', 60); f('town', 40); f('townName', 60); f('date', 60); f('headline', 90); f('subhead', 200); f('lead', 2400); f('quote', 240);
  if (Array.isArray(a.stories)) issue.stories = a.stories.slice(0, 4).map((s) => ({ head: clean(s?.head, 80), text: clean(s?.text, 900) })).filter((s) => s.head || s.text);
  if (Array.isArray(a.ads)) issue.ads = a.ads.slice(0, 3).map((s) => clean(s, 160)).filter(Boolean);
  if (Array.isArray(a.classifieds)) issue.classifieds = a.classifieds.slice(0, 6).map((c) => ({ name: clean(c?.name, 60), reward: Number(c?.reward) || 0, crime: clean(c?.crime, 120) }));
  if (Array.isArray(a.faces)) issue.faces = a.faces.slice(0, 3).map((x) => clean(x, 12));
}

export function papersAction(state, a, { warden, log = () => {} }) {
  const find = () => { const p = state.issues.find((x) => x.id === a.id); if (!p) throw new Error('That issue is gone.'); return p; };
  if (a.action === 'seen') return; // (per device, kept in the browser)
  if (!warden) throw new Error('Warden PIN required.');
  switch (a.action) {
    case 'save': { // new draft, or edits to one
      let p = a.id ? find() : state.issues.find((x) => x.sessionId && x.sessionId === a.sessionId && !x.published);
      if (!p) {
        p = { id: crypto.randomUUID().slice(0, 8), no: Math.max(0, ...state.issues.map((x) => x.no || 0)) + 1, sessionId: clean(a.sessionId, 12), paper: '', town: '', townName: '', date: '', headline: '', subhead: '', lead: '', stories: [], quote: '', ads: [], classifieds: [], faces: [], published: false, at: Date.now() };
        state.issues = [p, ...state.issues].slice(0, 100);
      }
      fill(p, a);
      if (!p.paper) p.paper = paperName(p.townName);
      p.at = Date.now();
      return p;
    }
    case 'publish': {
      const p = find();
      if (!p.headline) throw new Error('Give it a headline first.');
      p.published = true; p.publishedAt = Date.now();
      log(`Extra! Extra! ${p.paper} is out: “${p.headline}”`);
      return p;
    }
    case 'unpublish': find().published = false; return;
    case 'remove': find(); state.issues = state.issues.filter((x) => x.id !== a.id); return;
    default: throw new Error('Unknown action.');
  }
}

export const papersView = (state, { warden }) => ({ v: state.v, issues: warden ? state.issues : state.issues.filter((p) => p.published) });
