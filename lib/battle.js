// Battle map: a background map with a 1-inch hex grid and tokens for the posse, enemies and NPCs.
// Ranges follow the Guidebook's miniature distances (pp. 40 & 85): Arm's Reach ≤1", Short ≤6", Long ≤18", Distant beyond.
import crypto from 'node:crypto';
import { profileFor } from './combat.js';
import { BOOK_NPCS } from './booknpcs.js';
import { KINDS, SLOTS, fields, inRange, bestSweep, lossText, edisonConflicts, hexDist, sweepTolerance } from './forstall.js';
export { hexDist }; // one hex-distance function, shared with the Forstall rules
import { clean, int } from './util.js';

// Token art: Trade portraits, book monster art, faction portraits. Everything else gets a styled stand-in.
const MONSTER_ART = new Set(['American Bullfrog', 'Badlands Sasquatch', 'Burrowing Mudbugs', 'Carnivorous Pine', 'Feral Hog Cyclops', 'Great Golden Elk',
  'King Cottonmouth', 'Lightning Bug', 'Opossum', 'Plains Shepherd Bison', 'Quill Archer', 'Road Runner', 'Shasta Skullface', 'Silver-Ringed Octopus',
  'Trapdoor Spider', 'Winter Wolverine']);
const slug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const NPC_ART = Object.fromEntries(BOOK_NPCS.factions.map((f) => [f.profile.name, `npc-${f.profile.img}`]));
function artFor(kind, src, name) {
  if (kind === 'pc') return src?.trade ? `trade-${src.trade.toLowerCase()}` : null;
  if (kind === 'enemy' && src?.profile) {
    if (MONSTER_ART.has(src.profile)) return `monster-${slug(src.profile)}`;
    return profileFor(src.profile)?.img || null;
  }
  return NPC_ART[name] || null;
}

// Battle maps sized as 36" × 25" play mats, served at 100 px per inch.
const PRESETS = [
  { id: 'imaginary-town', name: 'Imaginary Town' },
  { id: 'great-plains', name: 'Great Plains' },
  { id: 'red-rock-canyon', name: 'Red Rock Canyon' },
  { id: 'mountain-pass', name: 'Mountain Pass' },
  { id: 'monster-burrow', name: 'Monster Burrow' },
].map((p) => ({ ...p, w: 3600, h: 2503, ppi: 100, src: `/img/battle/${p.id}.webp`, thumb: `/img/battle/${p.id}-thumb.jpg` }));

const TOKEN_KINDS = ['pc', 'enemy', 'npc'];
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

export function freshBattle() {
  const p = PRESETS[0];
  return {
    v: 0,
    map: { kind: 'preset', id: p.id, name: p.name, w: p.w, h: p.h, imgV: 0 },
    grid: { ppi: p.ppi, dx: 0, dy: 0, show: true, opacity: 0.35 },
    tokens: [],
    forstalls: [], // the Warden's free-standing Forstalls (a character's rides on their token)
    cave: false,   // Edison's Rule 2: Sweeps roll 1 fewer die
  };
}

// Grid geometry (pointy-top hexes, odd rows shifted right). One hex is 1" flat-to-flat.
function gridSize(state) {
  const R = state.grid.ppi / Math.sqrt(3);
  const cols = Math.ceil((state.map.w - state.grid.dx) / (R * Math.sqrt(3)));
  const rows = Math.ceil((state.map.h - state.grid.dy - R / 2) / (1.5 * R));
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
}

// New tokens land in the middle of the map, so the Warden can find them: the free hex nearest the center.
// Enemies gather just above the middle, the posse just below, everyone else right on it.
function freeSpot(state, kind) {
  const { cols, rows } = gridSize(state);
  const taken = new Set(state.tokens.map((t) => `${t.col},${t.row}`));
  const mid = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
  const shift = kind === 'enemy' ? -1 : kind === 'pc' ? 1 : 0;
  const at = { col: mid.col, row: Math.max(0, Math.min(rows - 1, mid.row + shift)) };
  let best = null, bestD = Infinity;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (taken.has(`${col},${row}`)) continue;
    const d = hexDist(at, { col, row });
    if (d < bestD) { best = { col, row }; bestD = d; }
  }
  return best || { col: 0, row: 0 };
}

// pointy-top hexes, odd rows shifted right (same as the page)
export const clampHex = (state, col, row) => { const { cols, rows } = gridSize(state); return { col: int(col, 0, cols - 1), row: int(row, 0, rows - 1) }; };

// Keep the board in step with the fight: while combat runs, everyone in it gets a token;
// tokens for enemies/characters that no longer exist are removed. Returns true if anything changed.
export function autoSync(state, combat) {
  if (!combat) return false;
  let changed = false;
  const alive = new Set([...(combat.posse || []).map((p) => p.id), ...(combat.enemies || []).map((e) => e.id)]);
  const before = state.tokens.length;
  state.tokens = state.tokens.filter((t) => !(t.ref && (t.kind === 'pc' || t.kind === 'enemy') && !alive.has(t.ref)));
  if (state.tokens.length !== before) changed = true;
  if (!combat.combat?.active && state.removed?.length) { state.removed = []; changed = true; } // a new fight starts fresh
  if (combat.combat?.active) {
    const have = new Set(state.tokens.map((t) => t.ref).filter(Boolean));
    const party = combat.combat.party;
    const gone = new Set(state.removed || []); // tokens the Warden took off the map stay off
    (combat.posse || []).filter((p) => !p.dead && (!party || party.includes(p.id)) && !have.has(p.id) && !gone.has(p.id)).forEach((p) => { state.tokens.push({ id: crypto.randomUUID().slice(0, 8), kind: 'pc', ref: p.id, name: p.name, ...freeSpot(state, 'pc'), hidden: false }); changed = true; });
    (combat.enemies || []).filter((e) => !e.defeated && !e.out && !have.has(e.id) && !gone.has(e.id)).forEach((e) => { state.tokens.push({ id: crypto.randomUUID().slice(0, 8), kind: 'enemy', ref: e.id, name: e.name, ...freeSpot(state, 'enemy'), hidden: false }); changed = true; });
  }
  return changed;
}

// ---------- painted terrain: rough ground (moves cost double, p. 42) and fog of war (hidden from the posse) ----------
// Stored as "col,row" keys per layer. The hexes are pointy-top with odd rows shifted right (offset → cube for lines).
export const LAYERS = ['rough', 'fog'];
const MAX_CELLS = 20000;
const cubeOf = (c) => { const q = c.col - (c.row - (c.row & 1)) / 2; return { q, r: c.row, s: -q - c.row }; };
function cubeRound(q, r, s) {
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs; else rs = -rq - rr;
  return { col: rq + (rr - (rr & 1)) / 2, row: rr };
}
// the hexes a straight move passes through, not counting where it starts
export function hexLine(from, to) {
  const a = cubeOf(from), b = cubeOf(to), n = hexDist(from, to), out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push(cubeRound(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6, a.s + (b.s - a.s) * t - 2e-6));
  }
  return out;
}
export const roughOnPath = (state, from, to) => { const set = new Set(state.rough || []); return hexLine(from, to).some((h) => set.has(`${h.col},${h.row}`)); };
export const inFog = (state, c) => !!state.fog?.length && new Set(state.fog).has(`${c.col},${c.row}`);

// after the map or grid changes size, nothing may be left somewhere nobody can reach:
// tokens and placed Forstalls off the grid come back to the middle; painted hexes off the grid are dropped
function keepOnMap(state) {
  const { cols, rows } = gridSize(state);
  const off = (c) => c.col < 0 || c.row < 0 || c.col >= cols || c.row >= rows;
  for (const t of state.tokens) if (off(t)) Object.assign(t, freeSpot(state, t.kind));
  for (const f of state.forstalls || []) if (off(f)) Object.assign(f, freeSpot(state, 'npc'));
  for (const k of LAYERS) if (state[k]?.length) state[k] = state[k].filter((key) => { const [col, row] = key.split(',').map(Number); return !off({ col, row }); });
}

export const PING_MS = 4000; // how long a map ping stays up
export function battleAction(state, a, { warden, combat }) {
  const token = () => { const t = state.tokens.find((x) => x.id === a.id); if (!t) throw new Error('No such token.'); return t; };
  if (a.action === 'move') {
    const t = token();
    // A player moves their own character's token (the one marked "This is me"); the Warden moves everything.
    if (!warden && t.kind !== 'pc') throw new Error('Only the Warden can move that one.');
    if (!warden && t.ref !== String(a.pc || '')) throw new Error(a.pc ? `That’s not your character. You can move your own token.` : 'Tap “This is me” on your character sheet first, then you can move your token.');
    const { cols, rows } = gridSize(state);
    t.col = int(a.col, 0, cols - 1); t.row = int(a.row, 0, rows - 1);
    return;
  }
  if (a.action === 'ping') { // "over here!" — a marker everyone sees for a few seconds
    const { cols, rows } = gridSize(state);
    const who = combat?.posse?.find((p) => p.id === String(a.pc || ''))?.name || (warden ? 'The Warden' : 'Someone');
    const ping = { id: crypto.randomUUID().slice(0, 6), col: int(a.col, 0, cols - 1), row: int(a.row, 0, rows - 1), name: who, at: Date.now() };
    state.pings = [...(state.pings || []).filter((p) => Date.now() - p.at < PING_MS), ping].slice(-6);
    return ping;
  }
  if (!warden) throw new Error('Warden PIN required.');
  state.forstalls ||= [];
  const fst = () => { const f = state.forstalls.find((x) => x.id === a.id); if (!f) throw new Error('No such Forstall.'); return f; };
  switch (a.action) {
    case 'addForstall': {
      const kind = KINDS[a.kind] ? a.kind : 'backpack';
      const { cols, rows } = gridSize(state);
      const spot = a.col !== undefined ? clampHex(state, a.col, a.row) : { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
      const f = { id: `fs-${crypto.randomUUID().slice(0, 6)}`, kind, name: clean(a.name, 40) || KINDS[kind].label, ...spot, hidden: !!a.hidden, slots: Array(SLOTS).fill('') };
      state.forstalls.push(f);
      return f;
    }
    case 'moveForstall': { const f = fst(); Object.assign(f, clampHex(state, a.col, a.row)); return; }
    case 'editForstall': {
      const f = fst();
      if (a.name !== undefined) f.name = clean(a.name, 40) || f.name;
      if (a.hidden !== undefined) f.hidden = !!a.hidden;
      if (a.fuse !== undefined) f.fuse = !!a.fuse; // Crystal Burst Fuse: can it Burst?
      if (a.kind !== undefined && KINDS[a.kind]) f.kind = a.kind;
      if (Array.isArray(a.slots)) f.slots = Array.from({ length: SLOTS }, (_, i) => clean(a.slots[i], 60));
      return;
    }
    case 'removeForstall': state.forstalls = state.forstalls.filter((f) => f.id !== a.id); return;
    case 'cave': state.cave = !!a.value; return;
    case 'preset': {
      const p = PRESETS.find((x) => x.id === a.id);
      if (!p) throw new Error('Unknown map.');
      state.map = { kind: 'preset', id: p.id, name: p.name, w: p.w, h: p.h, imgV: state.map.imgV || 0 };
      state.grid = { ...state.grid, ppi: p.ppi, dx: 0, dy: 0 };
      state.cave = p.id === 'monster-burrow'; // the burrow is a cave: Sweeps roll 1 fewer die
      keepOnMap(state);
      return;
    }
    case 'uploaded': { // image bytes are stored separately (see api/battle.js)
      const w = int(a.w, 100, 8000), h = int(a.h, 100, 8000);
      const inches = num(a.inches, 4, 200) || 36;
      state.map = { kind: 'upload', id: 'upload', name: clean(a.name, 60) || 'Custom map', w, h, imgV: (state.map.imgV || 0) + 1 };
      state.grid = { ...state.grid, ppi: w / inches, dx: 0, dy: 0 };
      keepOnMap(state);
      return;
    }
    case 'grid': {
      const g = state.grid;
      if (a.ppi !== undefined) g.ppi = num(a.ppi, 20, 600);
      if (a.dx !== undefined) g.dx = num(a.dx, -600, 600);
      if (a.dy !== undefined) g.dy = num(a.dy, -600, 600);
      if (a.show !== undefined) g.show = !!a.show;
      if (a.opacity !== undefined) g.opacity = num(a.opacity, 0, 1);
      if (a.ppi !== undefined || a.dx !== undefined || a.dy !== undefined) keepOnMap(state);
      return;
    }
    case 'addToken': {
      const kind = TOKEN_KINDS.includes(a.kind) ? a.kind : 'npc';
      const spot = a.col !== undefined ? { col: int(a.col, 0, 999), row: int(a.row, 0, 999) } : freeSpot(state, kind);
      const t = { id: crypto.randomUUID().slice(0, 8), kind, ref: clean(a.ref, 12) || null, name: clean(a.name, 40) || 'Stranger', ...spot, hidden: !!a.hidden };
      state.tokens.push(t);
      return t;
    }
    case 'syncCombat': { // drop in whoever isn't on the board yet (only: 'enemies' = just the enemies, e.g. after Add enemies)
      const have = new Set(state.tokens.map((t) => t.ref).filter(Boolean));
      const party = combat?.combat?.active ? combat.combat.party : null; // mid-fight: only the characters in it
      if (a.only !== 'enemies') state.removed = [];
      if (a.only !== 'enemies') (combat?.posse || []).filter((p) => !p.dead && (!party || party.includes(p.id)) && !have.has(p.id)).forEach((p) =>
        state.tokens.push({ id: crypto.randomUUID().slice(0, 8), kind: 'pc', ref: p.id, name: p.name, ...freeSpot(state, 'pc'), hidden: false }));
      (combat?.enemies || []).filter((e) => !e.defeated && !e.out && !have.has(e.id)).forEach((e) =>
        state.tokens.push({ id: crypto.randomUUID().slice(0, 8), kind: 'enemy', ref: e.id, name: e.name, ...freeSpot(state, 'enemy'), hidden: !!a.hidden }));
      return;
    }
    case 'tokenEdit': {
      const t = token();
      if (a.name !== undefined) t.name = clean(a.name, 40) || t.name;
      if (a.hidden !== undefined) t.hidden = !!a.hidden;
      return;
    }
    case 'paint': { // {layer, cells: [[col,row]…], on}: add or erase hexes on a painted layer
      const layer = LAYERS.includes(a.layer) ? a.layer : null;
      if (!layer) throw new Error('Pick rough terrain or fog.');
      const { cols, rows } = gridSize(state);
      const set = new Set(state[layer] || []);
      for (const c of (Array.isArray(a.cells) ? a.cells : []).slice(0, 4000)) {
        const col = int(c?.[0], -1, cols), row = int(c?.[1], -1, rows);
        if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
        if (a.on === false) set.delete(`${col},${row}`); else set.add(`${col},${row}`);
      }
      state[layer] = [...set].slice(0, MAX_CELLS);
      return { count: state[layer].length };
    }
    case 'layerAll': { // fog the whole map (then reveal what they can see), or clear a layer
      const layer = LAYERS.includes(a.layer) ? a.layer : null;
      if (!layer) throw new Error('Pick rough terrain or fog.');
      if (a.on) { const { cols, rows } = gridSize(state); const all = []; for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) all.push(`${col},${row}`); state[layer] = all.slice(0, MAX_CELLS); }
      else state[layer] = [];
      return { count: state[layer].length };
    }
    case 'recenter': { // bring a token back to the middle of the map (the nearest free hex)
      const t = token();
      const rest = state.tokens;
      state.tokens = rest.filter((x) => x.id !== t.id); // its own spot doesn't count as taken
      Object.assign(t, freeSpot(state, t.kind));
      state.tokens = rest;
      return { col: t.col, row: t.row };
    }
    case 'removeToken': {
      const t = state.tokens.find((x) => x.id === a.id);
      if (t?.ref && (t.kind === 'pc' || t.kind === 'enemy')) state.removed = [...new Set([...(state.removed || []), t.ref])].slice(-50);
      state.tokens = state.tokens.filter((x) => x.id !== a.id);
      return;
    }
    case 'clearTokens': state.tokens = a.kind ? state.tokens.filter((t) => t.kind !== a.kind) : []; return;
    default: throw new Error('Unknown action.');
  }
}

export function battleView(state, { warden, combat }) {
  const posse = new Map((combat?.posse || []).map((p) => [p.id, p]));
  const enemies = new Map((combat?.enemies || []).map((e) => [e.id, e]));
  const showEnemyHp = warden || !!combat?.settings?.showEnemyHealth;
  const fl = fields(state, combat);
  const fogged = warden ? () => false : (c) => inFog(state, c) ; // the posse can't see into the fog (their own tokens always show)
  const tokens = state.tokens.filter((t) => warden || (!t.hidden && (t.kind === 'pc' || !fogged(t)))).map((t) => {
    const src = t.kind === 'pc' ? posse.get(t.ref) : t.kind === 'enemy' ? enemies.get(t.ref) : null;
    const prof = t.kind === 'enemy' && src?.profile ? profileFor(src.profile) : null;
    const hp = src && (t.kind === 'pc' || showEnemyHp) ? { health: src.health, maxHealth: src.maxHealth } : {};
    const holding = t.kind === 'pc' && src?.hold ? `${src.hold.label} — when ${src.hold.when}` : '';
    return {
      ...t,
      ...hp,
      name: src?.name || t.name,
      holding,
      img: artFor(t.kind, src, src?.name || t.name),
      beast: t.kind === 'enemy' && !!src?.profile && sweepTolerance(src).monster, // silhouette: a beast or a person
      photo: t.kind === 'pc' && src?.portrait ? `/api/image?ns=pc&id=${encodeURIComponent(src.id)}&size=head&v=${src.portrait.v}` : undefined,
      size: src?.size || (t.kind === 'pc' ? 'Human' : undefined),
      statuses: src?.statuses || {},
      grit: src?.grit,
      frenzied: t.kind === 'enemy' ? !!src?.frenzied?.length : false,
      swept: t.kind === 'enemy' && !!src && !src.defeated && fl.some((f) => f.sweep && inRange(f, t)),
      ...(warden && t.kind === 'enemy' && src && !src.defeated ? (() => { const b = bestSweep(fl, src, t); return b ? { sweepPreview: `−${b.loss} Grit at its turn (${lossText(b)}${b.why ? ` · ${b.why}` : ''})` } : {}; })() : {}),
      submerged: t.kind === 'enemy' ? !!src?.submerged : undefined,
      ...(warden && t.kind === 'enemy' && src && (prof?.features || []).some((x) => /^Natural EMP/.test(x)) ? { emp: 2 - (src.empUses || 0) } : {}),
      bleeding: !!src?.bleeding,
      // details the Warden needs at a glance
      ...(warden && src && t.kind === 'enemy' ? {
        defense: src.defense, speed: src.speed,
        attacks: (prof?.attacks || []).map((a) => `${a.name} (${a.range}, ${a.grit} Grit): ${a.effect}`),
        frenzyText: (prof?.frenzy || []).filter((f) => src.frenzied?.includes(f.name)).map((f) => `${f.name}: ${f.text}`),
      } : {}),
      ...(t.kind === 'pc' && src ? { defense: src.defense, aces: src.aces, finesse: src.skills?.finesse } : {}),
      trade: t.kind === 'pc' ? src?.trade : undefined,
      down: t.kind === 'pc' ? !!(src?.dead || src?.bleeding) : t.kind === 'enemy' ? !!src?.defeated : false,
      dead: t.kind === 'pc' ? !!src?.dead : t.kind === 'enemy' ? !!src?.defeated : false,
      gone: !!t.ref && !src, // character or enemy was deleted elsewhere
    };
  });
  return {
    v: `${state.v}.${combat?.v || 0}`,
    map: state.map, grid: state.grid, size: gridSize(state), tokens,
    current: combat?.combat?.active ? combat.combat.current : null,
    cave: !!state.cave,
    pings: (state.pings || []).filter((p) => Date.now() - p.at < PING_MS),
    // what's on the board (players don't see the Warden's hidden ones)
    rough: state.rough || [], fog: state.fog || [],
    forstalls: fl.filter((f) => f.pos && (warden || (!f.hidden && (f.owner || !fogged(f.pos))))).map(({ known, ...f }) => ({
      ...f, known: [...known],
      // monsters it could Burst right now: programmed, standing, in Range
      burst: f.fuse ? (combat?.enemies || []).filter((e) => !e.defeated && known.has(e.profile))
        .map((e) => ({ e, t: state.tokens.find((t) => t.kind === 'enemy' && t.ref === e.id) }))
        .filter(({ t }) => t && (warden || !t.hidden) && inRange(f, t)).map(({ e }) => ({ ref: e.id, name: e.name })) : [],
      // Heartbeat Sensor: how many monsters it can hear (hidden ones too — it beats, it doesn't show them)
      pulse: f.heartbeat && f.sweep ? (() => {
        const d = (combat?.enemies || []).filter((e) => !e.defeated).map((e) => state.tokens.find((t) => t.kind === 'enemy' && t.ref === e.id)).filter(Boolean)
          .map((t) => hexDist(f.pos, t)).filter((x) => f.rangeIn >= 999 || x <= f.rangeIn + 6);
        return { count: d.length, nearest: d.length ? Math.min(...d) : null };
      })() : null,
    })),
    edison: edisonConflicts(fl.filter((f) => warden || !f.hidden)),
    presets: PRESETS,
  };
}
