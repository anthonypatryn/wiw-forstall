// Forstall Scanning rules — Wild Imaginary West Official Guidebook pp. 83–84.
import crypto from 'node:crypto';
import { MONSTERS } from './monsters.js';
import { TRAITS, TRAIT_IDS, SWEEP_TOLERANCES, hasEffect } from './traits.js';

// Official bullet dice faces (Guidebook p. 3 conversion table).
export const FACES = {
  B: ['blank', 'blank', 'spur', 'hit', 'hit', 'ace'],
  G: ['blank', 'spur', 'hit', 'hit', 'hit', 'ace'],
};
const HIT_VALUE = { blank: 0, spur: 0, hit: 1, ace: 2 };
const MAX_DICE = 12;
const MAX_LOG = 40;

const rand = (n) => crypto.randomInt(n);
const now = () => Date.now();
const digitsOf = (kz) => kz.replace(/\D/g, '').split('').map(Number);
export const formatKz = (d) => `${d[0]}-${d[1]}-${d.slice(2).join('')}`;

export function freshState() {
  return { v: 0, active: null, jammed: false, settings: { easyMode: false }, custom: [], notebook: {} };
}

export function allMonsters(state) {
  return [...MONSTERS.map((m) => ({ ...m, custom: false })), ...state.custom.map((m) => ({ ...m, custom: true }))]
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findMonster(state, name) {
  return allMonsters(state).find((m) => m.name === name) || null;
}

function entryFor(state, name) {
  if (!state.notebook[name]) {
    state.notebook[name] = { revealed: [], guesses: [], rolls: [], solved: false, notes: '', started: now(), updated: now() };
  }
  return state.notebook[name];
}

// Wordle/Mastermind scoring, per the Guidebook's 6-4-2713 vs 6-1-2829 example.
export function scoreGuess(guess, answer) {
  const res = Array(6).fill('red');
  const left = {};
  answer.forEach((d, i) => { if (guess[i] === d) res[i] = 'green'; else left[d] = (left[d] || 0) + 1; });
  guess.forEach((d, i) => {
    if (res[i] !== 'green' && left[d]) { res[i] = 'yellow'; left[d]--; }
  });
  return res;
}

function greenPositions(entry) {
  const s = new Set();
  entry.guesses.forEach((g) => g.result.forEach((r, i) => r === 'green' && s.add(i)));
  return s;
}

function rollDie(color, spurTalent) {
  const faces = [FACES[color][rand(6)]];
  while (spurTalent && faces[faces.length - 1] === 'spur') faces.push(FACES[color][rand(6)]);
  return { color, faces, face: faces[faces.length - 1] };
}

// Chupacabra "Spinal Deflectors": roll with half the dice pool (rounded down).
function halvePool(black, gold) {
  const total = Math.floor((black + gold) / 2);
  const g = Math.min(gold, Math.ceil(total * (gold / Math.max(1, black + gold))));
  return { black: total - g, gold: g };
}

export function doRoll(state, { black, gold, spurTalent }) {
  const m = state.active && findMonster(state, state.active);
  if (!m) throw new Error('No target locked — the Warden has to pick a monster first.');
  const entry = entryFor(state, m.name);
  if (entry.solved) throw new Error(`${m.name}'s frequency is already fully decoded.`);
  if (state.jammed) throw new Error('The Forstall is jammed — no Scanning until the Warden clears it.');

  let pool = { black: clampDice(black), gold: clampDice(gold) };
  const requested = { ...pool };
  const halved = hasEffect(m, 'half');
  if (halved) pool = halvePool(pool.black, pool.gold);
  if (pool.black + pool.gold === 0) throw new Error('Roll at least one die.');

  const dice = [
    ...Array.from({ length: pool.black }, () => rollDie('B', !!spurTalent)),
    ...Array.from({ length: pool.gold }, () => rollDie('G', !!spurTalent)),
  ];
  const hits = dice.reduce((n, d) => n + HIT_VALUE[d.face], 0);

  // Each Hit earns one digit the posse doesn't already know (p. 83).
  const answer = digitsOf(m.kz);
  const greens = greenPositions(entry);
  let candidates = [0, 1, 2, 3, 4, 5].filter((i) => !entry.revealed.includes(i) && !greens.has(i));
  if (!candidates.length) candidates = [0, 1, 2, 3, 4, 5].filter((i) => !entry.revealed.includes(i));
  shuffle(candidates);
  const newPositions = candidates.slice(0, hits);
  entry.revealed.push(...newPositions);

  const roll = {
    at: now(), requested, pool, halved,
    spurTalent: !!spurTalent, dice, hits,
    newPositions,
    newDigits: newPositions.map((i) => answer[i]).sort((a, b) => a - b),
  };
  entry.rolls = [roll, ...entry.rolls].slice(0, MAX_LOG);
  entry.updated = now();
  if (entry.revealed.length === 6 && state.settings.easyMode) { entry.solved = true; entry.solvedAt = now(); }
  const { newPositions: _hidden, ...publicRoll } = roll; // positions stay secret from players
  return publicRoll;
}

export function doGuess(state, { digits }) {
  const m = state.active && findMonster(state, state.active);
  if (!m) throw new Error('No target locked.');
  if (!Array.isArray(digits) || digits.length !== 6 || digits.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error('A guess needs all six digits.');
  }
  const entry = entryFor(state, m.name);
  if (entry.solved) throw new Error('Already decoded.');
  if (state.jammed) throw new Error('The Forstall is jammed — the display is dead until the Warden clears it.');
  const result = scoreGuess(digits, digitsOf(m.kz));
  entry.guesses.push({ at: now(), digits, result });
  if (result.every((r) => r === 'green')) { entry.solved = true; entry.solvedAt = now(); }
  entry.updated = now();
  return { result, solved: entry.solved };
}

export function doNote(state, { name, text }) {
  if (!state.notebook[name]) throw new Error('No notebook entry for that monster.');
  state.notebook[name].notes = String(text || '').slice(0, 2000);
}

// ---- Warden actions ----
export function wardenAction(state, a) {
  switch (a.action) {
    case 'setTarget': {
      if (a.name && !findMonster(state, a.name)) throw new Error('Unknown monster.');
      state.active = a.name || null;
      state.jammed = false;
      if (a.name) entryFor(state, a.name);
      return;
    }
    case 'setJam':
      state.jammed = !!a.value && !!state.active; return;
    case 'setEasy':
      state.settings.easyMode = !!a.value; return;
    case 'reveal': {
      const e = entryFor(state, a.name);
      const i = Number(a.position);
      if (i >= 0 && i < 6 && !e.revealed.includes(i)) e.revealed.push(i);
      e.updated = now();
      return;
    }
    case 'solve': {
      const e = entryFor(state, a.name);
      e.revealed = [0, 1, 2, 3, 4, 5]; e.solved = true; e.solvedAt = now(); e.updated = now();
      return;
    }
    case 'reset':
      delete state.notebook[a.name]; return;
    case 'addCustom': {
      const name = cleanName(a.name);
      const d = digitsOf(String(a.kz || ''));
      if (!name) throw new Error('Name required.');
      if (d.length !== 6) throw new Error('Frequency must be six digits.');
      if (findMonster(state, name)) throw new Error('A monster with that name already exists.');
      const clash = allMonsters(state).find((m) => digitsOf(m.kz).join('') === d.join(''));
      if (clash) throw new Error(`That frequency is already taken by the ${clash.name}.`);
      const traits = (Array.isArray(a.traits) ? a.traits : []).filter((t) => TRAIT_IDS.has(t));
      const sweep = SWEEP_TOLERANCES.includes(String(a.sweep)) ? String(a.sweep) : null;
      state.custom.push({ name, kz: formatKz(d), size: a.size || 'Medium', page: null, traits, sweep });
      return;
    }
    case 'removeCustom':
      state.custom = state.custom.filter((m) => m.name !== a.name);
      if (state.active === a.name) state.active = null;
      delete state.notebook[a.name];
      return;
    default:
      throw new Error('Unknown action.');
  }
}

// ---- Views ----
// Players never receive a frequency until it's fully decoded.
function publicEntry(state, name, e) {
  const m = findMonster(state, name);
  if (!m) return null;
  const answer = digitsOf(m.kz);
  const easy = state.settings.easyMode;
  const greens = greenPositions(e);
  const positional = answer.map((d, i) => (e.solved || greens.has(i) || (easy && e.revealed.includes(i)) ? d : null));
  return {
    name, size: m.size, page: m.page, solved: e.solved, notes: e.notes,
    kz: e.solved ? m.kz : null,
    known: e.revealed.map((i) => answer[i]).sort((a, b) => a - b), // "numerical order" (p. 83 tip)
    positional,
    guesses: e.guesses,
    rolls: e.rolls.map(({ newPositions, ...r }) => r),
    started: e.started, updated: e.updated, solvedAt: e.solvedAt,
    scanHalf: hasEffect(m, 'half'),
  };
}

export function playerView(state) {
  const notebook = Object.entries(state.notebook)
    .map(([n, e]) => publicEntry(state, n, e))
    .filter(Boolean)
    .sort((a, b) => b.updated - a.updated);
  return {
    v: state.v,
    settings: state.settings,
    jammed: !!state.jammed,
    active: state.active ? notebook.find((e) => e.name === state.active) || null : null,
    notebook,
  };
}

export function wardenView(state) {
  const monsters = allMonsters(state);
  return {
    ...playerView(state),
    monsters,
    traits: TRAITS,
    sweepTolerances: SWEEP_TOLERANCES,
    progress: Object.fromEntries(Object.entries(state.notebook).map(([n, e]) => [n, { revealed: e.revealed, solved: e.solved }])),
  };
}

// ---- utils ----
function clampDice(n) { n = Math.floor(Number(n) || 0); return Math.max(0, Math.min(MAX_DICE, n)); }
function cleanName(s) { return String(s || '').replace(/[<>]/g, '').trim().slice(0, 40); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
