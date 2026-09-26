// "Previously on…": the first time a player opens the site after a session was written up, a pop-up shows the recap
// the Warden wrote for the players, plus the posse's open quests and the next step on each — so everyone starts the
// night on the same page. Once per session per device (wiw.prevSeen). Never in Warden mode.
import { esc, api, savedPin, store, paras, me } from './common.js';
import { gl } from './glyphs.js';

const busyScreen = () => document.querySelector('.ask-back, .tour-back, .saloon-back, .lock-back, .duel-back, .ho-back, .paper-back');

export async function showPreviously() {
  if (savedPin() || !me()) return;
  let r;
  try { r = await api('GET', null, '?view=recap', '/api/session'); } catch { return; }
  if (!r?.id || store.get('wiw.prevSeen', '') === r.id) return;
  // not while something else is on screen (the tour, a dialog, a card table…): try again shortly
  if (busyScreen()) { setTimeout(showPreviously, 4000); return; }
  let quests = [];
  try { quests = ((await api('GET', null, '?view=player', '/api/journal')).quests || []).filter((q) => q.status === 'open'); } catch {}
  store.set('wiw.prevSeen', r.id);
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  back.innerHTML = `<div class="modal ask prev-modal" role="dialog" aria-modal="true" aria-label="Previously on Wild Imaginary West">
    <div class="ho-kicker">${gl('scroll')} PREVIOUSLY ON WILD IMAGINARY WEST</div>
    <h2>${esc(r.title || 'Last time')}${r.date ? ` <small class="muted">${esc(r.date)}</small>` : ''}</h2>
    <div class="prev-recap">${paras(r.recap)}</div>
    ${quests.length ? `<h3 class="prev-h">${gl('pin')} Still open</h3><ul class="prev-quests">${quests.slice(0, 6).map((q) => {
      const next = (q.steps || []).find((s) => !s.done);
      return `<li><b>${esc(q.title)}</b>${next ? `<span class="muted"> — next: ${esc(next.text)}</span>` : ''}</li>`;
    }).join('')}</ul>` : ''}
    <div class="ask-btns">${quests.length ? '<a class="btn secondary" href="/journal#quests">Open the Journal</a>' : ''}<button type="button" class="btn" data-go>${gl('revolver')} Let’s ride</button></div></div>`;
  document.body.append(back);
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-go]')) close(); });
  back.querySelector('[data-go]').focus({ preventScroll: true });
}
