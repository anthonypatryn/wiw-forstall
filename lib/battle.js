// Battle map: a background map with a 1-inch hex grid and tokens for the posse, enemies and NPCs.
// Ranges follow the Guidebook's miniature distances (pp. 40 & 85): Arm's Reach ≤1", Short ≤6", Long ≤18", Distant beyond.
import crypto from 'node:crypto';

// Battle maps sized as 36" × 25" play mats, served at 100 px per inch.
export const PRESETS = [
  { id: 'imaginary-town', name: 'Imaginary Town' },
  { id: 'great-plains', name: 'Great Plains' },
  { id: 'red-rock-canyon', name: 'Red Rock Canyon' },
  { id: 'mountain-pass', name: 'Mountain Pass' },
  { id: 'monster-burrow', name: 'Monster Burrow' },
].map((p) => ({ ...p, w: 3600, h: 2503, ppi: 100, src: `/img/battle/${p.id}.jpg`, thumb: `/img/battle/${p.id}-thumb.jpg` }));

const TOKEN_KINDS = ['pc', 'enemy', 'npc'];
const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

export function freshBattle() {
  const p = PRESETS[0];
  return {
    v: 0,
    map: { kind: 'preset', id: p.id, name: p.name, w: p.w, h: p.h, imgV: 0 },
    grid: { ppi: p.ppi, dx: 0, dy: 0, show: true, opacity: 0.35 },
    tokens: [],
  };
}

// Grid geometry (pointy-top hexes, odd rows shifted right). One hex is 1" flat-to-flat.
export function gridSize(state) {
  const R = state.grid.ppi / Math.sqrt(3);
  const cols = Math.ceil((state.map.w - state.grid.dx) / (R * Math.sqrt(3)));
  const rows = Math.ceil((state.map.h - state.grid.dy - R / 2) / (1.5 * R));
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
}

function freeSpot(state, preferRow) {
  const { cols, rows } = gridSize(state);
  const taken = new Set(state.tokens.map((t) => `${t.col},${t.row}`));
  const row0 = Math.max(0, Math.min(rows - 1, preferRow));
  for (let d = 0; d < rows; d++) {
    for (const row of [row0 + d, row0 - d]) {
      if (row < 0 || row >= rows) continue;
      for (let col = 1; col < cols - 1; col++) if (!taken.has(`${col},${row}`)) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}

export function battleAction(state, a, { warden, combat }) {
  const token = () => { const t = state.tokens.find((x) => x.id === a.id); if (!t) throw new Error('No such token.'); return t; };
  if (a.action === 'move') {
    const t = token();
    // The posse can move their own tokens; the Warden moves everything else.
    if (!warden && t.kind !== 'pc') throw new Error('Only the Warden can move that one.');
    const { cols, rows } = gridSize(state);
    t.col = int(a.col, 0, cols - 1); t.row = int(a.row, 0, rows - 1);
    return;
  }
  if (!warden) throw new Error('Warden PIN required.');
  switch (a.action) {
    case 'preset': {
      const p = PRESETS.find((x) => x.id === a.id);
      if (!p) throw new Error('Unknown map.');
      state.map = { kind: 'preset', id: p.id, name: p.name, w: p.w, h: p.h, imgV: state.map.imgV || 0 };
      state.grid = { ...state.grid, ppi: p.ppi, dx: 0, dy: 0 };
      return;
    }
    case 'uploaded': { // image bytes are stored separately (see api/battle.js)
      const w = int(a.w, 100, 8000), h = int(a.h, 100, 8000);
      const inches = num(a.inches, 4, 200) || 36;
      state.map = { kind: 'upload', id: 'upload', name: clean(a.name, 60) || 'Custom map', w, h, imgV: (state.map.imgV || 0) + 1 };
      state.grid = { ...state.grid, ppi: w / inches, dx: 0, dy: 0 };
      return;
    }
    case 'grid': {
      const g = state.grid;
      if (a.ppi !== undefined) g.ppi = num(a.ppi, 20, 600);
      if (a.dx !== undefined) g.dx = num(a.dx, -600, 600);
      if (a.dy !== undefined) g.dy = num(a.dy, -600, 600);
      if (a.show !== undefined) g.show = !!a.show;
      if (a.opacity !== undefined) g.opacity = num(a.opacity, 0, 1);
      return;
    }
    case 'addToken': {
      const kind = TOKEN_KINDS.includes(a.kind) ? a.kind : 'npc';
      const spot = a.col !== undefined ? { col: int(a.col, 0, 999), row: int(a.row, 0, 999) } : freeSpot(state, kind === 'pc' ? gridSize(state).rows - 2 : 1);
      const t = { id: crypto.randomUUID().slice(0, 8), kind, ref: clean(a.ref, 12) || null, name: clean(a.name, 40) || 'Stranger', ...spot, hidden: !!a.hidden };
      state.tokens.push(t);
      return t;
    }
    case 'syncCombat': { // drop in every posse member and enemy that isn't on the board yet
      const have = new Set(state.tokens.map((t) => t.ref).filter(Boolean));
      const { rows } = gridSize(state);
      (combat?.posse || []).filter((p) => !p.dead && !have.has(p.id)).forEach((p) =>
        state.tokens.push({ id: crypto.randomUUID().slice(0, 8), kind: 'pc', ref: p.id, name: p.name, ...freeSpot(state, rows - 2), hidden: false }));
      (combat?.enemies || []).filter((e) => !e.defeated && !have.has(e.id)).forEach((e) =>
        state.tokens.push({ id: crypto.randomUUID().slice(0, 8), kind: 'enemy', ref: e.id, name: e.name, ...freeSpot(state, 1), hidden: !!a.hidden }));
      return;
    }
    case 'tokenEdit': {
      const t = token();
      if (a.name !== undefined) t.name = clean(a.name, 40) || t.name;
      if (a.hidden !== undefined) t.hidden = !!a.hidden;
      return;
    }
    case 'removeToken': state.tokens = state.tokens.filter((t) => t.id !== a.id); return;
    case 'clearTokens': state.tokens = a.kind ? state.tokens.filter((t) => t.kind !== a.kind) : []; return;
    default: throw new Error('Unknown action.');
  }
}

export function battleView(state, { warden, combat }) {
  const posse = new Map((combat?.posse || []).map((p) => [p.id, p]));
  const enemies = new Map((combat?.enemies || []).map((e) => [e.id, e]));
  const tokens = state.tokens.filter((t) => warden || !t.hidden).map((t) => {
    const src = t.kind === 'pc' ? posse.get(t.ref) : t.kind === 'enemy' ? enemies.get(t.ref) : null;
    return {
      ...t,
      name: src?.name || t.name,
      trade: t.kind === 'pc' ? src?.trade : undefined,
      down: t.kind === 'pc' ? !!(src?.dead || src?.bleeding) : t.kind === 'enemy' ? !!src?.defeated : false,
      gone: !!t.ref && !src, // character or enemy was deleted elsewhere
    };
  });
  return {
    v: `${state.v}.${combat?.v || 0}`,
    map: state.map, grid: state.grid, size: gridSize(state), tokens,
    current: combat?.combat?.active ? combat.combat.current : null,
    presets: PRESETS,
  };
}
