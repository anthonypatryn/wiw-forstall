// Scene prep (Warden only): build a scene ahead of time — read-aloud text, who to reveal, the fight, handouts, locks, rolls —
// then run it at the table from Run the Game, one tap per beat. Firing a beat calls the same actions the Warden's cards use.
import { clean, int, id } from './util.js';

const ids = (v, n = 30) => (Array.isArray(v) ? [...new Set(v.map((x) => clean(x, 40)).filter(Boolean))].slice(0, n) : []);
export const freshScenes = () => ({ v: 0, scenes: [], current: '' });
export const SKILLS = ['Charm', 'Finesse', 'Intuition', 'Nerve'];
export const DIFFS = ['Very Easy', 'Easy', 'Medium', 'Difficult', 'Very Difficult'];

function tidy(a) {
  return {
    title: clean(a.title, 90), town: clean(a.town, 40), readAloud: clean(a.readAloud, 4000), notes: clean(a.notes, 4000),
    npcs: ids(a.npcs), wanted: ids(a.wanted), journal: (Array.isArray(a.journal) ? a.journal : []).slice(0, 20).map((j) => ({ kind: j?.kind === 'clue' ? 'clue' : 'quest', id: clean(j?.id, 12) })).filter((j) => j.id),
    battleMap: clean(a.battleMap, 40),
    enemies: (Array.isArray(a.enemies) ? a.enemies : []).slice(0, 12).map((e) => ({ profile: clean(e?.profile, 80), name: clean(e?.name, 40), count: int(e?.count || 1, 1, 8) })).filter((e) => e.profile || e.name),
    handouts: (Array.isArray(a.handouts) ? a.handouts : []).slice(0, 10).map((h) => ({ id: clean(h?.id, 12) || id(), kind: h?.kind === 'note' ? 'note' : 'item', title: clean(h?.title, 80), text: clean(h?.text, 4000) })).filter((h) => h.title || h.text),
    locks: (Array.isArray(a.locks) ? a.locks : []).slice(0, 8).map((l) => ({
      id: clean(l?.id, 12) || id(), what: clean(l?.what, 60) || 'a lock', difficulty: int(l?.difficulty || 3, 1, 5), retries: int(l?.retries, 0, 5), retryCost: clean(l?.retryCost, 60),
      loot: l?.loot && ['money', 'scrap', 'custom'].includes(l.loot.kind) ? { kind: l.loot.kind, amount: Number(l.loot.amount) || 0, name: clean(l.loot.name, 80), desc: clean(l.loot.desc, 300) } : null,
      trap: l?.trap && Number(l.trap.damage) ? { damage: int(l.trap.damage, 0, 30) } : null,
    })),
    checks: (Array.isArray(a.checks) ? a.checks : []).slice(0, 10).map((c) => ({ id: clean(c?.id, 12) || id(), skill: SKILLS.includes(c?.skill) ? c.skill : 'Intuition', diff: DIFFS.includes(c?.diff) ? c.diff : 'Medium', note: clean(c?.note, 80) })),
  };
}

export function sceneAction(state, a, { warden }) {
  if (!warden) throw new Error('Warden PIN required.');
  const find = () => { const s = state.scenes.find((x) => x.id === a.id); if (!s) throw new Error('That scene is gone.'); return s; };
  switch (a.action) {
    case 'save': {
      const body = tidy(a.scene || {});
      if (!body.title) throw new Error('Give the scene a name.');
      if (a.id) { const s = find(); Object.assign(s, body, { updated: Date.now() }); return s; }
      const s = { id: id(), ...body, used: {}, done: false, at: Date.now(), updated: Date.now() };
      state.scenes = [s, ...state.scenes].slice(0, 60);
      return s;
    }
    case 'copy': { const s = find(); const c = { ...JSON.parse(JSON.stringify(s)), id: id(), title: `${s.title} (copy)`.slice(0, 90), used: {}, done: false, at: Date.now() }; state.scenes = [c, ...state.scenes]; return c; }
    case 'remove': find(); state.scenes = state.scenes.filter((x) => x.id !== a.id); if (state.current === a.id) state.current = ''; return;
    case 'current': if (a.id) find(); state.current = clean(a.id, 12); return;
    case 'used': { const s = find(); const key = clean(a.key, 40); if (a.value === false) delete s.used[key]; else s.used[key] = Date.now(); return s; }
    case 'done': { const s = find(); s.done = a.value !== false; if (s.done && state.current === s.id) state.current = ''; return s; }
    case 'reset': { const s = find(); s.used = {}; s.done = false; return s; }
    default: throw new Error('Unknown action.');
  }
}
