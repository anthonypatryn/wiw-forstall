// Downtime (Run the Game → Rewards): a week spent practicing earns the Prestige for a Talent or a Skill practice,
// spent on it right away. East Portal p. 14 ("Some Time to Kill") and the Guidebook's downtime tip (p. 138).
import { esc, api, toast } from './common.js';
import { gl } from './glyphs.js';

const ACTIVITIES = [
  { id: 'gregory', label: 'Shadow Gregory at the Mule Depot', what: 'practice', skill: 'Finesse', src: 'East Portal p. 14', doing: 'shadowing Gregory at the Mule Depot' },
  { id: 'ivan', label: 'Volunteer with Ivan Ward', what: 'talent', talent: 'Forstalls', src: 'East Portal p. 14', doing: 'volunteering with Ivan Ward for Forstall trade secrets' },
  { id: 'job', label: 'Learn tracking from Job', what: 'talent', talent: 'Traps', src: 'East Portal p. 14', doing: 'learning tracking and trapping from Job Tarryall' },
  { id: 'talent', label: 'Practice for a Talent', what: 'talent', src: 'Guidebook p. 138', doing: 'in dedicated practice' },
  { id: 'skill', label: 'Practice a Skill', what: 'practice', src: 'Guidebook p. 32 & 138', doing: 'in dedicated practice' },
];

export function mountDowntime(el, getCombat) {
  let meta = null;
  const st = { pc: '', act: 'gregory', talent: '', skill: '' };
  api('GET', null, '?view=meta', '/api/combat').then((m) => { meta = m; draw(); }).catch(() => {});
  const draw = () => {
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    if (!posse.some((p) => p.id === st.pc)) st.pc = posse[0]?.id || '';
    const pc = posse.find((p) => p.id === st.pc);
    const a = ACTIVITIES.find((x) => x.id === st.act);
    const talents = (meta?.talents || []).filter((t) => !pc?.talents?.includes(t));
    const skills = meta?.skills || [];
    const talent = a.talent || st.talent, skill = a.skill || st.skill;
    const has = a.what === 'talent' && talent && pc?.talents?.includes(talent);
    const noBlack = a.what === 'practice' && skill && pc && !/\d+B/i.test(String(pc.skills?.[skill.toLowerCase()] || ''));
    el.innerHTML = posse.length ? `
      <label class="field-step"><span>WHO</span><select data-dt-pc aria-label="Who">${posse.map((p) => `<option value="${esc(p.id)}"${p.id === st.pc ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <div class="field-step"><span>HOW THEY SPEND THE WEEK</span><div class="chip-row">${ACTIVITIES.map((x) => `<button type="button" class="chip-btn${x.id === st.act ? ' on' : ''}" data-dt-act="${x.id}" title="${esc(x.src)}">${esc(x.label)}</button>`).join('')}</div></div>
      ${a.id === 'talent' ? `<label class="field-step"><span>WHICH TALENT</span><select data-dt-talent aria-label="Talent"><option value="">Pick…</option>${talents.map((t) => `<option${t === st.talent ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : ''}
      ${a.id === 'skill' ? `<label class="field-step"><span>WHICH SKILL</span><select data-dt-skill aria-label="Skill"><option value="">Pick…</option>${skills.map((s) => `<option${s === st.skill ? ' selected' : ''}>${esc(s)} (${esc(pc?.skills?.[s.toLowerCase()] || '—')})</option>`).join('')}</select></label>` : ''}
      <p class="muted sess-note">${a.what === 'talent' ? `Earns 4 Prestige and spends it on the ${esc(talent || '…')} Talent.` : `Earns 2 Prestige and spends it swapping one Black ${esc(skill || '…')} die for Gold.`} (${esc(a.src)})
        ${has ? `<br><b>${esc(pc.name)} already has ${esc(talent)}.</b>` : ''}${noBlack ? `<br><b>${esc(skill)} has no Black die left.</b>` : ''}</p>
      <button type="button" class="btn small" data-dt-go${!talent && a.what === 'talent' || !skill && a.what === 'practice' || has || noBlack ? ' disabled' : ''}>${gl('star')} A week well spent</button>`
      : '<p class="muted">No characters yet.</p>';
  };
  el.addEventListener('change', (e) => {
    const d = e.target.dataset;
    if (d.dtPc !== undefined) st.pc = e.target.value;
    if (d.dtTalent !== undefined) st.talent = e.target.value;
    if (d.dtSkill !== undefined) st.skill = e.target.value.replace(/ \(.*$/, '');
    e.target.blur(); draw();
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.dtAct) { st.act = b.dataset.dtAct; draw(); return; }
    if (b.dataset.dtGo === undefined) return;
    const a = ACTIVITIES.find((x) => x.id === st.act);
    b.disabled = true;
    try {
      await api('POST', { action: 'downtime', id: st.pc, what: a.what, talent: a.talent || st.talent, skill: a.skill || st.skill, activity: a.doing }, '', '/api/combat');
      toast('Done. It’s in the Table Log.');
    } catch (err) { toast(err.message, true); }
    b.disabled = false;
  });
  draw();
  return { draw };
}
