// Core rule checks — run with `npm test` before every push (the live data is real).
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreGuess } from '../lib/game.js';
import { kindFromSheet, slotMonster, sweepTolerance, sweepLoss, bestSweep, edisonConflicts, fields, hexDist, KINDS } from '../lib/forstall.js';
import { newSheet, equipItem, unequipItem, isPlaced, attachUpgrade, setSheetField, forstallFields } from '../lib/sheets.js';
import { moveCost, freshCombat, publicAction, sweepHit } from '../lib/combat.js';
import { CATALOG } from '../lib/catalog.js';

const item = (id) => { const it = CATALOG.find((x) => x.id === id); assert.ok(it, `catalog has ${id}`); return it; };
const firstOf = (sub, n = 1) => CATALOG.filter((x) => x.sub === sub).slice(0, n);

test('Scanner scoring matches the Guidebook example (p. 84)', () => {
  assert.deepEqual(scoreGuess([6, 1, 2, 8, 2, 9], [6, 4, 2, 7, 1, 3]), ['green', 'yellow', 'green', 'red', 'red', 'red']);
});

test('hex distance and Forstall ranges (p. 85)', () => {
  assert.equal(hexDist({ col: 0, row: 0 }, { col: 6, row: 0 }), 6);
  assert.equal(KINDS.backpack.rangeIn, 6);
  assert.equal(KINDS.saddlebag.rangeIn, 6);
  assert.equal(KINDS.mech.rangeIn, 18);
  const k = kindFromSheet(forstallFields(item('models-saddlebag-forstall')));
  assert.deepEqual([k.kind, k.rangeIn, k.pool, k.grit], ['saddlebag', 6, '3B', 4]);
  assert.equal(kindFromSheet({ model: 'Mech Forstall', range: 'Long' }).rangeIn, 18);
});

test('memory slots read "Name · kz", bare frequencies and names', () => {
  assert.equal(slotMonster('Golden Bear · 2-6-3598'), 'Golden Bear');
  assert.equal(slotMonster('2-6-3598'), 'Golden Bear');
  assert.equal(slotMonster('golden bear'), 'Golden Bear');
  assert.equal(slotMonster(''), null);
});

test('Sweep Tolerance: profile, Frenzy, Immune, submerged', () => {
  assert.equal(sweepTolerance({ profile: 'Golden Bear', frenzied: [] }).tol, 2);
  assert.equal(sweepTolerance({ profile: 'Golden Bear', frenzied: ['Full Sovereignty'] }).tol, 4);
  assert.equal(sweepTolerance({ profile: 'Horned Lizard', frenzied: ['Blood Boil'] }).tol, 4);
  assert.equal(sweepTolerance({ profile: 'Shasta Skullface', frenzied: ['Ancient Tolerance'] }).immune, true);
  assert.equal(sweepTolerance({ profile: 'Chupacabra', submerged: true }).immune, true);
  assert.equal(sweepTolerance({ profile: 'npc:Bandit' }).monster, false);
});

test('Sweep loss = Hits + 1 if programmed − Tolerance, never below 0; the strongest field wins', () => {
  const bear = { profile: 'Golden Bear', frenzied: [] };
  const f = (hits, known, rangeIn = 6, pos = { col: 0, row: 0 }) => ({ key: String(hits), sweep: { hits }, known: new Set(known), rangeIn, pos });
  assert.equal(sweepLoss(f(3, ['Golden Bear']), bear).loss, 2);
  assert.equal(sweepLoss(f(3, []), bear).loss, 1);
  assert.equal(sweepLoss(f(1, []), bear).loss, 0);
  assert.equal(sweepLoss(f(5, []), { profile: 'npc:Bandit' }), null);
  const best = bestSweep([f(2, []), f(6, [], 18)], bear, { col: 5, row: 0 });
  assert.equal(best.loss, 4);
  assert.equal(bestSweep([f(6, [])], bear, { col: 10, row: 0 }), null); // out of Range
});

test('Edison’s Rule 1 flags two Sweeping Forstalls in Range of each other', () => {
  const a = { key: 'a', sweep: { hits: 1 }, rangeIn: 6, pos: { col: 0, row: 0 } };
  assert.deepEqual(edisonConflicts([a, { key: 'b', sweep: { hits: 1 }, rangeIn: 18, pos: { col: 15, row: 0 } }]), [['a', 'b']]);
  assert.deepEqual(edisonConflicts([a, { key: 'b', sweep: { hits: 1 }, rangeIn: 6, pos: { col: 15, row: 0 } }]), []);
  assert.deepEqual(edisonConflicts([a, { key: 'b', sweep: null, rangeIn: 18, pos: { col: 1, row: 0 } }]), []);
});

test('a character’s Forstall rides on their token and knows only its slots', () => {
  const pc = newSheet('Hunter', 'Tess');
  Object.assign(pc.forstall, forstallFields(item('models-backpack-forstall')));
  pc.forstall.kz[0] = 'Golden Bear · 2-6-3598';
  const [fl] = fields({ tokens: [{ kind: 'pc', ref: pc.id, col: 3, row: 4, id: 't' }] }, { posse: [pc], sweeps: {} });
  assert.deepEqual(fl.pos, { col: 3, row: 4 });
  assert.deepEqual([...fl.known], ['Golden Bear']);
});

test('Move cost (p. 41): Normal 1 Grit per 6″, Fast half, rough doubles', () => {
  assert.equal(moveCost('pc', {}, 6, false).cost, 1);
  assert.equal(moveCost('pc', {}, 7, false).cost, 2);
  assert.equal(moveCost('pc', { mounted: 'horse' }, 12, false).cost, 1);
  assert.equal(moveCost('pc', {}, 6, true).cost, 2);
});

test('Store items land in the right sheet section, with a warning when full', () => {
  const pc = newSheet('Hunter', 'Fanny');
  pc.items = [];
  assert.equal(equipItem(pc, item('models-backpack-forstall')).placed, 'Forstall');
  assert.match(equipItem(pc, item('models-mech-forstall')).warning, /already carry/);
  assert.equal(equipItem(pc, item('horse-breeds-appaloosa')).placed, 'Horse');
  assert.equal(equipItem(pc, item('models-refined-crystal-bursting')).placed, 'Gear');
  assert.equal(equipItem(pc, item('for-purchase-crystal-burst-fuse')).placed, 'Forstall');
  const rifles = firstOf('Rifles', 4);
  const results = rifles.map((r) => equipItem(pc, r));
  assert.ok(results.some((r) => r.warning && /weapon slots/.test(r.warning)), 'a fourth weapon has no room');
  assert.equal(equipItem(pc, item('special-ammo-arrows-piercing-rounds-1'), 5).placed, 'Ammo');
  assert.match(equipItem(pc, item('special-ammo-arrows-poison-arrowheads-1')).warning, /bow/);
});

test('isPlaced / unequipItem keep the inventory and the sheet in step', () => {
  const pc = newSheet('Hunter', 'Felix');
  const horse = item('horse-breeds-appaloosa');
  pc.items = [{ uid: 'h', itemId: horse.id, name: horse.name, cat: horse.cat, sub: horse.sub, qty: 1 }];
  assert.equal(isPlaced(pc, pc.items[0]), false);
  equipItem(pc, horse);
  assert.equal(isPlaced(pc, pc.items[0]), true);
  assert.equal(unequipItem(pc, horse.id, horse.name), 'Horse');
  assert.equal(pc.horse.breed, '');
});

test('clearing a name by hand unlinks the Store item (its picture goes too)', () => {
  const pc = newSheet('Hunter', 'Felix');
  equipItem(pc, item('horse-breeds-appaloosa'));
  setSheetField(pc, 'horse.breed', '');
  assert.equal(pc.horse.itemId, '');
});

test('upgrades need a free slot and one of each type', () => {
  const f = forstallFields(item('models-backpack-forstall')); // 2 slots
  attachUpgrade(f, item('forstall-upgrades-forstall-battery-charges-level-1'), 'forstall');
  assert.equal(f.charges, 3);
  assert.throws(() => attachUpgrade(f, item('forstall-upgrades-forstall-battery-charges-level-2'), 'forstall'), /only one of each type/);
  attachUpgrade(f, item('for-purchase-crystal-burst-fuse'), 'forstall');
  assert.throws(() => attachUpgrade(f, item('forstall-upgrades-forstall-calibration-level-1'), 'forstall'), /No free upgrade slot/);
});

test('a Sweep in combat spends Grit + a charge and a monster’s turn start costs it Grit', () => {
  const state = freshCombat();
  const pc = publicAction(state, { action: 'addPc', trade: 'Hunter', name: 'Tess' }, { warden: true });
  Object.assign(pc.forstall, forstallFields(item('models-backpack-forstall')));
  publicAction(state, { action: 'addEnemy', profile: 'Chupacabra' }, { warden: true });
  publicAction(state, { action: 'start' }, { warden: true });
  state.combat.current = pc.id; pc.grit = 6;
  const tokens = [{ kind: 'pc', ref: pc.id, col: 0, row: 0, id: 'p' }, { kind: 'enemy', ref: state.enemies[0].id, col: 2, row: 0, id: 'e' }];
  const ctx = () => ({ list: fields({ tokens }, state), tokens, cave: false });
  const r = publicAction(state, { action: 'forstall', op: 'sweep', key: `pc:${pc.id}` }, { warden: false, ctx: ctx() });
  assert.equal(pc.grit, 2);
  assert.equal(pc.forstall.charges, 1);
  assert.equal(state.sweeps[`pc:${pc.id}`].hits, r.hits);
  // the Chupacabra (Tolerance 1, not programmed) starts its turn 2″ away inside a 3-Hit Sweep → −2 Grit
  state.sweeps[`pc:${pc.id}`].hits = 3;
  const e = state.enemies[0]; e.grit = 6;
  sweepHit(state, ctx().list, tokens, e.id, 'start');
  assert.equal(e.grit, 4);
});
