// Sound controls for full-screen game scenes (the saloon, the carnival, contests), which cover the nav's sound button.
// soundBtn(dark) goes in a scene's header; one document listener opens a small panel: sound on/off, background
// sounds on/off, and volume. The panel lives on <body>, so a scene redrawing its header doesn't close it.
import { gl } from './glyphs.js';
import { play, isMuted, setMuted, volume, setVolume, ambienceOn, setAmbienceOn } from './sound.js';

export const soundBtn = (cls = '') => `<button type="button" class="snd-btn ${cls}" data-sndctl aria-haspopup="dialog" aria-pressed="${!isMuted()}" title="Sound" aria-label="Sound">${gl(isMuted() ? 'mute' : 'sound')}</button>`;

let panel = null, anchor = null;
function close() { panel?.remove(); panel = null; anchor = null; }
function draw() {
  if (!panel) return;
  const off = isMuted(), amb = ambienceOn();
  panel.innerHTML = `<div class="snd-h">SOUND <small>this device</small></div>
    <div class="chip-row"><button type="button" class="chip-btn${off ? '' : ' on'}" data-snd="on">On</button><button type="button" class="chip-btn${off ? ' on' : ''}" data-snd="off">Off</button></div>
    <label class="snd-vol">Volume <input type="range" min="0" max="1" step="0.05" value="${volume()}" data-snd-vol aria-label="Volume"${off ? ' disabled' : ''}></label>
    <div class="snd-h">BACKGROUND <small>crowd, piano</small></div>
    <div class="chip-row"><button type="button" class="chip-btn${amb ? ' on' : ''}" data-amb="on"${off ? ' disabled' : ''}>On</button><button type="button" class="chip-btn${amb ? '' : ' on'}" data-amb="off"${off ? ' disabled' : ''}>Off</button></div>`;
}
function place() {
  if (!panel || !anchor?.isConnected) { const fresh = document.querySelector('[data-sndctl]'); if (!fresh) return close(); anchor = fresh; }
  const r = anchor.getBoundingClientRect(), w = panel.offsetWidth, W = document.documentElement.clientWidth;
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.left = `${Math.max(12, Math.min(W - w - 12, r.right - w))}px`;
}
// every sound button (in any scene) shows the current state
function refreshBtns() {
  document.querySelectorAll('[data-sndctl]').forEach((b) => { b.innerHTML = gl(isMuted() ? 'mute' : 'sound'); b.setAttribute('aria-pressed', String(!isMuted())); });
  draw();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sndctl]');
  if (b) { e.stopPropagation(); if (panel) { close(); return; } open(b); return; }
  if (!panel) return;
  if (!panel.contains(e.target)) { close(); return; }
  const s = e.target.closest('[data-snd]'), a = e.target.closest('[data-amb]');
  if (s) { setMuted(s.dataset.snd === 'off'); if (s.dataset.snd === 'on') play('chime'); }
  if (a) setAmbienceOn(a.dataset.amb === 'on');
  if (s || a) refreshBtns();
}, true);
document.addEventListener('input', (e) => { if (e.target.matches?.('[data-snd-vol]')) setVolume(e.target.value); });
document.addEventListener('change', (e) => { if (e.target.matches?.('[data-snd-vol]')) play('chime'); });
document.addEventListener('keydown', (e) => { if (panel && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);
document.addEventListener('wiw:sound', refreshBtns);
addEventListener('resize', () => place());

function open(b) {
  anchor = b;
  panel = document.createElement('div');
  panel.className = 'snd-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Sound');
  document.body.append(panel);
  draw(); place();
  panel.querySelector('button')?.focus({ preventScroll: true });
}
