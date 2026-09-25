// Call for a roll (pp. 12–13), the quick way: tap who, tap how hard, tap the Skill — the request goes out.
import { esc, api, toast } from './common.js';
import { gl } from './glyphs.js';

const DIFF = [['Very Easy', 1], ['Easy', 2], ['Medium', 3], ['Difficult', 4], ['Very Difficult', 5]];
const SKILLS = [['Charm', 'convince, barter, intimidate'], ['Finesse', 'sneak, craft, steer'], ['Intuition', 'track, investigate, notice'], ['Nerve', 'endure, resist, stay calm']];

// el: the box to draw into. getCombat(): the Warden combat view. after(ck): called once a roll is called.
export function mountRollCaller(el, getCombat, after) {
  const sel = { who: null, diff: 'Medium', note: '', npc: '' }; // who: null = everyone (or everyone in the fight)
  const people = () => {
    const c = getCombat();
    if (!c) return [];
    return (c.posse || []).filter((p) => !p.dead && p.done !== false);
  };
  const fighting = () => { const c = getCombat(); return c?.combat?.active ? people().filter((p) => !c.combat.party || c.combat.party.includes(p.id)) : null; };
  const chosen = () => (sel.who ? people().filter((p) => sel.who.has(p.id)) : (fighting() || people()));
  function draw() {
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const c = getCombat(), list = people(), fight = fighting();
    const picked = new Set(chosen().map((p) => p.id));
    const everyone = !sel.who;
    el.innerHTML = `
      <div class="rc-step"><span>WHO</span>
        <button type="button" class="rc-chip${everyone ? ' on' : ''}" data-rc-all>${fight ? 'Everyone in the fight' : 'Everyone'}</button>
        ${list.map((p) => `<button type="button" class="rc-chip${!everyone && picked.has(p.id) ? ' on' : ''}" data-rc-who="${esc(p.id)}">${esc(p.name)}</button>`).join('') || '<span class="muted">No characters yet.</span>'}</div>
      <div class="rc-step"><span>HOW HARD</span>
        ${DIFF.map(([n, t]) => `<button type="button" class="rc-chip${sel.diff === n ? ' on' : ''}" data-rc-diff="${n}">${n}<small>${t} Hit${t > 1 ? 's' : ''}</small></button>`).join('')}
        <button type="button" class="rc-chip${sel.diff === 'challenge' ? ' on' : ''}" data-rc-diff="challenge">Challenge<small>most Hits wins</small></button></div>
      ${sel.diff === 'challenge' ? `<div class="rc-step"><span>AGAINST</span><select data-rc-npc aria-label="Opponent"><option value="">— just the posse picked above —</option>
          ${(c?.enemies || []).filter((e) => !e.defeated).map((e) => `<option value="en:${e.id}"${sel.npc === `en:${e.id}` ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}
          <optgroup label="Book NPCs">${(c?.npcCatalog || []).map((n) => { const v = `np:${n.key}|${n.faction ? n.name : ''}`; return `<option value="${esc(v)}"${sel.npc === v ? ' selected' : ''}>${esc(n.name.replace('Human - ', 'Human: '))}</option>`; }).join('')}</optgroup></select></div>` : ''}
      <div class="rc-step rc-note"><span>FOR</span><input data-rc-note maxlength="80" placeholder="what’s it for? (optional) e.g. climb the cliff" value="${esc(sel.note)}"></div>
      <div class="rc-skills">${SKILLS.map(([s, d]) => `<button type="button" class="rc-skill" data-rc-skill="${s}">${gl('die')}<b>${s}</b><small>${d}</small></button>`).join('')}</div>
      <p class="muted rc-tip">Tap a Skill to send it — it pops up on ${chosen().length === 1 ? `${esc(chosen()[0].name)}’s` : 'their'} phones. Anyone not called can Help with half their dice.</p>`;
  }
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.rcAll !== undefined) { sel.who = null; draw(); return; }
    if (b.dataset.rcWho) {
      if (!sel.who) sel.who = new Set();
      if (sel.who.has(b.dataset.rcWho)) sel.who.delete(b.dataset.rcWho); else sel.who.add(b.dataset.rcWho);
      if (!sel.who.size) sel.who = null;
      draw(); return;
    }
    if (b.dataset.rcDiff) { sel.diff = b.dataset.rcDiff; draw(); return; }
    if (b.dataset.rcSkill) {
      const who = chosen().map((p) => p.id);
      if (!who.length) return toast('Nobody to roll.', true);
      b.disabled = true;
      try {
        const res = await api('POST', { action: 'checkStart', who, skill: b.dataset.rcSkill, diff: sel.diff, npc: sel.diff === 'challenge' ? sel.npc : '', note: sel.note }, '', '/api/combat');
        toast(`${b.dataset.rcSkill} roll called${who.length === 1 ? ` for ${chosen()[0].name}` : ` for ${who.length}`}.`);
        sel.note = '';
        after?.(res);
      } catch (err) { toast(err.message, true); }
      b.disabled = false;
      draw();
    }
  });
  el.addEventListener('input', (e) => { if (e.target.matches('[data-rc-note]')) sel.note = e.target.value; });
  el.addEventListener('change', (e) => { if (e.target.matches('[data-rc-npc]')) sel.npc = e.target.value; });
  return { draw };
}
