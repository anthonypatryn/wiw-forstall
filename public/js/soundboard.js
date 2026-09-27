// The Warden's Soundboard (Run the Game): any sound effect, instantly, for everyone at the table or just the Warden
// (a preview), and background loops that keep playing on every screen until the Warden stops them.
// watchSoundcast() runs on every page (mountTableLog) and plays what the Warden sends.
import { esc, api, toast, startPolling } from './common.js';
import { gl } from './glyphs.js';
import { play, ambience, LOOPS } from './sound.js';

const EP = '/api/sound';
export const BOARD = [
  ['Fights', [['gun', 'Gunshot'], ['shotgun', 'Shotgun'], ['bow', 'Bow shot'], ['arrowHit', 'Arrow thunk'], ['swing', 'Swing'], ['steps', 'Footsteps']]],
  ['Explosions', [['explosion:small', 'Small'], ['explosion:medium', 'Medium'], ['explosion:large', 'Large'], ['explosion:huge', 'Huge']]],
  ['Saloon & games', [['dice', 'Dice'], ['card', 'Card deal'], ['shuffle', 'Shuffle'], ['chips', 'Chips'], ['drink', 'Pour a drink']]],
  ['Good & bad', [['success', 'Success'], ['successBig', 'Big win'], ['fail', 'Fail'], ['failClunk', 'Clunk'], ['failComic', 'Comic fail'], ['chime', 'Cowbell']]],
  ['Carnival', [['striker', 'Mallet & bell'], ['strikerMiss', 'Mallet, no bell'], ['oink', 'Pig oink'], ['squeal', 'Pig squeal']]],
  ['Trains', [['trainArrive', 'Train pulls in'], ['trainPass', 'Train rolls past']]],
  ['Forstalls & locks', [['forstall', 'Forstall hum'], ['zap', 'Zap'], ['lockClick', 'Lock click'], ['lockSnap', 'Pick snaps'], ['lockOpen', 'Lock opens']]],
];
const fire = (key) => { const [name, arg] = key.split(':'); play(name, arg); };

// ---------- every screen: play the Warden's cues, and the table's background loop ----------
const seen = new Set();
let started = false, current = null;
export function watchSoundcast() {
  if (started) return;
  started = true;
  let first = true;
  startPolling('player', (d) => {
    for (const c of d.cues || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      if (!first && d.now - c.at < 15000) fire(c.arg ? `${c.name}:${c.arg}` : c.name); // never replay old ones on page load
    }
    first = false;
    current = d.loop?.name || null;
    ambience('warden', current);
    document.dispatchEvent(new CustomEvent('wiw:soundboard'));
  }, null, EP);
}

// ---------- the Warden's card ----------
export function mountSoundboard(el) {
  let everyone = true;
  const draw = () => {
    el.innerHTML = `<div class="sb-who chip-row" role="group" aria-label="Who hears it"><button type="button" class="chip-btn${everyone ? ' on' : ''}" data-sb-who="all">${gl('hat')} Everyone</button><button type="button" class="chip-btn${everyone ? '' : ' on'}" data-sb-who="me">Just me (preview)</button></div>
      <h3 class="sub-h">BACKGROUND <small>keeps playing until you stop it</small></h3>
      <div class="sb-grid">${Object.entries(LOOPS).map(([k, l]) => `<button type="button" class="sb-btn loop${current === k ? ' on' : ''}" data-sb-loop="${k}">${esc(l[4])}${current === k ? ' <small>playing</small>' : ''}</button>`).join('')}
        <button type="button" class="sb-btn stop" data-sb-loop=""${current ? '' : ' disabled'}>Stop the background</button></div>
      ${BOARD.map(([title, list]) => `<h3 class="sub-h">${esc(title.toUpperCase())}</h3><div class="sb-grid">${list.map(([k, label]) => `<button type="button" class="sb-btn" data-sb="${k}">${esc(label)}</button>`).join('')}</div>`).join('')}
      <p class="muted sess-note">Players hear it within a couple of seconds (and only if their sound is on). Saloon and carnival background plays on its own while a game is open.</p>`;
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.sbWho) { everyone = d.sbWho === 'all'; draw(); return; }
    if (d.sb) {
      fire(d.sb); // the Warden hears it right away
      if (!everyone) return;
      const [name, arg] = d.sb.split(':');
      try { const r = await api('POST', { action: 'cue', name, arg: arg || '' }, '', EP); if (r.result?.id) seen.add(r.result.id); } catch (err) { toast(err.message, true); }
      return;
    }
    if (d.sbLoop !== undefined) {
      if (!everyone) { ambience('preview', d.sbLoop && d.sbLoop !== current ? d.sbLoop : null); toast(d.sbLoop ? `Previewing ${LOOPS[d.sbLoop][4]} (tap Stop to end it).` : 'Preview stopped.'); if (!d.sbLoop) ambience('preview', null); return; }
      try { await api('POST', { action: 'loop', name: d.sbLoop }, '', EP); current = d.sbLoop || null; ambience('warden', current); draw(); } catch (err) { toast(err.message, true); }
    }
  });
  document.addEventListener('wiw:soundboard', draw);
  draw();
}
