// Combat tracker & shared dice — Wild Imaginary West Official Guidebook pp. 39–51 (Combat, Statuses),
// p. 66 (Character Death), pp. 139–140 (Monster Profiles & Frenzy).
import crypto from 'node:crypto';
import { rollPool, parsePool, poolLabel } from './dice.js';
import { PROFILES } from './profiles.js';
import { BOOK_NPCS } from './booknpcs.js';
import { TRADES } from './trades.js';
import { newSheet, setSheetField, toggleSheetList, hasSpur, giveStartingWeapons, weaponFields, gearFields, tierRanged, tierMelee, TIERS, ACHIEVEMENTS, EXTRA_CATS, STARTING_WEAPONS, TALENTS, REPUTATION, MECH_STATES, PACKS, KEEPSAKES } from './sheets.js';
import { CATALOG } from './catalog.js';
import { TROPHIES, CONDITIONS, CONDITION_GUIDE, trophyValue, trophyName } from './trophies.js';

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

// Book NPC stat blocks (faction figures + generic human combatants), shaped like monster profiles.
const POOLRE = /^(\d+[BG])+$/;
const NPC_PROFILES = Object.fromEntries([...BOOK_NPCS.factions.map((f) => ({ ...f.profile, faction: f.faction })), ...BOOK_NPCS.generic].map((n) => [`npc:${n.name}`, {
  name: n.name, size: 'Human', page: n.page, health: Number(n.health) || 10, defense: n.defense, speed: n.speed,
  skills: { charm: n.charm, finesse: n.finesse, intuition: n.intuition, nerve: n.nerve },
  attacks: n.attacks.flatMap((w) => w.ranges.map((r) => ({
    name: w.weapon.replace(/\b([A-Z][a-z])-(\d+)/g, (_, x, n) => `${x.toUpperCase()}-${n}`), grit: Number(r.grit) || null, range: r.range === "Arm's Reach" ? 'Melee' : r.range.replace(' Range', ''), aoe: false,
    effect: POOLRE.test(r.damage.replace(/\s|\(thrown\)/g, ''))
      ? `${r.damage.replace(/\s*\(thrown\)/, '')} damage${/thrown/.test(r.damage) ? ' (thrown)' : ''}`
      : r.damage.replace(/(\w+):\s*((?:\d+[BG])+)/g, '$1 [$2]').replace(/\+:\s*(\d+)/g, '+ Damage [$1]'),
  }))),
  features: [...n.abilities, n.talents && `Talents: ${n.talents}`, n.items && `Items: ${n.items}`, ...n.attacks.filter((w) => w.notes).map((w) => `${w.weapon.replace(/\b([A-Z][a-z])-(\d+)/g, (_, x, d) => `${x.toUpperCase()}-${d}`)}: ${w.notes}`)].filter(Boolean),
  tolerances: '', frenzy: [], img: n.img ? `npc-${n.img}` : null, faction: n.faction,
}]));
export const profileFor = (key) => PROFILES.find((p) => p.name === key) || NPC_PROFILES[key] || null;

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
// ---------- High Noon Duel (p. 58) ----------
// Both roll each Skill in order; more Hits = +1B to their Draw! (tie: both). Draw! = 2G + those B.
// Hits against you: 0 nothing · 1–2 minor injury · 3–4 severe injury + Bleeding Out · 5+ dead.
const DUEL_STEPS = [...SKILLS, 'Draw!'];
function duelInjury(hits) {
  if (hits >= 5) return { level: 'dead', text: 'Killed instantly. The cost of the Duel was their life.' };
  if (hits >= 3) return { level: 'severe', text: 'A severe, lasting injury — and Bleeding Out.' };
  if (hits >= 1) return { level: 'minor', text: 'A minor injury (decide it with the Warden).' };
  return { level: 'none', text: 'Untouched. Lucky as a prospector on a gold vein.' };
}
// p. 54 Town Rest: all Health back, Statuses relieved, Supplies reset, Forstall Battery Charges recharged
function townRest(state, pc, quiet) {
  if (pc.dead) return false;
  pc.health = pc.maxHealth; pc.statuses = {}; pc.aces = 0; pc.bleeding = null;
  if (pc.forstall) pc.forstall.charges = 2;
  if (!quiet) log(state, { type: 'event', text: `🏨 ${pc.name} takes a Town Rest: full Health, Statuses cleared, Supplies reset, Forstall recharged.` });
  return true;
}

// "pc:<id>" or "en:<id>" → { kind, who, talent(name) }
function duelist(state, ref) {
  const [kind, ...restRef] = String(ref || '').split(':');
  const rid = restRef.join(':');
  // "np:<profile key>|<name>" — an NPC straight from the book or the ledger, not on the field
  if (kind === 'np') {
    const [key, nm] = rid.split('|');
    const p = profileFor(key);
    if (!p || !String(key).startsWith('npc:')) return null;
    const talents = (p.features || []).find((f) => /^Talents:/.test(f)) || '';
    return { kind, who: { name: clean(nm) || p.name, skills: p.skills, health: p.health }, talent: (t) => talents.includes(t) };
  }
  if (kind === 'pc') { const p = findPc(state, rid); return p && { kind, who: p, talent: (t) => hasSpur(p, t) }; }
  if (kind === 'en') {
    const e = findEnemy(state, rid);
    const talents = (profileFor(e?.profile)?.features || []).find((f) => /^Talents:/.test(f)) || '';
    return e && { kind, who: e, talent: (t) => talents.includes(t) };
  }
  return null;
}
function duelAction(state, a) {
  const d = state.duel;
  switch (a.action) {
    case 'duelStart': {
      if (d && !d.done) throw new Error('A Duel is already under way — finish or call it off first.');
      const A = duelist(state, a.a), B = duelist(state, a.b);
      if (!A || !B || a.a === a.b) throw new Error('Pick two different duelists.');
      if (A.who.dead || B.who.dead || A.who.defeated || B.who.defeated) throw new Error('The dead don’t duel.');
      state.duel = { a: a.a, b: a.b, names: [A.who.name, B.who.name], step: 0, bonus: [0, 0], rounds: [], result: null, done: false, at: now() };
      log(state, { type: 'event', text: `🤠 High noon. ${A.name} and ${B.name} face off in a Duel.` });
      return state.duel;
    }
    case 'duelRoll': {
      if (!d || d.done) throw new Error('No Duel under way.');
      const sides = [duelist(state, d.a), duelist(state, d.b)];
      if (sides.some((x) => !x)) throw new Error('A duelist has left the fight.');
      const pcs = sides.map((x) => x.who);
      const skill = DUEL_STEPS[d.step];
      const rolls = pcs.map((pc, i) => {
        const draw = skill === 'Draw!';
        const pool = draw ? { black: d.bonus[i], gold: 2 } : parsePool(pc.skills?.[skill.toLowerCase()] || '1B');
        const spur = sides[i].talent(draw ? 'Pistols' : skill);
        const r = rollPool(pool.black, pool.gold, spur);
        log(state, { type: 'roll', who: pc.name, label: `Duel · ${skill}`, pool: poolLabel(pool), spur, dice: r.dice, hits: r.hits, aces: r.aces });
        return { pool: poolLabel(pool), dice: r.dice, hits: r.hits };
      });
      const round = { skill, rolls };
      if (skill !== 'Draw!') {
        const [x, y] = [rolls[0].hits, rolls[1].hits];
        round.won = x > y ? [true, false] : y > x ? [false, true] : [true, true];
        round.won.forEach((w, i) => { if (w) d.bonus[i] += 1; });
      } else {
        // each duelist takes the Hits the other rolled
        d.result = pcs.map((pc, i) => {
          const against = rolls[1 - i].hits, inj = duelInjury(against);
          if (sides[i].kind === 'np') { /* off the field: the result is only logged */ } else if (sides[i].kind === 'en') { // enemies don't Bleed Out (p. 55): a bad Draw! puts them down
            if (inj.level === 'dead' || inj.level === 'severe') { pc.health = 0; pc.defeated = true; }
          } else {
            if (inj.level === 'dead') { pc.health = 0; pc.bleeding = null; pc.dead = true; }
            if (inj.level === 'severe') { pc.health = 0; pc.bleeding = { skills: [] }; }
          }
          return { name: pc.name, against, ...inj };
        });
        d.done = true;
        log(state, { type: 'event', text: `💥 DRAW! ${d.result.map((r) => `${r.name} takes ${r.against} Hit${r.against === 1 ? '' : 's'} — ${r.text}`).join(' ')}` });
      }
      d.rounds.push(round);
      d.step += 1;
      return round;
    }
    case 'duelEnd':
      state.duel = null;
      return;
  }
  return undefined;
}

export function publicAction(state, a, { warden }) {
  if (a.action?.startsWith('duel')) return duelAction(state, a);
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
    case 'status': {
      const wasOut = (pc.statuses?.Unconscious || 0) > 0;
      setStatus(pc, a.status, a.value, 'Human');
      // p. 54: when Unconscious is relieved after being saved, regain 1 Health
      if (wasOut && !(pc.statuses?.Unconscious > 0) && pc.health === 0 && !pc.dead) {
        pc.health = 1;
        log(state, { type: 'event', text: `${pc.name} comes to and regains 1 Health.` });
      }
      break;
    }
    case 'aces':
      pc.aces = int(a.value, 0, 6);
      if (a.used) log(state, { type: 'event', text: `${pc.name} plays their Ace-in-the-Hole!` });
      break;
    case 'spend': { // Spend Prestige (p. 32)
      const COSTS = { practice: 2, health: 2, talent: 4, ability: 4, master: 6, ace2: 6 };
      const cost = COSTS[a.what];
      if (!cost) throw new Error('Pick an improvement.');
      const pr = pc.prestige;
      if ((pr.unclaimed || 0) < cost) throw new Error(`That costs ${cost} Prestige — they have ${pr.unclaimed || 0} unclaimed.`);
      const sk = SKILLS.find((x) => x === a.skill);
      const pool = sk ? parsePool(pc.skills[sk.toLowerCase()] || '') : null;
      const poolStr = (b, g) => `${b ? b + 'B' : ''}${g ? g + 'G' : ''}`;
      let text;
      switch (a.what) {
        case 'practice':
          if (!sk) throw new Error('Pick a Skill.');
          if (!pool.black) throw new Error(`${sk} has no Black die left to swap.`);
          pc.skills[sk.toLowerCase()] = poolStr(pool.black - 1, pool.gold + 1);
          text = `practices ${sk} (1B → 1G, now ${pc.skills[sk.toLowerCase()]})`;
          break;
        case 'health':
          if ((pr.healthUps || 0) >= 5) throw new Error('Health can only be improved 5 times.');
          pr.healthUps = (pr.healthUps || 0) + 1; pc.maxHealth += 1; pc.health += 1;
          text = `improves Health (max ${pc.maxHealth})`;
          break;
        case 'talent':
          if (!TALENTS.includes(a.talent)) throw new Error('Pick a Talent.');
          if (pc.talents.includes(a.talent)) throw new Error('They already have that Talent.');
          pc.talents.push(a.talent);
          text = `develops the ${a.talent} Talent`;
          break;
        case 'ability': {
          const ab = TRADES[pc.trade]?.abilities.find((x) => x.name === a.ability);
          if (!ab) throw new Error('Pick an ability.');
          if (pc.abilities.includes(ab.name)) throw new Error('Already unlocked.');
          pc.abilities.push(ab.name);
          text = `unlocks ${ab.name}`;
          break;
        }
        case 'master':
          if (!sk) throw new Error('Pick a Skill.');
          if ((pr.mastered || 0) >= 3) throw new Error('Master Skill can only be taken 3 times.');
          pr.mastered = (pr.mastered || 0) + 1;
          pc.skills[sk.toLowerCase()] = poolStr(pool.black + 1, pool.gold);
          text = `masters ${sk} (+1B, now ${pc.skills[sk.toLowerCase()]})`;
          break;
        case 'ace2':
          if (pc.aceTwo) throw new Error('Already unlocked.');
          pc.aceTwo = true;
          text = 'unlocks their second Ace-in-the-Hole';
          break;
      }
      pr.unclaimed -= cost; pc.updated = Date.now();
      log(state, { type: 'event', text: `⭐ ${pc.name} spends ${cost} Prestige and ${text}.` });
      break;
    }
    case 'bleedRoll': { // p. 54: end of each ally's turn — roll an unused Skill, need 1 Hit
      if (!pc.bleeding || pc.dead) throw new Error('They aren’t Bleeding Out.');
      const s = SKILLS.find((x) => x === a.skill);
      if (!s) throw new Error('Pick a Skill.');
      if (pc.bleeding.skills.includes(s)) throw new Error(`${s} was already rolled — pick another Skill.`);
      const pool = parsePool(pc.skills[s.toLowerCase()] || '');
      const r = rollPool(pool.black, pool.gold, hasSpur(pc, s));
      pc.bleeding.skills.push(s);
      log(state, { type: 'roll', who: pc.name, label: `Bleeding Out · ${s}`, pool: poolLabel(pool), spur: hasSpur(pc, s), dice: r.dice, hits: r.hits, aces: r.aces });
      const entry = state.log[0];
      let outcome = 'alive';
      if (!r.hits) {
        pc.bleeding = null; pc.dead = true; outcome = 'dead';
        log(state, { type: 'event', text: `${pc.name} rolled no Hits on ${s} and has died. Rest easy, partner.` });
        if (state.combat.current === pc.id) advance(state, false);
      } else if (pc.bleeding.skills.length === 4) {
        outcome = 'last';
        log(state, { type: 'event', text: `${pc.name} has rolled all four Skills — without First Aid, they die at the end of the next ally’s turn.` });
      } else {
        log(state, { type: 'event', text: `${pc.name} hangs on (${4 - pc.bleeding.skills.length} Skill${pc.bleeding.skills.length === 3 ? '' : 's'} left).` });
      }
      return { ...entry, outcome, left: 4 - (pc.bleeding?.skills.length ?? 4) };
    }
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
    case 'finish': // "Save character" at the end of creation: the sheet opens in view mode from now on
      if (pc.done !== false) break;
      pc.done = true; pc.updated = Date.now();
      log(state, { type: 'event', text: `${pc.name} the ${pc.trade} joins the posse.` });
      break;
    case 'startKit': { // Used Pistol + pocket knife (p. 7)
      const added = giveStartingWeapons(pc);
      if (!added.length) throw new Error('No empty weapon slot, or they already have them.');
      break;
    }
    case 'tierKit': { // Starting at Higher Prestige (p. 33): weapons, Scrap, Wallet, extra items, Prestige to spend
      const t = TIERS.find((x) => x.name === a.tier);
      if (!t || t.prestige === 0) throw new Error('Pick a Prestige tier above Tenderfoot.');
      const item = (id) => CATALOG.find((i) => i.id === id);
      const ranged = item(a.ranged), melee = item(a.melee);
      if (!ranged || !tierRanged(t, ranged)) throw new Error(`Pick a ${t.ranged} ranged weapon.`);
      if (!melee || !tierMelee(t, melee)) throw new Error(`Pick a ${t.melee} melee weapon or trap.`);
      const extras = (Array.isArray(a.extras) ? a.extras : []).slice(0, t.extras).map(item).filter((i) => i && EXTRA_CATS.includes(i.cat));
      // clear the Tenderfoot kit and anything a previous tier kit put in
      const old = new Set([...STARTING_WEAPONS, ...(pc.tierKit || [])]);
      const GEAR_SLOT_SUBS = ['First Aid', 'Explosives', 'Shields & Armor', 'Special Ammo & Arrows'];
      pc.weapons.forEach((w, i) => { if (old.has(w.itemId)) pc.weapons[i] = { ...w, itemId: '', type: '', manufacturer: '', model: '', slots: '', grit: '', arms: '', short: '', long: '', distant: '', upgrades: ['', '', '', ''] }; });
      pc.gear.forEach((g, i) => { if (old.has(g.itemId)) pc.gear[i] = { itemId: '', item: '', type: '', grit: '', notes: '', uses: 0 }; });
      const put = (list, fields, empty) => {
        const slot = list.findIndex(empty);
        if (slot < 0) throw new Error('No empty slot left for the loadout. Clear a weapon or gear slot first.');
        Object.assign(list[slot], fields);
      };
      const wEmpty = (w) => !w.itemId && !w.model && !w.manufacturer;
      put(pc.weapons, weaponFields(ranged), wEmpty);
      if (melee.cat === 'Traps') put(pc.gear, gearFields(melee), (g) => !g.itemId && !g.item);
      else put(pc.weapons, weaponFields(melee), wEmpty);
      // gear-type extras fill empty Gear Items slots; the rest go into Other items under their own header
      const loose = [];
      for (const it of extras) {
        const slot = GEAR_SLOT_SUBS.includes(it.sub) ? pc.gear.findIndex((g) => !g.itemId && !g.item) : -1;
        if (slot >= 0) Object.assign(pc.gear[slot], gearFields(it)); else loose.push(it);
      }
      const inv = String(pc.inventory || '').replace(/(^|\n)— Starting extras —\n(?:[^\n]+\n?)*/, '$1').trim();
      pc.inventory = (loose.length ? `${inv ? inv + '\n\n' : ''}— Starting extras —\n${loose.map((i) => i.name).join('\n')}` : inv).slice(0, 3000);
      pc.tier = t.name; pc.tierApplied = t.name; pc.tierKit = [ranged.id, melee.id, ...extras.map((i) => i.id)];
      pc.prestige = { ...pc.prestige, total: t.prestige, unclaimed: t.prestige };
      pc.wallet = String(t.wallet); pc.scrap = String(t.scrap);
      if (t.packs < 2) pc.pack2 = '';
      pc.updated = Date.now();
      log(state, { type: 'event', text: `${pc.name} starts as a ${t.name}: ${t.prestige} Prestige to spend, ${ranged.name}, ${melee.name}, $${t.wallet}, ${t.scrap} Scrap.` });
      return { ranged: ranged.name, melee: melee.name };
    }
    case 'rollWallet': { // Step 5 (p. 8): roll 6B — Aces $2, Hits $1
      if (String(pc.wallet || '').trim() && !a.force) throw new Error('Their Wallet already has money in it.');
      const r = rollPool(6, 0, false);
      pc.wallet = String(r.hits);
      log(state, { type: 'roll', who: pc.name, label: 'Starting Wallet ($)', pool: '6B', spur: false, dice: r.dice, hits: r.hits, aces: r.aces });
      return { ...state.log[0], dollars: r.hits };
    }
    case 'rest': // (older clients) = town rest
    case 'townRest': townRest(state, pc); break;
    case 'campRest': { // p. 52: roll a Skill of your choice, regain Health equal to Hits
      if (pc.dead) throw new Error('The dead don’t rest.');
      const s = SKILLS.find((x) => x === a.skill);
      if (!s) throw new Error('Pick a Skill to roll.');
      const pool = parsePool(pc.skills[s.toLowerCase()] || '');
      const r = rollPool(pool.black, pool.gold, hasSpur(pc, s));
      log(state, { type: 'roll', who: pc.name, label: `Campfire rest · ${s}`, pool: poolLabel(pool), spur: hasSpur(pc, s), dice: r.dice, hits: r.hits, aces: r.aces });
      const entry = state.log[0], before = pc.health;
      changeHealth(state, pc, r.hits, false);
      pc.aces = 0;
      log(state, { type: 'event', text: `🔥 ${pc.name} rests by the campfire and regains ${pc.health - before} Health (${pc.health}/${pc.maxHealth}).` });
      return { ...entry, healed: pc.health - before };
    }
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

const money = (v) => Number(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
function wardenCombat(state, a) {
  const c = state.combat;
  switch (a.action) {
    case 'award': { // after a fight or expedition: Prestige, dollars, Scrap, loot to chosen characters
      const ids = Array.isArray(a.ids) ? a.ids : [];
      const pcs = state.posse.filter((p) => ids.includes(p.id) && !p.dead);
      if (!pcs.length) throw new Error('Pick at least one character.');
      const prestige = int(a.prestige, 0, 100), dollars = int(a.dollars, 0, 100000), scrap = int(a.scrap, 0, 10000);
      const item = clean(a.item, 120), reason = clean(a.reason, 120);
      if (!prestige && !dollars && !scrap && !item) throw new Error('Nothing to award yet.');
      for (const pc of pcs) {
        if (prestige) { pc.prestige.total += prestige; pc.prestige.unclaimed += prestige; }
        if (dollars) pc.wallet = String(money(pc.wallet) + dollars);
        if (scrap) pc.scrap = String(money(pc.scrap) + scrap);
        if (item) pc.inventory = `${String(pc.inventory || '').trim()}\nLoot: ${item}`.trim().slice(0, 3000);
        pc.updated = Date.now();
      }
      const what = [prestige && `+${prestige} Prestige`, dollars && `$${dollars}`, scrap && `${scrap} Scrap`, item && item].filter(Boolean).join(', ');
      log(state, { type: 'event', text: `🏆 ${pcs.map((p) => p.name).join(', ')} ${pcs.length > 1 ? 'each get' : 'gets'} ${what}${reason ? ` — ${reason}` : ''}.` });
      return { count: pcs.length, what };
    }
    case 'achieve': { // Warden grants (or takes back) a special Achievement
      const pc = findPc(state, a.id);
      const ach = ACHIEVEMENTS.find((x) => x.name === a.name);
      if (!pc || !ach) throw new Error('Pick a character and an Achievement.');
      const has = (pc.achievements ||= []).includes(ach.name);
      if (a.on && !has) {
        pc.achievements.push(ach.name);
        log(state, { type: 'event', text: `🏅 ${pc.name} earns the title “${ach.name}”!` });
      } else if (!a.on && has) {
        pc.achievements = pc.achievements.filter((x) => x !== ach.name);
        if (pc.title === ach.name) pc.title = '';
      }
      pc.updated = Date.now();
      return;
    }
    case 'loot': { // p. 79: a slain monster's trophy goes to a posse member, valued by condition + size
      const e = findEnemy(state, a.enemy), pc = findPc(state, a.pc);
      if (!e || !pc) throw new Error('Pick who takes the trophy.');
      const p = profileFor(e.profile), text = TROPHIES[p?.name];
      if (!text) throw new Error('This one has no trophy listed.');
      const cond = CONDITIONS.includes(a.condition) ? a.condition : 'Good';
      const [lo, hi] = trophyValue(cond, e.size) || [0, 0];
      const money = (n) => (n < 10 ? n.toFixed(2) : String(n));
      const name = trophyName(text);
      pc.inventory = `${String(pc.inventory || '').trim()}\nTrophy: ${name} (${p.name}, ${cond}) — sells $${money(lo)}–$${money(hi)}`.trim().slice(0, 3000);
      pc.updated = Date.now();
      e.looted = pc.name;
      log(state, { type: 'event', text: `🏆 ${pc.name} takes the ${name} from the ${p.name} — ${cond} condition, worth $${money(lo)}–$${money(hi)}.` });
      return { name, lo, hi };
    }
    case 'search': { // p. 79: search a body/wagon/rubble — roll Intuition, the Warden decides what's found
      const e = findEnemy(state, a.enemy), pc = findPc(state, a.pc);
      if (!e || !pc) throw new Error('Pick who searches.');
      const pool = parsePool(pc.skills.intuition || '');
      const r = rollPool(pool.black, pool.gold, hasSpur(pc, 'Intuition'));
      log(state, { type: 'roll', who: pc.name, label: `Searches ${e.name} · Intuition`, pool: poolLabel(pool), spur: hasSpur(pc, 'Intuition'), dice: r.dice, hits: r.hits, aces: r.aces });
      return state.log[0];
    }
    case 'townRestAll': {
      const rested = state.posse.filter((pc) => townRest(state, pc, true));
      log(state, { type: 'event', text: `🏨 The posse takes a Town Rest (${rested.map((p) => p.name).join(', ') || 'no one'}): full Health, Statuses cleared, Supplies reset, Forstalls recharged.` });
      return { count: rested.length };
    }
    case 'jackpot': { // p. 54: the table votes an extra Prestige point to one player
      const pc = findPc(state, a.id);
      if (!pc) throw new Error('Pick who gets the Jackpot.');
      pc.prestige.total += 1; pc.prestige.unclaimed += 1; pc.updated = Date.now();
      log(state, { type: 'event', text: `🎰 Jackpot! The posse votes ${pc.name} the play of the game${a.reason ? ` — ${clean(a.reason, 120)}` : ''}. +1 Prestige.` });
      return { name: pc.name };
    }
    case 'addEnemy': {
      const count = int(a.count || 1, 1, 8);
      for (let k = 0; k < count; k++) {
        if (a.profile) {
          const p = profileFor(a.profile);
          if (!p) throw new Error('Unknown monster.');
          state.enemies.push({
            id: id(), name: uniqueName(state, clean(a.name) || p.name), profile: a.profile, size: p.size, maxHealth: p.health, health: p.health,
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
export const META = { achievements: ACHIEVEMENTS, tiers: TIERS, packs: PACKS, keepsakes: KEEPSAKES, statuses: STATUSES, capture: CAPTURE, trades: TRADES, talents: TALENTS, reputationLevels: REPUTATION, mechStates: MECH_STATES, skills: SKILLS };

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
    duel: state.duel || null,
    log: state.log.filter((l) => !l.hidden).map(({ secret, ...l }) => l),
  };
}

export function wardenCombatView(state) {
  const profiles = Object.fromEntries(state.enemies.filter((e) => e.profile).map((e) => { const p = profileFor(e.profile); return [e.profile, { ...p, trophy: TROPHIES[p?.name] || '' }]; }));
  return {
    ...playerCombatView(state),
    enemies: state.enemies,
    log: state.log,
    profiles,
    catalog: PROFILES.map((p) => ({ name: p.name, size: p.size, health: p.health })),
    loot: { conditions: CONDITIONS, guide: CONDITION_GUIDE },
    npcCatalog: Object.entries(NPC_PROFILES).map(([key, p]) => ({ key, name: p.name, faction: p.faction || '', health: p.health })),
  };
}

function orderView(state) {
  const c = state.combat;
  return c.slots.map((k) => ({ key: k, name: actorName(state, k), hits: c.init[k]?.hits ?? null, surprise: c.surprise.includes(k) }));
}
