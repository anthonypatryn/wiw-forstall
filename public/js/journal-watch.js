// Players: a new quest, clue or finished job the Warden reveals pops up on any page, once per device.
import { esc, startPolling, savedPin, store } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

export function watchJournal() {
  if (savedPin() || location.pathname.startsWith('/journal')) return;
  let showing = false;
  startPolling('player', (d) => {
    const seenAt = store.get('wiw.journalSeenAt', 0);
    if (!seenAt) { store.set('wiw.journalSeenAt', Date.now()); return; } // first visit: nothing old pops up
    const fresh = (d.news || []).filter((n) => n.at > seenAt).sort((a, b) => a.at - b.at);
    if (!fresh.length || showing) return;
    showing = true;
    store.set('wiw.journalSeenAt', fresh[fresh.length - 1].at);
    const clue = fresh.some((n) => n.kind === 'clue'), quest = fresh.some((n) => n.kind === 'quest');
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    back.innerHTML = `<div class="modal ask whisper-card" role="dialog" aria-modal="true" aria-label="The Journal">
      <div class="ho-kicker">${gl('scroll')} THE JOURNAL</div>
      <h2>${clue && !quest ? 'A new lead' : fresh.length > 1 ? 'News for the posse' : esc(fresh[0].text.split(':')[0])}</h2>
      <ul class="jw-list">${fresh.slice(-5).map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>
      <div class="ask-btns"><button type="button" class="btn secondary" data-x>Later</button><a class="btn" href="/journal#${clue && !quest ? 'clues' : 'quests'}">Open the Journal</a></div></div>`;
    document.body.append(back);
    play('chime');
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-x]')) { back.remove(); showing = false; } });
  }, null, '/api/journal');
}
