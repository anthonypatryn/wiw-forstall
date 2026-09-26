// Core rule checks — run with `npm test` before every push (the live data is real).
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreGuess } from '../lib/game.js';
import { kindFromSheet, slotMonster, sweepTolerance, sweepLoss, bestSweep, edisonConflicts, fields, hexDist, KINDS } from '../lib/forstall.js';
import { newSheet, equipItem, unequipItem, isPlaced, attachUpgrade, setSheetField, forstallFields } from '../lib/sheets.js';
import { moveCost, freshCombat, publicAction, sweepHit, pushUndo, undoCombat } from '../lib/combat.js';
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

test('Natural EMP stops Sweeps in Long Range and blocks Bursts; Forstall Efficiency adds an Ace', () => {
  const state = freshCombat();
  const pc = publicAction(state, { action: 'addPc', trade: 'Mechanic', name: 'Gears' }, { warden: true });
  Object.assign(pc.forstall, forstallFields(item('models-backpack-forstall')));
  pc.forstall.upgrades[0] = 'Crystal Burst Fuse';
  pc.forstall.kz[0] = 'Southern Death Worm';
  pc.abilities = [...pc.abilities, 'Forstall Efficiency'];
  publicAction(state, { action: 'addEnemy', profile: 'Southern Death Worm' }, { warden: true });
  const worm = state.enemies[0];
  const tokens = [{ kind: 'pc', ref: pc.id, col: 0, row: 0, id: 'p' }, { kind: 'enemy', ref: worm.id, col: 4, row: 0, id: 'e' }];
  const ctx = () => ({ list: fields({ tokens }, state), tokens, cave: false });
  const key = `pc:${pc.id}`;
  publicAction(state, { action: 'forstall', op: 'sweep', key, efficiency: true }, { warden: true, ctx: ctx() });
  assert.ok(state.sweeps[key]);
  publicAction(state, { action: 'forstall', op: 'emp', enemy: worm.id }, { warden: true, ctx: ctx() });
  assert.equal(state.sweeps[key], undefined);
  assert.equal(worm.empUses, 1);
  pc.gear[0] = { itemId: 'x', item: 'Refined Crystal', type: '', grit: '', notes: '', uses: 0 };
  assert.throws(() => publicAction(state, { action: 'forstall', op: 'burst', key, enemy: worm.id }, { warden: true, ctx: ctx() }), /Natural EMP/);
});

test('"Needs you" lists store requests and enemy turns for the Warden', async () => {
  const { wardenNeeds } = await import('../lib/combat.js');
  const state = freshCombat();
  publicAction(state, { action: 'addPc', trade: 'Hunter', name: 'Tess' }, { warden: true });
  publicAction(state, { action: 'addEnemy', profile: 'Chupacabra' }, { warden: true });
  const shop = { requests: [{ status: 'pending', pcName: 'Tess', kind: 'buy', qty: 1, name: 'Rope', price: 1 }] };
  let n = wardenNeeds(state, { shop, edison: [] });
  assert.equal(n.count, 1);
  publicAction(state, { action: 'start' }, { warden: true });
  state.combat.current = state.enemies[0].id;
  n = wardenNeeds(state, { shop: null, edison: [] });
  assert.match(n.items[0].text, /Chupacabra’s turn/);
});

test('the inventory mirrors the sheet: picking from the list adds it, replacing drops the old one', async () => {
  const { placedIn } = await import('../lib/sheets.js');
  const state = freshCombat();
  const pc = publicAction(state, { action: 'addPc', trade: 'Hunter', name: 'Mira' }, { warden: true });
  pc.items = [];
  const [r1, r2] = firstOf('Rifles', 2);
  publicAction(state, { action: 'pc', id: pc.id, op: 'pick', kind: 'weapon', i: 2, item: r1 }, { warden: true });
  assert.deepEqual(pc.items.map((x) => x.itemId), [r1.id]);
  assert.equal(placedIn(pc, pc.items[0]), 'Weapons');
  publicAction(state, { action: 'pc', id: pc.id, op: 'pick', kind: 'weapon', i: 2, item: r2 }, { warden: true });
  assert.deepEqual(pc.items.map((x) => x.itemId), [r2.id]);
  assert.equal(placedIn(pc, { cat: 'Goods & Services', sub: 'x', itemId: 'y', name: 'Bedroll' }), '');
});

test('combat roster: only the picked fighters take turns; join and leave mid-fight', () => {
  const state = freshCombat();
  const a = publicAction(state, { action: 'addPc', trade: 'Hunter', name: 'Ada' }, { warden: true });
  const b = publicAction(state, { action: 'addPc', trade: 'Doctor', name: 'Bo' }, { warden: true });
  publicAction(state, { action: 'addEnemy', profile: 'Chupacabra' }, { warden: true });
  publicAction(state, { action: 'addEnemy', profile: 'Golden Bear' }, { warden: true });
  const [chupa, bear] = state.enemies;
  publicAction(state, { action: 'start', posse: [a.id], enemies: [chupa.id] }, { warden: true });
  assert.deepEqual(state.combat.slots.filter((s) => s !== 'enemies'), [a.id]);
  assert.equal(bear.out, true);
  publicAction(state, { action: 'join', id: b.id }, { warden: true });
  assert.ok(state.combat.slots.includes(b.id));
  publicAction(state, { action: 'join', id: bear.id }, { warden: true });
  assert.equal(bear.out, false);
  publicAction(state, { action: 'leave', id: a.id }, { warden: true });
  assert.ok(!state.combat.slots.includes(a.id));
  publicAction(state, { action: 'end' }, { warden: true });
  assert.equal(state.combat.party, null);
  assert.equal(bear.out, undefined);
});

test('session write-up: the archive outlives the Table Log, entries are picked by session, your notes are kept', async () => {
  const { sessionEntries, withSummary, plainSummary } = await import('../lib/session.js');
  const state = freshCombat();
  for (let i = 0; i < 120; i++) publicAction(state, { action: 'roll', pool: '1B', whoName: 'Ada', label: `test ${i}` }, { warden: true });
  assert.equal(state.log.length, 80);
  assert.equal(state.archive.length, 120);
  const now = Date.now();
  const sess = { sessions: [{ id: 'a', created: now - 1000 }, { id: 'b', created: now + 1e9 }] };
  assert.equal(sessionEntries(sess, sess.sessions[0], state.archive).length, 120);
  assert.equal(sessionEntries(sess, sess.sessions[1], state.archive).length, 0);
  const notes = withSummary('the mine is haunted', plainSummary(state.archive), 'plain');
  assert.match(notes, /=== SUMMARY ===[\s\S]*=== MY NOTES ===\nthe mine is haunted$/);
  assert.match(withSummary(notes, 'new summary', 'again'), /new summary[\s\S]*=== MY NOTES ===\nthe mine is haunted$/);
});

test('handouts: Warden-only sending, private until shown, the posse sees shared ones', async () => {
  const { freshHandouts, handoutAction, handoutView } = await import('../lib/handouts.js');
  const st = freshHandouts(), names = { a: 'Ada', b: 'Bo' };
  assert.throws(() => handoutAction(st, { action: 'send', kind: 'note', text: 'x', to: 'all' }, { warden: false, names }), /Warden/);
  const h = handoutAction(st, { action: 'send', kind: 'note', text: 'Trust no one', to: ['a'] }, { warden: true, names });
  assert.equal(handoutView(st, { pc: 'b' }).list.length, 0);
  assert.equal(handoutView(st, { pc: 'a' }).list.length, 1);
  assert.throws(() => handoutAction(st, { action: 'share', id: h.id, pc: 'b' }, { warden: false, names }), /Only the person/);
  handoutAction(st, { action: 'share', id: h.id, pc: 'a' }, { warden: false, names });
  assert.equal(handoutView(st, { pc: 'b' }).list[0].sharedBy, 'Ada');
});

test('whispers: player → Warden, Warden replies or starts one; each only reaches its person', async () => {
  const { freshWhispers, whisperAction, whisperView } = await import('../lib/whispers.js');
  const st = freshWhispers(), names = { a: 'Ada', b: 'Bo' };
  const { id } = whisperAction(st, { action: 'send', pc: 'a', text: 'psst' }, { warden: false, names });
  assert.equal(whisperView(st, { warden: true }).list.length, 1);
  assert.throws(() => whisperAction(st, { action: 'reply', id, text: 'ok' }, { warden: false, names }), /Warden/);
  whisperAction(st, { action: 'reply', id, text: 'noted' }, { warden: true, names });
  whisperAction(st, { action: 'wardenSend', to: ['b'], text: 'you hear a click' }, { warden: true, names });
  assert.deepEqual(whisperView(st, { pc: 'a' }).list.map((w) => w.reply), ['noted']);
  assert.deepEqual(whisperView(st, { pc: 'b' }).list.map((w) => [w.reply, w.fromWarden]), [['you hear a click', true]]);
});

test('lock picking (High/Low): ties lose, Ace rules, win N in a row, peeks, retries', async () => {
  const { freshLocks, lockAction } = await import('../lib/lockpick.js');
  const names = { a: 'Ada', b: 'Bo' }, noRoll = () => ({ hits: 1, dice: [] });
  // deck helper: cards are drawn from the END, so list them in reverse (last = starter)
  const D = (...cards) => () => cards.map(([r, s]) => ({ r, s: s || '♠' })).reverse();
  const start = (need, deck, retries = 0) => {
    const st = freshLocks();
    const { ids: [id] } = lockAction(st, { action: 'start', to: ['a'], difficulty: need, retries, retryCost: 'one lockpick' }, { warden: true, names });
    lockAction(st, { action: 'finesse', id, pc: 'a' }, { warden: false, names, rollFinesse: noRoll, deck });
    return { st, id, go: (x) => lockAction(st, { id, pc: 'a', ...x }, { warden: false, names, rollFinesse: noRoll, deck }) };
  };
  // a tie loses
  let t = start(1, D([7], [7, '♥']));
  assert.equal(t.go({ action: 'guess', dir: 'higher' }).ok, false);
  // an Ace as the starter: the player calls it; low → a 2 is higher
  t = start(1, D([14], [2]));
  assert.equal(t.st.list[0].status, 'ace');
  t.go({ action: 'ace', value: 'low' });
  assert.equal(t.go({ action: 'guess', dir: 'higher' }).ok, true);
  assert.equal(t.st.list[0].status, 'picked');
  // an Ace drawn next is always high
  t = start(2, D([13], [14], [5]));
  assert.equal(t.go({ action: 'guess', dir: 'higher' }).ok, true);   // K → A(high)
  assert.equal(t.go({ action: 'guess', dir: 'lower' }).ok, true);    // A(14) → 5
  assert.equal(t.st.list[0].status, 'picked');
  // peeks show the next card's color and cost one
  t = start(3, D([9], [3, '♥'], [10]));
  assert.equal(t.go({ action: 'peek' }).color, 'red');
  assert.equal(t.st.list[0].peeks, 0);
  // failing, then retrying costs a try; with none left it can't
  t = start(1, D([9], [9]), 1);
  t.go({ action: 'guess', dir: 'lower' });
  t.st.list[0].peeks = 0; // spent the peek on the first try
  t.go({ action: 'retry' });
  assert.equal(t.st.list[0].status, 'playing', 'no second Finesse roll');
  assert.equal(t.st.list[0].peeks, 1, 'the same peeks as the first roll');
  assert.throws(() => t.go({ action: 'finesse' }), /Already rolled/);
  t.go({ action: 'guess', dir: 'lower' });
  assert.throws(() => t.go({ action: 'retry' }), /No more tries/);
  // someone else can't touch your lock
  assert.throws(() => lockAction(t.st, { action: 'peek', id: t.id, pc: 'b' }, { warden: false, names }), /someone else/);
});

test('lock loot and traps: hidden until it opens, then handed over once', async () => {
  const { freshLocks, lockAction, lockView } = await import('../lib/lockpick.js');
  const names = { a: 'Ann' }, opened = [];
  const st = freshLocks();
  const { ids: [id] } = lockAction(st, { action: 'start', to: ['a'], difficulty: 1, loot: { kind: 'money', amount: '12.5' }, trap: { damage: 3, status: 'Poisoned', sev: 2 } }, { warden: true, names });
  assert.deepEqual(st.list[0].loot, { kind: 'money', amount: 12.5 });
  assert.equal(lockView(st, { warden: false, pc: 'a' }).list[0].loot, undefined);
  assert.equal(lockView(st, { warden: true }).list[0].trap.damage, 3);
  const deck = () => [{ r: 9, s: '♠' }, { r: 5, s: '♠' }];
  const o = { warden: false, names, rollFinesse: () => ({ hits: 0 }), deck, onOpen: (a, what) => opened.push(what) };
  lockAction(st, { action: 'finesse', id, pc: 'a' }, o);
  lockAction(st, { action: 'guess', id, pc: 'a', dir: 'higher' }, o);
  assert.deepEqual(opened, ['trap', 'loot']);
  assert.equal(st.list[0].found, '$12.5');
  assert.equal(st.list[0].sprung, '−3 Health, Poisoned [2]');
  // nothing inside, no trap: no loot calls
  const s2 = freshLocks();
  lockAction(s2, { action: 'start', to: ['a'], difficulty: 1, loot: { kind: 'item' }, trap: { damage: 0 } }, { warden: true, names });
  assert.equal(s2.list[0].loot, null); assert.equal(s2.list[0].trap, null);
});

test('End Session: a late-started session reaches back over the night, then ends', async () => {
  const { freshSession, sessionAction } = await import('../lib/session.js');
  const st = freshSession(), now = Date.now();
  const s = sessionAction(st, { action: 'add', created: now - 5 * 3600e3 });
  assert.ok(Math.abs(s.created - (now - 5 * 3600e3)) < 1000);
  assert.ok(sessionAction(st, { action: 'add', created: now - 9 * 86400e3 }).created >= now - 2 * 86400e3 - 1000);
  assert.ok(sessionAction(st, { action: 'add', created: now + 86400e3 }).created <= Date.now());
  assert.ok(sessionAction(st, { action: 'end', id: s.id }).ended);
});

test('Duel requests: a player calls out a ledger NPC; the Warden accepts (starts the p. 58 Duel) or says no', () => {
  const st = freshCombat();
  const pc = publicAction(st, { action: 'addPc', name: 'Lila', trade: 'Gunslinger' }, { warden: false });
  const r = publicAction(st, { action: 'duelRequest', pc: pc.id, npcId: 'n1', npcName: 'Black Bart', reason: 'He cheated at cards' }, { warden: false });
  assert.throws(() => publicAction(st, { action: 'duelRequest', pc: pc.id, npcName: 'Someone' }, { warden: false }), /already/);
  assert.throws(() => publicAction(st, { action: 'duelAnswer', id: r.id, accept: true }, { warden: false }), /PIN/);
  assert.throws(() => publicAction(st, { action: 'duelStart', a: `pc:${pc.id}`, b: 'np:npc:Human - Weak Combatant|X' }, { warden: false }), /PIN/);
  publicAction(st, { action: 'duelAnswer', id: r.id, accept: true, tough: 'Strong' }, { warden: true });
  assert.equal(st.duel.a, `pc:${pc.id}`);
  assert.equal(st.duel.b, 'np:npc:Human - Strong Combatant|Black Bart');
  assert.deepEqual(st.duel.names, ['Lila', 'Black Bart']);
  assert.throws(() => publicAction(st, { action: 'duelAnswer', id: r.id, accept: false }, { warden: true }), /already/);
  // a second challenge, turned down with a note
  const r2 = publicAction(st, { action: 'duelRequest', pc: pc.id, npcName: 'Doc' }, { warden: false });
  const ans = publicAction(st, { action: 'duelAnswer', id: r2.id, accept: false, note: 'Not in church.' }, { warden: true });
  assert.equal(ans.status, 'denied'); assert.equal(ans.note, 'Not in church.');
});

test('Wanted posters: Warden-only, hidden ones stay hidden, bounty split with Cut of the Profit', async () => {
  const { freshWanted, wantedAction, wantedView, allTowns } = await import('../lib/wanted.js');
  const st = freshWanted(), towns = allTowns(st, []);
  const dodge = towns.find((t) => t.name.includes('Dodge'));
  assert.ok(dodge, 'Dodge is a town');
  const posse = [{ id: 'a', name: 'Lila', wallet: '$10' }, { id: 'b', name: 'Doc', wallet: '' }];
  const o = { warden: true, towns, posse };
  assert.throws(() => wantedAction(st, { action: 'add', town: dodge.id, name: 'X' }, { ...o, warden: false }), /PIN/);
  assert.throws(() => wantedAction(st, { action: 'add', town: 'nowhere', name: 'X' }, o), /town/);
  const p = wantedAction(st, { action: 'add', town: dodge.id, name: 'Black Bart', reward: '$100', crime: 'Train robbery', wardenNote: 'secret' }, o);
  wantedAction(st, { action: 'add', town: dodge.id, name: 'Hidden Hank', hidden: true }, o);
  const pub = wantedView(st, { warden: false, towns });
  assert.equal(pub.posters.length, 1); assert.equal(pub.posters[0].wardenNote, undefined);
  const t = wantedAction(st, { action: 'addTown', name: 'Coyote Flats' }, o);
  const towns2 = allTowns(st, []);
  wantedAction(st, { action: 'edit', id: p.id, town: t.id }, { ...o, towns: towns2 });
  assert.throws(() => wantedAction(st, { action: 'removeTown', id: t.id }, o), /posters/);
  const paid = wantedAction(st, { action: 'payout', id: p.id, to: ['a', 'b'], bonus: ['b'] }, o);
  assert.deepEqual(paid.map((x) => x.amount), [50, 60]);
  assert.equal(posse[0].wallet, '60.00'); assert.equal(posse[1].wallet, '60.00');
  assert.throws(() => wantedAction(st, { action: 'payout', id: p.id, to: ['a'] }, o), /already/);
});

test('Selling: anything on the sheet can be sold (starting weapons, horse), and a sold Store item leaves the sheet too', async () => {
  const { freshShop, shopAction, sellables } = await import('../lib/shop.js');
  const combat = freshCombat(), shop = freshShop();
  const pc = publicAction(combat, { action: 'addPc', name: 'Lila', trade: 'Gunslinger' }, { warden: false });
  pc.wallet = '10.00';
  pc.horse.breed = 'Morgan'; pc.horse.name = 'Biscuit';
  const list = sellables(pc, shop);
  const gun = list.find((x) => x.key.startsWith('weapon:'));
  assert.ok(gun, 'starting weapon is sellable');
  assert.ok(list.some((x) => x.key === 'horse' && x.name === 'Biscuit (Morgan)'));
  const r = shopAction(shop, combat, { action: 'request', kind: 'sell', pc: pc.id, key: gun.key }, { warden: false });
  shopAction(shop, combat, { action: 'decide', id: r.id, approve: true, price: 7 }, { warden: true });
  assert.equal(pc.wallet, '17.00');
  assert.equal(pc.weapons[Number(gun.key.split(':')[1])].model, '');
  assert.ok(!sellables(pc, shop).some((x) => x.key === gun.key && x.name === gun.name));
  // a bought gun: one row (the inventory), and selling it takes it off the Weapons section too
  const buy = shopAction(shop, combat, { action: 'request', kind: 'buy', pc: pc.id, itemId: 'pistols-used-pistol' }, { warden: false });
  pc.wallet = '999';
  shopAction(shop, combat, { action: 'decide', id: buy.id, approve: true }, { warden: true });
  assert.ok(pc.weapons.some((w) => w.itemId === 'pistols-used-pistol'));
  const rows = sellables(pc, shop).filter((x) => x.name.includes('Used Pistol'));
  assert.equal(rows.length, 1); assert.ok(rows[0].key.startsWith('inv:'));
  const s = shopAction(shop, combat, { action: 'request', kind: 'sell', pc: pc.id, key: rows[0].key }, { warden: false });
  shopAction(shop, combat, { action: 'decide', id: s.id, approve: true }, { warden: true });
  assert.ok(!pc.weapons.some((w) => w.itemId === 'pistols-used-pistol'));
});

test('Newspaper: drafts stay with the Warden until printed; one draft per session; publish logs the headline', async () => {
  const { freshPapers, papersAction, papersView, paperName } = await import('../lib/papers.js');
  const st = freshPapers(), logs = [];
  assert.equal(paperName('Dodge'), paperName('Dodge'));
  assert.equal(paperName(''), 'The Frontier Gazette');
  assert.throws(() => papersAction(st, { action: 'save', sessionId: 's1', headline: 'X' }, { warden: false }), /PIN/);
  const p = papersAction(st, { action: 'save', sessionId: 's1', townName: 'Dodge', headline: '', stories: [{ head: 'A', text: 'B' }, { head: '', text: '' }] }, { warden: true });
  assert.equal(p.stories.length, 1); assert.equal(p.no, 1); assert.ok(p.paper.startsWith('The Dodge'));
  assert.equal(papersAction(st, { action: 'save', sessionId: 's1', headline: 'Posse Routs Hogwilds' }, { warden: true }).id, p.id);
  assert.equal(papersView(st, { warden: false }).issues.length, 0);
  papersAction(st, { action: 'publish', id: p.id }, { warden: true, log: (t) => logs.push(t) });
  assert.equal(papersView(st, { warden: false }).issues.length, 1);
  assert.match(logs[0], /Posse Routs Hogwilds/);
  assert.equal(papersAction(st, { action: 'save', sessionId: 's1', headline: 'Next' }, { warden: true }).no, 2); // printed issues aren't reused
});

test('Journal: players see only revealed quests/clues (no hidden steps); reveals and completions make news', async () => {
  const { freshJournal, journalAction, journalView } = await import('../lib/journal.js');
  const st = freshJournal(), W = { warden: true };
  assert.throws(() => journalAction(st, { action: 'saveQuest', title: 'X' }, { warden: false }), /PIN/);
  const q = journalAction(st, { action: 'saveQuest', title: 'Find the Kurtz crystal', steps: [{ text: 'Ask the barkeep' }, { text: 'The secret mine', hidden: true }] }, W);
  const c = journalAction(st, { action: 'saveClue', title: 'Muddy boots', text: 'Size 13', quest: q.id }, W);
  let pv = journalView(st, { warden: false });
  assert.equal(pv.quests.length, 0); assert.equal(pv.clues.length, 0); assert.equal(pv.news.length, 0);
  journalAction(st, { action: 'reveal', kind: 'clue', id: c.id, value: true }, W);
  pv = journalView(st, { warden: false });
  assert.equal(pv.clues[0].quest, '', 'a clue does not leak a hidden quest');
  journalAction(st, { action: 'reveal', kind: 'quest', id: q.id, value: true }, W);
  pv = journalView(st, { warden: false });
  assert.equal(pv.quests[0].steps.length, 1); assert.equal(pv.clues[0].quest, q.id);
  journalAction(st, { action: 'step', id: q.id, step: q.steps[1].id, hidden: false }, W);
  journalAction(st, { action: 'status', id: q.id, status: 'done' }, W);
  pv = journalView(st, { warden: false });
  assert.equal(pv.quests[0].steps.length, 2);
  assert.match(pv.news[0].text, /Quest complete/);
  journalAction(st, { action: 'posseNote', id: q.id, text: 'Barkeep lied' }, { warden: false });
  assert.equal(st.quests[0].posseNotes, 'Barkeep lied');
  journalAction(st, { action: 'remove', id: q.id }, W);
  assert.equal(st.clues[0].quest, '');
});

test('Scene prep: Warden-only, tidy fields, beats marked used, done clears tonight', async () => {
  const { freshScenes, sceneAction } = await import('../lib/scenes.js');
  const st = freshScenes(), W = { warden: true };
  assert.throws(() => sceneAction(st, { action: 'save', scene: { title: 'x' } }, { warden: false }), /PIN/);
  assert.throws(() => sceneAction(st, { action: 'save', scene: {} }, W), /name/);
  const s = sceneAction(st, { action: 'save', scene: { title: 'Ambush at Dry Gulch', enemies: [{ profile: 'npc:Human - Weak Combatant', count: 20 }, {}], checks: [{ skill: 'Nope', diff: 'Hard' }], locks: [{ what: 'strongbox', difficulty: 9, loot: { kind: 'money', amount: '12' } }] } }, W);
  assert.equal(s.enemies.length, 1); assert.equal(s.enemies[0].count, 8);
  assert.equal(s.checks[0].skill, 'Intuition'); assert.equal(s.checks[0].diff, 'Medium');
  assert.equal(s.locks[0].difficulty, 5); assert.equal(s.locks[0].loot.amount, 12);
  sceneAction(st, { action: 'current', id: s.id }, W);
  sceneAction(st, { action: 'used', id: s.id, key: 'fight' }, W);
  assert.ok(st.scenes[0].used.fight);
  sceneAction(st, { action: 'done', id: s.id }, W);
  assert.equal(st.current, '');
  const c = sceneAction(st, { action: 'copy', id: s.id }, W);
  assert.deepEqual(c.used, {}); assert.equal(c.done, false);
});

test('Poker (five-card draw): hand ranks and tie-breaks', async () => {
  const { rankHand, compareHands } = await import('../lib/saloon.js');
  const H = (s) => s.split(' ').map((x) => ({ r: { A: 14, K: 13, Q: 12, J: 11, T: 10 }[x[0]] || Number(x[0]), s: x[1] }));
  const cat = (s) => rankHand(H(s)).cat;
  assert.equal(cat('A♠ K♠ Q♠ J♠ T♠'), 8); assert.equal(rankHand(H('A♠ K♠ Q♠ J♠ T♠')).name, 'Royal Flush');
  assert.equal(cat('9♥ 9♠ 9♦ 9♣ 2♠'), 7);
  assert.equal(cat('3♥ 3♠ 3♦ 7♣ 7♠'), 6);
  assert.equal(cat('2♥ 7♥ 9♥ J♥ K♥'), 5);
  assert.equal(cat('A♥ 2♠ 3♦ 4♣ 5♠'), 4); assert.equal(rankHand(H('A♥ 2♠ 3♦ 4♣ 5♠')).name, 'Straight to the Five');
  assert.equal(cat('8♥ 8♠ 8♦ K♣ 2♠'), 3);
  assert.equal(cat('8♥ 8♠ 4♦ 4♣ 2♠'), 2);
  assert.equal(cat('8♥ 8♠ 5♦ 4♣ 2♠'), 1);
  assert.equal(cat('A♥ 9♠ 5♦ 4♣ 2♠'), 0);
  assert.ok(compareHands(rankHand(H('A♥ A♠ 5♦ 4♣ 2♠')), rankHand(H('K♥ K♠ Q♦ J♣ 9♠'))) > 0, 'aces beat kings');
  assert.ok(compareHands(rankHand(H('A♥ A♠ 9♦ 4♣ 2♠')), rankHand(H('A♦ A♣ 8♦ 7♣ 6♠'))) > 0, 'kicker decides');
  assert.equal(compareHands(rankHand(H('2♥ 3♠ 4♦ 5♣ 6♠')), rankHand(H('2♦ 3♣ 4♥ 5♠ 6♥'))), 0);
});

test('Poker: a fold wins the pot; a full hand runs to the showdown with real wallet money', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const C = (x) => ({ r: { A: 14, K: 13, Q: 12, J: 11, T: 10 }[x[0]] || Number(x[0]), s: x[1] });
  // cards come off the top: NPC 1st, Lila 1st, NPC 2nd, … then the draw
  const stack = (dealt, rest = []) => () => [...dealt, ...rest].map(C).reverse();
  const make = (style, deck, rand = 0.99) => {
    const st = freshSaloon(), logs = [];
    const posse = [{ id: 'a', name: 'Lila', wallet: '20.00', skills: { intuition: '3B', charm: '3B', finesse: '3B' } }];
    const ctx = { posse, rand: () => rand, deck, npcSkills: () => ({ charm: '1B', intuition: '1B', finesse: '1B' }), roll: (seat) => ({ hits: seat.kind === 'npc' ? 0 : 3 }), log: (t) => logs.push(t) };
    saloonAction(st, { action: 'open', ante: 1, bet: 2, npcs: [{ name: 'Doc', style, bank: 50 }] }, { ...ctx, warden: true });
    saloonAction(st, { action: 'join', pc: 'a' }, ctx);
    return { st, ctx, posse, logs };
  };
  // 1) Lila bets pair of aces; a tight NPC holding junk folds
  let g = make('tight', stack(['2♠', 'A♠', '7♦', 'A♦', '9♣', '3♣', 'J♥', '5♥', '4♠', '8♠']));
  saloonAction(g.st, { action: 'deal' }, { ...g.ctx, warden: true });
  let v = saloonView(g.st, { pc: 'a' });
  assert.equal(v.table.hand.turn, 'pc:a', 'the NPC checked to Lila');
  assert.equal(v.table.hand.mine.length, 5);
  assert.throws(() => saloonAction(g.st, { action: 'move', pc: 'a', move: 'call' }, g.ctx), /check/);
  saloonAction(g.st, { action: 'move', pc: 'a', move: 'bet' }, g.ctx);
  assert.equal(g.st.table.hand.phase, 'over');
  assert.equal(g.posse[0].wallet, '21.00');
  assert.match(g.logs.at(-1), /Lila takes the pot \(\$4\.00\)/);
  // 2) a loose NPC with kings bets both rounds; Lila calls with aces and wins at the showdown
  g = make('loose', stack(['K♠', 'A♠', 'K♦', 'A♦', '9♣', '3♣', '6♥', '5♥', '2♠', '8♠'], ['4♣', '7♣', 'J♦', '2♦', '4♦', '7♦']));
  saloonAction(g.st, { action: 'deal' }, { ...g.ctx, warden: true });
  assert.equal(g.st.table.hand.turn, 'pc:a');
  saloonAction(g.st, { action: 'move', pc: 'a', move: 'call' }, g.ctx);
  assert.equal(g.st.table.hand.phase, 'draw');
  assert.throws(() => saloonAction(g.st, { action: 'draw', pc: 'a', discard: [0, 1, 2, 3] }, g.ctx), /Ace/, 'four cards only while keeping an Ace');
  saloonAction(g.st, { action: 'draw', pc: 'a', discard: [2, 3, 4] }, g.ctx);
  assert.equal(g.st.table.hand.phase, 'bet2');
  saloonAction(g.st, { action: 'move', pc: 'a', move: 'call' }, g.ctx);
  assert.equal(g.st.table.hand.phase, 'over');
  v = saloonView(g.st, { pc: 'a' });
  assert.deepEqual(v.table.hand.winners, ['pc:a']);
  assert.match(v.table.hand.shown['npc:0'].name, /Kings/);
  assert.equal(g.posse[0].wallet, '27.00'); // 20 − 1 ante − 2 − 4 + 14 pot
  assert.equal(g.st.table.seats[0].bank, 43);
  // the NPC's cards were never in Lila's view before the showdown; the Warden sees them
  assert.ok(saloonView(g.st, { warden: true }).table.hand.all['npc:0']);
});

test('Poker skill moves: a tell shows one NPC card, a bluff rattles weak hands, a caught palm folds you', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const C = (x) => ({ r: { A: 14, K: 13, Q: 12, J: 11, T: 10 }[x[0]] || Number(x[0]), s: x[1] });
  const deck = () => ['2♠', 'A♠', '7♦', 'A♦', '9♣', '3♣', 'J♥', '5♥', '4♠', '8♠', 'K♣', 'K♦', 'Q♠', 'Q♥'].map(C).reverse();
  const make = (lilaHits) => {
    const st = freshSaloon(), caught = [];
    const posse = [{ id: 'a', name: 'Lila', wallet: '20.00', skills: {} }];
    const ctx = { posse, rand: () => 0.99, deck, npcSkills: () => ({}), roll: (seat) => ({ hits: seat.kind === 'npc' ? 1 : lilaHits }), log: () => {}, caught: (s) => caught.push(s.name) };
    saloonAction(st, { action: 'open', npcs: [{ name: 'Doc', style: 'loose' }] }, { ...ctx, warden: true });
    saloonAction(st, { action: 'join', pc: 'a' }, ctx);
    saloonAction(st, { action: 'deal' }, { ...ctx, warden: true });
    return { st, ctx, caught };
  };
  let g = make(3);
  const r = saloonAction(g.st, { action: 'tell', pc: 'a', target: 'npc:0' }, g.ctx);
  assert.ok(r.won && r.card);
  assert.equal(saloonView(g.st, { pc: 'a' }).table.hand.peeks.length, 1);
  assert.throws(() => saloonAction(g.st, { action: 'tell', pc: 'a', target: 'npc:0' }, g.ctx), /One tell/);
  const b = saloonAction(g.st, { action: 'bluff', pc: 'a' }, g.ctx);
  assert.deepEqual(b.rattled, ['Doc'], 'junk hand is rattled');
  g = make(0); // Lila can't palm to save her life
  saloonAction(g.st, { action: 'move', pc: 'a', move: 'check' }, g.ctx);
  if (g.st.table.hand.phase === 'draw' && g.st.table.hand.turn === 'pc:a') {
    const p = saloonAction(g.st, { action: 'palm', pc: 'a', card: 2 }, g.ctx);
    assert.equal(p.won, false); assert.deepEqual(g.caught, ['Lila']);
    assert.equal(g.st.table.hand.phase, 'over', 'caught cheating: folded, the NPC takes the pot');
  }
});

test('Faro: soda and hock have no action, losers pay the bank, winners get even money, coppered bets reverse, splits cost half, calling the turn', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const C = (x) => ({ r: { A: 14, K: 13, Q: 12, J: 11, T: 10 }[x[0]] || Number(x[0]), s: x[1] });
  // the box, top first: soda, then (banker, player) pairs … and at the end three cards: banker, player, hock
  const top = ['2♠', '7♥', 'K♣', '5♦', '5♣', '9♠', '3♥'], bottom = ['Q♥', 'A♠', 'J♦'];
  const all = [];
  for (const su of ['♠', '♥', '♦', '♣']) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']) all.push(r + su);
  const box = [...top, ...all.filter((c) => !top.includes(c) && !bottom.includes(c)), ...bottom];
  assert.equal(box.length, 52);
  const posse = [{ id: 'a', name: 'Lila', wallet: '50.00', skills: { intuition: '3B' } }];
  const st = freshSaloon(), logs = [];
  const ctx = { posse, rand: () => 0.99, deck: () => box.map(C).reverse(), npcSkills: () => ({ finesse: '1B' }), roll: (seat) => ({ hits: seat.kind === 'npc' ? 0 : 2 }), log: (t) => logs.push(t) };
  saloonAction(st, { action: 'open', game: 'faro', ante: 1, bet: 2, npcs: [{ name: 'Faro Pete', bank: 100 }, { name: 'extra' }] }, { ...ctx, warden: true });
  assert.equal(st.table.seats.length, 1, 'one dealer banks faro');
  saloonAction(st, { action: 'join', pc: 'a' }, ctx);
  saloonAction(st, { action: 'deal' }, { ...ctx, warden: true });
  assert.equal(st.table.faro.soda.r, 2);
  saloonAction(st, { action: 'faroBet', pc: 'a', rank: 7, amount: 2 }, ctx);                // on the banker's card → loses
  saloonAction(st, { action: 'faroBet', pc: 'a', rank: 13, amount: 2 }, ctx);               // on the player's card → wins even money
  assert.equal(posse[0].wallet, '46.00');
  saloonAction(st, { action: 'faroTurn' }, { ...ctx, warden: true });                        // 7♥ loses, K♣ wins
  assert.equal(posse[0].wallet, '48.00', 'lost the 7 stake, won $2 on the King (stake still down)');
  assert.ok(!st.table.faro.bets['pc:a'][7]); assert.equal(st.table.faro.bets['pc:a'][13].amt, 2);
  saloonAction(st, { action: 'faroBet', pc: 'a', rank: 13, amount: 0 }, ctx);               // take the King bet back
  saloonAction(st, { action: 'faroBet', pc: 'a', rank: 5, amount: 4 }, ctx);
  saloonAction(st, { action: 'faroTurn' }, { ...ctx, warden: true });                        // 5♦ 5♣: a split
  assert.equal(posse[0].wallet, '48.00', 'split: half back');
  saloonAction(st, { action: 'faroBet', pc: 'a', rank: 9, amount: 2, copper: true }, ctx);  // coppered on the banker's 9 → wins
  saloonAction(st, { action: 'faroTurn' }, { ...ctx, warden: true });                        // 9♠ loses, 3♥ wins
  assert.equal(posse[0].wallet, '48.00', 'coppered 9 won $2, stake still down (48 − 2 + 2)');
  while (st.table.faro.deck.length > 3) saloonAction(st, { action: 'faroTurn' }, { ...ctx, warden: true });
  assert.ok(saloonView(st, { pc: 'a' }).table.faro.canCall);
  const before = Number(posse[0].wallet);
  saloonAction(st, { action: 'faroCall', pc: 'a', order: [12, 14, 11], amount: 1 }, ctx);    // Q, A, J
  saloonAction(st, { action: 'faroTurn' }, { ...ctx, warden: true });
  assert.ok(st.table.faro.over); assert.equal(st.table.faro.hock, 'J♦');
  assert.ok(Number(posse[0].wallet) >= before + 4, 'called the turn: 4 to 1, and the stakes left on the layout come home');
  assert.throws(() => saloonAction(st, { action: 'faroBet', pc: 'a', rank: 4, amount: 1 }, ctx), /next deal/);
});

test('Faro: a crooked box can be spotted with Intuition', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const posse = [{ id: 'a', name: 'Lila', wallet: '50.00', skills: {} }];
  const st = freshSaloon(), caught = [];
  const ctx = { posse, rand: () => 0.1, npcSkills: () => ({}), roll: (seat) => ({ hits: seat.kind === 'npc' ? 0 : 1 }), log: () => {}, caught: (d) => caught.push(d.name) };
  saloonAction(st, { action: 'open', game: 'faro', crooked: true, npcs: [{ name: 'Slick Sam' }] }, { ...ctx, warden: true });
  saloonAction(st, { action: 'join', pc: 'a' }, ctx);
  saloonAction(st, { action: 'deal' }, { ...ctx, warden: true });
  assert.equal(saloonView(st, { pc: 'a' }).table.faro.crooked, undefined, 'players never see the flag');
  const r = saloonAction(st, { action: 'faroWatch', pc: 'a' }, ctx);
  assert.deepEqual(r, { won: true, crooked: true }); assert.deepEqual(caught, ['Slick Sam']);
  assert.equal(saloonView(st, { warden: true }).table.faro.crooked, false);
  assert.throws(() => saloonAction(st, { action: 'faroWatch', pc: 'a' }, ctx), /look/);
});

test('Liar’s Dice: ones wild, raises must go up, a Liar call costs the wrong side a die, last one with dice takes the pot', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const { legalRaise, bidText } = await import('../lib/liars.js');
  assert.ok(legalRaise(null, 1, 2)); assert.ok(legalRaise({ qty: 3, face: 4 }, 3, 5)); assert.ok(legalRaise({ qty: 3, face: 6 }, 4, 2));
  assert.ok(!legalRaise({ qty: 3, face: 4 }, 3, 4)); assert.ok(!legalRaise({ qty: 3, face: 4 }, 2, 6));
  assert.equal(bidText({ qty: 1, face: 6 }), '1 six'); assert.equal(bidText({ qty: 4, face: 3 }), '4 threes');
  const seq = [2, 2, 3, 4, 5, 6, 6, 6, 1, 2]; let i = 0;
  const posse = [{ id: 'a', name: 'Lila', wallet: '20.00', skills: {} }];
  const st = freshSaloon(), logs = [];
  const ctx = { posse, rand: () => 0.99, d6: () => seq[i++ % seq.length], npcSkills: () => ({}), roll: (seat) => ({ hits: seat.kind === 'npc' ? 0 : 2 }), log: (t) => logs.push(t) };
  saloonAction(st, { action: 'open', game: 'liars', ante: 2, npcs: [{ name: 'Doc', style: 'tight', bank: 30 }] }, { ...ctx, warden: true });
  saloonAction(st, { action: 'join', pc: 'a' }, ctx);
  saloonAction(st, { action: 'deal' }, { ...ctx, warden: true });
  let v = saloonView(st, { pc: 'a' }).table.liars;
  assert.equal(v.turn, 'pc:a'); assert.equal(v.pot, 4); assert.equal(posse[0].wallet, '18.00');
  assert.deepEqual(v.mine, [1, 2, 6, 6, 6]); assert.equal(v.all, undefined, 'players never see the other cups');
  assert.throws(() => saloonAction(st, { action: 'liarsCall', pc: 'a' }, ctx), /bid yet/);
  assert.throws(() => saloonAction(st, { action: 'liarsBid', pc: 'a', qty: 11, face: 6 }, ctx), /only 10/);
  // a tight NPC with no sixes calls; there are four (three sixes + a wild one), so Doc loses a die
  saloonAction(st, { action: 'liarsBid', pc: 'a', qty: 3, face: 6 }, ctx);
  v = saloonView(st, { pc: 'a' }).table.liars;
  assert.equal(v.last.count, 4); assert.equal(v.last.loser, 'Doc'); assert.equal(v.counts['npc:0'], 4); assert.equal(v.round, 2);
  // down to the last die: whoever loses it is out, and the other takes the pot
  st.table.liars.counts['npc:0'] = 1; st.table.liars.dice['npc:0'] = [3];
  st.table.liars.turn = 'pc:a'; st.table.liars.bid = null;
  st.table.liars.dice['pc:a'] = [6, 6, 6, 6, 6];
  saloonAction(st, { action: 'liarsBid', pc: 'a', qty: 5, face: 6 }, ctx); // Doc expects ~1.7 sixes: calls, and is wrong
  v = saloonView(st, { pc: 'a' }).table.liars;
  assert.ok(v.over); assert.equal(v.winner, 'pc:a'); assert.equal(posse[0].wallet, '22.00');
  assert.match(logs.at(-1), /Lila is the last one holding dice/);
});

test('Liar’s Dice skill moves: a peek shows one NPC die; a stare-down makes the next NPC raise instead of calling', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const seq = [2, 2, 3, 4, 5, 6, 6, 6, 1, 2]; let i = 0;
  const posse = [{ id: 'a', name: 'Lila', wallet: '20.00', skills: {} }];
  const st = freshSaloon();
  const ctx = { posse, rand: () => 0.99, d6: () => seq[i++ % seq.length], npcSkills: () => ({}), roll: (seat) => ({ hits: seat.kind === 'npc' ? 0 : 2 }), log: () => {} };
  saloonAction(st, { action: 'open', game: 'liars', npcs: [{ name: 'Doc', style: 'tight' }] }, { ...ctx, warden: true });
  saloonAction(st, { action: 'join', pc: 'a' }, ctx);
  saloonAction(st, { action: 'deal' }, { ...ctx, warden: true });
  const p = saloonAction(st, { action: 'liarsPeek', pc: 'a', target: 'npc:0' }, ctx);
  assert.ok(p.won && p.die >= 1 && p.die <= 6);
  assert.equal(saloonView(st, { pc: 'a' }).table.liars.peeks.length, 1);
  assert.throws(() => saloonAction(st, { action: 'liarsPeek', pc: 'a', target: 'npc:0' }, ctx), /One peek/);
  assert.deepEqual(saloonAction(st, { action: 'liarsStare', pc: 'a' }, ctx), { won: true, seat: 'Doc' });
  saloonAction(st, { action: 'liarsBid', pc: 'a', qty: 7, face: 6 }, ctx); // wildly high — but Doc is stared down, so he raises
  const v = saloonView(st, { pc: 'a' }).table.liars;
  assert.equal(v.bid.by, 'npc:0'); assert.equal(v.turn, 'pc:a');
});

test('Saloon Skill moves: Poisoned rolls 2 fewer dice (gold kept last)', async () => {
  const { poolFor } = await import('../lib/routes/saloon.js');
  assert.deepEqual(poolFor({ skills: { charm: '3B1G' }, statuses: {} }, 'charm'), { black: 3, gold: 1 });
  assert.deepEqual(poolFor({ skills: { charm: '3B1G' }, statuses: { Poisoned: 2 } }, 'charm'), { black: 1, gold: 1 });
  assert.deepEqual(poolFor({ skills: { charm: '1B' }, statuses: { Poisoned: 1 } }, 'charm'), { black: 0, gold: 0 });
});

test('Blackjack: totals, a dealer bust, blackjack pays 3 to 2, double down, the shiner and the count', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const { bjTotal } = await import('../lib/blackjack.js');
  const C = (x) => ({ r: { A: 14, K: 13, Q: 12, J: 11, T: 10 }[x[0]] || Number(x[0]), s: x[1] });
  assert.equal(bjTotal(['A♠', 'A♦', '9♣'].map(C)).n, 21, 'two Aces and a nine');
  assert.deepEqual(bjTotal(['A♠', '6♦'].map(C)), { n: 17, soft: true });
  assert.equal(bjTotal(['K♠', 'Q♦', '5♣'].map(C)).n, 25);
  // deal order: Lila, dealer, Lila, dealer; then hits
  const seq = ['T♠', '9♦', '7♣', '7♥', 'K♠', /* r2 */ 'A♠', '9♦', 'K♣', '8♥', /* r3 */ '6♠', 'T♦', '5♣', '7♥', 'T♠', /* r4 */ '9♠', 'T♣', '9♣', '8♦', '4♦'];
  const deck = () => [...seq, ...Array(52 - seq.length).fill('2♥')].map(C).reverse();
  const st = freshSaloon(), logs = [];
  const posse = [{ id: 'a', name: 'Lila', wallet: '20.00', skills: { intuition: '3B', charm: '3B', finesse: '3B' } }];
  let npcHits = 0;
  const ctx = { posse, deck, rand: () => 0.5, npcSkills: () => ({ charm: '1B', intuition: '1B', finesse: '1B' }), roll: (seat) => ({ hits: seat.kind === 'npc' ? npcHits : 2 }), log: (t) => logs.push(t) };
  const W = { ...ctx, warden: true };
  saloonAction(st, { action: 'open', game: 'blackjack', ante: 1, bet: 2, npcs: [{ name: 'Kid', bank: 100 }, { name: 'extra' }] }, W);
  assert.equal(st.table.seats.length, 1, 'one dealer');
  saloonAction(st, { action: 'join', pc: 'a' }, ctx);
  saloonAction(st, { action: 'deal' }, W);
  assert.throws(() => saloonAction(st, { action: 'bjBet', pc: 'a', amount: 50 }, ctx), /limit/);
  saloonAction(st, { action: 'bjBet', pc: 'a', amount: 5 }, ctx); // everyone's bet: the cards come out
  let v = saloonView(st, { pc: 'a' }).table.bj;
  assert.equal(v.phase, 'play'); assert.equal(v.hands['pc:a'].total, 17); assert.equal(v.dealer[1], null, 'hole card hidden');
  assert.equal(posse[0].wallet, '15.00');
  saloonAction(st, { action: 'bjMove', pc: 'a', move: 'stand' }, ctx);
  v = saloonView(st, { pc: 'a' }).table.bj;
  assert.equal(v.phase, 'done'); assert.match(v.results['pc:a'].text, /dealer busts/);
  assert.equal(posse[0].wallet, '25.00'); assert.equal(st.table.seats[0].bank, 95);
  // blackjack pays 3 to 2
  saloonAction(st, { action: 'deal' }, W);
  saloonAction(st, { action: 'bjBet', pc: 'a', amount: 2 }, ctx);
  assert.equal(saloonView(st, { pc: 'a' }).table.bj.phase, 'done');
  assert.equal(posse[0].wallet, '28.00');
  // double down on 11
  saloonAction(st, { action: 'deal' }, W);
  saloonAction(st, { action: 'bjBet', pc: 'a', amount: 2 }, ctx);
  saloonAction(st, { action: 'bjMove', pc: 'a', move: 'double' }, ctx);
  v = saloonView(st, { pc: 'a' }).table.bj;
  assert.equal(v.hands['pc:a'].bet, 4); assert.match(v.results['pc:a'].text, /21 beats 17/);
  assert.equal(posse[0].wallet, '32.00');
  // count (win: next card band) and the shiner (win: the hole card; lose: caught, bet forfeit)
  saloonAction(st, { action: 'deal' }, W);
  saloonAction(st, { action: 'bjBet', pc: 'a', amount: 2 }, ctx);
  const n = saloonAction(st, { action: 'bjCount', pc: 'a' }, ctx);
  assert.match(n.next, /low/, 'the next card is the 4');
  const sh = saloonAction(st, { action: 'bjShiner', pc: 'a' }, ctx);
  assert.equal(sh.card, '8♦');
  assert.equal(saloonView(st, { pc: 'a' }).table.bj.dealer[1], '8♦');
  assert.throws(() => saloonAction(st, { action: 'bjShiner', pc: 'a' }, ctx), /Once/);
  saloonAction(st, { action: 'bjMove', pc: 'a', move: 'stand' }, ctx); // 18 vs 18
  assert.match(saloonView(st, { pc: 'a' }).table.bj.results['pc:a'].text, /push/);
  assert.equal(posse[0].wallet, '32.00');
  saloonAction(st, { action: 'deal' }, W);
  saloonAction(st, { action: 'bjBet', pc: 'a', amount: 2 }, ctx);
  npcHits = 5;
  const caught = saloonAction(st, { action: 'bjShiner', pc: 'a' }, ctx);
  assert.equal(caught.won, false);
  assert.match(saloonView(st, { pc: 'a' }).table.bj.results['pc:a'].text, /forfeit/);
  assert.equal(posse[0].wallet, '30.00');
  assert.ok(logs.some((l) => /cheating at blackjack/.test(l)));
});

test('Bounties: taking a poster makes a Journal quest; captured and paid tick it off; a torn-down poster fails it', async () => {
  const { freshWanted, wantedAction, allTowns } = await import('../lib/wanted.js');
  const { freshJournal, journalView } = await import('../lib/journal.js');
  const st = freshWanted(), journal = freshJournal(), towns = allTowns(st, []), dodge = towns.find((t) => t.name.includes('Dodge'));
  const posse = [{ id: 'a', name: 'Lila', wallet: '' }, { id: 'b', name: 'Doc', wallet: '' }], logs = [];
  const W = { warden: true, towns, posse, journal, log: (t) => logs.push(t) }, P = { ...W, warden: false };
  const p = wantedAction(st, { action: 'add', town: dodge.id, name: 'Black Bart', reward: 100, crime: 'Train robbery' }, W);
  assert.throws(() => wantedAction(st, { action: 'take', id: p.id, pc: 'zz' }, P), /playing/);
  wantedAction(st, { action: 'take', id: p.id, pc: 'a' }, P);
  wantedAction(st, { action: 'take', id: p.id, pc: 'b' }, P);
  assert.deepEqual(p.takenBy, ['a', 'b']);
  const q = journalView(journal, { warden: false }).quests;
  assert.equal(q.length, 1, 'one quest, the second taker joins it');
  assert.equal(q[0].title, 'Bounty: Black Bart'); assert.equal(q[0].steps.length, 3); assert.match(q[0].reward, /\$100/);
  assert.ok(logs.some((l) => /Lila takes the bounty/.test(l)));
  assert.throws(() => wantedAction(st, { action: 'edit', id: p.id, status: 'dead' }, P), /PIN/);
  wantedAction(st, { action: 'edit', id: p.id, status: 'captured' }, W);
  assert.deepEqual(journal.quests[0].steps.map((s) => s.done), [true, true, false]);
  wantedAction(st, { action: 'payout', id: p.id, to: ['a', 'b'] }, W);
  assert.equal(journal.quests[0].status, 'done');
  assert.throws(() => wantedAction(st, { action: 'take', id: p.id, pc: 'a' }, P), /already/);
  const p2 = wantedAction(st, { action: 'add', town: dodge.id, name: 'Slim' }, W);
  wantedAction(st, { action: 'take', id: p2.id, pc: 'a' }, P);
  wantedAction(st, { action: 'remove', id: p2.id }, W);
  assert.equal(journal.quests.find((x) => x.bounty === p2.id).status, 'failed');
});

test('Trading: money and things change hands whole (a gun keeps its upgrades, a horse moves), or not at all', async () => {
  const { tradeAction } = await import('../lib/trade.js');
  const { sellables } = await import('../lib/shop.js');
  const combat = freshCombat();
  const a = publicAction(combat, { action: 'addPc', name: 'Lila', trade: 'Gunslinger' }, { warden: false });
  const b = publicAction(combat, { action: 'addPc', name: 'Doc', trade: 'Trapper' }, { warden: false });
  a.wallet = '20.00'; b.wallet = '5.00';
  const gunKey = sellables(a, { custom: [] }).find((x) => x.key.startsWith('weapon:')).key;
  const gi = Number(gunKey.split(':')[1]);
  a.weapons[gi].upgrades[0] = 'Scope';
  const gunName = [a.weapons[gi].manufacturer, a.weapons[gi].model].filter(Boolean).join(' - ');
  b.horse.breed = 'Morgan'; b.horse.name = 'Biscuit'; b.horse.bond = 'Loyal';
  const T = (x) => tradeAction(combat, { action: 'trade', ...x });
  assert.throws(() => T({ op: 'offer', pc: a.id, to: a.id, give: { money: 1 } }), /yourself/);
  assert.throws(() => T({ op: 'offer', pc: a.id, to: b.id }), /something/);
  const o = T({ op: 'offer', pc: a.id, to: b.id, give: { money: 5, things: [{ key: gunKey }] }, get: { things: [{ key: 'horse' }] }, note: 'fair deal' });
  assert.throws(() => T({ op: 'answer', id: o.id, pc: a.id, accept: true }), /Only/);
  const r = T({ op: 'answer', id: o.id, pc: b.id, accept: true });
  assert.equal(r.status, 'accepted');
  assert.equal(a.wallet, '15.00'); assert.equal(b.wallet, '10.00');
  assert.equal(a.weapons[gi].model, '', 'gun left Lila’s sheet');
  const theirGun = b.weapons.find((w) => [w.manufacturer, w.model].filter(Boolean).join(' - ') === gunName && w.upgrades[0] === 'Scope');
  assert.ok(theirGun, 'Doc has the gun with its upgrade');
  assert.equal(a.horse.name, 'Biscuit'); assert.equal(a.horse.bond, 'Loyal'); assert.equal(b.horse.breed, '');
  assert.ok(combat.log.some((l) => /Lila traded \$5\.00/.test(l.text)));
  // a failed trade changes nothing: Doc asks for money Lila no longer has
  const o2 = T({ op: 'offer', pc: b.id, to: a.id, give: { money: 1 }, get: { money: 15 } });
  a.wallet = '2.00';
  const r2 = T({ op: 'answer', id: o2.id, pc: a.id, accept: true });
  assert.equal(r2.status, 'failed'); assert.match(r2.why, /only has/);
  assert.equal(a.wallet, '2.00'); assert.equal(b.wallet, '10.00');
  // a horse can't go to someone who already rides one
  const o3 = T({ op: 'offer', pc: a.id, to: b.id, give: { things: [{ key: 'horse' }] } });
  b.horse.breed = 'Mustang';
  assert.equal(T({ op: 'answer', id: o3.id, pc: b.id, accept: true }).status, 'failed');
  assert.equal(a.horse.name, 'Biscuit');
  const o4 = T({ op: 'offer', pc: a.id, to: b.id, give: { money: 1 } });
  assert.equal(T({ op: 'cancel', id: o4.id, pc: a.id }).status, 'cancelled');
});

test('Posse stash: money and things go in and come out whole (a gun keeps its upgrades), partial stacks, Warden loot, all or nothing', async () => {
  const { stashAction } = await import('../lib/trade.js');
  const { sellables } = await import('../lib/shop.js');
  const combat = freshCombat();
  const a = publicAction(combat, { action: 'addPc', name: 'Lila', trade: 'Gunslinger' }, { warden: false });
  const b = publicAction(combat, { action: 'addPc', name: 'Doc', trade: 'Trapper' }, { warden: false });
  a.wallet = '20.00'; b.wallet = '0';
  const S = (x, o) => stashAction(combat, { action: 'stash', ...x }, o);
  const gunKey = sellables(a, { custom: [] }).find((x) => x.key.startsWith('weapon:')).key, gi = Number(gunKey.split(':')[1]);
  a.weapons[gi].upgrades[0] = 'Scope';
  const gunModel = a.weapons[gi].model;
  a.horse.breed = 'Morgan'; a.horse.name = 'Biscuit';
  assert.throws(() => S({ op: 'put', pc: a.id, money: 50 }), /only have/);
  S({ op: 'put', pc: a.id, money: 8, things: [{ key: gunKey }, { key: 'horse' }] });
  assert.equal(a.wallet, '12.00'); assert.equal(a.weapons[gi].model, ''); assert.equal(a.horse.breed, '');
  assert.equal(combat.stash.money, 8); assert.equal(combat.stash.items.length, 2);
  const gun = combat.stash.items.find((x) => x.where === 'Weapons');
  S({ op: 'take', pc: b.id, money: 3, id: gun.id });
  assert.equal(b.wallet, '3.00'); assert.equal(combat.stash.money, 5);
  assert.ok(b.weapons.some((w) => w.model === gunModel && w.upgrades[0] === 'Scope'), 'the gun keeps its Scope');
  // Doc already rides a horse: taking Biscuit fails and nothing changes
  b.horse.breed = 'Mustang';
  const horse = combat.stash.items.find((x) => x.where === 'Horse');
  assert.throws(() => S({ op: 'take', pc: b.id, id: horse.id, money: 5 }), /already has a horse/);
  assert.equal(b.wallet, '3.00'); assert.equal(combat.stash.money, 5); assert.equal(b.horse.breed, 'Mustang');
  // Warden loot: a stack, split between two takers
  assert.throws(() => S({ op: 'loot', money: 1 }), /PIN/);
  S({ op: 'loot', money: 10, itemId: 'bandages', qty: 3 }, { warden: true, findItem: (x) => ({ id: x, name: 'Bandages', cat: 'Gear', sub: 'First Aid' }) });
  const band = combat.stash.items.find((x) => x.name === 'Bandages');
  S({ op: 'take', pc: a.id, id: band.id, qty: 2 });
  assert.equal(band.qty, 1); assert.equal(a.items.find((i) => i.name === 'Bandages').qty, 2);
  S({ op: 'take', pc: b.id, id: band.id });
  assert.ok(!combat.stash.items.some((x) => x.name === 'Bandages'));
  assert.equal(combat.stash.money, 15);
  assert.ok(combat.log.some((l) => /Lila put \$8\.00/.test(l.text)) && combat.log.some((l) => /Doc took \$3\.00/.test(l.text)));
});

test('Drinking contest: Nerve vs a rising number, Grit adds dice, a miss is Drunk + 1 Health, 3 Drunk passes out Dazed, the first out pays the tab', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const { shotPool } = await import('../lib/drinking.js');
  assert.deepEqual(shotPool({ black: 2, gold: 2 }, { drunk: 1, grit: 2 }), { black: 3, gold: 2 }, 'Drunk takes a Black die first; Grit adds Black');
  assert.deepEqual(shotPool({ black: 0, gold: 3 }, { drunk: 1, needled: 2 }), { black: 0, gold: 0 });
  const st = freshSaloon(), logs = [], dazed = [];
  const posse = [{ id: 'a', name: 'Lila', wallet: '10.00', grit: 6, health: 10, statuses: {}, skills: { nerve: '3B', finesse: '3B', charm: '3B' } }];
  // Lila's rolls come from a script: [hits…]; NPC rolls are scripted too
  let mine = [], theirs = [];
  const ctx = { posse, rand: () => 0.5, log: (t) => logs.push(t), npcSkills: () => ({ nerve: '2B', intuition: '2B', charm: '2B', finesse: '2B' }), npcHealth: () => 6,
    poolOf: (seat) => (seat.kind === 'pc' ? { black: 3, gold: 0 } : { black: 2, gold: 0 }), status: (pc, n, s) => { pc.statuses[n] = s; dazed.push(pc.name); },
    roll: (seat, skill, pool) => ({ hits: seat.kind === 'npc' ? theirs.shift() ?? 0 : mine.shift() ?? 0, pool }) };
  const W = { ...ctx, warden: true };
  saloonAction(st, { action: 'open', game: 'drinking', ante: 2, npcs: [{ name: 'Big Sal', profile: 'npc:Human - Weak Combatant', bank: 20 }] }, W);
  saloonAction(st, { action: 'join', pc: 'a' }, ctx);
  saloonAction(st, { action: 'deal' }, W);
  assert.equal(posse[0].wallet, '8.00'); assert.equal(st.table.drink.pot, 4);
  // round 1 (need 1): Sal makes it; Lila spends 2 Grit and makes it
  theirs = [1]; saloonAction(st, { action: 'drinkPour', pc: 'a' }, ctx);
  mine = [2]; let r = saloonAction(st, { action: 'drink', pc: 'a', grit: 2 }, ctx);
  assert.equal(r.ok, true); assert.equal(posse[0].grit, 4, 'Grit comes off the sheet');
  assert.throws(() => saloonAction(st, { action: 'drink', pc: 'a' }, ctx), /pour/);
  // round 2 (need 2): Sal misses; Lila misses → Drunk 1, Health 9
  theirs = [1]; saloonAction(st, { action: 'drinkPour', pc: 'a' }, ctx);
  mine = [1]; r = saloonAction(st, { action: 'drink', pc: 'a' }, ctx);
  assert.equal(r.drunk, 1); assert.equal(posse[0].health, 9);
  assert.throws(() => saloonAction(st, { action: 'drink', pc: 'a', grit: 9 }, ctx), /pour|Grit/);
  // round 3: needle Sal (−2 dice), then Sal misses again; Lila keeps it down
  theirs = [0]; mine = [3];
  assert.equal(saloonAction(st, { action: 'drinkNeedle', pc: 'a', target: 'npc:0' }, ctx).won, true);
  theirs = [0]; saloonAction(st, { action: 'drinkPour', pc: 'a' }, ctx);
  mine = [3]; saloonAction(st, { action: 'drink', pc: 'a' }, ctx);
  // round 4: Sal misses a third time and passes out; Lila wins the pot and Sal pays the tab
  theirs = [0]; saloonAction(st, { action: 'drinkPour', pc: 'a' }, ctx);
  mine = [4]; r = saloonAction(st, { action: 'drink', pc: 'a' }, ctx);
  const v = saloonView(st, { pc: 'a' }).table.drink;
  assert.equal(v.over, true); assert.deepEqual(r.end.winners, ['Lila']);
  assert.equal(posse[0].wallet, '12.00', 'Lila takes the $4 pot');
  assert.equal(st.table.seats[0].bank, cents(20 - 2 - 0.8), 'Sal pays in and pays 8 shots of tab');
  assert.ok(logs.some((l) => /drinks everyone under the table/.test(l)));
  // a new contest: the spittoon — caught means a double; Lila passes out at 3 Drunk and wakes Dazed
  saloonAction(st, { action: 'deal' }, W);
  theirs = [5]; saloonAction(st, { action: 'drinkPour', pc: 'a' }, ctx);
  mine = [0]; theirs = [3];
  assert.equal(saloonAction(st, { action: 'drinkSpit', pc: 'a' }, ctx).won, false);
  mine = [1, 0]; r = saloonAction(st, { action: 'drink', pc: 'a' }, ctx);
  assert.equal(r.rolls.length, 2, 'a double'); assert.equal(r.ok, false);
  for (let n = 0; n < 2; n++) { theirs = [9]; saloonAction(st, { action: 'drinkPour', pc: 'a' }, ctx); mine = [0]; r = saloonAction(st, { action: 'drink', pc: 'a' }, ctx); }
  assert.equal(r.out, true); assert.deepEqual(dazed, ['Lila']); assert.equal(posse[0].statuses.Dazed, 1);
  assert.ok(posse[0].health >= 1);
  assert.equal(saloonView(st, { pc: 'a' }).table.drink.firstOut, 'pc:a');
});
function cents(n) { return Math.round(n * 100) / 100; }

test('Start combat with a surprise: the side that springs it takes the first turn (p. 40)', () => {
  const s = freshCombat();
  const a = publicAction(s, { action: 'addPc', name: 'Lila', trade: 'Gunslinger' }, { warden: false });
  publicAction(s, { action: 'addEnemy', profile: 'Prairie Wolf', count: 1 }, { warden: true });
  publicAction(s, { action: 'start', posse: [a.id], enemies: s.enemies.map((e) => e.id), surprise: 'enemies' }, { warden: true });
  assert.equal(s.combat.slots[0], 'enemies');
  publicAction(s, { action: 'end' }, { warden: true });
  publicAction(s, { action: 'start', posse: [a.id], enemies: s.enemies.map((e) => e.id), surprise: 'posse' }, { warden: true });
  assert.equal(s.combat.slots[0], a.id);
});

test('Saves are all-or-nothing: a request that read stale data is refused (and re-run) instead of overwriting', async () => {
  const { transaction, load, save } = await import('../lib/store.js');
  const fs = await import('node:fs');
  const KEY = 'test-cas-' + process.pid;
  await save({ n: 0 }, KEY);
  let release;
  const gate = new Promise((r) => { release = r; });
  // A reads, then waits; B reads, writes and commits first; A's commit must be refused
  const a = transaction(async () => { const d = await load(KEY); await gate; d.n += 1; await save(d, KEY); });
  await transaction(async () => { const d = await load(KEY); d.n += 10; await save(d, KEY); });
  release();
  await assert.rejects(a, (e) => e.conflict === true);
  assert.equal((await load(KEY)).n, 10, 'B’s change survived');
  // the retry pattern the API router uses: re-run on fresh data
  for (let i = 0; i < 3; i++) { try { await transaction(async () => { const d = await load(KEY); d.n += 1; await save(d, KEY); }); break; } catch (e) { if (!e.conflict) throw e; } }
  assert.equal((await load(KEY)).n, 11);
  // two saves in one request land together; a write-only key needs no read
  await transaction(async () => { const d = await load(KEY); d.n += 1; await save(d, KEY); await save({ x: 1 }, KEY + '-b'); });
  assert.equal((await load(KEY)).n, 12); assert.equal((await load(KEY + '-b')).x, 1);
  for (const k of [KEY, KEY + '-b']) fs.rmSync(new URL(`../.data/${k}.json`, import.meta.url), { force: true });
});

test('Undo puts the fight back but leaves sheet edits made meanwhile (story, inventory) alone', () => {
  const s = freshCombat();
  const a = publicAction(s, { action: 'addPc', name: 'Lila', trade: 'Gunslinger' }, { warden: false });
  publicAction(s, { action: 'addEnemy', profile: 'Prairie Wolf', count: 1 }, { warden: true });
  publicAction(s, { action: 'start', posse: [a.id], enemies: s.enemies.map((e) => e.id) }, { warden: true });
  const hp = a.health;
  pushUndo(s, 'hit');
  const pc = s.posse[0];
  pc.health = hp - 4; pc.inventory = 'a silver pocket watch'; pc.history = 'Born in Dodge.';
  undoCombat(s, { warden: true, mode: 'last' });
  assert.equal(s.posse[0].health, hp, 'the damage is undone');
  assert.equal(s.posse[0].inventory, 'a silver pocket watch', 'the inventory edit survives');
  assert.equal(s.posse[0].history, 'Born in Dodge.');
  assert.ok(!JSON.stringify(s.undoStack).includes('pocket watch'));
});

test('Map pings: anyone can ping a hex; it shows for a few seconds with their name', async () => {
  const { freshBattle, battleAction, battleView } = await import('../lib/battle.js');
  const s = freshBattle();
  const combat = { posse: [{ id: 'a', name: 'Lila' }] };
  const p = battleAction(s, { action: 'ping', col: 3, row: 4, pc: 'a' }, { warden: false, combat });
  assert.equal(p.name, 'Lila'); assert.equal(p.col, 3);
  assert.equal(battleView(s, { warden: false, combat }).pings.length, 1);
  assert.equal(battleAction(s, { action: 'ping', col: 1, row: 1 }, { warden: true, combat }).name, 'The Warden');
  s.pings[0].at -= 60000;
  assert.equal(battleView(s, { warden: false, combat }).pings.length, 1, 'the old one has expired');
});

test('Battle Map tokens: new ones land mid-map; Add enemies never brings back removed characters', async () => {
  const { freshBattle, battleAction, autoSync, hexDist } = await import('../lib/battle.js');
  const s = freshBattle();
  const combat = { posse: [{ id: 'a', name: 'Lila' }, { id: 'b', name: 'Bo' }], enemies: [], combat: { active: false } };
  battleAction(s, { action: 'syncCombat' }, { warden: true, combat });
  assert.equal(s.tokens.length, 2);
  const R = s.grid.ppi / Math.sqrt(3), cols = Math.ceil((s.map.w - s.grid.dx) / (R * Math.sqrt(3))), rows = Math.ceil((s.map.h - s.grid.dy - R / 2) / (1.5 * R));
  const mid = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
  s.tokens.forEach((t) => assert.ok(hexDist(t, mid) <= 2, `${t.name} is near the middle`));
  // the Warden takes Bo off the map, then adds a monster
  battleAction(s, { action: 'removeToken', id: s.tokens.find((t) => t.ref === 'b').id }, { warden: true, combat });
  combat.enemies.push({ id: 'e1', name: 'Wolf' });
  battleAction(s, { action: 'syncCombat', only: 'enemies' }, { warden: true, combat });
  assert.deepEqual(s.tokens.map((t) => t.ref).sort(), ['a', 'e1']);
  assert.ok(hexDist(s.tokens.find((t) => t.ref === 'e1'), mid) <= 2, 'the monster is near the middle too');
  // mid-fight, the map doesn't put a removed token back on its own
  combat.combat = { active: true, party: ['a', 'b'] };
  autoSync(s, combat);
  assert.ok(!s.tokens.some((t) => t.ref === 'b'));
  // "Add posse & enemies" is an explicit ask for everyone
  battleAction(s, { action: 'syncCombat' }, { warden: true, combat });
  assert.ok(s.tokens.some((t) => t.ref === 'b'));
});

test('a melee weapon at Short Range is a throw, and the Table Log says so', async () => {
  const { weaponFields } = await import('../lib/sheets.js');
  const { CATALOG } = await import('../lib/catalog.js');
  const state = freshCombat();
  const pc = publicAction(state, { action: 'addPc', trade: 'Hunter', name: 'Lila' }, { warden: true });
  publicAction(state, { action: 'addEnemy', profile: 'Chupacabra' }, { warden: true });
  pc.weapons[0] = { ...pc.weapons[0], ...weaponFields(CATALOG.find((x) => x.id === 'melee-handcraft-club')) };
  pc.grit = 6;
  const target = state.enemies[0].id;
  publicAction(state, { action: 'pc', id: pc.id, op: 'attack', weapon: 0, range: 'short', target }, { warden: true });
  const shot = state.log.find((l) => l.type === 'roll' && l.label.includes('→'));
  assert.match(shot.label, /Short Range \(thrown\)/);
  pc.grit = 6;
  publicAction(state, { action: 'pc', id: pc.id, op: 'attack', weapon: 0, range: 'arms', target }, { warden: true });
  assert.doesNotMatch(state.log.find((l) => l.type === 'roll' && l.label.includes('→')).label, /thrown/, 'a swing up close is not a throw');
});

test('only the Warden can bring a fallen character back', () => {
  const state = freshCombat();
  const pc = publicAction(state, { action: 'addPc', trade: 'Hunter', name: 'Ada' }, { warden: true });
  pc.dead = true; pc.health = 0;
  assert.throws(() => publicAction(state, { action: 'pc', id: pc.id, op: 'revive' }, { warden: false }), /Only the Warden/);
  assert.equal(pc.dead, true);
  publicAction(state, { action: 'pc', id: pc.id, op: 'revive' }, { warden: true });
  assert.equal(pc.dead, false); assert.equal(pc.health, 1);
  assert.match(state.log[0].text, /back among the living/);
  assert.throws(() => publicAction(state, { action: 'pc', id: pc.id, op: 'revive' }, { warden: true }), /hasn’t fallen/);
});

test('Needs you: a finished roll says how it went and offers Close', async () => {
  const { wardenNeeds } = await import('../lib/combat.js');
  const state = freshCombat();
  const pc = publicAction(state, { action: 'addPc', trade: 'Hunter', name: 'Tess' }, { warden: true });
  const ck = publicAction(state, { action: 'checkStart', who: [pc.id], skill: 'Nerve', diff: 'Very Easy' }, { warden: true });
  let item = wardenNeeds(state, { shop: null, edison: [] }).items.find((x) => /Nerve/.test(x.text));
  assert.ok(!item.closeCheck && /waiting on Tess/.test(item.text));
  publicAction(state, { action: 'pc', id: pc.id, op: 'checkRoll', check: ck.id }, { warden: false });
  item = wardenNeeds(state, { shop: null, edison: [] }).items.find((x) => /Nerve/.test(x.text));
  assert.equal(item.closeCheck, ck.id);
  assert.match(item.text, /Tess (made it|missed) \(\d+\/1\)\. Close it\?/);
});

test('saloon powers work on players too: peek under a player’s cup, stare a player into raising, sharpest eye counts the posse', async () => {
  const { freshSaloon, saloonAction, saloonView } = await import('../lib/saloon.js');
  const { sharpest } = await import('../lib/saloon-common.js');
  const seq = [2, 2, 3, 4, 5, 6, 6, 6, 1, 2]; let i = 0;
  const posse = [{ id: 'a', name: 'Lila', wallet: '20.00', skills: {} }, { id: 'b', name: 'Bo', wallet: '20.00', skills: {} }];
  const st = freshSaloon();
  const ctx = { posse, rand: () => 0.99, d6: () => seq[i++ % seq.length], npcSkills: () => ({}), roll: (seat) => ({ hits: seat.name === 'Lila' ? 3 : 0 }), log: () => {} };
  saloonAction(st, { action: 'open', game: 'liars', npcs: [{ name: 'Doc', style: 'tight' }] }, { ...ctx, warden: true });
  saloonAction(st, { action: 'join', pc: 'a' }, ctx);
  saloonAction(st, { action: 'join', pc: 'b' }, ctx);
  saloonAction(st, { action: 'deal' }, { ...ctx, warden: true });
  const L = st.table.liars;
  const p = saloonAction(st, { action: 'liarsPeek', pc: 'a', target: 'pc:b' }, ctx);
  assert.ok(p.won && p.seat === 'Bo');
  assert.throws(() => saloonAction(st, { action: 'liarsPeek', pc: 'b', target: 'pc:b' }, ctx), /someone still holding dice/);
  // Lila stares Bo down: on his turn he can't call, only raise
  L.order = ['pc:a', 'pc:b', 'npc:0']; L.turn = 'pc:a'; L.bid = null;
  assert.deepEqual(saloonAction(st, { action: 'liarsStare', pc: 'a' }, ctx), { won: true, seat: 'Bo' });
  saloonAction(st, { action: 'liarsBid', pc: 'a', qty: 2, face: 3 }, ctx);
  assert.equal(L.turn, 'pc:b');
  assert.equal(saloonView(st, { pc: 'b' }).table.liars.staredMe, true);
  assert.throws(() => saloonAction(st, { action: 'liarsCall', pc: 'b' }, ctx), /stared you down/);
  saloonAction(st, { action: 'liarsBid', pc: 'b', qty: 3, face: 3 }, ctx);
  assert.equal(L.stared, null, 'raising spends the stare');
  // the sharpest eye can be a player
  const eye = sharpest([{ kind: 'npc', name: 'Doc' }, { kind: 'pc', name: 'Bo' }], { poolOf: (s) => (s.name === 'Bo' ? { black: 4, gold: 0 } : { black: 2, gold: 0 }) });
  assert.equal(eye.name, 'Bo');
});
