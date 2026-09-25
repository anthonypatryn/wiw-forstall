// Run the Game → "High Noon Duel": the Warden picks two duelists and calls it (p. 58). The Duel itself then plays out in the
// Duel pop-up on every page (duel-hud.js), where the Warden rolls each step. Moved here from the old Combat Control page.
import { esc, api, toast } from './common.js';
import { gl } from './glyphs.js';

export function mountDuelStart(el, getCombat) {
  let ledger = [], sig = '';
  api('GET', null, '?view=warden', '/api/npcs').then((r) => { ledger = r.npcs || []; sig = ''; draw(); }).catch(() => {});
  function draw() {
    const c = getCombat();
    if (!c) return;
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    const alive = c.posse.filter((p) => !p.dead), foes = c.enemies.filter((e) => !e.defeated), d = c.duel;
    const next = JSON.stringify([!!d && !d.done, alive.map((p) => p.id + p.name), foes.map((e) => e.id + e.name), ledger.length]);
    if (next === sig) return;
    sig = next;
    if (d && !d.done) { el.innerHTML = `<p class="muted mt-0">${esc(d.a?.name || '')} and ${esc(d.b?.name || '')} are facing off. Roll each step from the Duel pop-up.</p>`; return; }
    const opts = `<option value="">— pick —</option><optgroup label="The Posse">${alive.map((p) => `<option value="pc:${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>
      ${foes.length ? `<optgroup label="In the fight">${foes.map((e) => `<option value="en:${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>` : ''}
      <optgroup label="Book NPCs">${(c.npcCatalog || []).filter((n) => n.faction).map((n) => `<option value="np:${esc(n.key)}|${esc(n.name)}">${esc(n.name)}</option>`).join('')}</optgroup>
      <optgroup label="Human combatants (p. 191)">${(c.npcCatalog || []).filter((n) => !n.faction).map((n) => `<option value="np:${esc(n.key)}|">${esc(n.name.replace('Human - ', ''))}</option>`).join('')}</optgroup>
      ${ledger.length ? `<optgroup label="Your NPC ledger (fights like a Moderate combatant)">${ledger.map((n) => `<option value="np:npc:Human - Moderate Combatant|${esc(n.name)}">${esc(n.name)}</option>`).join('')}</optgroup>` : ''}`;
    el.innerHTML = `<p class="muted mt-0">Just Skills and the town’s Dueling Pistols (2G). Both roll Charm, Finesse, Intuition and Nerve; each win adds 1B to their Draw! Players ask for duels from the NPC ledger too.</p>
      <div class="field-step"><span>WHO’S FACING OFF</span><select data-da aria-label="First duelist">${opts}</select><select data-db aria-label="Second duelist">${opts}</select></div>
      <button class="btn" type="button" data-go>${gl('revolver')} Face off</button>`;
    el.querySelector('[data-go]').addEventListener('click', async () => {
      const a = el.querySelector('[data-da]').value, b = el.querySelector('[data-db]').value;
      if (!a || !b) return toast('Pick both duelists.', true);
      if (a === b) return toast('Pick two different duelists.', true);
      try { await api('POST', { action: 'duelStart', a, b }, '', '/api/combat'); sig = ''; toast('High noon. The Duel pop-up is up.'); } catch (err) { toast(err.message, true); }
    });
  }
  setInterval(draw, 3000);
  draw();
  return { draw };
}
