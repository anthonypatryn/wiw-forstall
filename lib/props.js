// Things the Warden places on the Battle Map (`battle.props`): a chest (a Lock Pick game with what's inside), a dead
// body (finds that each need some Intuition Hits), a clue or note (read it; it can reveal a Journal clue), and a plain
// marker. Players use one when their token is within Arm's Reach (1″); lib/routes/battle.js does the using, since it
// touches the Lock Pick, combat and Journal documents.
import crypto from 'node:crypto';
import { clean, int } from './util.js';
import { cleanLoot, cleanTrap, lootText } from './lockpick.js';

export const PROP_KINDS = ['chest', 'body', 'clue', 'marker'];
export const MARKER_ICONS = ['pin', 'fire', 'drop', 'hat', 'lock', 'star', 'horseshoe', 'target', 'skull', 'scroll'];
const MAX_PROPS = 60, MAX_FINDS = 6;
const DEFAULT_NAME = { chest: 'A chest', body: 'A body', clue: 'A note', marker: 'Something' };

function fields(p, a) {
  if (a.name !== undefined) p.name = clean(a.name, 50).trim() || DEFAULT_NAME[p.kind];
  if (a.hidden !== undefined) p.hidden = !!a.hidden;
  if (p.kind === 'chest') {
    if (a.difficulty !== undefined) p.difficulty = int(a.difficulty, 1, 5);
    if (a.retries !== undefined) p.retries = int(a.retries, 0, 5);
    if (a.retryCost !== undefined) p.retryCost = clean(a.retryCost, 60);
    if (a.loot !== undefined) p.loot = cleanLoot(a.loot);
    if (a.trap !== undefined) p.trap = cleanTrap(a.trap);
  }
  if (p.kind === 'body' && Array.isArray(a.finds)) {
    p.finds = a.finds.slice(0, MAX_FINDS).map((f) => { const l = cleanLoot(f); return l && { ...l, need: int(f.need || 1, 1, 6), by: '' }; }).filter(Boolean);
  }
  if (p.kind === 'clue') {
    if (a.text !== undefined) p.text = clean(a.text, 1000);
    if (a.clueId !== undefined) p.clueId = clean(a.clueId, 12);
  }
  if (p.kind === 'marker' && a.icon !== undefined) p.icon = MARKER_ICONS.includes(a.icon) ? a.icon : 'pin';
}

// the Warden's actions: addProp, moveProp, editProp, removeProp
export function propAction(state, a, { cols, rows }) {
  const find = () => { const p = (state.props || []).find((x) => x.id === a.id); if (!p) throw new Error('That isn’t on the map any more.'); return p; };
  const at = (p) => { p.col = int(a.col, 0, cols - 1); p.row = int(a.row, 0, rows - 1); };
  switch (a.action) {
    case 'addProp': {
      const kind = PROP_KINDS.includes(a.kind) ? a.kind : null;
      if (!kind) throw new Error('Pick what to place.');
      const p = { id: crypto.randomUUID().slice(0, 8), kind, name: DEFAULT_NAME[kind], hidden: false, at: Date.now(),
        ...(kind === 'chest' ? { difficulty: 3, retries: 1, retryCost: 'one lockpick', loot: null, trap: null, opened: '', picking: null } : {}),
        ...(kind === 'body' ? { finds: [], searchedBy: [] } : {}),
        ...(kind === 'clue' ? { text: '', clueId: '', readBy: [] } : {}),
        ...(kind === 'marker' ? { icon: 'pin' } : {}) };
      fields(p, a); at(p);
      state.props = [...(state.props || []), p].slice(-MAX_PROPS);
      return p;
    }
    case 'moveProp': { const p = find(); at(p); return p; }
    case 'editProp': { const p = find(); fields(p, a); if (a.reset) { p.resetAt = Date.now(); p.opened = ''; p.picking = null; p.searchedBy = []; (p.finds || []).forEach((f) => { f.by = ''; }); p.readBy = []; } return p; }
    case 'removeProp': { find(); state.props = state.props.filter((x) => x.id !== a.id); return null; }
    default: return undefined;
  }
}

// what each side sees: the Warden everything; the posse only what isn't hidden or fogged, and never what's inside
export function propsView(state, { warden, fogged = () => false, names = {} }) {
  return (state.props || []).filter((p) => warden || (!p.hidden && !fogged(p))).map((p) => {
    const base = { id: p.id, kind: p.kind, col: p.col, row: p.row, name: p.name, hidden: !!p.hidden, icon: p.icon };
    if (p.kind === 'chest') return { ...base, opened: p.opened || '', picking: p.picking ? names[p.picking.pc] || 'Someone' : '',
      ...(warden ? { difficulty: p.difficulty, retries: p.retries, retryCost: p.retryCost, loot: p.loot, lootText: lootText(p.loot), trap: p.trap } : { difficulty: p.difficulty }) };
    if (p.kind === 'body') return { ...base, searchedBy: p.searchedBy || [], left: (p.finds || []).filter((f) => !f.by).length,
      ...(warden ? { finds: (p.finds || []).map((f) => ({ ...f, text: lootText(f), byName: f.by ? names[f.by] || 'someone' : '' })) } : {}) };
    if (p.kind === 'clue') return { ...base, readBy: p.readBy || [], ...(warden ? { text: p.text, clueId: p.clueId } : {}) };
    return base;
  });
}

// a body search: one Intuition roll (`hits`); everything not yet found that needs no more Hits than that is theirs
export function searchBody(p, pcId, hits) {
  if ((p.searchedBy || []).includes(pcId)) throw new Error('You’ve already searched this one.');
  p.searchedBy = [...(p.searchedBy || []), pcId];
  const found = (p.finds || []).filter((f) => !f.by && f.need <= hits);
  found.forEach((f) => { f.by = pcId; });
  return found;
}
