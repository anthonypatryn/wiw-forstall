// Quick reference (the top of a finished sheet): what this character can do right now, at a glance.
//   Abilities & Aces-in-the-Hole: the rule, the Grit, uses left today, and a Use button (the same useAbility as the
//     Battle Map; abilities with nothing to roll or spend are shown as rules only).
//   Statuses in effect: what each does, the Skill that relieves it, and a Relieve button (all the dice; in combat it
//     costs 1 Grit a die, once per Status per turn).
//   Weapons: dice at each range, Grit, Special Ammo left and the upgrades on it.
import { esc, poolIcons, abilityOptions, abilityTargetsHTML, abilityBody, rollPopup, toast } from './common.js';
import { gl } from './glyphs.js';

const RANGES = [['arms', 'Arm’s'], ['short', 'Short'], ['long', 'Long'], ['distant', 'Distant']];

export function renderQuickRef(box, p, { meta, combat = {}, posse = [], enemies = [] }) {
  const show = p.done && !p.dead;
  box.hidden = !show;
  if (!show || box.contains(document.activeElement)) return;
  const t = meta.trades[p.trade], I = meta.abilityInfo || {};
  const usable = Object.fromEntries(abilityOptions(p, meta).map((o) => [o.name, o]));
  const foes = enemies.filter((e) => !e.defeated && !e.out);
  const abCard = (a, ace) => {
    const info = I[a.name] || {}, o = usable[a.name], used = p.abilityUses?.[a.name] || 0;
    const bits = [info.cost ? `${info.cost} Grit` : '', info.dice ? `rolls ${info.dice}` : '', info.daily ? `${Math.max(0, 2 - used)} of 2 left today` : ''].filter(Boolean);
    const targets = o ? abilityTargetsHTML(a.name, p, posse, foes, {}) : '';
    return `<div class="qr-ab${ace ? ' ace' : ''}${o?.out ? ' out' : ''}" data-qr-ab="${esc(a.name)}">
      <div class="qr-top"><b>${ace ? `${gl('star')} ` : ''}${esc(a.name)}</b>${bits.length ? `<small>${esc(bits.join(' · '))}</small>` : ''}</div>
      <p>${esc(a.text)}</p>
      ${o ? `<div class="qr-use">${targets}<button type="button" class="btn small" data-qr-use="${esc(a.name)}"${o.out ? ' disabled' : ''}>${o.out ? 'Used up today' : `Use${info.cost ? ` (${info.cost} Grit)` : ''}`}</button></div>` : ''}
    </div>`;
  };
  const abs = t.abilities.filter((a) => p.abilities.includes(a.name)).map((a) => abCard(a, false));
  const aceReady = (p.aces || 0) >= 6;
  const aces = t.aces.filter((_, i) => i === 0 || p.aceTwo).map((a) => (aceReady ? abCard(a, true) : `<div class="qr-ab ace locked"><div class="qr-top"><b>${gl('star')} ${esc(a.name)}</b><small>Ace-in-the-Hole · ${p.aces || 0} of 6 Aces</small></div><p>${esc(a.text)}</p></div>`));

  const statuses = Object.entries(p.statuses || {}).filter(([, v]) => v);
  const stCards = statuses.map(([st, v]) => {
    const info = meta.statuses[st] || {}, skills = String(info.skill || '').split(' or ').filter(Boolean);
    const tried = combat.active && (p.relieved || []).includes(st);
    return `<div class="qr-st"><div class="qr-top"><b>${esc(st)} [${v}]</b><small>relieve with ${esc(skills.join(' or ') || '—')}</small></div>
      <p>${esc(info.text || '')}</p>
      <div class="qr-use">${skills.length > 1 ? `<select data-qr-skill="${esc(st)}" aria-label="Skill">${skills.map((s) => `<option>${esc(s)}</option>`).join('')}</select>` : ''}
        <button type="button" class="btn small secondary" data-qr-rl="${esc(st)}"${tried ? ' disabled' : ''}>${tried ? 'Tried this turn' : `${gl('die')} Relieve`}</button>
        ${combat.active ? '<small class="muted">1 Grit a die, on your turn</small>' : ''}</div></div>`;
  });

  const weapons = (p.weapons || []).filter((w) => w.model || w.manufacturer).map((w) => {
    const ammo = (w.ammo || []).filter((a) => a.name);
    const ups = (w.upgrades || []).filter(Boolean);
    return `<div class="qr-w"><div class="qr-top"><b>${esc(w.model || w.manufacturer)}</b><small>${esc(w.type || '')}${w.grit ? ` · ${esc(w.grit)} Grit` : ''}</small></div>
      <div class="qr-ranges">${RANGES.map(([k, l]) => `<span class="${w[k] ? '' : 'none'}"><small>${l}</small>${w[k] ? poolIcons(w[k]) : '—'}</span>`).join('')}</div>
      ${ammo.length ? `<div class="qr-line">${gl('bullet')} ${ammo.map((a) => `${esc(a.name)} × ${esc(a.rds || 0)}`).join(', ')}</div>` : ''}
      ${ups.length ? `<div class="qr-line">${gl('wrench')} ${ups.map(esc).join(', ')}</div>` : ''}</div>`;
  });

  box.innerHTML = `<h2 class="qr-h">AT A GLANCE <small>what ${esc(p.name || 'you')} can do right now</small></h2>
    <div class="qr-grid">
      <section class="qr-card"><h3>${gl('star')} Abilities &amp; Aces</h3>${[...abs, ...aces].join('') || '<p class="muted">No abilities unlocked yet.</p>'}</section>
      <section class="qr-card"><h3>${gl('drop')} Statuses</h3>${stCards.join('') || '<p class="muted">Nothing ails you. Statuses show here with how to shake them.</p>'}</section>
      <section class="qr-card"><h3>${gl('revolver')} Weapons</h3>${weapons.join('') || '<p class="muted">No weapons on the sheet.</p>'}</section>
    </div>`;
}

// clicks: Use an ability (with its target pickers), Relieve a Status with all the dice for that Skill
export function wireQuickRef(box, getPc, act, inCombat) {
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const p = getPc(); if (!p) return;
    if (b.dataset.qrUse) {
      const card = b.closest('[data-qr-ab]'), sel = { name: b.dataset.qrUse };
      card.querySelectorAll('[data-ab]').forEach((s) => { sel[s.dataset.ab] = s.value; });
      b.disabled = true; b.blur();
      const r = await act(abilityBody(p, sel));
      if (r?.dice) rollPopup(r, `${p.name} · ${sel.name} · ${r.pool}`); else if (r) toast(`${sel.name}: done. It’s in the Table Log.`);
      return;
    }
    if (b.dataset.qrRl) {
      const st = b.dataset.qrRl, skill = box.querySelector(`[data-qr-skill="${CSS.escape(st)}"]`)?.value || undefined;
      b.disabled = true; b.blur();
      // all the Skill's dice (the server's default); in combat each die costs 1 Grit, so no more than the Grit left
      const r = await act({ action: 'pc', id: p.id, op: 'relieve', status: st, skill, dice: inCombat() ? Math.max(1, p.grit || 0) : undefined });
      if (r?.dice) { rollPopup(r, `${p.name} · Relieve ${st} · ${r.pool}`); toast(r.left ? `${st} down to [${r.left}].` : `${st} is gone!`); }
    }
  });
}
