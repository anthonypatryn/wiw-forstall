// The Warden's Soundboard (Run the Game): any sound effect, instantly, for everyone at the table or just the Warden
// (a preview), and background loops that keep playing on every screen until the Warden stops them.
// watchSoundcast() runs on every page (mountTableLog) and plays what the Warden sends.
import { esc, api, toast, startPolling } from './common.js';
import { gl } from './glyphs.js';
import { play, ambience, LOOPS, stopSounds, preload } from './sound.js';

const EP = '/api/sound';
export const BOARD = [
  ['Fights', [['gun', 'Gunshot'], ['shotgun', 'Shotgun'], ['bow', 'Bow shot'], ['arrowHit', 'Arrow thunk'], ['swing', 'Swing'], ['steps', 'Footsteps']]],
  ['Monsters', [['monRoar', 'Roar'], ['monLowRoar', 'Low roar'], ['monGrowl', 'Growl'], ['monClick', 'Insect clicking'], ['monGiantInsect', 'Giant insect'], ['monSmallInsect', 'Small insect']]],
  ['Explosions', [['explosion:small', 'Small'], ['explosion:medium', 'Medium'], ['explosion:large', 'Large'], ['explosion:huge', 'Huge']]],
  ['Saloon & games', [['dice', 'Dice'], ['card', 'Card deal'], ['shuffle', 'Shuffle'], ['chips', 'Chips'], ['drink', 'Pour a drink']]],
  ['Good & bad', [['success', 'Success'], ['successBig', 'Big win'], ['fail', 'Fail'], ['failClunk', 'Clunk'], ['failComic', 'Comic fail'], ['chime', 'Cowbell']]],
  ['Carnival', [['shoeRing', 'Horseshoe ringer'], ['shoeDirt', 'Horseshoe in the dirt'], ['striker', 'Mallet & bell'], ['strikerMiss', 'Mallet, no bell'], ['oink', 'Pig oink'], ['squeal', 'Pig squeal']]],
  ['Travel', [['horseWalk', 'Horse walking'], ['trainArrive', 'Train pulls in'], ['trainPass', 'Train rolls past']]],
  ['Forstalls & locks', [['fsSweep', 'Sweep'], ['fsScan', 'Scan'], ['fsReadout', 'Scanner readout'], ['fsBurst', 'Crystal Burst'], ['forstall', 'Forstall hum'], ['zap', 'Zap'], ['pickWork', 'Picking a lock'], ['lockMiss', 'Pick snaps'], ['lockUnlock', 'Lock clicks open']]],
];
const fire = (key) => { const [name, arg] = key.split(':'); if (name === 'stop') stopSounds(); else play(name, arg); };

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
  let everyone = true, preview = null; // preview = a loop only the Warden is hearing
  preload(...BOARD.flatMap(([, list]) => list.map(([k]) => (k.startsWith('explosion:') ? { small: 'boomSmall', medium: 'boomMedium', large: 'boomLarge', huge: 'boomHuge' }[k.slice(10)] : k)))); // every button ready to go
  const draw = () => {
    const anyLoop = current || preview;
    el.innerHTML = `<div class="sb-top">
        <div class="sb-mode" role="group" aria-label="Who hears it">
          <button type="button" data-sb-who="all" aria-pressed="${everyone}">Everyone</button><button type="button" data-sb-who="me" aria-pressed="${!everyone}">Just me <small>(preview)</small></button>
        </div>
        <button type="button" class="sb-stop-all" data-sb-stopall title="Cut every sound effect and the background, for everyone">&#9632; Stop all sounds</button>
      </div>
      <p class="sb-hint">${everyone ? 'Buttons play on everyone’s screen (players hear it within a couple of seconds).' : 'Buttons play only on this screen, to try them out.'}</p>
      <h3 class="sub-h">BACKGROUND <small>keeps playing until you stop it</small></h3>
      <div class="sb-grid">${Object.entries(LOOPS).map(([k, l]) => { const on = current === k || preview === k; return `<button type="button" class="sb-btn loop${on ? ' on' : ''}" data-sb-loop="${k}" aria-pressed="${on}">${esc(l[4])}${on ? `<small>${preview === k ? 'previewing' : 'playing for everyone'}</small>` : ''}</button>`; }).join('')}
        ${anyLoop ? '<button type="button" class="sb-btn stop" data-sb-loop="">Stop the background</button>' : ''}</div>
      ${BOARD.map(([title, list]) => `<h3 class="sub-h">${esc(title.toUpperCase())}</h3><div class="sb-grid">${list.map(([k, label]) => `<button type="button" class="sb-btn" data-sb="${k}">${esc(label)}</button>`).join('')}</div>`).join('')}
      <p class="muted sess-note">Players only hear it if their sound is on. The saloon and carnival play their own background while a game is open.</p>`;
  };
  const send = (body) => api('POST', body, '', EP).catch((err) => { toast(err.message, true); return null; });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.sbWho) { everyone = d.sbWho === 'all'; draw(); return; }
    if (d.sbStopall !== undefined) { // cut everything: effects here and on every screen, and the background
      stopSounds(); preview = null; ambience('preview', null);
      const id = Math.random().toString(36).slice(2, 10); seen.add(id);
      await send({ action: 'cue', name: 'stop', id });
      if (current) { await send({ action: 'loop', name: '' }); current = null; ambience('warden', null); }
      draw(); toast('All sounds stopped.'); return;
    }
    if (d.sb) {
      fire(d.sb); // the Warden hears it right away
      if (!everyone) return;
      const [name, arg] = d.sb.split(':');
      const id = Math.random().toString(36).slice(2, 10); seen.add(id);
      await send({ action: 'cue', name, arg: arg || '', id });
      return;
    }
    if (d.sbLoop !== undefined) {
      const k = d.sbLoop;
      if (!k) { // stop whatever background is on
        if (preview) { preview = null; ambience('preview', null); }
        if (current) { await send({ action: 'loop', name: '' }); current = null; ambience('warden', null); }
        draw(); return;
      }
      if (!everyone) { preview = preview === k ? null : k; ambience('preview', preview); draw(); return; }
      const next = current === k ? '' : k; // tapping the playing loop again stops it
      if (await send({ action: 'loop', name: next })) { current = next || null; ambience('warden', current); draw(); }
    }
  });
  document.addEventListener('wiw:soundboard', draw);
  draw();
}
