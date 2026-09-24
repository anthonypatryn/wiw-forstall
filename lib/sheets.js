// Digital character sheets, mirroring the official two-page Trade sheets.
import crypto from 'node:crypto';
import { TRADES } from './trades.js';
import { CATALOG } from './catalog.js';

export const TALENTS = [
  'Charm', 'Finesse', 'Intuition', 'Nerve',
  'Bows', 'Defense', 'Explosives', 'First Aid', 'Forstalls', 'Mechs', 'Melee Weapons',
  'Mounted Weapons', 'Pistols', 'Rifles', 'Shotguns', 'Traps',
];
export const REPUTATION = ['Revered', 'Helpful', 'Neutral', 'Suspicious', 'Hostile'];
export const MECH_STATES = ['Functional', 'Compromised', 'Totaled'];

// Character creation, Step 4 (p. 7): pick one Equipment Pack.
export const PACKS = {
  'Explorer’s Pack': ['Backpack', 'Thick blanket', 'Crowbar', 'Rations', 'Waterskin', 'Flint & steel', 'Journal & fountain pen', 'Compass (+1B to Intuition rolls made to navigate)'],
  'Pathfinder’s Pack': ['Backpack', 'Bedroll', 'Ball peen hammer & rivets', 'Rations', 'Waterskin', 'Push-button sparker', 'Lantern', '2x Pain Pills (1B First Aid)'],
  'Wanderer’s Pack': ['Backpack', 'Tarp', 'Wrench set', 'Rations', 'Waterskin', 'Bow drill', '30 yards of rope', 'Fishing pole (+1B to Finesse rolls made to fish)'],
  'Traveler’s Pack': ['Backpack', 'Bedroll', 'Multi-tool', 'Rations', 'Waterskin', 'Matches', 'Novel', 'Harmonica (+1B to Charm rolls made to play music)'],
};
// Step 5 (p. 8): one or two small keepsakes.
export const KEEPSAKES = [
  'A letter from a family member or friend', 'A picture of your family’s homestead', 'A wanted poster with your face on it',
  'A pocket watch with a meaningful inscription', 'A silver harmonica', 'A set of paints and canvas',
  'A handkerchief with an insignia belonging to a mystery enemy', 'A pocket knife with your initials carved in it',
  'A locket with a picture of your beloved', 'A dried flower preserved in the pages of a notebook',
  'A fossil of a trilobite wrapped in cloth', 'A coded message inscribed on a crumpled note',
];
// Every new character starts with a Used Pistol and a pocket knife (p. 7).
export const STARTING_WEAPONS = ['pistols-used-pistol', 'melee-pocket-knife'];

// Prestige tiers and the "Starting at Higher Prestige" loadouts (p. 33).
export const TIERS = [
  { name: 'Tenderfoot', prestige: 0, ranged: 'Used Pistol', melee: 'Pocket Knife', scrap: 0, wallet: 5, packs: 1, extras: 0 },
  { name: 'Cowpoke', prestige: 10, ranged: 'Basic', melee: 'Basic', scrap: 8, wallet: 10, packs: 1, extras: 1 },
  { name: 'Trailblazer', prestige: 25, ranged: 'Premium', melee: 'Basic', scrap: 16, wallet: 20, packs: 1, extras: 2 },
  { name: 'Roughrider', prestige: 50, ranged: 'Premium', melee: 'Premium', scrap: 24, wallet: 40, packs: 2, extras: 3 },
  { name: 'Wrangler', prestige: 75, ranged: 'Elite', melee: 'Premium', scrap: 36, wallet: 60, packs: 2, extras: 4 },
  { name: 'Legend', prestige: 100, ranged: 'Elite', melee: 'Elite', scrap: 48, wallet: 80, packs: 2, extras: 5 },
];
export const RANGED_SUBS = ['Rifles', 'Shotguns', 'Pistols', 'Bows'];
export const EXTRA_CATS = ['Gear'];
export const tierFor = (prestige) => [...TIERS].reverse().find((t) => (Number(prestige) || 0) >= t.prestige) || TIERS[0];
export const tierRanged = (t, it) => it.cat === 'Weapons' && RANGED_SUBS.includes(it.sub) && it.quality === t.ranged;
export const tierMelee = (t, it) => ((it.cat === 'Weapons' && it.sub === 'Melee') || it.cat === 'Traps') && it.quality === t.melee;
export function gearFields(it) {
  const notes = [it.benefit, it.effect, it.pool && `Roll ${it.pool}`, it.arms && `Arm’s Reach: ${it.arms}`, it.short && `Short: ${it.short}`, it.defense && `Defense ${it.defense}`].filter(Boolean).join(' · ').slice(0, 80);
  return { itemId: it.id, item: it.name.slice(0, 80), type: it.sub === 'Trap' ? 'Trap' : it.sub, grit: String(it.grit ?? ''), notes, uses: 0 };
}

const POOL_RE = /^(\d+[BG])+$/;
const WEAPON_TYPE = { Rifles: 'Rifles', Shotguns: 'Shotguns', Pistols: 'Pistols', Bows: 'Bows', Melee: 'Melee Weapons', Mounted: 'Mounted Weapons' };
export function weaponFields(item) {
  const [manufacturer, ...rest] = item.name.includes(' - ') ? item.name.split(' - ') : ['', item.name];
  const p = (v) => (POOL_RE.test(v || '') ? v : '');
  return {
    itemId: item.id, type: WEAPON_TYPE[item.sub] || item.sub || '', manufacturer: manufacturer.trim(), model: rest.join(' - ').trim() || item.name,
    slots: item.slots != null ? String(item.slots) : '', grit: item.grit2 ? `${item.grit} | ${item.grit2}` : String(item.grit ?? ''),
    arms: p(item.arms), short: p(item.short), long: p(item.long), distant: p(item.distant),
  };
}
// Put the Used Pistol and pocket knife into empty weapon slots (skips ones already carried). Returns what was added.
export function giveStartingWeapons(sheet) {
  const added = [];
  for (const id of STARTING_WEAPONS) {
    if (sheet.weapons.some((w) => w.itemId === id)) continue;
    const item = CATALOG.find((i) => i.id === id);
    const slot = sheet.weapons.find((w) => !w.itemId && !w.model && !w.manufacturer);
    if (!item || !slot) continue;
    Object.assign(slot, weaponFields(item));
    added.push(item.name);
  }
  sheet.updated = Date.now();
  return added;
}

const blankWeapon = () => ({ itemId: '', type: '', manufacturer: '', model: '', slots: '', grit: '', arms: '', short: '', long: '', distant: '', upgrades: ['', '', '', ''], ammo: [{ name: '', rds: '' }, { name: '', rds: '' }] });
const blankGear = () => ({ itemId: '', item: '', type: '', grit: '', notes: '', uses: 0 });

export function newSheet(trade, name) {
  const t = TRADES[trade];
  if (!t) throw new Error('Pick a Trade.');
  const sheet = {
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
    items: [], inventory: '', wallet: '', scrap: '', supplies: '1', pack: '', pack2: '', tier: '', tierApplied: '', tierKit: [], done: false,
    disposition: '', appearance: '', history: '',
    updated: Date.now(),
  };
  giveStartingWeapons(sheet);
  return sheet;
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
  [/^pack2?$/, (v) => (v === '' ? '' : oneOf(Object.keys(PACKS))(v))],
  [/^tier$/, (v) => (v === '' ? '' : oneOf(TIERS.map((t) => t.name))(v))],
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
