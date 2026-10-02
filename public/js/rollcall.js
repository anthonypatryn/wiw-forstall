// Call for a roll (pp. 12–13): tap who, how hard and the Skill, then Call for the roll sends it out.
import { esc, api, toast } from './common.js';
import { gl } from './glyphs.js';

const DIFF = [['Very Easy', 1], ['Easy', 2], ['Medium', 3], ['Difficult', 4], ['Very Difficult', 5]];
// Reputation (p. 118): Charm dice against a faction; same rule as repFor in lib/combat.js (the server decides the roll)
const REP_DICE = { Revered: 2, Helpful: 1, Neutral: 0, Suspicious: -1, Hostile: -2 }, REP_ORDER = ['Hostile', 'Suspicious', 'Neutral', 'Helpful', 'Revered'];
function repFor(pc, faction, posseLevel = 'Neutral') {
  const f = faction.trim().toLowerCase(), own = (pc.reputation || []).find((r) => r?.faction && r.faction.trim().toLowerCase() === f);
  let i = REP_ORDER.indexOf(own?.level && REP_DICE[own.level] !== undefined ? own.level : REP_DICE[posseLevel] !== undefined ? posseLevel : 'Neutral');
  if ((pc.abilities || []).includes('Warm Reception') && i >= 1) i++;
  if (/golden pelt/i.test(JSON.stringify([pc.items, pc.inventory, pc.gear]))) i++;
  const level = REP_ORDER[Math.min(i, 4)];
  return { level, dice: REP_DICE[level] };
}
let factionInfo = null; // { names, standing } from the NPC page, loaded once
const SKILLS = [['Charm', 'convince, barter, intimidate'], ['Finesse', 'sneak, craft, steer'], ['Intuition', 'track, investigate, notice'], ['Nerve', 'endure, resist, stay calm']];

// el: the box to draw into. getCombat(): the Warden combat view. after(ck): called once a roll is called.
export function mountRollCaller(el, getCombat, after) {
  const sel = { who: null, diff: 'Medium', note: '', npc: '', skill: null, faction: '' };
  if (!factionInfo) api('GET', null, '?view=warden', '/api/npcs').then((d) => { factionInfo = { names: (d.factions || []).map((f) => f.name), standing: d.standing || {} }; draw(); }).catch(() => {}); // who: null = everyone (or everyone in the fight)
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
      <div class="field-step"><span>WHO</span>
        <button type="button" class="chip-btn${everyone ? ' on' : ''}" data-rc-all>${fight ? 'Everyone in the fight' : 'Everyone'}</button>
        ${list.map((p) => `<button type="button" class="chip-btn${!everyone && picked.has(p.id) ? ' on' : ''}" data-rc-who="${esc(p.id)}">${esc(p.name)}</button>`).join('') || '<span class="muted">No characters yet.</span>'}</div>
      <div class="field-step"><span>HOW HARD</span>
        ${DIFF.map(([n, t]) => `<button type="button" class="chip-btn${sel.diff === n ? ' on' : ''}" data-rc-diff="${n}">${n}<small>${t} Hit${t > 1 ? 's' : ''}</small></button>`).join('')}
        <button type="button" class="chip-btn${sel.diff === 'challenge' ? ' on' : ''}" data-rc-diff="challenge">Challenge<small>most Hits wins</small></button></div>
      ${sel.diff === 'challenge' ? `<div class="field-step"><span>AGAINST</span><select data-rc-npc aria-label="Opponent"><option value="">— just the posse picked above —</option>
          ${(c?.enemies || []).filter((e) => !e.defeated).map((e) => `<option value="en:${e.id}"${sel.npc === `en:${e.id}` ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}
          <optgroup label="Book NPCs">${(c?.npcCatalog || []).map((n) => { const v = `np:${n.key}|${n.faction ? n.name : ''}`; return `<option value="${esc(v)}"${sel.npc === v ? ' selected' : ''}>${esc(n.name.replace('Human - ', 'Human: '))}</option>`; }).join('')}</optgroup></select></div>` : ''}
      <div class="field-step"><span>FOR</span><input data-rc-note maxlength="80" placeholder="what’s it for? (optional) e.g. climb the cliff" value="${esc(sel.note)}"></div>
      <div class="rc-skills">${SKILLS.map(([s, d]) => `<button type="button" class="rc-skill${sel.skill === s ? ' on' : ''}" data-rc-skill="${s}" aria-pressed="${sel.skill === s}">${gl('die')}<b>${s}</b><small>${d}</small></button>`).join('')}</div>
      ${sel.skill === 'Charm' ? `<div class="field-step rc-faction"><span>WITH A FACTION? <small>Reputation adds or takes Black dice (p. 118)</small></span>
        <select data-rc-faction aria-label="Faction"><option value="">— nobody in particular —</option>${(factionInfo?.names || []).map((n) => `<option value="${esc(n)}"${sel.faction === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
        ${sel.faction ? `<div class="rc-reps">${chosen().map((p) => { const r = repFor(p, sel.faction, factionInfo?.standing?.[sel.faction]?.level); return `<span class="pill${r.dice > 0 ? ' ok' : r.dice < 0 ? ' hot' : ''}">${esc(p.name)}: ${r.level}${r.dice ? ` ${r.dice > 0 ? '+' : '−'}${Math.abs(r.dice)}B` : ''}</span>`; }).join(' ')}</div>` : ''}</div>` : ''}
      <button type="button" class="btn rc-go" data-rc-go${sel.skill ? '' : ' disabled'}>${gl('die')} ${sel.skill ? `Call for the ${esc(sel.skill)} roll` : 'Pick a Skill to call for'}</button>
      <p class="muted rc-tip">It pops up on ${chosen().length === 1 ? `${esc(chosen()[0].name)}’s` : 'their'} phones. Anyone not called gets a pop-up to Help with half their dice — pick one person when the others should help.</p>`;
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
    if (b.dataset.rcSkill) { sel.skill = sel.skill === b.dataset.rcSkill ? null : b.dataset.rcSkill; draw(); return; }
    if (b.dataset.rcGo !== undefined && sel.skill) {
      const who = chosen().map((p) => p.id);
      if (!who.length) return toast('Nobody to roll.', true);
      b.disabled = true;
      try {
        const res = await api('POST', { action: 'checkStart', who, skill: sel.skill, diff: sel.diff, npc: sel.diff === 'challenge' ? sel.npc : '', note: sel.note, faction: sel.skill === 'Charm' ? sel.faction : '' }, '', '/api/combat');
        toast(`${sel.skill} roll called${who.length === 1 ? ` for ${chosen()[0].name}` : ` for ${who.length}`}.`);
        sel.note = ''; sel.skill = null;
        after?.(res);
      } catch (err) { toast(err.message, true); }
      b.disabled = false;
      draw();
    }
  });
  el.addEventListener('input', (e) => { if (e.target.matches('[data-rc-note]')) sel.note = e.target.value; });
  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-rc-npc]')) {
      sel.npc = e.target.value;
      const f = sel.npc.split('|')[1]; if (f && !sel.faction) { sel.faction = f; draw(); } // a book NPC from a faction: Charm is against them
    }
    if (e.target.matches('[data-rc-faction]')) { sel.faction = e.target.value; draw(); }
  });
  return { draw };
}
