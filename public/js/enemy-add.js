// The Warden's "Add enemies" dialog (Battle Map fight bar): a Guidebook monster, a person (p. 191 combatant, a faction
// NPC, or someone from the ledger — they borrow a Weak/Moderate/Strong stat block), or a custom enemy. New enemies are put
// straight on the map (optionally hidden for an ambush).
import { esc, api, toast, poolHTML, readPool } from './common.js';
import { NPC } from './npc-data.js';
import { gl } from './glyphs.js';

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Titan'];
const randName = () => `${NPC[Math.random() < 0.5 ? 'first1' : 'first2'][Math.floor(Math.random() * 52)]} ${NPC.last[Math.floor(Math.random() * 52)]}`;

// combat: the Warden combat view (catalog, npcCatalog, enemies, settings); done(): called after anything is added
// resolves with how many enemies were added once the dialog closes (opts.intro: a line above the tabs)
export async function openAddEnemies(combat, done = () => {}, opts = {}) {
  let finish; const closed = new Promise((r) => { finish = r; });
  let ledger = [];
  try { ledger = (await api('GET', null, '?view=warden', '/api/npcs')).npcs || []; } catch {}
  const humans = combat.npcCatalog.filter((n) => !n.faction);
  const st = { tab: 'monster', monster: combat.catalog[0]?.name || '', count: 1, name: '', npc: humans[0]?.key || '', as: humans.find((n) => /Moderate/.test(n.name))?.key || humans[0]?.key || '', ce: { name: '', hp: '' }, hidden: false, added: [] };
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const groups = {};
  combat.catalog.forEach((m) => (groups[m.size] ||= []).push(m));
  const npcSel = () => `<select data-f="npc" aria-label="Who"><optgroup label="Human combatants (p. 191)">${humans.map((n) => `<option value="${esc(n.key)}"${st.npc === n.key ? ' selected' : ''}>${esc(n.name.replace('Human - ', ''))}</option>`).join('')}</optgroup>
      ${[...new Set(combat.npcCatalog.filter((n) => n.faction).map((n) => n.faction))].map((f) => `<optgroup label="${esc(f)}">${combat.npcCatalog.filter((n) => n.faction === f).map((n) => `<option value="${esc(n.key)}"${st.npc === n.key ? ' selected' : ''}>${esc(n.name)}</option>`).join('')}</optgroup>`).join('')}
      ${ledger.length ? `<optgroup label="Your NPC ledger">${ledger.map((n) => `<option value="ledger:${esc(n.name)}"${st.npc === `ledger:${n.name}` ? ' selected' : ''}>${esc(n.name)}</option>`).join('')}</optgroup>` : ''}</select>`;
  const draw = () => {
    const tab = (k, l, sub) => `<button type="button" class="chip-btn${st.tab === k ? ' on' : ''}" data-tab="${k}">${l}<small>${sub}</small></button>`;
    let body = '';
    if (st.tab === 'monster') body = `<div class="field-step"><span>WHICH MONSTER</span><select data-f="monster" aria-label="Monster">${SIZES.filter((s) => groups[s]).map((s) => `<optgroup label="${s}">${groups[s].map((m) => `<option value="${esc(m.name)}"${st.monster === m.name ? ' selected' : ''}>${esc(m.name)} · ${m.health} Health</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field-step"><span>HOW MANY</span>${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" class="chip-btn${st.count === n ? ' on' : ''}" data-count="${n}">${n}</button>`).join('')}</div>
      <div class="field-step"><span>NAME (optional)</span><input data-f="name" maxlength="40" value="${esc(st.name)}" placeholder="e.g. the Big One"></div>`;
    else if (st.tab === 'person') body = `<div class="field-step"><span>WHO</span>${npcSel()}</div>
      ${st.npc.startsWith('ledger:') ? `<div class="field-step"><span>FIGHTS LIKE (p. 191)</span>${humans.map((n) => `<button type="button" class="chip-btn${st.as === n.key ? ' on' : ''}" data-as="${esc(n.key)}">${esc(n.name.replace('Human - ', '').replace(' Combatant', ''))}</button>`).join('')}</div>` : ''}
      <div class="field-step"><span>NAME</span><input data-f="name" maxlength="40" value="${esc(st.name)}" placeholder="Name"><button type="button" class="btn small secondary" data-rand title="Random name (p. 204)">${gl('die')} Random</button></div>`;
    else body = `<div class="field-step"><span>NAME</span><input data-f="cename" maxlength="40" value="${esc(st.ce.name)}" placeholder="Outlaw, bandit…"></div>
      <div class="field-step"><span>HEALTH</span><input data-f="cehp" type="number" min="1" value="${esc(st.ce.hp)}" placeholder="e.g. 8"></div>
      <div class="field-step"><span>DEFENSE</span>${poolHTML('data-ce="def"', 'Defense')}</div>
      <div class="field-step"><span>FINESSE (turn order)</span>${poolHTML('data-ce="fin"', 'Finesse')}</div>`;
    back.innerHTML = `<div class="modal ask trade-modal" role="dialog" aria-modal="true" aria-label="Add enemies">
      <div class="ho-kicker">${gl('claws')} THE OPPOSITION</div><h2>Add enemies</h2>${opts.intro ? `<p class="muted">${esc(opts.intro)}</p>` : ''}
      <div class="field-step">${tab('monster', 'Monster', 'from the Guidebook')}${tab('person', 'Person', 'outlaws, faction folk, the ledger')}${tab('custom', 'Custom', 'make one up')}</div>
      ${body}
      <label class="check"><input type="checkbox" data-hidden${st.hidden ? ' checked' : ''}> Keep them hidden from the posse (an ambush) — reveal them from the token list</label>
      ${st.added.length ? `<p class="muted small-text">Added: ${st.added.map(esc).join(', ')}</p>` : ''}
      <div class="ask-btns"><button type="button" class="btn secondary" data-close>Done</button><button type="button" class="btn" data-add>${gl('claws')} Add to the fight</button></div></div>`;
  };
  draw();
  document.body.append(back);
  if (st.tab === 'person' && !st.name) st.name = randName();
  back.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (f === 'name') st.name = e.target.value;
    if (f === 'cename') st.ce.name = e.target.value;
    if (f === 'cehp') st.ce.hp = e.target.value;
  });
  back.addEventListener('change', (e) => {
    const f = e.target.dataset.f;
    if (f === 'monster') st.monster = e.target.value;
    if (f === 'npc') { st.npc = e.target.value; const n = combat.npcCatalog.find((x) => x.key === st.npc); st.name = st.npc.startsWith('ledger:') ? st.npc.slice(7) : n?.faction ? n.name : randName(); draw(); }
    if (e.target.dataset.hidden !== undefined) st.hidden = e.target.checked;
  });
  back.addEventListener('click', async (e) => {
    if (e.target === back) { back.remove(); finish(st.added.length); return; }
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.close !== undefined) { back.remove(); finish(st.added.length); return; }
    if (d.tab) { st.tab = d.tab; if (d.tab === 'person' && !st.name) st.name = randName(); if (d.tab === 'monster') st.name = ''; draw(); return; }
    if (d.count) { st.count = Number(d.count); draw(); return; }
    if (d.as) { st.as = d.as; draw(); return; }
    if (d.rand !== undefined) { st.name = randName(); draw(); return; }
    if (d.add === undefined) return;
    let body;
    if (st.tab === 'monster') body = { action: 'addEnemy', profile: st.monster, count: st.count, name: st.name };
    else if (st.tab === 'person') body = st.npc.startsWith('ledger:') ? { action: 'addEnemy', profile: st.as, name: st.name || st.npc.slice(7) } : { action: 'addEnemy', profile: st.npc, name: st.name };
    else {
      if (!st.ce.name.trim()) { toast('Name the enemy.', true); return; }
      body = { action: 'addEnemy', name: st.ce.name, health: st.ce.hp, defense: readPool(back.querySelector('[data-ce="def"]')) || '—', finesse: readPool(back.querySelector('[data-ce="fin"]')) || '1B', size: 'Human' };
    }
    try {
      b.disabled = true;
      await api('POST', body, '', '/api/combat');
      await api('POST', { action: 'syncCombat', only: 'enemies', hidden: st.hidden }, '', '/api/battle'); // onto the map
      st.added.push(st.tab === 'monster' ? `${st.count > 1 ? `${st.count}× ` : ''}${st.name || st.monster}` : st.tab === 'person' ? st.name || 'someone' : st.ce.name);
      if (st.tab === 'person') st.name = randName();
      if (st.tab === 'custom') st.ce = { name: '', hp: '' };
      if (st.tab === 'monster') st.name = '';
      toast('On the map.');
      done();
      draw();
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });
  return closed;
}
