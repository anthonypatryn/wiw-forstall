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
// Achievements & Title Rewards (p. 34). Tier titles come from total Prestige; the rest the Warden grants.
export const ACHIEVEMENTS = [
  { name: 'Won’t Die Willie', req: 'Recover completely from Bleeding Out twice in one combat encounter.' },
  { name: 'The Silver Tongue', req: 'Reach Revered (or Hostile) Reputation with three different major Factions at once.' },
  { name: 'High Noon Survivor', req: 'Survive a High-Noon Duel against another player while seriously wounding or killing them.' },
  { name: 'Bare Wrestler', req: 'Defeat a Small monster with only your bare hands and no help.' },
  { name: 'Bronco Breaker', req: 'Find and tame a wild Spanish Mustang without help.' },
  { name: 'Wild West Purist', req: 'Take down a Huge monster without a mech or Forstall.' },
  { name: 'Trophy Master', req: 'Obtain and sell a Pristine pelt from a Large monster.' },
  { name: 'The Dust Drifter', req: 'Cross the continent from the Mississippi to the west coast of Isla California.' },
  { name: 'The Trailboss', req: 'Visit all nine western territories.' },
  { name: 'King o’ Frontier', req: 'Defeat a Titan, by whatever means necessary.' },
  { name: 'The Scrapper', req: 'Collect 100 Scrap — no borrowing (stealing is fair game).' },
  { name: 'Dino Bone Digger', req: 'Discover and excavate a new species of dinosaur bones.' },
];
// Upgrades (pp. 93–100): which store upgrades fit which item, and their "type" (one of each per item, Utility excepted).
const SINGULAR = { Rifles: 'Rifle', Shotguns: 'Shotgun', Pistols: 'Pistol', Bows: 'Bow' };
export const upgradeType = (it) => String(it.type || '').replace(/^L\d\s+/, '').replace(/\s*\(.*\)$/, '').trim();
export function upgradeFits(it, target, weaponSub) {
  if (it.cat !== 'Upgrades') return false;
  const to = String(it.appliesTo || '').split(/,\s*/);
  if (target === 'forstall') return it.sub === 'Forstall Upgrades' || (it.sub === 'For Purchase' && to.includes('Forstall'));
  if (target === 'mech') return it.sub === 'Mech Upgrades' || (it.sub === 'For Purchase' && to.includes('Mech'));
  if (weaponSub === 'Melee') return it.sub === 'Melee Weapon Upgrades' || (it.sub === 'For Purchase' && to.includes('Melee'));
  const one = SINGULAR[weaponSub];
  return !!one && (it.sub === 'Ranged Weapon Upgrades' || (it.sub === 'For Purchase' && to.includes(one)));
}
// p. 92: Fully-Functioning above 50% Health, Compromised at 50% or less, Totaled at 0.
export function mechState(m) {
  const max = Number(m?.maxHealth) || 0, hp = Number(m?.health);
  if (!max || !Number.isFinite(hp)) return m?.state || 'Functional';
  return hp <= 0 ? 'Totaled' : hp <= max / 2 ? 'Compromised' : 'Functional';
}
export const RANGED_SUBS = ['Rifles', 'Shotguns', 'Pistols', 'Bows'];
export const EXTRA_CATS = ['Gear'];
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

export const blankWeapon = () => ({ itemId: '', type: '', manufacturer: '', model: '', slots: '', grit: '', arms: '', short: '', long: '', distant: '', upgrades: ['', '', '', ''], ammo: [{ name: '', rds: '' }, { name: '', rds: '' }] });
export const blankGear = () => ({ itemId: '', item: '', type: '', grit: '', notes: '', uses: 0 });

export const blankHorse = () => ({ name: '', breed: '', breakingPoint: '', maxHealth: '', health: '', bond: 'Neutral', breedAbility: '', disposition: '', appearance: '' });
export const blankForstall = () => ({ model: '', slots: '', range: '', grit: '', charges: 2, duration: '', upgrades: ['', '', '', ''], kz: ['', '', '', ''] });
export const blankMech = () => ({ class: '', slots: '', speed: '', maxHealth: '', health: '', defense: '', state: 'Functional', supplies: '', cover: '', upgrades: ['', '', '', ''] });

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
  [/^mech\.toppled$/, bool],
  [/^mech\.upgrades\.[0-3]$/, str(60)],
  [/^(inventory|history)$/, str(3000)],
  [/^(disposition|appearance)$/, str(1000)],
  [/^(wallet|scrap|supplies)$/, str(20)],
  [/^pack2?$/, (v) => (v === '' ? '' : oneOf(Object.keys(PACKS))(v))],
  [/^title$/, str(40)],
  [/^player$/, str(40)],
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
  // emptying the name by hand also unlinks the Store item (its picture and details go with it)
  if (!v && /^(horse\.breed|mech\.class|forstall\.model|gear\.\d\.item|weapons\.\d\.model)$/.test(path) && !(keys[0] === 'weapons' && o.manufacturer)) o.itemId = '';
  if (path === 'maxHealth' && sheet.health > v) sheet.health = v;
  if (path === 'health' && sheet.health > sheet.maxHealth) sheet.health = sheet.maxHealth; // never above Max
  for (const k of ['horse', 'mech']) { // same for the horse and the mech
    const o = sheet[k], max = Number(o?.maxHealth), hp = Number(o?.health);
    if ((path === `${k}.health` || path === `${k}.maxHealth`) && max && hp > max) o.health = String(max);
  }
  if (path === 'mech.health' || path === 'mech.maxHealth') sheet.mech.state = mechState(sheet.mech);
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

// ---------- putting a bought or given item onto the sheet (Store → sheet) ----------
const poolOf = (v) => (POOL_RE.test(String(v || '').toUpperCase()) ? String(v).toUpperCase() : '');
export const forstallFields = (it) => ({
  itemId: it.id, model: it.name, slots: String(it.slots ?? ''), range: it.range || '', grit: String(it.grit ?? ''),
  duration: String(it.duration || '').replace(/\s*hours?/, ''), sweep: poolOf(it.sweep), charges: Number(String(it.battery || '').match(/\d+/)?.[0]) || 2,
});
export const mechFields = (it) => ({
  itemId: it.id, class: it.name.replace(/ Mech$/, ''), slots: String(it.slots ?? ''), speed: it.speed || '', maxHealth: String(it.health ?? ''), health: String(it.health ?? ''),
  defense: poolOf(it.defense), supplies: String(it.supply ?? ''), cover: it.cover || '', state: 'Functional',
});
export const horseFields = (it) => ({ itemId: it.id, breed: it.name, breakingPoint: String(it.breaking ?? ''), breedAbility: it.bond || '', maxHealth: '12', health: '12' });
// what kind of weapon sits in a slot (for upgrades and Special Ammo)
const weaponSubOf = (w) => CATALOG.find((x) => x.id === w.itemId)?.sub || (/melee/i.test(w.type) ? 'Melee' : /mounted/i.test(w.type) ? 'Mounted' : Object.keys(SINGULAR).find((k) => w.type === k)) || '';
// Fit an upgrade into a weapon/Forstall/mech: needs a free slot and one of each type (pp. 93–100). Returns the slot, or throws.
export function attachUpgrade(tgt, it, target) {
  const slots = Math.max(0, Math.min(4, Math.round(Number(tgt.slots) || 0)));
  tgt.upgrades ||= ['', '', '', '']; tgt.upgradeIds ||= ['', '', '', ''];
  const used = tgt.upgrades.slice(0, 4).filter((u) => String(u || '').trim()).length;
  if (used >= slots) throw new Error(`No free upgrade slot (${slots} slot${slots === 1 ? '' : 's'}).`);
  const type = upgradeType(it);
  if (type !== 'Utility' && tgt.upgradeIds.some((uid) => { const o = CATALOG.find((x) => x.id === uid); return o && upgradeType(o) === type; }))
    throw new Error(`It already has a ${type} upgrade — only one of each type.`);
  const k = tgt.upgrades.findIndex((u, n) => n < 4 && !String(u || '').trim());
  const short = it.name.replace(/^(Ranged Weapon|Melee Weapon|Forstall|Mech|Trap) /, '').replace(' — Level ', ' L');
  tgt.upgrades[k] = `${short}${it.upgrade && it.upgrade !== 'None' ? ` (${it.upgrade})` : ''}`.slice(0, 60);
  tgt.upgradeIds[k] = it.id;
  const add = Number(String(it.upgrade || '').match(/^Add (\d+)$/)?.[1] || 0);
  const n = (v) => Number(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
  if (target === 'mech' && type === 'Health' && add) { tgt.maxHealth = String(n(tgt.maxHealth) + add); tgt.health = String(n(tgt.health) + add); }
  if (target === 'mech' && type === 'Storage' && add) tgt.supplies = String(n(tgt.supplies) + add);
  if (target === 'forstall' && type === 'Battery Charges' && add) tgt.charges = (Number(tgt.charges) || 0) + add;
  if (target === 'mech') tgt.state = mechState(tgt);
  return k;
}
const GUNS = ['Rifles', 'Shotguns', 'Pistols', 'Mounted'];
// Returns { placed: 'where it went' | null, warning: 'why it couldn't go on' | null }. The item always stays in the inventory list.
export function equipItem(pc, it, qty = 1) {
  if (!it) return { placed: null, warning: null };
  const full = (why) => ({ placed: null, warning: `No room on ${pc.name}’s sheet for ${it.name}: ${why}. It’s in their inventory — make room, then tap “Put on sheet”.` });
  const { cat, sub } = it;
  if (cat === 'Weapons') {
    const w = pc.weapons.find((x) => !x.model && !x.manufacturer && !x.itemId);
    if (!w) return full('all 3 weapon slots are taken');
    Object.assign(w, weaponFields(it));
    return { placed: 'Weapons' };
  }
  if (cat === 'Forstalls' && !/crystal/i.test(it.name)) {
    pc.forstall ||= blankForstall();
    if (pc.forstall.model) return full(`they already carry a ${pc.forstall.model}`);
    Object.assign(pc.forstall, forstallFields(it));
    return { placed: 'Forstall' };
  }
  if (cat === 'Mechs') {
    pc.mech ||= blankMech();
    if (pc.mech.class) return full(`they already have the ${pc.mech.class} mech`);
    Object.assign(pc.mech, mechFields(it));
    return { placed: 'Mech' };
  }
  if (sub === 'Horse Breeds' || sub === 'Legendary Steeds') {
    pc.horse ||= blankHorse();
    if (pc.horse.breed) return full(`they already ride ${pc.horse.name || pc.horse.breed}`);
    Object.assign(pc.horse, horseFields(it));
    return { placed: 'Horse' };
  }
  if (sub === 'Special Ammo & Arrows') { // p. 76: counted in a weapon's ammo slot
    const kinds = /arrow/i.test(it.name) ? ['Bows'] : GUNS;
    const fits = pc.weapons.filter((w) => (w.model || w.manufacturer) && kinds.includes(weaponSubOf(w)));
    if (!fits.length) return full(`it needs a ${kinds.length > 1 ? 'gun' : 'bow'} in a weapon slot`);
    fits.forEach((w) => { w.ammo ||= [{ name: '', rds: '' }, { name: '', rds: '' }]; });
    const same = fits.flatMap((w) => w.ammo).find((a) => a.name === it.name);
    if (same) { same.rds = String((Number(same.rds) || 0) + qty); return { placed: 'Ammo' }; }
    const free = fits.flatMap((w) => w.ammo).find((a) => !a.name);
    if (!free) return full('every ammo slot on those weapons is loaded with something else');
    free.name = it.name.slice(0, 60); free.rds = String(qty);
    return { placed: 'Ammo' };
  }
  if (cat === 'Upgrades') {
    if (sub === 'Trap Upgrades') return { placed: null, warning: null };
    const tries = [];
    if (upgradeFits(it, 'forstall')) tries.push(['forstall', pc.forstall, 'Forstall']);
    if (upgradeFits(it, 'mech')) tries.push(['mech', pc.mech, 'mech']);
    pc.weapons.forEach((w) => { if ((w.model || w.manufacturer) && upgradeFits(it, 'weapon', weaponSubOf(w))) tries.push(['weapon', w, w.model || w.manufacturer]); });
    const have = tries.filter(([t, tgt]) => (t === 'forstall' ? tgt?.model : t === 'mech' ? tgt?.class : true));
    if (!have.length) return full(`there’s nothing it fits (${String(it.appliesTo || sub).replace(/ Upgrades$/, '')})`);
    const why = [];
    for (const [t, tgt, label] of have) {
      try { attachUpgrade(tgt, it, t); return { placed: label }; } catch (e) { why.push(`${label}: ${e.message.replace(/\.$/, '')}`); }
    }
    return full(why.join('; '));
  }
  if (cat === 'Gear' || cat === 'Traps' || cat === 'Forstalls') { // Refined Crystals ride in gear too
    if (pc.gear.some((g) => g.itemId === it.id)) return { placed: 'Gear' }; // already carried — the count is in the inventory
    const g = pc.gear.find((x) => !x.item && !x.itemId);
    if (!g) return full('all 3 gear slots are taken');
    Object.assign(g, gearFields(it));
    return { placed: 'Gear' };
  }
  return { placed: null, warning: null }; // goods & services live in the inventory list
}
// The other direction: an item leaves the inventory, so take it off the sheet too. Returns where it was, or null.
export function unequipItem(pc, itemId, name) {
  if (!itemId && !name) return null;
  const w = pc.weapons.findIndex((x) => itemId && x.itemId === itemId);
  if (w >= 0) { pc.weapons[w] = blankWeapon(); return 'Weapons'; }
  if (pc.forstall && ((itemId && pc.forstall.itemId === itemId) || (name && pc.forstall.model === name))) { pc.forstall = blankForstall(); return 'Forstall'; }
  if (pc.mech && itemId && pc.mech.itemId === itemId) { pc.mech = blankMech(); return 'Mech'; }
  if (pc.horse && ((itemId && pc.horse.itemId === itemId) || (name && pc.horse.breed === name))) { pc.horse = blankHorse(); return 'Horse'; }
  const g = pc.gear.findIndex((x) => itemId && x.itemId === itemId);
  if (g >= 0) { pc.gear[g] = blankGear(); return 'Gear'; }
  for (const t of [...pc.weapons, pc.forstall, pc.mech]) {
    const k = (t?.upgradeIds || []).indexOf(itemId);
    if (itemId && k >= 0) { t.upgrades[k] = ''; t.upgradeIds[k] = ''; return 'Upgrades'; }
  }
  for (const x of pc.weapons) {
    const a = (x.ammo || []).find((s) => name && s.name === name);
    if (a) { a.name = ''; a.rds = ''; return 'Ammo'; }
  }
  return null;
}
// Where an inventory entry lives on the sheet: 'Weapons', 'Forstall', … ; '' = it has no sheet section (goods & services); null = not placed yet
export function placedIn(pc, entry) {
  const { cat, sub, itemId } = entry, items = pc.items || [];
  if (cat === 'Weapons') return pc.weapons.filter((w) => w.itemId === itemId).length >= items.filter((x) => x.itemId === itemId).length ? 'Weapons' : null;
  if (cat === 'Forstalls' && !/crystal/i.test(entry.name)) return pc.forstall?.itemId === itemId || pc.forstall?.model === entry.name ? 'Forstall' : null;
  if (cat === 'Mechs') return pc.mech?.itemId === itemId ? 'Mech' : null;
  if (sub === 'Horse Breeds' || sub === 'Legendary Steeds') return pc.horse?.itemId === itemId || pc.horse?.breed === entry.name ? 'Horse' : null;
  if (sub === 'Special Ammo & Arrows') return pc.weapons.some((w) => (w.ammo || []).some((a) => a.name === entry.name)) ? 'Ammo' : null;
  if (cat === 'Upgrades') {
    if (sub === 'Trap Upgrades') return '';
    const t = [...pc.weapons, pc.forstall, pc.mech].find((x) => (x?.upgradeIds || []).includes(itemId));
    return t ? (t === pc.forstall ? 'Forstall' : t === pc.mech ? 'Mech' : 'Weapons') : null;
  }
  if (cat === 'Gear' || cat === 'Traps' || cat === 'Forstalls') return pc.gear.some((g) => g.itemId === itemId) ? 'Gear' : null;
  return ''; // goods & services have no sheet section
}
export const isPlaced = (pc, entry) => placedIn(pc, entry) !== null;
