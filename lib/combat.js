// Combat tracker & shared dice — Wild Imaginary West Official Guidebook pp. 39–51 (Combat, Statuses),
// p. 66 (Character Death), pp. 139–140 (Monster Profiles & Frenzy).
import crypto from 'node:crypto';
import { rollPool, rollDie, parsePool, poolLabel, HIT_VALUE } from './dice.js';
import { PROFILES } from './profiles.js';
import { BOOK_NPCS } from './booknpcs.js';
import { TRADES } from './trades.js';
import { newSheet, setSheetField, toggleSheetList, hasSpur, giveStartingWeapons, weaponFields, gearFields, tierRanged, tierMelee, upgradeFits, upgradeType, mechState, blankWeapon, blankGear, blankHorse, blankForstall, blankMech, TIERS, ACHIEVEMENTS, EXTRA_CATS, STARTING_WEAPONS, TALENTS, REPUTATION, MECH_STATES, PACKS, KEEPSAKES } from './sheets.js';
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
  // Grit reloads at the start of each turn — unless an ability set this turn's max (Fired Up: 9 then 3; Fired Up 2: allies 8, Marshal 2)
  if (a.gritNext != null) { a.grit = a.gritNext; a.gritLimited = a.gritNext < GRIT; a.gritNext = null; }
  else { a.grit = GRIT + (a.gritBonus || 0); a.gritLimited = false; }
  a.foolUsed = false; a.firedUp = false;
  if (a.hold) { log(state, { type: 'event', text: `⏳ ${a.name}’s prepared ${a.hold.label} fizzled — it wasn’t triggered in time.` }); a.hold = null; }
  a.dodge = 0; a.aimed = false; a.relieved = []; // Dodge is forfeited at the start of your next turn (p. 42)
  a.turnLog = []; a.lastMove = null; a.prepared = false;
  a.crippled = !!a.crippledNext; a.crippledNext = false; // Crippling Precision: moves cost double this turn
  a.freeAim = !!a.freeAimNext; a.freeAimNext = false;     // Biological Amplification: a free Aim
  if (a.gritLimited) note(a, `limited to ${a.grit} Grit this turn`, 0);
  if (a.crippled) note(a, 'crippled — moving costs double', 0);
  if (a.freeDodgeNext) { // Biological Amplification: a free Dodge [1B]
    a.freeDodgeNext = false;
    const r = rollPool(1, 0, false);
    a.dodge += r.hits;
    log(state, { type: 'roll', who: a.name, label: 'Free Dodge (Biological Amplification)', pool: '1B', spur: false, dice: r.dice, hits: r.hits, aces: r.aces });
    note(a, `free Dodge 1B → ${r.hits} ready`, 0);
  }
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

// ---------- automatic Achievements (p. 34) — checked after every change ----------
export function autoAchievements(state) {
  for (const pc of state.posse) {
    const has = (n) => (pc.achievements || []).includes(n);
    if (!has('The Scrapper') && money(pc.scrap) >= 100) {
      (pc.achievements ||= []).push('The Scrapper');
      log(state, { type: 'event', text: `🏅 ${pc.name} earns the title “The Scrapper” — 100 Scrap!` });
    }
  }
}

// ---------- Skill checks (pp. 12–13): the Warden sets a target number; Helping adds the best half-pool roll ----------
export const DIFFICULTY = [['Very Easy', 1], ['Easy', 2], ['Medium', 3], ['Difficult', 4], ['Very Difficult', 5]];
function checkOutcome(state, ck, pid) {
  const r = ck.rolls[pid];
  if (!r) return null;
  const help = Math.max(0, ...Object.values(ck.helps || {}).map((h) => h.hits));
  const total = r.hits + help;
  return { total, help, ok: total >= ck.target };
}
function logOutcome(state, ck, pid) {
  const o = checkOutcome(state, ck, pid), pc = findPc(state, pid);
  if (!o || !pc) return;
  log(state, { type: 'event', text: o.ok ? `✅ ${pc.name} succeeds — ${o.total}/${ck.target} Hits${o.help ? ` (incl. ${o.help} from Helping)` : ''}${ck.note ? ` · ${ck.note}` : ''}.`
    : `❌ ${pc.name} falls short — ${o.total}/${ck.target} Hits${o.help ? ` (incl. ${o.help} from Helping)` : ''}${ck.note ? ` · ${ck.note}` : ''}.` });
}

function resolveChallenge(state, ck) {
  const rows = ck.who.map((pid) => ({ name: ck.rolls[pid].name, hits: ck.rolls[pid].hits }));
  if (ck.npc) { // the NPC rolls once everyone else has
    const d = duelist(state, ck.npc);
    const sp = parsePool(d?.who.skills?.[ck.skill.toLowerCase()] || '1B');
    const r = rollPool(sp.black, sp.gold, d ? d.talent(ck.skill) : false);
    log(state, { type: 'roll', who: ck.npc.name, label: `Challenge · ${ck.skill}`, pool: poolLabel(sp), spur: d ? d.talent(ck.skill) : false, dice: r.dice, hits: r.hits, aces: r.aces });
    rows.push({ name: ck.npc.name, hits: r.hits });
  }
  const best = Math.max(...rows.map((x) => x.hits)), top = rows.filter((x) => x.hits === best);
  ck.last = rows;
  if (top.length > 1) { // "the struggle ain't over yet" — everyone rolls again
    ck.rolls = {}; ck.round = (ck.round || 1) + 1;
    log(state, { type: 'event', text: `⚔️ Tie at ${best} (${top.map((x) => x.name).join(' & ')}) — the struggle ain’t over. Roll ${ck.skill} again!` });
  } else {
    ck.winner = top[0].name;
    log(state, { type: 'event', text: `🏆 ${top[0].name} wins the ${ck.skill} Challenge — ${rows.map((x) => `${x.name} ${x.hits}`).join(' · ')}${ck.note ? ` · ${ck.note}` : ''}.` });
  }
}

// ---------- Undo in combat: a snapshot of the fight before each action ----------
const UNDO_MAX = 12;
const UNDO_PC_OPS = new Set(['attack', 'dodge', 'relieve', 'useItem', 'improvise', 'prepare', 'useAbility', 'fool', 'health', 'grit', 'status', 'aces',
  'endTurn', 'horseGrit', 'mount', 'bleedRoll', 'stabilize', 'die', 'checkRoll', 'ammo', 'prepare', 'fireHold', 'dropHold']);
const UNDO_ACTIONS = new Set(['enemyAttack', 'next', 'roll', 'enemy', 'checkRoll']);
const turnKeyOf = (state) => `${state.combat.round}:${state.combat.current}`;
export function isUndoable(state, a) {
  if (!state.combat?.active) return false;
  return a.action === 'pc' ? UNDO_PC_OPS.has(a.op) : UNDO_ACTIONS.has(a.action);
}
export function pushUndo(state, label = '', extra = {}) {
  const snap = JSON.parse(JSON.stringify({ posse: state.posse, enemies: state.enemies, combat: state.combat, duel: state.duel ?? null, checks: state.checks ?? [] }));
  (state.undoStack ||= []).push({ id: id(), turnKey: turnKeyOf(state), label, logTop: state.log[0]?.id ?? null, snap, ...extra });
  if (state.undoStack.length > UNDO_MAX) state.undoStack.shift();
}
export function undoLabel(state, a) {
  const who = a.action === 'pc' ? findPc(state, a.id)?.name : a.action === 'enemy' ? findEnemy(state, a.id)?.name : a.action === 'enemyAttack' ? findEnemy(state, a.enemy)?.name : '';
  const OPS = { attack: 'attack', dodge: 'Dodge', relieve: 'relieve a Status', useItem: 'use item', improvise: 'improvise', prepare: 'prepare', useAbility: a.name || 'ability',
    fool: 'Fool’s Grit', health: 'Health change', grit: 'Grit change', status: 'Status change', aces: 'Ace meter', endTurn: 'end turn', horseGrit: '+1 Grit', mount: 'mount up',
    bleedRoll: 'Bleeding Out roll', stabilize: 'stabilize', die: 'death', checkRoll: 'Skill roll', ammo: 'ammo', remove: 'remove', rename: 'rename' };
  const what = a.action === 'next' || a.action === 'setTurn' ? 'change of turn' : a.action === 'enemyAttack' ? 'attack' : a.action === 'roll' ? 'dice roll' : OPS[a.op] || a.op || a.action;
  return who ? `${who}: ${what}` : what;
}
// mode 'last' = one step; 'turn' = everything done this turn. Returns token moves to put back.
export function undoCombat(state, { warden, mode }) {
  const stack = state.undoStack || [];
  if (!state.combat?.active || !stack.length) throw new Error('Nothing to undo.');
  const key = turnKeyOf(state), popped = [];
  if (mode === 'turn') {
    while (stack.length && stack[stack.length - 1].turnKey === key) popped.push(stack.pop());
    if (!popped.length) throw new Error('Nothing has been done this turn yet.');
  } else {
    const top = stack[stack.length - 1];
    if (!warden && top.turnKey !== key) throw new Error('Only this turn’s actions can be undone — ask the Warden.');
    popped.push(stack.pop());
  }
  const oldest = popped[popped.length - 1];
  Object.assign(state, oldest.snap);
  const idx = oldest.logTop ? state.log.findIndex((l) => l.id === oldest.logTop) : state.log.length;
  if (idx > 0) state.log = state.log.slice(idx);
  const labels = popped.map((p) => p.label).reverse();
  log(state, { type: 'event', text: `↶ Undone: ${labels.join(' · ')}` });
  return { tokens: popped.filter((p) => p.token).map((p) => p.token), labels };
}

// ---------- the Grit engine: every Action spends Grit and is noted in this turn's log (pp. 40–43) ----------
function note(a, text, grit) {
  (a.turnLog ||= []).push({ id: id(), text, grit: grit || 0 });
  if (a.turnLog.length > 30) a.turnLog.shift();
}
// Move (p. 41): Normal 1 Grit per Short Range (6"), Fast 2 Short Ranges per Grit, Slow 2 / Very Slow 3 Grit each.
const SPEED_WORDS = ['Very Slow', 'Slow', 'Normal', 'Fast'];
const speedOf = (text) => SPEED_WORDS.find((w) => String(text || '').toLowerCase().startsWith(w.toLowerCase())) || 'Normal';
function moverSpeed(kind, a) {
  if (kind === 'enemy') return { speed: speedOf(a.speed), why: '' };
  if (a.mounted === 'horse') return { speed: 'Fast', why: 'riding' };
  if (a.mounted === 'mech') return { speed: speedOf(a.mech?.speed), why: 'in the mech', compromised: a.mech?.state === 'Compromised' };
  return { speed: 'Normal', why: '' };
}
export function moveCost(kind, a, inches, rough) {
  if (!inches) return { cost: 0, speed: 'Normal' };
  const sp = moverSpeed(kind, a);
  const shorts = Math.ceil(inches / 6);
  let cost = sp.speed === 'Fast' ? Math.ceil(inches / 12) : sp.speed === 'Slow' ? shorts * 2 : sp.speed === 'Very Slow' ? shorts * 3 : shorts;
  if (rough) cost *= 2; // Rough Terrain doubles the cost (p. 42)
  if (a.crippled) cost *= 2; // Crippling Precision (Doctor)
  if (sp.compromised) cost = Math.min(6, cost * 2); // p. 92: a Compromised mech's Move costs double, max 6
  return { cost: Math.max(1, cost), speed: sp.speed, why: sp.why };
}
// Called by the battle map before a token moves. Throws if it isn't allowed; returns what was spent.
export function chargeMove(state, { kind, ref, inches, rough, warden, tokenId, from, to }) {
  const c = state.combat;
  const a = kind === 'pc' ? findPc(state, ref) : findEnemy(state, ref);
  if (!a || !c.active) return { cost: 0 };
  if (c.current !== ref) {
    if (warden) return { cost: 0, free: true }; // the Warden can reposition anyone off-turn, free
    throw new Error(`It isn’t ${a.name}’s turn.`);
  }
  if (a.dead || a.bleeding || a.defeated) throw new Error(`${a.name} can’t move.`);
  if (a.statuses?.Trapped) throw new Error(`${a.name} is Trapped — no moving until it’s relieved.`);
  if (a.statuses?.Unconscious) throw new Error(`${a.name} is Unconscious.`);
  const m = moveCost(kind, a, inches, rough);
  if ((a.grit || 0) < m.cost) throw new Error(`Moving ${inches}″ costs ${m.cost} Grit (${m.speed}${rough ? ', rough terrain' : ''}) — ${a.name} has ${a.grit || 0}.`);
  a.grit -= m.cost;
  note(a, `moved ${inches}″${rough ? ' (rough)' : ''}`, m.cost);
  a.lastMove = { logId: a.turnLog[a.turnLog.length - 1].id, tokenId, from, to, cost: m.cost };
  return m;
}
export function undoMove(state, ref) {
  const a = findPc(state, ref) || findEnemy(state, ref);
  const lm = a?.lastMove;
  if (!lm || a.turnLog?.[a.turnLog.length - 1]?.id !== lm.logId) throw new Error('Only the last thing done can be undone, and only if it was a move.');
  a.grit += lm.cost; a.turnLog.pop(); a.lastMove = null;
  return lm;
}

// ---------- Trade abilities in play: Grit cost, dice, 2/day uses, and the ones that change Grit ----------
// Read straight from the ability text: "Spend 2 Grit", "roll 2G", "(2/day)".
export function abilityInfo(ab) {
  const t = String(ab?.text || '');
  const cost = Number((t.match(/Spend (\d+) Grit/i) || [])[1] || 0);
  const dice = ((t.match(/\broll(?:ing)? (\d+[BG](?:\d+[BG])?)/i) || [])[1] || '').toUpperCase();
  const talent = (String(ab?.name || '').match(/\(([^)]+)\)\s*$/) || [])[1] || '';
  const special = ['Fired Up', 'Fired Up 2', 'Crippling Precision', 'Biological Amplification', 'Digging Deep'].includes(ab?.name) ? ab.name : '';
  return { cost, dice, daily: /\(2\/day\)/i.test(t), talent: talent === 'Melee' ? 'Melee Weapons' : talent, special, usable: !!(cost || dice || special) };
}
function useAbility(state, pc, a) {
  const t = TRADES[pc.trade];
  const aceIdx = t.aces.findIndex((x) => x.name === a.name);
  const ab = aceIdx >= 0 ? t.aces[aceIdx] : t.abilities.find((x) => x.name === a.name);
  if (!ab) throw new Error('Pick an ability.');
  if (aceIdx < 0 && !pc.abilities.includes(ab.name)) throw new Error(`${ab.name} isn’t unlocked yet.`);
  if (aceIdx >= 0) {
    if ((pc.aces || 0) < 6) throw new Error('The Ace-in-the-Hole meter isn’t full yet (6 Aces).');
    if (aceIdx === 1 && !pc.aceTwo) throw new Error('Ace-in-the-Hole 2 isn’t unlocked.');
  }
  const info = abilityInfo(ab);
  const used = pc.abilityUses?.[ab.name] || 0;
  if (info.daily && used >= 2 && ab.name !== 'Fired Up 2') throw new Error(`${ab.name} is used up for today (2/day) — a night in town resets it.`);
  const c = state.combat;
  let extra = '';
  // abilities that change Grit or grant things before anything is spent
  if (ab.name === 'Fired Up') {
    if (!c.active) throw new Error('Fired Up is for combat.');
    if (c.current !== pc.id) throw new Error('Use Fired Up on your own turn.');
    if (pc.gritLimited) throw new Error('Still cooling down from Fired Up — try next turn.');
    if (pc.firedUp) throw new Error('Already Fired Up this turn.');
    pc.firedUp = true; pc.grit += 3; pc.gritNext = Math.min(pc.gritNext ?? 3, 3);
    extra = 'max Grit 9 this turn (+3 now); only 3 next turn';
  }
  if (!a.prepaid) spendGrit(state, pc, info.cost, ab.name);
  if (ab.name === 'Fired Up 2') {
    const allies = (Array.isArray(a.targets) ? a.targets : []).map((pid) => findPc(state, pid)).filter((x) => x && x !== pc && !x.dead).slice(0, 2);
    if (!allies.length) throw new Error('Pick up to 2 allies within Short Range.');
    allies.forEach((x) => { x.gritNext = 8; });
    pc.gritNext = Math.min(pc.gritNext ?? 2, 2);
    extra = `${allies.map((x) => x.name).join(' & ')} get max 8 Grit next turn; ${pc.name} only 2`;
    if (used < 2) { changeHealth(state, pc, 2, false); pc.abilityUses = { ...(pc.abilityUses || {}), [ab.name]: used + 1 }; extra += ' · +2 Health'; }
  }
  if (ab.name === 'Crippling Precision') {
    const e = findEnemy(state, a.target) || findPc(state, a.target);
    if (!e) throw new Error('Pick the target you just damaged.');
    e.crippledNext = true;
    extra = `${e.name}’s moves cost double Grit on its next turn`;
  }
  if (ab.name === 'Biological Amplification') {
    const x = findPc(state, a.target);
    if (!x || x === pc) throw new Error('Pick an ally within Short Range.');
    if (a.option === 'dodge') x.freeDodgeNext = true; else x.freeAimNext = true;
    extra = `${x.name} gets a free ${a.option === 'dodge' ? 'Dodge [1B]' : 'Aim'} on their next turn`;
  }
  let entry = null;
  if (info.dice) {
    const p = parsePool(info.dice), spur = ab.name === 'Digging Deep' ? hasSpur(pc, 'Nerve') : info.talent ? hasSpur(pc, info.talent) : false;
    const r = rollPool(p.black, p.gold, spur);
    log(state, { type: 'roll', who: pc.name, label: ab.name, pool: poolLabel(p), spur, dice: r.dice, hits: r.hits, aces: r.aces });
    entry = state.log[0];
    if (ab.name === 'Digging Deep') { pc.health += r.hits; extra = `+${r.hits} Health (can go over Max for now)`; } // p. text: may exceed Max Health
  }
  if (info.daily && ab.name !== 'Fired Up 2') pc.abilityUses = { ...(pc.abilityUses || {}), [ab.name]: used + 1 };
  if (aceIdx >= 0) { pc.aces = 0; log(state, { type: 'event', text: `${pc.name} plays their Ace-in-the-Hole!` }); }
  log(state, { type: 'event', text: `✨ ${pc.name} uses ${ab.name}${info.cost ? ` (${info.cost} Grit)` : ''}${extra ? ` — ${extra}` : ''}.` });
  if (c.active) note(pc, `${ab.name}${extra ? ` — ${extra}` : ''}`, ab.name === 'Fired Up' ? -3 : info.cost);
  return { ...(entry || {}), ability: ab.name, extra };
}

// ---------- Prepare (p. 42): hold one Action for a named trigger; pay now, fire outside your turn ----------
const RANGE_WORD = { arms: 'Arm’s Reach', short: 'Short Range' };
function holdWhen(state, t) {
  const en = (id) => findEnemy(state, id)?.name || 'the enemy';
  switch (t?.type) {
    case 'within': return `an enemy comes within ${RANGE_WORD[t.range] || 'Short Range'}`;
    case 'moves': return `${en(t.enemy)} moves`;
    case 'attacks': return `${en(t.enemy)} attacks`;
    case 'allyAttacked': return 'an ally is attacked';
    default: return clean(t?.text, 80) || 'the moment is right';
  }
}
function prepareHold(state, pc, a) {
  const c = state.combat;
  if (c.active && c.current !== pc.id) throw new Error('Prepare on your own turn.');
  if (pc.prepared && c.active) throw new Error('Prepare is once per turn.');
  const h = a.hold || {};
  let cost = 0, label = '';
  const hold = { kind: h.kind, trigger: { type: h.trigger?.type || 'custom', range: h.trigger?.range === 'arms' ? 'arms' : 'short', enemy: h.trigger?.enemy || '', text: clean(h.trigger?.text, 80) } };
  if (h.kind === 'attack') {
    const w = pc.weapons[int(h.weapon, 0, 2)];
    if (!w || !(w.model || w.manufacturer)) throw new Error('Pick the weapon to hold.');
    const rng = RANGE_NAME[h.range] ? h.range : null;
    if (!rng || !POOLRE.test(String(w[rng] || ''))) throw new Error('Pick a range that weapon can fire at.');
    Object.assign(hold, { weapon: int(h.weapon, 0, 2), range: rng, ammo: h.ammo ?? '', aim: !!h.aim });
    cost = (parseInt(String(w.grit).split('|')[0], 10) || 0) + (h.aim ? 1 : 0);
    label = `attack (${w.model || w.manufacturer}, ${RANGE_NAME[rng]}${h.aim ? ', aimed' : ''})`;
  } else if (h.kind === 'dodge') {
    hold.grit = int(h.grit, 1, 12); cost = hold.grit; label = `Dodge (${hold.grit}B)`;
  } else if (h.kind === 'item') {
    const g = pc.gear[int(h.gear, 0, 2)];
    if (!g?.item) throw new Error('Pick the item to hold.');
    hold.gear = int(h.gear, 0, 2); cost = parseInt(String(g.grit || '0'), 10) || 0; label = g.item;
  } else if (h.kind === 'ability') {
    const t = TRADES[pc.trade], ab = [...t.abilities, ...t.aces].find((x) => x.name === h.ability?.name);
    if (!ab) throw new Error('Pick the ability to hold.');
    hold.ability = { name: ab.name, target: h.ability.target || '', option: h.ability.option || '', targets: h.ability.targets || [] };
    cost = abilityInfo(ab).cost; label = ab.name;
  } else throw new Error('Pick what to hold.');
  spendGrit(state, pc, cost, 'Preparing that');
  pc.prepared = true;
  hold.label = label; hold.cost = cost; hold.when = holdWhen(state, hold.trigger); hold.triggeredBy = null; hold.at = now();
  pc.hold = hold;
  if (c.active) note(pc, `prepared ${label} — when ${hold.when}`, cost);
  log(state, { type: 'event', text: `⏳ ${pc.name} prepares ${label} — goes off when ${hold.when}.` });
  return { label, when: hold.when, cost };
}
// fire the held Action (Grit already paid)
function fireHold(state, pc, a) {
  const h = pc.hold;
  if (!h) throw new Error('Nothing prepared.');
  if (pc.dead || pc.statuses?.Unconscious) throw new Error(`${pc.name} can’t act right now.`);
  let res;
  if (h.kind === 'attack') {
    const target = a.target || h.triggeredBy?.enemy || h.trigger.enemy;
    if (!findEnemy(state, target)) throw new Error('Pick who the prepared attack hits.');
    res = pcOp(state, { action: 'pc', id: pc.id, op: 'attack', weapon: h.weapon, range: a.range || h.range, target, ammo: h.ammo, aim: h.aim, prepaid: true });
  } else if (h.kind === 'dodge') {
    const r = rollPool(h.grit, 0, hasSpur(pc, 'Defense'));
    pc.dodge = (pc.dodge || 0) + r.hits;
    log(state, { type: 'roll', who: pc.name, label: `Prepared Dodge (${h.grit}B)`, pool: `${h.grit}B`, spur: hasSpur(pc, 'Defense'), dice: r.dice, hits: r.hits, aces: r.aces });
    res = { ...state.log[0], banked: pc.dodge };
  } else if (h.kind === 'item') {
    res = pcOp(state, { action: 'pc', id: pc.id, op: 'useItem', gear: h.gear, prepaid: true });
  } else if (h.kind === 'ability') {
    res = useAbility(state, pc, { ...h.ability, prepaid: true });
  }
  log(state, { type: 'event', text: `⏳ ${pc.name}’s prepared ${h.label} goes off${h.triggeredBy ? ` — ${h.triggeredBy.text}` : ''}!` });
  pc.hold = null;
  return { ...(res || {}), fired: h.label };
}
// Called when something happens that might set off someone's prepared Action.
export function checkHoldTriggers(state, ev) {
  for (const pc of state.posse) {
    const h = pc.hold;
    if (!h || h.triggeredBy || pc.dead) continue;
    const t = h.trigger;
    let hit = null;
    if (ev.type === 'enemyMoved') {
      if (t.type === 'moves' && t.enemy === ev.enemy) hit = `${ev.name} moved`;
      if (t.type === 'within' && ev.distTo?.[pc.id] != null && ev.distTo[pc.id] <= (t.range === 'arms' ? 1 : 6)) hit = `${ev.name} came within ${RANGE_WORD[t.range]}`;
    }
    if (ev.type === 'enemyAttacked') {
      if (t.type === 'attacks' && t.enemy === ev.enemy) hit = `${ev.name} attacked`;
      if (t.type === 'allyAttacked' && ev.target !== pc.id) hit = `${ev.name} attacked ${ev.targetName}`;
    }
    if (hit) {
      h.triggeredBy = { enemy: ev.enemy, name: ev.name, text: hit, at: now() };
      log(state, { type: 'event', text: `⏳ ${hit} — ${pc.name}’s prepared ${h.label} can go off!` });
    }
  }
}

// ---------- attacks, Dodge, relieving Statuses (pp. 41–43, 49) ----------
const RANGE_NAME = { arms: 'Arm’s Reach', short: 'Short Range', long: 'Long Range', distant: 'Distant' };
const WEAPON_TALENTS = ['Rifles', 'Shotguns', 'Pistols', 'Bows', 'Melee Weapons', 'Mounted Weapons'];
const sumHits = (dice) => dice.reduce((n, d) => n + HIT_VALUE[d.face], 0);
// Special Ammo effects (p. 76–77): Piercing [n], a Status [n], Knockback, Bang!, +1G at Arm's Reach
function ammoFx(effect) {
  const e = String(effect || ''), fx = {};
  const pierce = e.match(/Piercing \[(\d)\]/); if (pierce) fx.piercing = Number(pierce[1]);
  const st = e.match(/(Trapped|Unconscious|Poisoned|Burned|Electrocuted|Afraid|Dazed) \[(\d)\]/); if (st) fx.status = [st[1], Number(st[2])];
  if (/Knockback/i.test(e)) fx.knockback = true;
  if (/Bang!/i.test(e)) fx.bang = true;
  const extra = e.match(/\+(\d)([BG]) \(Arm/); if (extra) fx.extra = { [extra[2] === 'B' ? 'black' : 'gold']: Number(extra[1]) };
  return fx;
}
// statuses in an attack effect like "3B damage + Dazed [2]" or "Afraid [3G]"
function effectStatuses(effect) {
  return [...String(effect || '').matchAll(/(Afraid|Burned|Dazed|Electrocuted|Poisoned|Trapped|Unconscious)\s*\[((?:\d+[BG])+|\d+)\]/gi)]
    .map((m) => ({ status: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), pool: /[BG]/i.test(m[2]) ? m[2].toUpperCase() : null, fixed: /[BG]/i.test(m[2]) ? null : Number(m[2]) }));
}
function spendGrit(state, a, cost, what) {
  if (!state.combat.active) return; // outside combat nobody counts Grit
  if (a.statuses?.Unconscious) throw new Error(`${a.name} is Unconscious — they can only try to relieve it.`);
  if ((a.grit || 0) < cost) throw new Error(`${what} costs ${cost} Grit — ${a.name} has ${a.grit || 0}.`);
  a.grit -= cost;
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
  a.health = Math.max(0, Math.min(a.maxHealth, a.health + delta)); // never above Max Health
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
  pc.grit = GRIT + (pc.gritBonus || 0); // rested: full Grit
  pc.abilityUses = {}; pc.horseGrit = 0; pc.gritNext = null; // a night's sleep resets the 2/day abilities
  if (pc.forstall) pc.forstall.charges = 2;
  if (pc.horse && Number(pc.horse.maxHealth)) pc.horse.health = String(pc.horse.maxHealth); // p. 104: a night in town
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
      sheet.player = clean(a.player);
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
      if (state.combat.active) note(pc, 'Fool’s Grit (−1 Health)', -1);
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
    case 'installUpgrade': { // pp. 93–100: kitbash with Scrap or buy with $; needs a free slot, one of each type
      const it = CATALOG.find((x) => x.id === a.item);
      const tgt = a.target === 'weapon' ? pc.weapons[int(a.index, 0, 2)] : a.target === 'forstall' ? pc.forstall : a.target === 'mech' ? pc.mech : null;
      if (!it || !tgt) throw new Error('Pick an upgrade.');
      const wSub = a.target === 'weapon' ? (CATALOG.find((x) => x.id === tgt.itemId)?.sub || (/melee/i.test(tgt.type) ? 'Melee' : Object.keys({ Rifles: 1, Shotguns: 1, Pistols: 1, Bows: 1 }).find((k) => tgt.type === k))) : null;
      if (!upgradeFits(it, a.target, wSub)) throw new Error('That upgrade doesn’t fit this item.');
      const slots = int(tgt.slots, 0, 4);
      tgt.upgrades ||= ['', '', '', '']; tgt.upgradeIds ||= ['', '', '', ''];
      const used = tgt.upgrades.slice(0, 4).filter((u) => String(u || '').trim()).length;
      if (used >= slots) throw new Error(`No free upgrade slot (${slots} slot${slots === 1 ? '' : 's'}).`);
      const type = upgradeType(it);
      if (type !== 'Utility' && tgt.upgradeIds.some((uid) => { const o = CATALOG.find((x) => x.id === uid); return o && upgradeType(o) === type; }))
        throw new Error(`It already has a ${type} upgrade — only one of each type.`);
      if (a.pay === 'scrap') {
        if (!it.scrapCost) throw new Error('That one has to be bought.');
        if (money(pc.scrap) < it.scrapCost) throw new Error(`Needs ${it.scrapCost} Scrap (has ${money(pc.scrap)}).`);
        pc.scrap = String(money(pc.scrap) - it.scrapCost);
      } else {
        if (money(pc.wallet) < it.cost) throw new Error(`Costs $${it.cost} (Wallet has $${money(pc.wallet)}).`);
        pc.wallet = String(+(money(pc.wallet) - it.cost).toFixed(2));
      }
      const k = tgt.upgrades.findIndex((u, n) => n < 4 && !String(u || '').trim());
      const short = it.name.replace(/^(Ranged Weapon|Melee Weapon|Forstall|Mech|Trap) /, '').replace(' — Level ', ' L');
      tgt.upgrades[k] = `${short}${it.upgrade && it.upgrade !== 'None' ? ` (${it.upgrade})` : ''}`.slice(0, 60);
      tgt.upgradeIds[k] = it.id;
      // numbers the sheet tracks directly
      const add = Number(String(it.upgrade || '').match(/^Add (\d+)$/)?.[1] || 0);
      if (a.target === 'mech' && type === 'Health' && add) { tgt.maxHealth = String(money(tgt.maxHealth) + add); tgt.health = String(money(tgt.health) + add); }
      if (a.target === 'mech' && type === 'Storage' && add) tgt.supplies = String(money(tgt.supplies) + add);
      if (a.target === 'mech') tgt.state = mechState(tgt);
      pc.updated = Date.now();
      log(state, { type: 'event', text: `🔧 ${pc.name} ${a.pay === 'scrap' ? `kitbashes (${it.scrapCost} Scrap)` : `buys ($${it.cost})`} ${it.name} for their ${a.target === 'weapon' ? (tgt.model || 'weapon') : a.target === 'forstall' ? 'Forstall' : 'mech'}.` });
      return { slot: k };
    }
    case 'removeUpgrade': {
      const tgt = a.target === 'weapon' ? pc.weapons[int(a.index, 0, 2)] : a.target === 'forstall' ? pc.forstall : a.target === 'mech' ? pc.mech : null;
      const k = int(a.slot, 0, 3);
      if (!tgt) throw new Error('Nothing there.');
      tgt.upgrades ||= ['', '', '', '']; tgt.upgradeIds ||= ['', '', '', ''];
      tgt.upgrades[k] = ''; tgt.upgradeIds[k] = '';
      pc.updated = Date.now();
      return;
    }
    case 'attack': { // p. 41: spend the weapon's Grit, roll its pool at that Range; damage = Hits − target's Defense (p. 43)
      if (pc.dead || pc.bleeding) throw new Error(`${pc.name} can’t attack right now.`);
      const w = pc.weapons[int(a.weapon, 0, 2)];
      const rng = RANGE_NAME[a.range] ? a.range : null;
      if (!w || !(w.model || w.manufacturer)) throw new Error('Pick a weapon.');
      if (!rng || !POOLRE.test(String(w[rng] || ''))) throw new Error(`${w.model || 'That weapon'} can’t attack at ${RANGE_NAME[a.range] || 'that range'}.`);
      const e = findEnemy(state, a.target);
      if (!e || e.defeated) throw new Error('Pick a target that’s still standing.');
      const aim = !!a.aim;
      if (aim && pc.aimed && !a.prepaid) throw new Error('Aim is once per turn.');
      if (aim && pc.statuses?.Electrocuted) throw new Error('Electrocuted — you can’t Aim.');
      const freeAim = aim && pc.freeAim;
      const cost = (parseInt(String(w.grit).split('|')[0], 10) || 0) + (aim && !freeAim ? 1 : 0);
      if (!a.prepaid) spendGrit(state, pc, cost, 'That attack');
      if (freeAim) pc.freeAim = false;
      if (aim) pc.aimed = true;
      const noteIdx = (pc.turnLog ||= []).length;
      let ammo = null, fx = {};
      if (a.ammo !== '' && a.ammo != null) {
        const slot = w.ammo?.[int(a.ammo, 0, 1)];
        if (!slot?.name) throw new Error('No Special Ammo loaded there.');
        if (!(Number(slot.rds) > 0)) throw new Error(`Out of ${slot.name}.`);
        slot.rds = String(Number(slot.rds) - 1);
        ammo = slot.name;
        fx = ammoFx(CATALOG.find((x) => x.name === slot.name)?.effect || slot.name);
      }
      const pool = parsePool(w[rng]);
      if (fx.extra && rng === 'arms') { pool.black += fx.extra.black || 0; pool.gold += fx.extra.gold || 0; }
      if (pc.statuses?.Electrocuted) { pool.black += pool.gold; pool.gold = 0; } // p. 48: Gold becomes Black
      const talent = WEAPON_TALENTS.includes(w.type) ? w.type : null;
      const spur = !!talent && hasSpur(pc, talent);
      const r = rollPool(pool.black, pool.gold, spur);
      if (aim) { // p. 41: reroll one die — the worst one
        const k = r.dice.findIndex((d) => d.face === 'blank') >= 0 ? r.dice.findIndex((d) => d.face === 'blank') : r.dice.findIndex((d) => d.face === 'spur');
        if (k >= 0) { const nd = rollDie(r.dice[k].color, spur); r.dice[k] = { ...nd, faces: [...r.dice[k].faces, ...nd.faces], aimed: true }; }
      }
      let hits = sumHits(r.dice);
      if (fx.bang) hits = r.dice.filter((d) => d.face === 'hit' || d.face === 'ace').length * 2; // Bang!: Hits become Aces
      const wname = w.model || w.manufacturer || 'weapon';
      log(state, { type: 'roll', who: pc.name, label: `${wname} → ${e.name} · ${RANGE_NAME[rng]}${aim ? ' · Aim' : ''}${ammo ? ` · ${ammo}` : ''}`, pool: poolLabel(pool), spur, dice: r.dice, hits, aces: r.dice.filter((d) => d.face === 'ace').length });
      const atk = state.log[0];
      if (state.combat.active && r.dice.some((d) => d.face === 'ace')) pc.aces = Math.min(6, (pc.aces || 0) + r.dice.filter((d) => d.face === 'ace').length);
      // target's Defense
      let def = 0, defEntry = null;
      if (POOLRE.test(String(e.defense || ''))) {
        const dp = parsePool(e.defense), dr = rollPool(dp.black, dp.gold, false);
        def = dr.hits;
        log(state, { type: 'roll', who: e.name, label: 'Defense', pool: poolLabel(dp), spur: false, dice: dr.dice, hits: dr.hits, aces: dr.aces });
        defEntry = state.log[0];
      }
      if (e.dodge) { def += e.dodge; e.dodge = 0; } // the enemy's banked Dodge (p. 42)
      const pierced = Math.min(def, fx.piercing || 0);
      const dmg = Math.max(0, hits - (def - pierced));
      if (dmg) changeHealth(state, e, -dmg, true);
      const notes = [];
      if (dmg && fx.status) { const [st, n] = fx.status; setStatus(e, st, (e.statuses[st] || 0) + n, e.size); notes.push(`${st} [${n}]`); }
      if (dmg && fx.knockback) notes.push('knocked back a Short Range');
      log(state, { type: 'event', text: `⚔ ${pc.name} hits ${e.name} for ${dmg} damage (${hits} Hit${hits === 1 ? '' : 's'} − ${def - pierced} Defense${pierced ? `, ${pierced} pierced` : ''})${notes.length ? ` · ${notes.join(' · ')}` : ''}.` });
      if (state.combat.active) pc.turnLog.splice(noteIdx, 0, { id: id(), text: `${aim ? 'aimed + ' : ''}attacked ${e.name} with ${wname} → ${dmg} dmg`, grit: cost });
      return { ...atk, dmg, def: def - pierced, target: e.name, defense: defEntry, down: e.defeated };
    }
    case 'dodge': { // p. 42: roll 1B per Grit; subtract the Hits from the next attack against you
      if (pc.statuses?.Electrocuted) throw new Error('Electrocuted — you can’t Dodge.');
      if (pc.statuses?.Trapped) throw new Error('Trapped — you can’t Dodge.');
      const n = int(a.grit, 1, 12);
      spendGrit(state, pc, n, 'That Dodge');
      const r = rollPool(n, 0, hasSpur(pc, 'Defense'));
      pc.dodge = (pc.dodge || 0) + r.hits;
      if (state.combat.active) note(pc, `dodged ${n}B → ${r.hits} ready`, n);
      log(state, { type: 'roll', who: pc.name, label: `Dodge (${n} Grit)`, pool: `${n}B`, spur: hasSpur(pc, 'Defense'), dice: r.dice, hits: r.hits, aces: r.aces });
      return { ...state.log[0], banked: pc.dodge };
    }
    case 'relieve': { // p. 49: roll up to your Skill's dice (1 Grit each); each Hit lowers the Severity by 1
      const st = String(a.status || '');
      const sev = pc.statuses?.[st] || 0;
      if (!sev || !STATUSES[st]) throw new Error('They don’t have that Status.');
      const choices = STATUSES[st].skill.split(' or ');
      const skill = choices.includes(a.skill) ? a.skill : choices[0];
      const sp = parsePool(pc.skills[skill.toLowerCase()] || '');
      let max = sp.black + sp.gold;
      if (pc.statuses?.Poisoned && st !== 'Poisoned') max = Math.max(0, max - 2); // p. 49: Poisoned = 2 fewer dice
      const n = int(a.dice || max, 1, max || 1);
      if (!max) throw new Error(`No ${skill} dice to roll.`);
      if (state.combat.active) {
        if (state.combat.current !== pc.id) throw new Error('You can only relieve Statuses on your own turn.');
        if ((pc.relieved || []).includes(st)) throw new Error(`Already tried ${st} this turn.`);
        if ((pc.grit || 0) < n) throw new Error(`${n} dice cost ${n} Grit — ${pc.name} has ${pc.grit || 0}.`);
        pc.grit -= n; (pc.relieved ||= []).push(st);
        note(pc, `relieve ${st} (${n} dice)`, n);
      }
      const g = Math.min(sp.gold, n), b = n - g; // Gold before Black
      const r = rollPool(b, g, hasSpur(pc, skill));
      const left = Math.max(0, sev - r.hits);
      setStatus(pc, st, left, 'Human');
      log(state, { type: 'roll', who: pc.name, label: `Relieve ${st} · ${skill}`, pool: poolLabel({ black: b, gold: g }), spur: hasSpur(pc, skill), dice: r.dice, hits: r.hits, aces: r.aces });
      const entry = state.log[0];
      if (!left && st === 'Unconscious' && pc.health === 0 && !pc.dead) { pc.health = 1; log(state, { type: 'event', text: `${pc.name} comes to and regains 1 Health.` }); }
      log(state, { type: 'event', text: left ? `${pc.name} eases ${st} to [${left}].` : `${pc.name} shakes off ${st}!` });
      return { ...entry, left, status: st };
    }
    case 'checkRoll': { // answer the Warden's Skill check — or Help someone with half your dice (p. 13)
      const ck = (state.checks || []).find((x) => x.id === a.check);
      if (!ck) throw new Error('That roll isn’t being asked for any more.');
      const helping = !ck.who.includes(pc.id);
      if (ck.kind === 'challenge' && helping) throw new Error('This is a Challenge between the named sides.');
      if (!helping && ck.rolls[pc.id]) throw new Error('Already rolled — ask the Warden if you want another go.');
      if (helping && ck.helps[pc.id]) throw new Error('You’ve already helped.');
      const sp = parsePool(pc.skills[ck.skill.toLowerCase()] || '');
      let n = sp.black + sp.gold;
      if (pc.statuses?.Poisoned) n = Math.max(0, n - 2); // p. 48: 2 fewer dice on Skill rolls
      if (helping) n = Math.ceil(n / 2);
      if (!n) throw new Error(`No ${ck.skill} dice to roll.`);
      const g = Math.min(sp.gold, n), b = n - g;
      const r = rollPool(b, g, hasSpur(pc, ck.skill));
      log(state, { type: 'roll', who: pc.name, label: `${helping ? 'Helping · ' : ''}${ck.skill} · ${ck.diff} (${ck.target})${ck.note ? ` · ${ck.note}` : ''}`, pool: poolLabel({ black: b, gold: g }), spur: hasSpur(pc, ck.skill), dice: r.dice, hits: r.hits, aces: r.aces });
      const entry = state.log[0];
      if (helping) {
        const before = Object.fromEntries(ck.who.map((pid) => [pid, checkOutcome(state, ck, pid)?.ok]));
        ck.helps[pc.id] = { hits: r.hits, name: pc.name };
        log(state, { type: 'event', text: `🤝 ${pc.name} helps with ${r.hits} Hit${r.hits === 1 ? '' : 's'}.` });
        ck.who.forEach((pid) => { if (ck.rolls[pid] && before[pid] === false && checkOutcome(state, ck, pid).ok) logOutcome(state, ck, pid); });
      } else if (ck.kind === 'challenge') {
        ck.rolls[pc.id] = { hits: r.hits, name: pc.name };
        if (ck.who.every((pid) => ck.rolls[pid])) resolveChallenge(state, ck);
      } else {
        ck.rolls[pc.id] = { hits: r.hits };
        logOutcome(state, ck, pc.id);
      }
      return { ...entry, helping, outcome: helping || ck.kind === 'challenge' ? null : checkOutcome(state, ck, pc.id), target: ck.target };
    }
    case 'useItem': { // p. 42: spend the item's Grit and roll its dice
      const g = pc.gear[int(a.gear, 0, 2)];
      if (!g?.item) throw new Error('Pick a gear item.');
      const cost = parseInt(String(g.grit || '0'), 10) || 0;
      if (!a.prepaid) spendGrit(state, pc, cost, `Using ${g.item}`);
      g.uses = Math.min(6, (g.uses || 0) + 1);
      const pool = (String(g.notes || '').toUpperCase().match(/(?:\d+[BG])+/) || [])[0];
      let entry = null;
      if (pool) {
        const p = parsePool(pool), r = rollPool(p.black, p.gold, hasSpur(pc, g.type === 'First Aid' ? 'First Aid' : g.type === 'Explosives' ? 'Explosives' : /trap/i.test(g.type) ? 'Traps' : ''));
        log(state, { type: 'roll', who: pc.name, label: `Uses ${g.item}`, pool: poolLabel(p), spur: false, dice: r.dice, hits: r.hits, aces: r.aces });
        entry = state.log[0];
      } else log(state, { type: 'event', text: `${pc.name} uses ${g.item}.` });
      if (state.combat.active) note(pc, `used ${g.item}`, cost);
      return entry || { used: g.item };
    }
    case 'prepare': return prepareHold(state, pc, a);
    case 'fireHold': return fireHold(state, pc, a);
    case 'dropHold':
      if (pc.hold) log(state, { type: 'event', text: `⏳ ${pc.name} lets their prepared ${pc.hold.label} go.` });
      pc.hold = null;
      return;
    case 'improvise': { // p. 43: Improvise costs 1+ Grit (maybe a Skill roll)
      const n = int(a.grit, a.op === 'prepare' ? 0 : 1, 12), what = clean(a.label, 60) || (a.op === 'prepare' ? 'an Action' : 'something');
      if (a.op === 'prepare' && pc.prepared && state.combat.active) throw new Error('Prepare is once per turn.');
      spendGrit(state, pc, n, a.op === 'prepare' ? 'Preparing that' : 'That');
      if (a.op === 'prepare') pc.prepared = true;
      let entry = null;
      const sk = SKILLS.find((x) => x === a.skill);
      if (sk) {
        const sp = parsePool(pc.skills[sk.toLowerCase()] || ''), r = rollPool(sp.black, sp.gold, hasSpur(pc, sk));
        log(state, { type: 'roll', who: pc.name, label: `${a.op === 'prepare' ? 'Prepare' : 'Improvise'} · ${what} · ${sk}`, pool: poolLabel(sp), spur: hasSpur(pc, sk), dice: r.dice, hits: r.hits, aces: r.aces });
        entry = state.log[0];
      } else log(state, { type: 'event', text: `${pc.name} ${a.op === 'prepare' ? 'prepares' : 'improvises'}: ${what} (${n} Grit).` });
      if (state.combat.active) note(pc, `${a.op === 'prepare' ? 'prepared' : 'improvised'}: ${what}`, n);
      return entry || { done: what };
    }
    case 'mount': // riding the horse (Fast) or driving the mech (its speed) — changes Move costs
      pc.mounted = ['horse', 'mech'].includes(a.value) ? a.value : '';
      if (pc.mounted === 'horse' && !pc.horse?.breed) { pc.mounted = ''; throw new Error('No horse on the sheet.'); }
      if (pc.mounted === 'mech' && !pc.mech?.class) { pc.mounted = ''; throw new Error('No mech on the sheet.'); }
      return;
    case 'useAbility': return useAbility(state, pc, a);
    case 'horseGrit': { // Arabian, Revered Bond (p. 104): gain 1 Grit during combat, 2/day, while riding
      if (!/arabian/i.test(pc.horse?.breed || '') || pc.horse?.bond !== 'Revered') throw new Error('Needs a Revered Bond with an Arabian.');
      if (pc.mounted !== 'horse') throw new Error('Only while riding.');
      if ((pc.horseGrit || 0) >= 2) throw new Error('Used twice today already.');
      pc.horseGrit = (pc.horseGrit || 0) + 1; pc.grit += 1;
      note(pc, `${pc.horse.name || 'Arabian'}: +1 Grit`, -1);
      log(state, { type: 'event', text: `🐎 ${pc.name}’s Arabian finds another gear — +1 Grit.` });
      return;
    }
    case 'endTurn': // a player ends their own turn
      if (!state.combat.active || state.combat.current !== pc.id) throw new Error('It isn’t their turn.');
      advance(state);
      return;
    case 'breakHorse': { // p. 108: roll all four Skills; total Hits vs the breed's Breaking Point
      const h = pc.horse || {};
      const need = Number(h.breakingPoint);
      if (!h.breed || !need) throw new Error('Pick the horse breed first (it sets the Breaking Point).');
      const all = [];
      let total = 0, aces = 0;
      for (const s of SKILLS) {
        const pool = parsePool(pc.skills[s.toLowerCase()] || '');
        const r = rollPool(pool.black, pool.gold, hasSpur(pc, s));
        log(state, { type: 'roll', who: pc.name, label: `Breaking ${h.name || 'the horse'} · ${s}`, pool: poolLabel(pool), spur: hasSpur(pc, s), dice: r.dice, hits: r.hits, aces: r.aces });
        all.push(...r.dice); total += r.hits; aces += r.aces;
      }
      const ok = total >= need;
      h.bond = ok ? 'Neutral' : 'Suspicious';
      pc.updated = Date.now();
      log(state, { type: 'event', text: ok ? `🐎 ${pc.name} breaks the ${h.breed}${h.name ? ` “${h.name}”` : ''}! ${total} Hits vs Breaking Point ${need}. Bond: Neutral.`
        : `🐎 The ${h.breed} won’t be broken — ${total} Hits vs Breaking Point ${need}. It stays Suspicious (and might buck ${pc.name} off).` });
      return { dice: all, hits: total, aces, pool: `4 Skills vs ${need}`, ok, need };
    }
    case 'mechRepair': { // p. 94: 1 Scrap per Mech Health, or $2 each at a mech depot; not during combat
      if (state.combat.active) throw new Error('Repairs take time — not during combat.');
      const m = pc.mech, max = Number(m.maxHealth) || 0, hp = Number(m.health) || 0;
      if (!max) throw new Error('Set the mech’s Max Health first.');
      const n = Math.min(int(a.amount, 1, 99), max - hp);
      if (n <= 0) throw new Error('The mech is already at full Health.');
      if (a.pay === 'cash') {
        if (money(pc.wallet) < n * 2) throw new Error(`That costs $${n * 2} (Wallet has $${money(pc.wallet)}).`);
        pc.wallet = String(+(money(pc.wallet) - n * 2).toFixed(2));
      } else {
        if (money(pc.scrap) < n) throw new Error(`That takes ${n} Scrap (has ${money(pc.scrap)}).`);
        pc.scrap = String(money(pc.scrap) - n);
      }
      m.health = String(hp + n); m.state = mechState(m);
      pc.updated = Date.now();
      log(state, { type: 'event', text: `🔧 ${pc.name} repairs their mech +${n} Health (${a.pay === 'cash' ? `$${n * 2} at a depot` : `${n} Scrap`}) — now ${m.health}/${max}.` });
      return { n };
    }
    case 'removeThing': { // empty a weapon/gear slot, or drop the horse/mech/Forstall
      const k = int(a.index, 0, 2);
      let what = '';
      if (a.target === 'weapon') { what = pc.weapons[k]?.model || pc.weapons[k]?.manufacturer || 'a weapon'; pc.weapons[k] = blankWeapon(); }
      else if (a.target === 'gear') { what = pc.gear[k]?.item || 'gear'; pc.gear[k] = blankGear(); }
      else if (a.target === 'horse') { what = pc.horse?.name || pc.horse?.breed || 'their horse'; pc.horse = blankHorse(); }
      else if (a.target === 'mech') { what = pc.mech?.class ? `their ${pc.mech.class} mech` : 'their mech'; pc.mech = blankMech(); }
      else if (a.target === 'forstall') { what = pc.forstall?.model || 'their Forstall'; pc.forstall = blankForstall(); }
      else throw new Error('Nothing to remove.');
      pc.updated = Date.now();
      log(state, { type: 'event', text: `🗑 ${pc.name} no longer has ${what}.` });
      return { what };
    }
    case 'ammo': { // Special Ammo & Arrows are tracked by count (p. 76)
      const w = pc.weapons[int(a.index, 0, 2)];
      const slot = w?.ammo?.[int(a.slot, 0, 1)];
      if (!slot) throw new Error('No ammo slot.');
      slot.rds = String(Math.max(0, Math.min(99, (Number(slot.rds) || 0) + int(a.delta, -99, 99))));
      pc.updated = Date.now();
      return;
    }
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
      pc.aces = 0; pc.grit = GRIT + (pc.gritBonus || 0);
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
    case 'enemyAttack': { // Warden: roll an enemy attack at a posse member; their Defense + Cover + Dodge soak it (p. 43)
      const e = findEnemy(state, a.enemy), pc = findPc(state, a.pc);
      if (!e || !pc) throw new Error('Pick the attack and who it targets.');
      const prof = profileFor(e.profile);
      const at = prof?.attacks?.[int(a.attack, 0, 99)];
      if (!at) throw new Error('Pick an attack.');
      if (state.combat.active && at.grit) {
        if (state.combat.current === e.id && (e.grit || 0) < at.grit) throw new Error(`${at.name} costs ${at.grit} Grit — ${e.name} has ${e.grit || 0}.`);
        e.grit = Math.max(0, (e.grit || 0) - at.grit);
        note(e, `${at.name} → ${pc.name}`, at.grit);
      }
      const dmgPool = (String(at.effect).match(/((?:\d+[BG])+)\s+damage/i) || [])[1];
      const cover = int(a.cover, 0, 2);
      // defense: the sheet's Defense pool + Cover dice (1B light / 2B heavy) + banked Dodge
      const dp = parsePool(pc.defense || ''); dp.black += cover;
      const dr = rollPool(dp.black, dp.gold, hasSpur(pc, 'Defense'));
      const dodge = pc.dodge || 0; pc.dodge = 0;
      // p. 77: Piercing [n] ignores that much Defense/Cover — Dodge still counts
      const pierce = Number((String(at.effect).match(/Piercing \[(\d)\]/) || [])[1] || 0);
      const soak = Math.max(0, dr.hits - pierce) + dodge;
      let hits = 0, dmg = 0, atkEntry = null;
      if (dmgPool) {
        const ap = parsePool(dmgPool), ar = rollPool(ap.black, ap.gold, false);
        hits = ar.hits;
        log(state, { type: 'roll', who: e.name, label: `${at.name} → ${pc.name}`, pool: poolLabel(ap), spur: false, dice: ar.dice, hits: ar.hits, aces: ar.aces });
        atkEntry = state.log[0];
      }
      if (dp.black + dp.gold) log(state, { type: 'roll', who: pc.name, label: `Defense${cover ? ` + ${cover === 2 ? 'Heavy' : 'Light'} Cover` : ''}`, pool: poolLabel(dp), spur: hasSpur(pc, 'Defense'), dice: dr.dice, hits: dr.hits, aces: dr.aces });
      if (dmgPool) { dmg = Math.max(0, hits - soak); if (dmg) changeHealth(state, pc, -dmg, false); }
      const notes = [];
      for (const s of effectStatuses(at.effect)) {
        let sev = s.fixed;
        if (s.pool) { const sp = parsePool(s.pool), sr = rollPool(sp.black, sp.gold, false); sev = sr.hits; }
        if (!dmgPool) sev = Math.max(0, sev - soak); // a Status-only attack: Defense lowers the Severity
        else if (!dmg) sev = 0; // with damage, the Status lands only if damage got through
        if (sev) { setStatus(pc, s.status, (pc.statuses[s.status] || 0) + sev, 'Human'); notes.push(`${s.status} [${sev}]`); }
      }
      checkHoldTriggers(state, { type: 'enemyAttacked', enemy: e.id, name: e.name, target: pc.id, targetName: pc.name });
      log(state, { type: 'event', text: `💥 ${e.name}’s ${at.name} ${dmgPool ? `hits ${pc.name} for ${dmg} (${hits} − ${soak} Defense${dodge ? ` incl. ${dodge} Dodge` : ''})` : `targets ${pc.name}`}${notes.length ? ` · ${notes.join(' · ')}` : dmgPool ? '' : ' — shrugged off'}.` });
      return { dmg, hits, soak, notes, atk: atkEntry };
    }
    case 'checkStart': { // Warden calls for a Skill roll at a difficulty (p. 12)
      const who = (Array.isArray(a.who) ? a.who : []).filter((pid) => findPc(state, pid));
      const skill = SKILLS.find((x) => x === a.skill);
      if (!who.length || !skill) throw new Error('Pick who rolls and which Skill.');
      const preset = DIFFICULTY.find(([n]) => n === a.diff);
      const target = preset ? preset[1] : int(a.target, 1, 20);
      if (a.diff === 'challenge') { // p. 13: both sides roll the same Skill; most Hits wins, a tie rolls again
        let npc = null;
        if (a.npc) {
          const d = duelist(state, a.npc);
          if (!d || d.kind === 'pc') throw new Error('Pick the NPC opponent.');
          npc = { ref: a.npc, name: d.who.name };
        }
        if (who.length + (npc ? 1 : 0) < 2) throw new Error('A Challenge needs two sides — tick two characters or pick an NPC.');
        const ck = { id: id(), kind: 'challenge', who, skill, diff: 'Challenge', target: 0, npc, note: clean(a.note, 80), rolls: {}, helps: {}, round: 1, at: now() };
        (state.checks ||= []).unshift(ck); state.checks = state.checks.slice(0, 8);
        log(state, { type: 'event', text: `⚔️ Challenge: ${[...who.map((pid) => findPc(state, pid).name), ...(npc ? [npc.name] : [])].join(' vs ')} — everyone rolls ${skill}${ck.note ? ` · ${ck.note}` : ''}.` });
        return ck;
      }
      const ck = { id: id(), who, skill, diff: preset ? preset[0] : `Target ${target}`, target, note: clean(a.note, 80), rolls: {}, helps: {}, at: now() };
      (state.checks ||= []).unshift(ck);
      state.checks = state.checks.slice(0, 8);
      log(state, { type: 'event', text: `🎯 ${who.map((pid) => findPc(state, pid).name).join(', ')}: roll ${skill} — ${ck.diff} (${target} Hit${target === 1 ? '' : 's'})${ck.note ? ` · ${ck.note}` : ''}.` });
      return ck;
    }
    case 'checkClose':
      state.checks = (state.checks || []).filter((x) => x.id !== a.id);
      return;
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
        case 'rename': { const n = clean(a.name); if (!n) throw new Error('Give them a name.'); const old = e.name; e.name = n === old ? old : uniqueName(state, n); log(state, { type: 'event', text: `${old} is now known as ${e.name}.`, hidden: true }); break; }
        case 'dodge': { // p. 42 — enemies can Dodge too
          const n = int(a.grit, 1, 12);
          spendGrit(state, e, n, 'That Dodge');
          const r = rollPool(n, 0, true); // monsters always reroll Spurs (p. 139)
          e.dodge = (e.dodge || 0) + r.hits;
          log(state, { type: 'roll', who: e.name, label: `Dodge (${n} Grit)`, pool: `${n}B`, spur: true, dice: r.dice, hits: r.hits, aces: r.aces, hidden: !!a.hidden });
          if (state.combat.active) note(e, `dodged ${n}B → ${r.hits} ready`, n);
          return { ...state.log[0], banked: e.dodge };
        }
        case 'improvise': {
          const n = int(a.grit, 1, 12), what = clean(a.label, 60) || 'something';
          spendGrit(state, e, n, 'That');
          log(state, { type: 'event', text: `${e.name}: ${what} (${n} Grit).` });
          if (state.combat.active) note(e, what, n);
          break;
        }
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
      c.active = true; c.round = 1; state.undoStack = [];
      orderSlots(state);
      // what everyone rolled for turn order, in order — shown as a pop-up on every page (p. 40)
      c.startInfo = { at: now(), rolls: c.slots.map((k) => {
        const who = actorName(state, k);
        const r = state.log.find((l) => l.type === 'roll' && String(l.label || '').startsWith('Finesse — turn order') && l.who === who);
        return { name: who, hits: c.init[k]?.hits ?? r?.hits ?? null, pool: r?.pool || '', dice: r?.dice || [], surprise: c.surprise.includes(k), by: k === 'enemies' ? (c.init.enemies?.by || '') : '' };
      }) };
      log(state, { type: 'round', text: 'Combat begins — Round 1' });
      const first = turnList(state)[0];
      if (first) startTurn(state, first);
      return;
    }
    case 'next': if (c.active) advance(state); return;
    case 'setTurn': if (c.active && turnList(state).includes(a.key)) startTurn(state, a.key); return;
    case 'end':
      c.active = false; c.round = 0; c.slots = []; c.current = null; c.init = {}; c.surprise = []; c.tiebreak = {};
      state.undoStack = [];
      [...state.posse, ...state.enemies].forEach((x) => { x.dodge = 0; x.aimed = false; x.turnLog = []; x.lastMove = null; x.prepared = false; x.grit = GRIT + (x.gritBonus || 0); });
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
export const META = { abilityInfo: Object.fromEntries(Object.values(TRADES).flatMap((t) => [...t.abilities, ...t.aces]).map((ab) => [ab.name, abilityInfo(ab)])), difficulty: DIFFICULTY, achievements: ACHIEVEMENTS, tiers: TIERS, packs: PACKS, keepsakes: KEEPSAKES, statuses: STATUSES, capture: CAPTURE, trades: TRADES, talents: TALENTS, reputationLevels: REPUTATION, mechStates: MECH_STATES, skills: SKILLS };

export function logView(state) {
  const c = state.combat;
  const name = (pid) => findPc(state, pid)?.name || '—';
  return {
    v: state.v,
    log: state.log.filter((l) => !l.hidden).map(({ secret, ...l }) => l),
    hud: {
      active: !!c.active, round: c.round, current: c.current,
      order: c.active ? turnList(state).map((k) => ({ key: k, name: actorName(state, k), pc: !!findPc(state, k) })) : [],
      start: c.active ? c.startInfo || null : null,
      checks: (state.checks || []).filter((ck) => !ck.winner).map((ck) => ({ id: ck.id, kind: ck.kind || 'check', skill: ck.skill, diff: ck.diff, target: ck.target, note: ck.note,
        round: ck.round || 1, who: ck.who.map((pid) => ({ id: pid, name: name(pid), rolled: !!ck.rolls[pid] })), vs: ck.npc?.name || '' })),
      holds: state.posse.filter((p) => p.hold).map((p) => ({ id: p.id, name: p.name, label: p.hold.label, when: p.hold.when, kind: p.hold.kind, triggeredBy: p.hold.triggeredBy, at: p.hold.at })),
    },
  };
}

export function playerCombatView(state) {
  const showHp = state.settings.showEnemyHealth;
  return {
    v: state.v,
    posse: state.posse,
    enemies: state.enemies.map((e) => ({
      id: e.id, name: e.name, size: e.size, statuses: e.statuses, defeated: e.defeated, frenzied: e.frenzied.length > 0, grit: e.grit, speed: e.speed, turnLog: e.turnLog || [], crippled: !!e.crippled,
      ...(showHp ? { health: e.health, maxHealth: e.maxHealth } : {}),
    })),
    combat: { ...state.combat, order: orderView(state), turnList: turnList(state) },
    settings: state.settings,
    duel: state.duel || null,
    checks: state.checks || [],
    undo: (() => { const st = state.undoStack || [], key = state.combat?.active ? `${state.combat.round}:${state.combat.current}` : '';
      return { last: st[st.length - 1]?.label || '', lastIsThisTurn: st[st.length - 1]?.turnKey === key, thisTurn: st.filter((x) => x.turnKey === key).length }; })(),
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
