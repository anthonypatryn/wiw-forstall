// Combat tracker & shared dice — Wild Imaginary West Official Guidebook pp. 39–51 (Combat, Statuses),
// p. 66 (Character Death), pp. 139–140 (Monster Profiles & Frenzy).
import crypto from 'node:crypto';
import { rollPool, parsePool, poolLabel } from './dice.js';
import { PROFILES } from './profiles.js';
import { TRADES } from './trades.js';
import { newSheet, setSheetField, toggleSheetList, hasSpur, TALENTS, REPUTATION, MECH_STATES } from './sheets.js';

export const STATUSES = {
  Afraid: { skill: 'Charm', text: 'Can’t move closer to the source of fear; Actions targeting it use half the dice (round up, Gold first).' },
  Burned: { skill: 'Finesse', text: 'Lose Health equal to the Severity at the end of each turn. Lasting: Max Health −2 the first time in combat.' },
  Dazed: { skill: 'Intuition', text: 'After spending Grit on an Action, roll 1B — only a Hit or Ace lets the Action happen.' },
  Electrocuted: { skill: 'Nerve', text: 'Can’t Aim or Dodge; Gold dice become Black. +1 Severity if carrying a Battery.' },
  Poisoned: { skill: 'Nerve', text: 'Roll 2 fewer dice on every Skill roll. Lasting: 1 fewer until treated.' },
  Trapped: { skill: 'Finesse or Nerve', text: 'Can’t Move or Dodge. Captured when Severity reaches the size limit.' },
  Unconscious: { skill: 'Intuition', text: 'Can’t spend Grit or act, except to try relieving this Status.' },
};
// "Bagged 'n' Tagged" (p. 48): Trapped Severity that Captures a target.
export const CAPTURE = { Tiny: 6, Small: 8, Human: 8, Medium: 10, Large: 12, Huge: 14, Titan: null };
export const SKILLS = ['Charm', 'Finesse', 'Intuition', 'Nerve'];
const GRIT = 6;
const MAX_LOG = 80;

const id = () => crypto.randomUUID().slice(0, 8);
const now = () => Date.now();
const clean = (s, n = 40) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const int = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

export function freshCombat() {
  return {
    v: 0,
    posse: [],
    enemies: [],
    combat: { active: false, round: 0, slots: [], current: null, init: {}, surprise: [] },
    settings: { showEnemyHealth: false },
    log: [],
  };
}

// Other tools (e.g. the Forstall scanner) write into the same shared table log.
export function addLog(state, entry) { log(state, entry); }

function log(state, entry) {
  state.log = [{ id: id(), at: now(), ...entry }, ...state.log].slice(0, MAX_LOG);
}

const findPc = (s, pid) => s.posse.find((p) => p.id === pid);
const findEnemy = (s, eid) => s.enemies.find((e) => e.id === eid);
const actorName = (s, key) => (key === 'enemies' ? 'The enemies' : findPc(s, key)?.name || findEnemy(s, key)?.name || '?');

// ---------- turn order ----------
// Slots are the rolled order; the enemies share one slot and act in sequence inside it (p. 39).
function fullOrder(state) {
  const list = [];
  for (const slot of state.combat.slots) {
    if (slot === 'enemies') state.enemies.forEach((e) => list.push(e.id));
    else if (findPc(state, slot)) list.push(slot);
  }
  return list;
}
const canAct = (state, key) => { const p = findPc(state, key); if (p) return !p.dead; const e = findEnemy(state, key); return !!e && !e.defeated; };
const turnList = (state) => fullOrder(state).filter((k) => canAct(state, k));

function startTurn(state, key) {
  state.combat.current = key;
  const a = findPc(state, key) || findEnemy(state, key);
  if (!a) return;
  a.grit = GRIT + (a.gritBonus || 0); // Grit reloads at the start of each turn
  a.foolUsed = false;
  if (a.bleeding) log(state, { type: 'event', text: `${a.name} is Bleeding Out — an ally must use First Aid, or they keep rolling Skills.` });
}

function endTurn(state, key) {
  const a = findPc(state, key) || findEnemy(state, key);
  if (!a) return;
  const burn = a.statuses?.Burned || 0;
  if (burn > 0) {
    const isEnemy = !!findEnemy(state, key);
    changeHealth(state, a, -burn, isEnemy);
    log(state, { type: 'event', text: isEnemy ? `${a.name} smolders from its burns.` : `${a.name} takes ${burn} Burned damage.`, secret: isEnemy ? `${a.name} lost ${burn} Health to Burned [${burn}].` : undefined });
  }
}

function rollFinesse(pool, spur) {
  const p = parsePool(pool);
  return { ...rollPool(p.black, p.gold, spur), pool: poolLabel(p) };
}

function orderSlots(state) {
  const c = state.combat;
  const keys = [...state.posse.filter((p) => !p.dead).map((p) => p.id), ...(state.enemies.length ? ['enemies'] : [])];
  // Ties re-roll between the tied (p. 39); surprise attackers go first.
  const tiebreak = {};
  for (let pass = 0; pass < 6; pass++) {
    const groups = {};
    keys.forEach((k) => { const sig = `${c.surprise.includes(k) ? 1 : 0}|${c.init[k]?.hits ?? -1}|${tiebreak[k] ?? ''}`; (groups[sig] ||= []).push(k); });
    const tied = Object.values(groups).filter((g) => g.length > 1);
    if (!tied.length) break;
    tied.flat().forEach((k) => {
      const r = k === 'enemies' ? rollFinesse(enemyFinessePool(state)) : rollFinesse(findPc(state, k).skills.finesse, hasSpur(findPc(state, k), 'Finesse'));
      tiebreak[k] = `${tiebreak[k] ?? ''}${String(r.hits).padStart(2, '0')}`;
    });
  }
  c.tiebreak = tiebreak;
  c.slots = keys.sort((a, b) =>
    (c.surprise.includes(b) - c.surprise.includes(a))
    || ((c.init[b]?.hits ?? -1) - (c.init[a]?.hits ?? -1))
    || String(tiebreak[b] ?? '').localeCompare(String(tiebreak[a] ?? '')));
}

function enemyFinessePool(state) {
  const lead = state.enemies.find((e) => !e.defeated) || state.enemies[0];
  return lead?.skills?.finesse || '1B';
}

// ---------- health, frenzy, bleeding ----------
function changeHealth(state, a, delta, isEnemy) {
  const before = a.health;
  a.health = Math.max(0, Math.min(a.maxHealth + 20, a.health + delta));
  if (isEnemy) {
    checkFrenzy(state, a, before);
    if (a.health === 0 && !a.defeated) {
      a.defeated = true;
      log(state, { type: 'event', text: `${a.name} is down!` });
      if (state.combat.current === a.id) advance(state, false);
    }
    if (a.health > 0) a.defeated = false;
  } else {
    if (a.health === 0 && before > 0 && !a.dead) {
      a.bleeding = { skills: [] };
      log(state, { type: 'event', text: `${a.name} is Bleeding Out!` });
    }
    if (a.health > 0 && a.bleeding) a.bleeding = null;
  }
}

function checkFrenzy(state, e, before) {
  const p = PROFILES.find((x) => x.name === e.profile);
  (p?.frenzy || []).forEach((f) => {
    if (f.health == null || e.frenzied.includes(f.name)) return;
    if (e.health <= f.health && before > f.health) {
      e.frenzied.push(f.name);
      log(state, {
        type: 'frenzy', enemy: e.id,
        text: `${e.name} flies into a Frenzy!`,
        secret: `${f.name}${f.event ? ' (Event — happens now)' : ' (from its next turn)'}: ${f.text}`,
      });
    }
  });
}

function advance(state, applyEnd = true) {
  const c = state.combat;
  if (applyEnd && c.current) endTurn(state, c.current);
  const order = fullOrder(state);
  if (!order.some((k) => canAct(state, k))) { c.current = null; return; }
  // Walk forward from the current actor (even if they just went down) to the next one who can act.
  let i = order.indexOf(c.current);
  for (let step = 0; step < order.length; step++) {
    i += 1;
    if (i >= order.length) { i = 0; c.round += 1; log(state, { type: 'round', text: `Round ${c.round}` }); }
    if (canAct(state, order[i])) return startTurn(state, order[i]);
  }
}

// ---------- actions ----------
export function publicAction(state, a, { warden }) {
  switch (a.action) {
    case 'roll': {
      const pool = a.pool ? parsePool(a.pool) : parsePool(`${a.black || 0}B${a.gold || 0}G`);
      if (!pool.black && !pool.gold) throw new Error('Roll at least one die.');
      const r = rollPool(pool.black, pool.gold, !!a.spur);
      const pc = findPc(state, a.who);
      const enemy = warden ? findEnemy(state, a.who) : null;
      const who = pc?.name || enemy?.name || (warden && a.who === 'warden' ? 'Warden' : clean(a.whoName) || 'Someone');
      // Every Ace rolled in combat marks the Ace-in-the-Hole meter (p. 2, p. 22).
      let aceNote;
      if (pc && state.combat.active && r.aces) { pc.aces = Math.min(6, (pc.aces || 0) + r.aces); aceNote = pc.aces; }
      const entry = { type: 'roll', who, label: clean(a.label, 80), pool: poolLabel(pool), spur: !!a.spur, dice: r.dice, hits: r.hits, aces: r.aces, aceMeter: aceNote, hidden: warden && !!a.hidden };
      log(state, entry);
      return state.log[0];
    }
    case 'addPc': {
      const sheet = newSheet(a.trade, clean(a.name));
      state.posse.push(sheet);
      return sheet;
    }
    case 'sheet': {
      const pc = findPc(state, a.id);
      if (!pc) throw new Error('No such character.');
      if (a.list) toggleSheetList(pc, a.list, a.item);
      else if (a.fields && typeof a.fields === 'object') {
        // several fields at once (e.g. picking a weapon fills dice, Grit, slots…) — validate all before applying
        const copy = JSON.parse(JSON.stringify(pc));
        for (const [path, value] of Object.entries(a.fields).slice(0, 30)) setSheetField(copy, String(path), value);
        Object.assign(pc, copy);
      } else setSheetField(pc, String(a.path || ''), a.value);
      return;
    }
    case 'pc': return pcOp(state, a);
    case 'initiative': {
      const pc = findPc(state, a.id);
      if (!pc) throw new Error('No such character.');
      // Quick-Draw and similar bonuses: the player can add dice (e.g. "+2B") for this roll only.
      const bonus = parsePool(a.bonus || '');
      const base = parsePool(pc.skills.finesse);
      const r = rollFinesse(poolLabel({ black: base.black + bonus.black, gold: base.gold + bonus.gold }), hasSpur(pc, 'Finesse'));
      state.combat.init[pc.id] = { hits: r.hits, at: now() };
      log(state, { type: 'roll', who: pc.name, label: 'Finesse — turn order', pool: r.pool, spur: hasSpur(pc, 'Finesse'), dice: r.dice, hits: r.hits, aces: r.aces });
      if (state.combat.active) orderSlots(state);
      return;
    }
    default:
      if (!warden) throw new Error('Warden PIN required.');
      return wardenCombat(state, a);
  }
}

function pcOp(state, a) {
  const pc = findPc(state, a.id);
  if (!pc) throw new Error('No such character.');
  switch (a.op) {
    case 'health': changeHealth(state, pc, int(a.delta, -99, 99), false); break;
    case 'grit': pc.grit = int(a.value, 0, 12); break;
    case 'fool': // Fool's Grit (p. 40): once per turn, +1 Grit for 1 Health
      if (pc.foolUsed) throw new Error('Fool’s Grit is once per turn.');
      if (pc.health < 1) throw new Error('No Health left to spend.');
      pc.foolUsed = true; pc.grit += 1; changeHealth(state, pc, -1, false);
      log(state, { type: 'event', text: `${pc.name} digs deep — Fool’s Grit (+1 Grit, −1 Health).` });
      break;
    case 'status': setStatus(pc, a.status, a.value, 'Human'); break;
    case 'aces':
      pc.aces = int(a.value, 0, 6);
      if (a.used) log(state, { type: 'event', text: `${pc.name} plays their Ace-in-the-Hole!` });
      break;
    case 'bleedSkill': {
      if (!pc.bleeding) break;
      const s = SKILLS.includes(a.skill) ? a.skill : null;
      if (s && !pc.bleeding.skills.includes(s)) pc.bleeding.skills.push(s);
      break;
    }
    case 'stabilize': // First Aid from an ally (p. 66): Unconscious [5]; regain 1 Health when relieved
      pc.bleeding = null; pc.statuses.Unconscious = 5;
      log(state, { type: 'event', text: `${pc.name} is stabilized — Unconscious [5].` });
      break;
    case 'die':
      pc.bleeding = null; pc.dead = true;
      log(state, { type: 'event', text: `${pc.name} has died. Rest easy, partner.` });
      if (state.combat.current === pc.id) advance(state, false);
      break;
    case 'revive': pc.dead = false; pc.bleeding = null; pc.health = Math.max(pc.health, 1); break;
    case 'rest': // campfire or town: full Health, statuses cleared, Ace meter reset (p. 22)
      pc.health = pc.maxHealth; pc.statuses = {}; pc.aces = 0; pc.bleeding = null;
      break;
    case 'remove':
      if (state.combat.current === pc.id) advance(state, false);
      state.posse = state.posse.filter((p) => p !== pc);
      state.combat.slots = state.combat.slots.filter((s) => s !== pc.id);
      delete state.combat.init[pc.id];
      if (state.combat.current === pc.id) state.combat.current = null;
      break;
    default: throw new Error('Unknown character action.');
  }
}

function setStatus(target, status, value, size) {
  if (!STATUSES[status]) throw new Error('Unknown Status.');
  // Severity stacks but caps at 6, except Trapped, which caps at the Capture size (p. 48).
  const cap = status === 'Trapped' ? (CAPTURE[size] ?? 14) : 6;
  const v = int(value, 0, cap);
  if (v) target.statuses[status] = v; else delete target.statuses[status];
}

function uniqueName(state, base) {
  const taken = new Set(state.enemies.map((e) => e.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

function wardenCombat(state, a) {
  const c = state.combat;
  switch (a.action) {
    case 'addEnemy': {
      const count = int(a.count || 1, 1, 8);
      for (let k = 0; k < count; k++) {
        if (a.profile) {
          const p = PROFILES.find((x) => x.name === a.profile);
          if (!p) throw new Error('Unknown monster.');
          state.enemies.push({
            id: id(), name: uniqueName(state, p.name), profile: p.name, size: p.size, maxHealth: p.health, health: p.health,
            defense: p.defense, speed: p.speed, skills: p.skills, grit: GRIT, statuses: {}, frenzied: [], defeated: false,
          });
        } else {
          const name = clean(a.name);
          if (!name) throw new Error('Name the enemy.');
          const hp = int(a.health || 10, 1, 999);
          state.enemies.push({
            id: id(), name: uniqueName(state, name), profile: null, size: a.size || 'Human', maxHealth: hp, health: hp,
            defense: clean(a.defense || '—', 10), speed: 'Normal', skills: { finesse: poolLabel(parsePool(a.finesse || '2B')) },
            grit: GRIT, statuses: {}, frenzied: [], defeated: false,
          });
        }
      }
      if (c.active && !c.slots.includes('enemies')) { c.slots.push('enemies'); }
      return;
    }
    case 'enemy': {
      const e = findEnemy(state, a.id);
      if (!e) throw new Error('No such enemy.');
      switch (a.op) {
        case 'health': changeHealth(state, e, int(a.delta, -999, 999), true); break;
        case 'grit': e.grit = int(a.value, 0, 20); break;
        case 'status': setStatus(e, a.status, a.value, e.size); break;
        case 'frenzy': e.frenzied = e.frenzied.includes(a.name) ? e.frenzied.filter((n) => n !== a.name) : [...e.frenzied, a.name]; break;
        case 'remove':
          if (c.current === e.id) advance(state, false);
          state.enemies = state.enemies.filter((x) => x !== e);
          if (c.current === e.id) c.current = null;
          if (!state.enemies.length) c.slots = c.slots.filter((s) => s !== 'enemies');
          break;
        default: throw new Error('Unknown enemy action.');
      }
      return;
    }
    case 'enemyInitiative': {
      // The Warden rolls once for all enemies (p. 39).
      if (!state.enemies.length) throw new Error('Add some enemies first.');
      const lead = findEnemy(state, a.id) || state.enemies[0];
      const r = rollFinesse(lead.skills?.finesse || '1B');
      c.init.enemies = { hits: r.hits, at: now(), by: lead.name };
      log(state, { type: 'roll', who: 'The enemies', label: `Finesse — turn order (${lead.name})`, pool: r.pool, dice: r.dice, hits: r.hits, aces: r.aces });
      if (c.active) orderSlots(state);
      return;
    }
    case 'surprise': {
      const key = a.key;
      c.surprise = c.surprise.includes(key) ? c.surprise.filter((k) => k !== key) : [...c.surprise, key];
      if (c.active) orderSlots(state);
      return;
    }
    case 'start': {
      if (!state.posse.length && !state.enemies.length) throw new Error('Add the posse and some enemies first.');
      state.posse.filter((p) => !p.dead && !c.init[p.id]).forEach((p) => publicAction(state, { action: 'initiative', id: p.id }, { warden: true }));
      if (state.enemies.length && !c.init.enemies) wardenCombat(state, { action: 'enemyInitiative' });
      c.active = true; c.round = 1;
      orderSlots(state);
      log(state, { type: 'round', text: 'Combat begins — Round 1' });
      const first = turnList(state)[0];
      if (first) startTurn(state, first);
      return;
    }
    case 'next': if (c.active) advance(state); return;
    case 'setTurn': if (c.active && turnList(state).includes(a.key)) startTurn(state, a.key); return;
    case 'end':
      c.active = false; c.round = 0; c.slots = []; c.current = null; c.init = {}; c.surprise = []; c.tiebreak = {};
      log(state, { type: 'round', text: 'Combat is over.' });
      return;
    case 'clearEnemies':
      state.enemies = []; c.slots = c.slots.filter((s) => s !== 'enemies'); delete c.init.enemies;
      if (c.current && !findPc(state, c.current)) c.current = null;
      return;
    case 'clearLog': state.log = []; return;
    case 'setting': if (a.key === 'showEnemyHealth') state.settings.showEnemyHealth = !!a.value; return;
    default: throw new Error('Unknown action.');
  }
}

// ---------- views ----------
// Static reference data, fetched once per page load.
export const META = { statuses: STATUSES, capture: CAPTURE, trades: TRADES, talents: TALENTS, reputationLevels: REPUTATION, mechStates: MECH_STATES, skills: SKILLS };

export function logView(state) {
  return { v: state.v, log: state.log.filter((l) => !l.hidden).map(({ secret, ...l }) => l) };
}

export function playerCombatView(state) {
  const showHp = state.settings.showEnemyHealth;
  return {
    v: state.v,
    posse: state.posse,
    enemies: state.enemies.map((e) => ({
      id: e.id, name: e.name, size: e.size, statuses: e.statuses, defeated: e.defeated, frenzied: e.frenzied.length > 0,
      ...(showHp ? { health: e.health, maxHealth: e.maxHealth } : {}),
    })),
    combat: { ...state.combat, order: orderView(state), turnList: turnList(state) },
    settings: state.settings,
    log: state.log.filter((l) => !l.hidden).map(({ secret, ...l }) => l),
  };
}

export function wardenCombatView(state) {
  const profiles = Object.fromEntries(state.enemies.filter((e) => e.profile).map((e) => [e.profile, PROFILES.find((p) => p.name === e.profile)]));
  return {
    ...playerCombatView(state),
    enemies: state.enemies,
    log: state.log,
    profiles,
    catalog: PROFILES.map((p) => ({ name: p.name, size: p.size, health: p.health })),
  };
}

function orderView(state) {
  const c = state.combat;
  return c.slots.map((k) => ({ key: k, name: actorName(state, k), hits: c.init[k]?.hits ?? null, surprise: c.surprise.includes(k) }));
}
