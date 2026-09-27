// Guided level-up: spending Prestige (p. 32) as a short walkthrough instead of the sheet's row of dropdowns.
// 1) what to buy (big cards, only what you can afford) → 2) which one (skills, talents, abilities, with what they do)
// → 3) confirm. Uses the same pc op `spend` as the sheet's Prestige box.
import { esc, toast } from './common.js';
import { gl } from './glyphs.js';

export const SPEND = [
  ['practice', 2, 'Practice a Skill', 'Swap one Black die for a Gold one on a Skill.'],
  ['health', 2, 'Improve Health', '+1 Max Health (up to 5 times).'],
  ['talent', 4, 'Develop a Talent', 'Reroll Spurs on that kind of roll.'],
  ['ability', 4, 'Unlock an Ability', 'A new Ability from your Trade.'],
  ['master', 6, 'Master a Skill', '+1 Black die on a Skill (up to 3 times).'],
  ['ace2', 6, 'Ace-in-the-Hole 2', 'Your Trade’s second Ace-in-the-Hole.'],
];
const TALENT_WHAT = { Charm: 'Charm rolls', Finesse: 'Finesse rolls (including turn order)', Intuition: 'Intuition rolls (including Scans)', Nerve: 'Nerve rolls', Bows: 'bow attacks', Defense: 'Defense rolls', Explosives: 'explosives', 'First Aid': 'First Aid', Forstalls: 'Forstall Sweeps', Mechs: 'mech rolls', 'Melee Weapons': 'melee attacks', 'Mounted Weapons': 'mounted weapons', Pistols: 'pistol attacks', Rifles: 'rifle attacks', Shotguns: 'shotgun attacks', Traps: 'traps' };

const parse = (pool) => { let b = 0, g = 0; (String(pool || '').toUpperCase().match(/\d+[BG]/g) || []).forEach((x) => { if (x.endsWith('B')) b += parseInt(x, 10); else g += parseInt(x, 10); }); return { b, g }; };
const fmt = ({ b, g }) => `${b ? `${b}B` : ''}${g ? `${g}G` : ''}` || '—';

export function openLevelUp({ pc, meta, act, onDone = () => {} }) {
  const t = meta.trades[pc.trade];
  let have = pc.prestige?.unclaimed || 0, step = 1, pick = null, choice = null;
  const maxed = () => ({
    health: (pc.prestige?.healthUps || 0) >= 5, master: (pc.prestige?.mastered || 0) >= 3, ace2: !!pc.aceTwo,
    ability: t.abilities.every((a) => pc.abilities.includes(a.name)), talent: meta.talents.every((x) => pc.talents.includes(x)),
    practice: !meta.skills.some((s) => parse(pc.skills[s.toLowerCase()]).b > 0),
  });
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const draw = () => {
    const mx = maxed(), cost = pick ? SPEND.find((x) => x[0] === pick)[1] : 0;
    let body = '';
    if (step === 1) {
      body = `<p class="lu-lead">${esc(pc.name)} has <b>${have} Prestige</b> to spend. What’ll it be?</p>
        <div class="lu-grid">${SPEND.map(([k, c, name, desc]) => { const off = have < c || mx[k]; return `<button type="button" class="lu-card" data-pick="${k}"${off ? ' disabled' : ''}>
          <span class="lu-cost">${c}</span><b>${esc(name)}</b><small>${esc(desc)}</small>${mx[k] ? '<em>All done</em>' : have < c ? `<em>Needs ${c}</em>` : ''}</button>`; }).join('')}</div>`;
    } else if (step === 2) {
      const [, , name] = SPEND.find((x) => x[0] === pick);
      let opts = '';
      if (pick === 'practice' || pick === 'master') {
        opts = meta.skills.map((s) => { const cur = parse(pc.skills[s.toLowerCase()]); const next = pick === 'practice' ? { b: cur.b - 1, g: cur.g + 1 } : { b: cur.b + 1, g: cur.g }; const off = pick === 'practice' && cur.b < 1;
          return `<button type="button" class="lu-opt${choice === s ? ' on' : ''}" data-choice="${s}"${off ? ' disabled' : ''}><b>${s}</b><span>${fmt(cur)} → <strong>${off ? 'no Black dice' : fmt(next)}</strong></span></button>`; }).join('');
      } else if (pick === 'talent') {
        opts = meta.talents.filter((x) => !pc.talents.includes(x)).map((x) => `<button type="button" class="lu-opt${choice === x ? ' on' : ''}" data-choice="${esc(x)}"><b>${esc(x)}</b><span>Reroll Spurs on ${esc(TALENT_WHAT[x] || x)}</span></button>`).join('');
      } else if (pick === 'ability') {
        opts = t.abilities.filter((a) => !pc.abilities.includes(a.name)).map((a) => `<button type="button" class="lu-opt lu-ab${choice === a.name ? ' on' : ''}" data-choice="${esc(a.name)}"><b>${esc(a.name)}</b><span>${esc(a.text)}</span></button>`).join('');
      }
      body = `<p class="lu-lead"><b>${esc(name)}</b>: pick one.</p><div class="lu-opts">${opts}</div>`;
    } else {
      const [, , name] = SPEND.find((x) => x[0] === pick);
      const what = pick === 'health' ? `Max Health ${pc.maxHealth} → ${pc.maxHealth + 1}` : pick === 'ace2' ? (t.aces[1] ? `${t.aces[1].name}: ${t.aces[1].text}` : 'Your second Ace-in-the-Hole') : choice;
      body = `<div class="lu-confirm"><span class="lu-cost">${cost}</span><div><b>${esc(name)}</b><p>${esc(what || '')}</p></div></div>
        <p class="muted">${esc(pc.name)} will have <b>${have - cost}</b> Prestige left. It goes in the Table Log.</p>`;
    }
    const needsChoice = ['practice', 'master', 'talent', 'ability'].includes(pick);
    back.innerHTML = `<div class="modal ask lu-modal" role="dialog" aria-modal="true" aria-label="Level up">
      <div class="ho-kicker">${gl('star')} LEVEL UP <small>step ${step} of ${needsChoice ? 3 : 2}</small></div>
      ${body}
      <div class="ask-btns">${step > 1 ? '<button type="button" class="btn secondary" data-back>‹ Back</button>' : '<button type="button" class="btn secondary" data-x>Later</button>'}
        ${step === 2 ? `<button type="button" class="btn" data-next${choice ? '' : ' disabled'}>Next</button>` : step === 3 ? `<button type="button" class="btn" data-lu-spend>${gl('star')} Spend ${cost} Prestige</button>` : ''}</div></div>`;
  };
  draw();
  document.body.append(back);
  back.addEventListener('click', async (e) => {
    if (e.target === back || e.target.closest('[data-x]')) { back.remove(); onDone(); return; }
    const p = e.target.closest('[data-pick]');
    if (p) { pick = p.dataset.pick; choice = null; step = ['practice', 'master', 'talent', 'ability'].includes(pick) ? 2 : 3; draw(); return; }
    const c = e.target.closest('[data-choice]');
    if (c) { choice = c.dataset.choice; draw(); return; }
    if (e.target.closest('[data-back]')) { step = step === 3 && ['practice', 'master', 'talent', 'ability'].includes(pick) ? 2 : 1; if (step === 1) pick = null; draw(); return; }
    if (e.target.closest('[data-next]')) { step = 3; draw(); return; }
    const sp = e.target.closest("[data-lu-spend]");
    if (!sp) return;
    sp.disabled = true;
    const body = { action: 'pc', id: pc.id, op: 'spend', what: pick };
    if (pick === 'practice' || pick === 'master') body.skill = choice;
    if (pick === 'talent') body.talent = choice;
    if (pick === 'ability') body.ability = choice;
    const r = await act(body);
    if (r === null || r === undefined || r === false) { sp.disabled = false; return; }
    const cost = SPEND.find((x) => x[0] === pick)[1];
    have -= cost;
    // keep the local picture right for another round (the sheet refreshes itself from the server)
    if (pick === 'health') { pc.maxHealth += 1; pc.prestige.healthUps = (pc.prestige.healthUps || 0) + 1; }
    if (pick === 'master') pc.prestige.mastered = (pc.prestige.mastered || 0) + 1;
    if (pick === 'ace2') pc.aceTwo = true;
    if (pick === 'talent') pc.talents = [...pc.talents, choice];
    if (pick === 'ability') pc.abilities = [...pc.abilities, choice];
    if (pick === 'practice' || pick === 'master') { const k = choice.toLowerCase(), cur = parse(pc.skills[k]); pc.skills[k] = fmt(pick === 'practice' ? { b: cur.b - 1, g: cur.g + 1 } : { b: cur.b + 1, g: cur.g }); }
    toast(`${SPEND.find((x) => x[0] === pick)[2]}${choice ? ` (${choice})` : ''}: done.`);
    if (have >= 2) { step = 1; pick = null; choice = null; draw(); } else { back.remove(); onDone(); }
  });
}
