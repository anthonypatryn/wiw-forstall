// The carnival booths, animated (like the saloon games): after the server rolls, the booth plays out what happened —
// the wheel spins to its slice, the puck climbs the High Striker, horseshoes arc at the spike, arrows thunk into the
// target, the crystal ball swirls, pies go down, the greased pig squirts away. Sounds come from sound.js.
import { esc } from './common.js';
import { play } from './sound.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const motionOff = () => document.documentElement.classList.contains('less-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = (ms) => (motionOff() ? Math.min(ms, 120) : ms);

// ---------- Wheel of Fortune: most of the wheel loses, the prizes are thin slices (p. 64) ----------
const SLICES = [['lose', 42], ['x2', 25], ['lose', 42], ['x3', 15], ['lose', 42], ['x2', 25], ['lose', 42], ['x4', 7], ['lose', 41], ['x2', 25], ['lose', 39], ['x3', 15]];
const SLICE_LABEL = { lose: 'LOSE', x2: '×2', x3: '×3', x4: '×4' };
const SLICE_FILL = { lose: 'var(--cv-lose)', x2: 'var(--cv-two)', x3: 'var(--cv-three)', x4: 'var(--cv-four)' };
function wheelSVG() {
  let a = 0;
  const pt = (deg, r) => [150 + r * Math.sin(deg * Math.PI / 180), 150 - r * Math.cos(deg * Math.PI / 180)];
  const paths = SLICES.map(([k, w]) => {
    const [x1, y1] = pt(a, 140), [x2, y2] = pt(a + w, 140), [tx, ty] = pt(a + w / 2, 104);
    const mid = a + w / 2;
    const out = `<path d="M150 150 L${x1} ${y1} A140 140 0 0 1 ${x2} ${y2} Z" fill="${SLICE_FILL[k]}" stroke="var(--cv-rim)" stroke-width="2"/>
      <text x="${tx}" y="${ty}" transform="rotate(${mid} ${tx} ${ty})" text-anchor="middle" dominant-baseline="middle" class="cv-wtext${w < 12 ? ' tiny' : ''}">${SLICE_LABEL[k]}</text>`;
    a += w;
    return out;
  }).join('');
  return `<svg viewBox="0 0 300 300" class="cv-wheel-svg" aria-hidden="true"><g class="cv-wheel-rot">${paths}<circle cx="150" cy="150" r="18" fill="var(--cv-rim)"/></g><circle cx="150" cy="150" r="143" fill="none" stroke="var(--cv-rim)" stroke-width="6"/></svg>`;
}
async function wheel(el, r) {
  el.innerHTML = `<div class="cv-wheel"><div class="cv-pointer"></div>${wheelSVG()}</div>`;
  const want = r.mult ? `x${r.mult}` : 'lose';
  const spots = []; let a = 0;
  SLICES.forEach(([k, w]) => { if (k === want) spots.push(a + w / 2 + (Math.random() - 0.5) * w * 0.6); a += w; });
  const land = spots[Math.floor(Math.random() * spots.length)];
  const spin = 360 * 6 + (360 - land);
  const g = el.querySelector('.cv-wheel-rot');
  const dur = T(4200);
  g.style.transition = `transform ${dur}ms cubic-bezier(.12,.72,.14,1)`;
  requestAnimationFrame(() => { g.style.transform = `rotate(${spin}deg)`; });
  // ticks that slow down with the wheel
  let t = 0, gap = 45;
  while (t < dur - 150) { play('lockClick'); await wait(gap); t += gap; gap *= 1.07; }
  await wait(Math.max(0, dur - t));
  play(r.mult ? 'success' : 'fail');
}

// ---------- High Striker: the puck climbs by Hits, 5 rings the bell ----------
async function striker(el, r) {
  const top = Math.min(r.hits, 5) / 5;
  el.innerHTML = `<div class="cv-striker"><div class="cv-bell">DING</div><div class="cv-tower">${[5, 4, 3, 2, 1].map((n) => `<span>${n}</span>`).join('')}<div class="cv-puck"></div></div>
    <div class="cv-base"></div><div class="cv-mallet"></div></div>`;
  const puck = el.querySelector('.cv-puck'), mallet = el.querySelector('.cv-mallet'), bell = el.querySelector('.cv-bell');
  await wait(T(300));
  mallet.classList.add('swing'); play('swing');
  await wait(T(380));
  play('lockSnap');
  puck.style.transition = `bottom ${T(700)}ms cubic-bezier(.2,.9,.3,1)`;
  puck.style.bottom = `${top * 88}%`;
  await wait(T(760));
  if (r.hits >= 5) { bell.classList.add('ring'); play('chime'); await wait(T(500)); play('success'); }
  else { puck.style.transition = `bottom ${T(600)}ms cubic-bezier(.6,0,.9,.4)`; puck.style.bottom = '0%'; await wait(T(620)); play('fail'); }
}

// ---------- Horseshoe Toss: three arcs at the spike; a ringer lands on it ----------
async function horseshoe(el, r) {
  el.innerHTML = `<div class="cv-pitch"><div class="cv-spike"></div>${r.tosses.map((t, i) => `<div class="cv-shoe-x" data-i="${i}"><div class="cv-shoe-y"><div class="cv-shoe"></div></div></div>`).join('')}
    <div class="cv-toss-notes">${r.tosses.map((t, i) => `<span data-note="${i}">Toss ${i + 1}: needs ${t.target}</span>`).join('')}</div></div>`;
  for (const [i, t] of r.tosses.entries()) {
    const ringer = t.hits >= t.target;
    const x = el.querySelector(`[data-i="${i}"]`);
    x.style.setProperty('--land', ringer ? '0px' : `${(i % 2 ? 1 : -1) * (30 + Math.random() * 40)}px`);
    x.classList.add('go', ringer ? 'ringer' : 'miss');
    play('swing');
    await wait(T(900));
    play(ringer ? 'lockOpen' : 'lockClick');
    const n = el.querySelector(`[data-note="${i}"]`);
    n.textContent = `Toss ${i + 1}: ${t.hits} Hit${t.hits === 1 ? '' : 's'} ${ringer ? '· RINGER' : '· miss'}`;
    n.classList.add(ringer ? 'ok' : 'no');
    await wait(T(350));
  }
  play(r.tosses.every((t) => t.hits >= t.target) ? 'success' : 'fail');
}

// ---------- Archery: every shot lands closer to the bullseye the more Hits it has (3B: up to 6) ----------
async function archery(el, r) {
  el.innerHTML = `<div class="cv-range"><div class="cv-target">${[1, 2, 3, 4, 5].map((n) => `<i class="ring r${n}"></i>`).join('')}</div>
    <div class="cv-score"><span>You <b data-me>0</b></span><span>Big Hal <b data-them>0</b></span></div></div>`;
  const target = el.querySelector('.cv-target');
  let me = 0, them = 0;
  const shoot = async (hits, mine) => {
    const rad = (1 - Math.min(hits, 6) / 6) * 46 + Math.random() * 4, ang = Math.random() * Math.PI * 2;
    const a = document.createElement('i');
    a.className = `cv-arrow${mine ? ' mine' : ''}`;
    a.style.left = `${50 + rad * Math.cos(ang)}%`; a.style.top = `${50 + rad * Math.sin(ang)}%`;
    target.append(a);
    play('bow');
    await wait(T(260));
    a.classList.add('hit'); play('lockClick');
  };
  for (const s of r.shots) {
    await shoot(s.me, true); me += s.me; el.querySelector('[data-me]').textContent = me;
    await wait(T(260));
    await shoot(s.carnie, false); them += s.carnie; el.querySelector('[data-them]').textContent = them;
    await wait(T(300));
  }
  play(r.me > r.carnie ? 'success' : 'fail');
}

// ---------- Fortune Teller: a crystal ball clouds over, glows, and speaks ----------
async function fortune(el, r) {
  el.innerHTML = `<div class="cv-fortune ${r.good ? 'good' : 'bad'}"><div class="cv-candles"><i></i><i></i></div>
    <div class="cv-ball"><div class="mist m1"></div><div class="mist m2"></div><div class="mist m3"></div><div class="shine"></div></div><div class="cv-stand"></div>
    <p class="cv-words"></p></div>`;
  play('forstall');
  await wait(T(1600));
  el.querySelector('.cv-fortune').classList.add('lit');
  play('chime');
  const words = el.querySelector('.cv-words');
  const text = r.text;
  if (motionOff()) { words.textContent = text; return; }
  for (let i = 1; i <= text.length; i += 2) { words.textContent = text.slice(0, i); await wait(22); }
  words.textContent = text;
  await wait(300);
  play(r.good ? 'success' : 'fail');
}

// ---------- Pie Eating Contest: a pie each, bites each round, and who drops out ----------
async function pie(el, r) {
  el.innerHTML = `<div class="cv-pies">${r.eaters.map((n, i) => `<div class="cv-eater${i === 0 ? ' me' : ''}" data-e="${esc(n)}"><div class="cv-pie"><i></i></div><b>${esc(i === 0 ? 'You' : n)}</b><small></small></div>`).join('')}</div>
    <p class="cv-round"></p>`;
  const bites = {};
  for (const [ri, round] of r.rounds.entries()) {
    el.querySelector('.cv-round').textContent = `Round ${ri + 1}: needs ${round.target} Hits`;
    await wait(T(500));
    for (const [who, hits] of Object.entries(round.hits)) {
      const e = el.querySelector(`[data-e="${CSS.escape(who)}"]`);
      e.querySelector('small').textContent = `${hits} Hit${hits === 1 ? '' : 's'}`;
      if (round.ok.includes(who)) { bites[who] = (bites[who] || 0) + 1; e.querySelector('.cv-pie i').style.setProperty('--eaten', `${Math.min(92, bites[who] * 22)}%`); play('lockClick'); }
      else { e.classList.add('out'); play('fail'); }
      await wait(T(380));
    }
    await wait(T(300));
  }
  r.left.forEach((who) => el.querySelector(`[data-e="${CSS.escape(who)}"]`)?.classList.add('won'));
  play(r.left.includes(r.eaters[0]) ? 'success' : 'fail');
}

// ---------- Greased Pig Chase: the pig zigzags, you lunge; 3 Hits and you hold on ----------
const PIG = `<svg viewBox="0 0 120 80" class="cv-pig-svg" aria-hidden="true"><ellipse cx="58" cy="44" rx="40" ry="24" fill="var(--cv-pig)"/><circle cx="96" cy="36" r="16" fill="var(--cv-pig)"/>
  <ellipse cx="108" cy="40" rx="7" ry="5.5" fill="var(--cv-snout)"/><circle cx="106" cy="39" r="1.3" fill="#5a2a30"/><circle cx="110" cy="39" r="1.3" fill="#5a2a30"/><circle cx="98" cy="30" r="2" fill="#2a1418"/>
  <path d="M88 22 l6 -10 l5 12 z" fill="var(--cv-snout)"/><path d="M20 40 q-10 -8 -6 -14 q6 -2 4 6" fill="none" stroke="var(--cv-snout)" stroke-width="3"/>
  <rect x="30" y="62" width="8" height="14" rx="3" fill="var(--cv-snout)"/><rect x="72" y="62" width="8" height="14" rx="3" fill="var(--cv-snout)"/>
  <path d="M34 34 q10 -6 22 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/></svg>`;
async function pig(el, r) {
  el.innerHTML = `<div class="cv-pen"><div class="cv-pig">${PIG}</div><div class="cv-hands"></div><p class="cv-grab-note"></p></div>`;
  const p = el.querySelector('.cv-pig'), hands = el.querySelector('.cv-hands'), note = el.querySelector('.cv-grab-note');
  const spots = [[12, 30], [70, 18], [30, 62], [78, 60], [48, 40]];
  for (const [i, hits] of r.grabs.entries()) {
    for (let k = 0; k < 2; k += 1) { const [x, y] = spots[(i * 2 + k) % spots.length]; p.style.left = `${x}%`; p.style.top = `${y}%`; p.classList.toggle('flip', k % 2 === 0); play('swing'); await wait(T(520)); }
    hands.style.left = p.style.left; hands.style.top = p.style.top;
    hands.classList.remove('lunge'); void hands.offsetWidth; hands.classList.add('lunge');
    await wait(T(420));
    const caught = hits >= 3;
    note.textContent = `Grab ${i + 1}: ${hits} Hit${hits === 1 ? '' : 's'} ${caught ? '· GOT IT' : '· it squirts free'}`;
    if (caught) { p.classList.add('caught'); play('success'); break; }
    p.classList.add('slip'); play('zap'); await wait(T(400)); p.classList.remove('slip');
  }
  if (!r.caught) play('fail');
}

const SHOWS = { wheel, striker, horseshoe, archery, fortune, pie, pig };
export const hasShow = (game) => !!SHOWS[game];
// play one booth's show in `el`, then show the outcome with a button back to the midway
export async function runShow(el, game, result) {
  el.hidden = false;
  el.innerHTML = '';
  const stage = document.createElement('div'); stage.className = 'cv-stage';
  const cap = document.createElement('div'); cap.className = 'cv-cap';
  el.append(stage, cap);
  try { await SHOWS[game](stage, result); } catch { /* never let an animation block the game */ }
  cap.innerHTML = `<p>${esc(result.text)}</p><button type="button" class="btn" data-cv-back>Back to the midway</button>`;
  await new Promise((res) => cap.querySelector('[data-cv-back]').addEventListener('click', res, { once: true }));
  el.hidden = true; el.innerHTML = '';
}
