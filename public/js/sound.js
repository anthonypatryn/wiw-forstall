// Sound effects. Real recordings (public/sfx/*.mp3, free Pixabay sounds) play as clips — a sound with several clips picks
// one at random so it never sounds like a loop. Everything else is synthesized in the browser (WebAudio), and so is a
// recorded sound until its file has loaded. To swap in another recording, drop it in public/sfx and point CLIPS at it.
// (Older route, still works: public/sfx/<name>.mp3 listed in public/sfx/manifest.json replaces that sound whole.)
// Muted/volume are per device: localStorage wiw.muted / wiw.volume.

const NAMES = ['dice', 'card', 'shuffle', 'chips', 'drink', 'gun', 'shotgun', 'bow', 'swing', 'explosion', 'forstall', 'zap', 'lockClick', 'lockSnap', 'lockOpen', 'success', 'fail', 'chime'];
// name → clips of [file, start s, length s]
const CLIPS = {
  dice: [['dice', 0, 1.2]],
  shuffle: [['shuffle', 0.2, 1.05], ['shuffle', 2.2, 1.9], ['shuffle', 5.25, 1.3], ['shuffle', 7.6, 2.5]],
  card: [['deal', 1.1, 0.32], ['deal', 1.85, 0.32], ['deal', 3.0, 0.32], ['deal', 4.3, 0.32], ['deal', 5.3, 0.32], ['deal', 6.25, 0.32], ['deal', 7.1, 0.32], ['deal', 8.25, 0.32], ['deal', 9.25, 0.32], ['deal', 10.3, 0.32], ['deal', 11.25, 0.32], ['deal', 12.25, 0.32]],
  chips: [['chips', 0.05, 0.7], ['chips2', 0.05, 0.7]],
  drink: [['drink', 1.2, 4.8]],
  gun: [['pistol', 0, 0.89], ['pistol2', 0, 1.6], ['rifle', 0, 1.6]],
  shotgun: [['shotgun', 0.25, 2.6], ['shotgun2', 0, 2.8]],
};
const buffers = {}; // file → AudioBuffer (or a Promise while loading)
function loadClips() {
  for (const f of new Set(Object.values(CLIPS).flat().map((c) => c[0]))) {
    if (buffers[f]) continue;
    buffers[f] = fetch(`/sfx/${f}.mp3`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => { buffers[f] = buf; }).catch(() => { delete buffers[f]; });
  }
}
function playClip(name) {
  const list = CLIPS[name];
  if (!list || !ctx || ctx.state !== 'running') return false;
  const [f, start, len] = list[Math.floor(Math.random() * list.length)];
  const buf = buffers[f];
  if (!(buf instanceof AudioBuffer)) return false;
  const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime + 0.01;
  src.buffer = buf; src.connect(g); g.connect(master);
  g.gain.setValueAtTime(1, t); g.gain.setValueAtTime(1, t + Math.max(0, len - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + len); // no click at the cut
  src.start(t, start, len);
  return true;
}
let ctx = null, master = null, files = null;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
export const isMuted = () => store.get('wiw.muted', false);
export const volume = () => Math.max(0, Math.min(1, Number(store.get('wiw.volume', 0.7))));
export function setMuted(v) { store.set('wiw.muted', !!v); document.dispatchEvent(new CustomEvent('wiw:sound')); }
export function setVolume(v) { store.set('wiw.volume', Math.max(0, Math.min(1, Number(v)))); if (master) master.gain.value = volume(); document.dispatchEvent(new CustomEvent('wiw:sound')); }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume(); master.connect(ctx.destination);
    loadClips();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
// browsers only allow sound after a tap/click — wake the engine on the first one
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (!isMuted()) audio(); }, { once: true, capture: true }));
fetch('/sfx/manifest.json').then((r) => (r.ok ? r.json() : [])).then((l) => { files = new Set(Array.isArray(l) ? l : []); }).catch(() => { files = new Set(); });

// ---------- building blocks ----------
function noise(len) {
  const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
function env(t, a, peak, dur, curve = 'exp') {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur); else g.gain.linearRampToValueAtTime(0.0001, t + a + dur);
  g.connect(master); return g;
}
function filt(type, freq, q = 1) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
function burst(t, { len = 0.08, type = 'bandpass', freq = 3000, q = 1, peak = 0.5, a = 0.002 } = {}) {
  const n = noise(len + a), f = filt(type, freq, q), g = env(t, a, peak, len); n.connect(f); f.connect(g); n.start(t); n.stop(t + a + len + 0.02);
}
function tone(t, { freq = 440, to = null, type = 'sine', len = 0.2, peak = 0.3, a = 0.005 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
  const g = env(t, a, peak, len); o.connect(g); o.start(t); o.stop(t + a + len + 0.02);
}

// ---------- the sounds ----------
const SYNTH = {
  dice(t, n = 3) { // dice rattling in a cup, then clacking onto the table
    for (let i = 0; i < 7; i++) burst(t + i * 0.035, { len: 0.03, freq: 2400 + Math.random() * 1800, q: 4, peak: 0.25 });
    for (let i = 0; i < Math.min(8, n); i++) burst(t + 0.3 + i * 0.07 + Math.random() * 0.04, { len: 0.05, freq: 1400 + Math.random() * 900, q: 6, peak: 0.45 });
  },
  card(t) { burst(t, { len: 0.09, type: 'highpass', freq: 2500, q: 0.7, peak: 0.35, a: 0.01 }); burst(t + 0.05, { len: 0.03, freq: 5000, q: 2, peak: 0.15 }); },
  gun(t) { burst(t, { len: 0.28, type: 'lowpass', freq: 2200, q: 0.8, peak: 0.9, a: 0.001 }); tone(t, { freq: 140, to: 40, type: 'sine', len: 0.25, peak: 0.7 }); burst(t + 0.02, { len: 0.6, type: 'lowpass', freq: 600, peak: 0.25, a: 0.02 }); },
  bow(t) { tone(t, { freq: 220, to: 170, type: 'triangle', len: 0.35, peak: 0.35 }); burst(t + 0.02, { len: 0.25, type: 'bandpass', freq: 1800, q: 1.5, peak: 0.18, a: 0.03 }); },
  swing(t) { burst(t, { len: 0.22, type: 'bandpass', freq: 900, q: 1.2, peak: 0.35, a: 0.08 }); },
  explosion(t) { burst(t, { len: 1.6, type: 'lowpass', freq: 900, q: 0.7, peak: 1, a: 0.01 }); tone(t, { freq: 90, to: 25, type: 'sine', len: 1.2, peak: 0.9 }); burst(t + 0.05, { len: 0.4, type: 'highpass', freq: 3000, peak: 0.25 }); },
  forstall(t) { // the Kurtz hum spinning up
    const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), f = filt('lowpass', 1200, 4), g = env(t, 0.2, 0.22, 1.2, 'lin');
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(140, t + 1.2);
    l.frequency.value = 9; lg.gain.value = 12; l.connect(lg); lg.connect(o.frequency);
    o.connect(f); f.connect(g); o.start(t); l.start(t); o.stop(t + 1.45); l.stop(t + 1.45);
    tone(t + 0.9, { freq: 1600, to: 2400, type: 'sine', len: 0.25, peak: 0.08 });
  },
  zap(t) { for (let i = 0; i < 5; i++) tone(t + i * 0.05, { freq: 900 + Math.random() * 1400, to: 200, type: 'square', len: 0.06, peak: 0.12 }); burst(t, { len: 0.35, type: 'highpass', freq: 4000, peak: 0.25 }); },
  lockClick(t) { burst(t, { len: 0.025, freq: 3200, q: 8, peak: 0.5 }); burst(t + 0.04, { len: 0.02, freq: 2200, q: 8, peak: 0.3 }); },
  lockSnap(t) { burst(t, { len: 0.06, freq: 4200, q: 3, peak: 0.7 }); tone(t + 0.01, { freq: 2600, to: 900, type: 'triangle', len: 0.12, peak: 0.2 }); burst(t + 0.25, { len: 0.04, freq: 1600, q: 5, peak: 0.3 }); },
  lockOpen(t) { burst(t, { len: 0.04, freq: 1800, q: 6, peak: 0.5 }); burst(t + 0.12, { len: 0.12, type: 'lowpass', freq: 1200, peak: 0.6 }); tone(t + 0.14, { freq: 660, to: 990, type: 'triangle', len: 0.3, peak: 0.15 }); },
  success(t) { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, { freq: f, type: 'triangle', len: 0.3, peak: 0.18 })); },
  fail(t) { [392, 330, 262].forEach((f, i) => tone(t + i * 0.13, { freq: f, to: f * 0.97, type: 'sawtooth', len: 0.3, peak: 0.09 })); },
  chime(t) { tone(t, { freq: 1320, type: 'sine', len: 0.5, peak: 0.16 }); tone(t + 0.12, { freq: 1760, type: 'sine', len: 0.6, peak: 0.12 }); },
};

// play('dice', 4) — safe to call anywhere; silent when muted or before the first tap.
export function play(name, arg) {
  if (isMuted() || !NAMES.includes(name)) return;
  if (files?.has(name)) { const a = new Audio(`/sfx/${name}.mp3`); a.volume = volume(); a.play().catch(() => {}); return; }
  const c = audio();
  if (!c || c.state !== 'running') return;
  if (playClip(name)) return;
  try { (SYNTH[name] || SYNTH[FALLBACK[name]])?.(c.currentTime + 0.01, arg); } catch { /* never let a sound break the page */ }
}
// recorded sounds with no synth of their own use a close one until the file loads
const FALLBACK = { shuffle: 'card', chips: 'lockClick', shotgun: 'gun', drink: 'swing' };
// which attack sound fits a weapon
export const weaponSound = (w) => (/shotgun|scattergun/i.test(`${w?.type} ${w?.model}`) ? 'shotgun' : /bow/i.test(`${w?.type} ${w?.model}`) ? 'bow' : /melee|knife|axe|sword|club|fist|hatchet|machete/i.test(`${w?.type} ${w?.model}`) ? 'swing' : 'gun');
