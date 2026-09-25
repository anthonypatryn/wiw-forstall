// High-Noon Duels on any page (p. 58): the Warden answers a player's challenge, and everyone watches the Duel play out.
// Fed by the Table Log poll (logView().hud.duel / duelReqs) via renderHud in tablelog.js.
import { esc, api, toast, savedPin, store, staticDice, animateRoll, ask, askText } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const STEPS = ['Charm', 'Finesse', 'Intuition', 'Nerve', 'Draw!'];
const TOUGH = [['Weak', 'A weak shot'], ['Moderate', 'Handy with a pistol'], ['Strong', 'A born killer']];
const me = () => store.get('wiw.me', null);
const tabSeen = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const setTabSeen = (k) => { try { sessionStorage.setItem(k, '1'); } catch {} };
const post = (body) => api('POST', body, '', '/api/combat');

let busy = false, box = null, sig = '', shownAt = null, seenRounds = 0;

export function duelHud(h) {
  const warden = !!savedPin();
  if (!busy) {
    if (warden) {
      const r = (h.duelReqs || []).find((x) => x.status === 'pending' && !tabSeen(`wiw.duelLater.${x.id}`));
      if (r) answer(r);
    } else {
      const seen = new Set(store.get('wiw.duelSeen', []));
      const r = (h.duelReqs || []).find((x) => x.pc === me() && x.status === 'denied' && !seen.has(x.id));
      if (r) denied(r, seen);
    }
  }
  watch(h.duel, warden);
}

// ---------- the Warden: a challenge came in ----------
function answer(r) {
  busy = true;
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  back.innerHTML = `<div class="modal ask duel-ask" role="dialog" aria-modal="true" aria-label="A Duel challenge">
    <div class="ho-kicker">${gl('revolver')} A CHALLENGE</div>
    <h2>${esc(r.name)} calls out ${esc(r.npcName)}</h2>
    ${r.reason ? `<blockquote class="whisper-quote big">${esc(r.reason)}</blockquote>` : ''}
    <p class="ask-body">A High-Noon Duel (p. 58): both roll Charm, Finesse, Intuition and Nerve, then DRAW! 3–4 Hits against you is a severe injury and Bleeding Out; 5+ is death.</p>
    <div class="field-step"><span>HOW DANGEROUS IS ${esc(r.npcName.toUpperCase())}? (p. 191)</span>${TOUGH.map(([k, d]) => `<button type="button" class="chip-btn${k === 'Moderate' ? ' on' : ''}" data-tough="${k}">${k}<small>${d}</small></button>`).join('')}</div>
    <div class="ask-btns"><button type="button" class="btn secondary" data-later>Later</button><button type="button" class="btn secondary" data-deny>Say no</button><button type="button" class="btn" data-accept>${gl('revolver')} Accept the Duel</button></div></div>`;
  document.body.append(back);
  play('chime');
  let tough = 'Moderate';
  const close = () => { back.remove(); busy = false; };
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tough) { tough = b.dataset.tough; back.querySelectorAll('[data-tough]').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (b.dataset.later !== undefined) { setTabSeen(`wiw.duelLater.${r.id}`); close(); return; }
    try {
      if (b.dataset.accept !== undefined) { await post({ action: 'duelAnswer', id: r.id, accept: true, tough }); close(); toast('High noon. The Duel is on.'); }
      else if (b.dataset.deny !== undefined) {
        back.hidden = true;
        const note = await askText(`Tell ${r.name} why not (optional):`, '', { ok: 'Say no' });
        if (note === null) { back.hidden = false; return; }
        await post({ action: 'duelAnswer', id: r.id, accept: false, note });
        close();
      }
    } catch (err) { toast(err.message, true); close(); }
  });
}

// ---------- the player: the Warden said no ----------
async function denied(r, seen) {
  busy = true;
  seen.add(r.id); store.set('wiw.duelSeen', [...seen].slice(-30));
  play('chime');
  await ask(`No Duel with ${r.npcName}\n\n${r.note ? `The Warden says: “${r.note}”` : 'The Warden turned your challenge down.'}`, { ok: 'Fair enough', cancel: null, danger: false });
  busy = false;
}

// ---------- everyone: watch the Duel ----------
function watch(d, warden) {
  if (!d) { if (box) { box.remove(); box = null; } sig = ''; shownAt = null; return; }
  if (tabSeen(`wiw.duelHide.${d.at}`)) { if (box) { box.remove(); box = null; } return; }
  const s = JSON.stringify([d.at, d.step, d.done, warden]);
  if (s === sig && box) return;
  sig = s;
  if (!box) {
    box = document.createElement('div');
    box.className = 'modal-back duel-back';
    document.body.append(box);
    box.addEventListener('click', onClick);
    if (shownAt !== d.at) { shownAt = d.at; seenRounds = d.rounds.length; play('chime'); }
  }
  box.dataset.warden = warden ? '1' : '';
  const cell = (r, i) => (r ? `<td><div class="tray duel-tray" data-dt="${r.skill}-${i}"></div><span class="dh">${r.rolls[i].hits} hit${r.rolls[i].hits === 1 ? '' : 's'}</span>${r.won?.[i] ? ' <b class="plus">+1B</b>' : ''}</td>` : '<td class="muted">—</td>');
  box.innerHTML = `<div class="duel-scene" role="dialog" aria-modal="true" aria-label="High-Noon Duel">
    <div class="duel-head"><small>HIGH-NOON DUEL · p. 58</small><b>${esc(d.names[0])} <i>vs</i> ${esc(d.names[1])}</b></div>
    <p class="duel-sub">Gear and defenses set aside: just Skills and the town’s Dueling Pistols (2G). Each Skill won adds 1B to the Draw!</p>
    <table class="duel-table"><thead><tr><th></th><th>${esc(d.names[0])}<small>Draw! ${d.bonus[0]}B 2G</small></th><th>${esc(d.names[1])}<small>Draw! ${d.bonus[1]}B 2G</small></th></tr></thead>
      <tbody>${STEPS.map((st) => { const r = d.rounds.find((x) => x.skill === st); return `<tr class="${st === d.next ? 'now' : ''}"><th>${st}</th>${cell(r, 0)}${cell(r, 1)}</tr>`; }).join('')}</tbody></table>
    ${d.result ? `<div class="duel-result">${d.result.map((r) => `<div class="dr ${r.level}"><b>${esc(r.name)}</b> takes <b>${r.against}</b> Hit${r.against === 1 ? '' : 's'}: ${esc(r.text)}</div>`).join('')}</div>` : ''}
    <div class="duel-actions">${warden && d.next ? `<button type="button" class="btn" data-roll>${d.next === 'Draw!' ? `${gl('flash')} DRAW!` : `${gl('die')} Both roll ${d.next}`}</button>` : ''}
      ${!warden && d.next ? `<span class="muted">The Warden calls each roll${d.next === 'Draw!' ? ' — hands over holsters…' : '.'}</span>` : ''}
      ${warden ? `<button type="button" class="btn small secondary" data-end>${d.done ? 'Close the Duel' : 'Call it off'}</button>` : ''}
      <button type="button" class="btn small secondary" data-hide>${d.done ? 'Close' : 'Hide'}</button></div></div>`;
  d.rounds.forEach((r) => r.rolls.forEach((x, i) => { const t = box.querySelector(`[data-dt="${r.skill}-${i}"]`); if (t) staticDice(t, x.dice); }));
  if (d.rounds.length > seenRounds) { // animate only the newest round, once
    const r = d.rounds[d.rounds.length - 1];
    r.rolls.forEach((x, i) => { const t = box.querySelector(`[data-dt="${r.skill}-${i}"]`); if (t) animateRoll(t, x.dice); });
    if (r.skill === 'Draw!') setTimeout(() => play('gun'), 600);
    seenRounds = d.rounds.length;
  }
  box.dataset.at = d.at;
}
async function onClick(e) {
  const b = e.target.closest('button'); if (!b || !box) return;
  if (b.dataset.hide !== undefined) { setTabSeen(`wiw.duelHide.${box.dataset.at}`); box.remove(); box = null; return; }
  try {
    if (b.dataset.roll !== undefined) { b.disabled = true; await post({ action: 'duelRoll' }); }
    else if (b.dataset.end !== undefined) {
      if (b.textContent.includes('Call') && !await ask('Call off the Duel?')) return;
      await post({ action: 'duelEnd' });
    }
  } catch (err) { toast(err.message, true); b.disabled = false; }
}
