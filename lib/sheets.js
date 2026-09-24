// Digital character sheets, mirroring the official two-page Trade sheets.
import crypto from 'node:crypto';
import { TRADES } from './trades.js';

export const TALENTS = [
  'Charm', 'Finesse', 'Intuition', 'Nerve',
  'Bows', 'Defense', 'Explosives', 'First Aid', 'Forstalls', 'Mechs', 'Melee Weapons',
  'Mounted Weapons', 'Pistols', 'Rifles', 'Shotguns', 'Traps',
];
export const REPUTATION = ['Revered', 'Helpful', 'Neutral', 'Suspicious', 'Hostile'];
export const MECH_STATES = ['Functional', 'Compromised', 'Totaled'];

const blankWeapon = () => ({ itemId: '', type: '', manufacturer: '', model: '', slots: '', grit: '', arms: '', short: '', long: '', distant: '', upgrades: ['', '', '', ''], ammo: [{ name: '', rds: '' }, { name: '', rds: '' }] });
const blankGear = () => ({ itemId: '', item: '', type: '', grit: '', notes: '', uses: 0 });

export function newSheet(trade, name) {
  const t = TRADES[trade];
  if (!t) throw new Error('Pick a Trade.');
  return {
    id: crypto.randomUUID().slice(0, 8),
    trade,
    name: String(name || '').trim().slice(0, 40) || `The ${trade}`,
    skills: { ...t.quickBuild },
    maxHealth: 10, health: 10, defense: '',
    grit: 6, statuses: {}, aces: 0, bleeding: null, dead: false,
    abilities: [t.abilities[0].name], abilityUses: {},
    aceTwo: false,
    prestige: { total: 0, unclaimed: 0, healthUps: 0, mastered: 0 },
    talents: [],
    reputation: [{ faction: '', level: 'Neutral' }, { faction: '', level: 'Neutral' }, { faction: '', level: 'Neutral' }, { faction: '', level: 'Neutral' }],
    weapons: [blankWeapon(), blankWeapon(), blankWeapon()],
    gear: [blankGear(), blankGear(), blankGear()],
    horse: { name: '', breed: '', breakingPoint: '', maxHealth: '', health: '', bond: 'Neutral', breedAbility: '', disposition: '', appearance: '' },
    forstall: { model: '', slots: '', range: '', grit: '', charges: 2, duration: '', upgrades: ['', '', '', ''], kz: ['', '', '', ''] },
    mech: { class: '', slots: '', speed: '', maxHealth: '', health: '', defense: '', state: 'Functional', supplies: '', cover: '', upgrades: ['', '', '', ''] },
    items: [], inventory: '', wallet: '', scrap: '', supplies: '',
    disposition: '', appearance: '', history: '',
    updated: Date.now(),
  };
}

// Whitelisted editable paths → validators. Anything else is rejected.
const str = (n) => (v) => String(v ?? '').replace(/[<>]/g, '').slice(0, n);
const num = (lo, hi) => (v) => { const x = Math.round(Number(v)); if (!Number.isFinite(x)) throw new Error('Not a number.'); return Math.max(lo, Math.min(hi, x)); };
const oneOf = (list) => (v) => { if (!list.includes(v)) throw new Error('Invalid choice.'); return v; };
const bool = (v) => !!v;
// Dice pools are stored as "3B1G" but always entered as two numbers (Black, Gold) in the UI.
const pool = (v) => {
  const m = String(v || '').toUpperCase().replace(/\s+/g, '');
  if (m && !/^(\d+[BG])+$/.test(m)) throw new Error('Dice must be a number of Black and Gold dice.');
  let b = 0, g = 0;
  for (const [, n, c] of m.matchAll(/(\d+)([BG])/g)) { if (c === 'B') b += +n; else g += +n; }
  b = Math.min(b, 12); g = Math.min(g, 12);
  return `${b ? b + 'B' : ''}${g ? g + 'G' : ''}`;
};

const RULES = [
  [/^name$/, str(40)],
  [/^skills\.(charm|finesse|intuition|nerve)$/, pool],
  [/^(maxHealth|health)$/, num(0, 99)],
  [/^defense$/, pool],
  [/^grit$/, num(0, 12)],
  [/^aces$/, num(0, 6)],
  [/^aceTwo$/, bool],
  [/^abilityUses\.[^.]{1,40}$/, num(0, 9)],
  [/^prestige\.(total|unclaimed|healthUps|mastered)$/, num(0, 999)],
  [/^reputation\.[0-3]\.faction$/, str(40)],
  [/^reputation\.[0-3]\.level$/, oneOf(REPUTATION)],
  [/^weapons\.[0-2]\.(manufacturer|model|slots|grit|itemId|type)$/, str(60)],
  [/^weapons\.[0-2]\.(arms|short|long|distant)$/, pool],
  [/^weapons\.[0-2]\.upgrades\.[0-3]$/, str(60)],
  [/^weapons\.[0-2]\.ammo\.[01]\.(name|rds)$/, str(40)],
  [/^gear\.[0-2]\.(item|type|grit|notes|itemId)$/, str(80)],
  [/^gear\.[0-2]\.uses$/, num(0, 6)],
  [/^horse\.(name|breed|breakingPoint|maxHealth|health|breedAbility|disposition|appearance|itemId)$/, str(300)],
  [/^horse\.bond$/, oneOf(REPUTATION)],
  [/^forstall\.(model|slots|range|grit|duration|itemId)$/, str(60)],
  [/^forstall\.sweep$/, pool],
  [/^forstall\.charges$/, num(0, 9)],
  [/^forstall\.(upgrades|kz)\.[0-3]$/, str(60)],
  [/^mech\.(class|slots|speed|maxHealth|health|supplies|cover|itemId)$/, str(60)],
  [/^mech\.defense$/, pool],
  [/^mech\.state$/, oneOf(MECH_STATES)],
  [/^mech\.upgrades\.[0-3]$/, str(60)],
  [/^(inventory|history)$/, str(3000)],
  [/^(disposition|appearance)$/, str(1000)],
  [/^(wallet|scrap|supplies)$/, str(20)],
  [/^items\.\d{1,2}\.qty$/, num(0, 99)],
];

export function setSheetField(sheet, path, value) {
  const rule = RULES.find(([re]) => re.test(path));
  if (!rule) throw new Error(`Can’t edit ${path}.`);
  const v = rule[1](value);
  const keys = path.split('.');
  let o = sheet;
  for (const k of keys.slice(0, -1)) { if (o[k] === undefined) o[k] = {}; o = o[k]; }
  if (keys[0] === 'items' && !sheet.items?.[Number(keys[1])]) throw new Error('No such item.');
  o[keys[keys.length - 1]] = v;
  if (keys[0] === 'items' && v === 0) sheet.items.splice(Number(keys[1]), 1); // quantity 0 drops it
  if (path === 'maxHealth' && sheet.health > v) sheet.health = v;
  sheet.updated = Date.now();
}

export function toggleSheetList(sheet, list, item) {
  const t = TRADES[sheet.trade];
  if (list === 'talents' && !TALENTS.includes(item)) throw new Error('Unknown Talent.');
  if (list === 'abilities' && !t.abilities.some((a) => a.name === item)) throw new Error('Unknown ability.');
  const arr = sheet[list];
  sheet[list] = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  sheet.updated = Date.now();
}

// Talents let you reroll Spurs; a Finesse Talent covers turn-order rolls.
export const hasSpur = (sheet, talent) => (sheet.talents || []).includes(talent);
