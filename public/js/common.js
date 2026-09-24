import { ICONS } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- API ----------
let wardenPin = null;
export function setPin(p) { wardenPin = p; }
export const getPin = () => wardenPin;

export async function api(method, body, query = '', endpoint = '/api/scan') {
  const headers = { 'Content-Type': 'application/json' };
  if (wardenPin) headers['x-warden-pin'] = wardenPin;
  const r = await fetch(endpoint + query, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({ error: 'Bad response from server.' }));
  if (!r.ok) { const e = new Error(data.error || r.statusText); e.status = r.status; throw e; }
  return data;
}

// Poll for shared state; onState only fires when something changed.
export function startPolling(view, onState, onConn, endpoint = '/api/scan') {
  let v = null, timer = null, stopped = false;
  async function tick() {
    try {
      const q = `?view=${view}` + (v !== null ? `&since=${v}` : '');
      const data = await api('GET', null, q, endpoint);
      onConn?.(true);
      if (!data.unchanged) { v = data.v; onState(data); }
    } catch (e) {
      onConn?.(false, e);
      if (e.status === 401) { stopped = true; return; }
    }
    if (!stopped) timer = setTimeout(tick, document.hidden ? 6000 : 2000);
  }
  tick();
  return {
    push(data) { v = data.v; onState(data); },
    now() { clearTimeout(timer); tick(); },
    stop() { stopped = true; clearTimeout(timer); },
  };
}

// ---------- bullet dice ----------
// Shared gradients live in one hidden sprite so each die is a light <svg>.
export function injectDefs() {
  if (document.getElementById('bullet-defs')) return;
  const div = document.createElement('div');
  div.innerHTML = `<svg id="bullet-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="caseB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5451"/><stop offset=".28" stop-color="#2d2927"/><stop offset=".7" stop-color="#121010"/><stop offset="1" stop-color="#2a2624"/></linearGradient>
    <linearGradient id="caseG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe6a6"/><stop offset=".3" stop-color="#d9ad52"/><stop offset=".72" stop-color="#94651f"/><stop offset="1" stop-color="#b8883a"/></linearGradient>
    <linearGradient id="tipB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ced2"/><stop offset=".35" stop-color="#8b9196"/><stop offset="1" stop-color="#4a4e52"/></linearGradient>
    <linearGradient id="tipG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3b184"/><stop offset=".35" stop-color="#c8743f"/><stop offset="1" stop-color="#7a3d19"/></linearGradient>
    <linearGradient id="rimB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4543"/><stop offset="1" stop-color="#0d0b0b"/></linearGradient>
    <linearGradient id="rimG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6c880"/><stop offset="1" stop-color="#7a5518"/></linearGradient>
  </defs></svg>`;
  document.body.appendChild(div.firstChild);
}

// color: 'B' | 'G'; face: 'hit' | 'ace' | 'spur' | 'blank' | null (no symbol, e.g. an icon)
export function bulletSVG(color, face, { title } = {}) {
  const sym = color === 'B' ? '#f1e7d2' : '#2a1b0c';
  const icon = face && ICONS[face]
    ? `<svg x="47" y="11" width="38" height="38" viewBox="0 0 100 100"><path fill="${sym}" d="${ICONS[face]}"/></svg>`
    : '';
  return `<svg class="bullet" viewBox="0 0 180 60" role="img" aria-label="${esc(title || `${color === 'B' ? 'Black' : 'Gold'} die${face ? ': ' + face : ''}`)}">
    <rect x="3" y="6" width="11" height="48" rx="2" fill="url(#rim${color})"/>
    <rect x="14" y="11" width="5" height="38" fill="url(#rim${color})" opacity=".85"/>
    <rect x="19" y="7" width="98" height="46" rx="3" fill="url(#case${color})"/>
    <path d="M117 9 C143 9 166 19 177 30 C166 41 143 51 117 51 Z" fill="url(#tip${color})"/>
    <rect x="21" y="11" width="94" height="4" rx="2" fill="#fff" opacity="${color === 'B' ? .12 : .35}"/>
    <line x1="117" y1="8" x2="117" y2="52" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
    ${icon}
  </svg>`;
}

export const FACE_LABEL = { hit: 'Hit', ace: 'Ace (2 Hits)', spur: 'Spur', blank: 'Blank' };
const FACES = { B: ['blank', 'blank', 'spur', 'hit', 'hit', 'ace'], G: ['blank', 'spur', 'hit', 'hit', 'hit', 'ace'] };

// Animate a finished roll into the tray. Returns a promise that resolves when dice settle.
export function animateRoll(tray, dice) {
  tray.innerHTML = '';
  const settle = [];
  dice.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'die rolling';
    el.style.animationDelay = `${i * 70}ms`;
    tray.appendChild(el);
    const flicker = [...Array(6 + i)].map(() => FACES[d.color][Math.floor(Math.random() * 6)]);
    const seq = [...flicker, ...d.faces];
    settle.push(new Promise((res) => {
      let k = 0;
      const step = () => {
        const face = seq[k];
        const spursSoFar = Math.max(0, k - flicker.length);
        el.innerHTML = bulletSVG(d.color, face) + (spursSoFar ? `<span class="rr">SPUR ↻${spursSoFar > 1 ? '×' + spursSoFar : ''}</span>` : '');
        el.title = FACE_LABEL[face];
        if (++k < seq.length) setTimeout(step, k < flicker.length ? 60 : 380);
        else { el.classList.toggle('miss', face === 'blank' || face === 'spur'); res(); }
      };
      setTimeout(step, i * 70);
    }));
  });
  return Promise.all(settle);
}

export function staticDice(tray, dice) {
  tray.innerHTML = dice.map((d) => {
    const rr = d.faces.length - 1;
    return `<div class="die${d.face === 'blank' || d.face === 'spur' ? ' miss' : ''}" title="${FACE_LABEL[d.face]}">${bulletSVG(d.color, d.face)}${rr ? `<span class="rr">SPUR ↻${rr > 1 ? '×' + rr : ''}</span>` : ''}</div>`;
  }).join('');
}

// ---------- frequency display bits ----------
export function readoutHTML(positional, cls = '') {
  const s = (i) => `<span class="slot${positional[i] === null ? ' unknown' : ''}">${positional[i] === null ? '?' : positional[i]}</span>`;
  return `<div class="readout ${cls}">${s(0)}<span class="dash">-</span>${s(1)}<span class="dash">-</span>${s(2)}${s(3)}${s(4)}${s(5)}</div>`;
}

export function diamondsHTML(digits, result = [], extra = () => '') {
  const d = (i) => `<div class="dia ${result[i] || ''}${extra(i)}"><span>${digits[i] ?? ''}</span></div>`;
  return `<div class="diamonds">${d(0)}<div class="gap"></div>${d(1)}<div class="gap"></div>${d(2)}${d(3)}${d(4)}${d(5)}</div>`;
}

export function chipsHTML(digits, newOnes = []) {
  const pending = [...newOnes];
  return `<span class="chips">${digits.map((x) => {
    const i = pending.indexOf(x);
    if (i >= 0) pending.splice(i, 1);
    return `<span class="chip${i >= 0 ? ' new' : ''}">${x}</span>`;
  }).join('')}</span>`;
}

export const WAVE_SVG = `<svg class="wave" viewBox="0 0 400 34" preserveAspectRatio="none" aria-hidden="true"><path d="${
  Array.from({ length: 61 }, (_, i) => `${i ? 'L' : 'M'}${i * 8} ${17 + Math.sin(i * 0.8) * 11 * Math.sin(i * 0.13 + 1)}`).join(' ')
}"/></svg>`;

// ---------- toast ----------
let toastTimer;
export function toast(msg, err = false) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}

// ---------- site nav ----------
const NAV = [
  ['/', 'Forstall Scanner'],
  ['/combat', 'Combat & Dice'],
  ['/posse', 'Posse Sheets'],
  ['/names', 'NPC Names'],
  ['/map', 'Map'],
];
export function mountNav(active) {
  const el = document.querySelector('[data-nav]');
  if (!el) return;
  el.innerHTML = `<div class="sitenav-inner">${NAV.map(([href, label]) =>
    `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div>`;
}

// ---------- Warden PIN (shared across pages) ----------
export async function tryWarden(pin, endpoint) {
  setPin(pin);
  try { await api('POST', { action: 'auth' }, '', endpoint); pinStore.set(pin); markWarden(true); return true; }
  catch { setPin(null); markWarden(false); return false; }
}
export function forgetWarden() { setPin(null); pinStore.set(null); markWarden(false); }
export const savedPin = () => pinStore.get();

// The PIN lives only for this browser tab, so a shared or player device drops back to
// player view when the tab closes. (Older versions kept it forever — clear that.)
const pinStore = {
  get() { try { return sessionStorage.getItem('wiw.pin'); } catch { return null; } },
  set(v) { try { if (v) sessionStorage.setItem('wiw.pin', v); else sessionStorage.removeItem('wiw.pin'); } catch {} },
};
try { localStorage.removeItem('wiw.pin'); } catch {}

// A strip under the nav so it's always obvious you're looking at the Warden's view.
export function markWarden(on) {
  let bar = document.querySelector('.warden-strip');
  if (on && !bar) {
    bar = document.createElement('div');
    bar.className = 'warden-strip';
    bar.innerHTML = '⭐ WARDEN MODE — players don’t see the Warden tools <button type="button">Switch to player view</button>';
    bar.querySelector('button').addEventListener('click', () => { forgetWarden(); location.reload(); });
    (document.querySelector('.sitenav') || document.body.firstElementChild).after(bar);
  } else if (!on && bar) bar.remove();
}

// ---------- dice-pool inputs: two numbers, never typed letters ----------
export function parsePoolStr(s) {
  const out = { B: 0, G: 0 };
  for (const [, n, c] of String(s || '').toUpperCase().matchAll(/(\d+)\s*([BG])/g)) out[c] += Number(n);
  return out;
}
export const composePool = (b, g) => `${b > 0 ? b + 'B' : ''}${g > 0 ? g + 'G' : ''}`;
export function poolHTML(attrs = '', label = '') {
  const one = (c, name) => `<label class="dp-${c.toLowerCase()}" title="${name} dice"><span class="dp-chip ${c.toLowerCase()}" aria-hidden="true">${c}</span><input type="number" min="0" max="12" step="1" inputmode="numeric" data-c="${c}" placeholder="0" aria-label="${label ? label + ' — ' : ''}${name} dice"></label>`;
  return `<span class="dp" ${attrs}>${one('B', 'Black')}${one('G', 'Gold')}</span>`;
}
export function readPool(dp) {
  const n = (c) => Math.max(0, Math.min(12, Math.round(Number(dp.querySelector(`[data-c="${c}"]`).value) || 0)));
  return composePool(n('B'), n('G'));
}
export function fillPool(dp, value) {
  if (dp.contains(document.activeElement)) return;
  const p = parsePoolStr(value);
  dp.querySelector('[data-c="B"]').value = p.B || '';
  dp.querySelector('[data-c="G"]').value = p.G || '';
}

// PIN prompt shared by pages that unlock Warden tools in place.
export function wardenModal(endpoint) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-label="Warden PIN"><h2>Warden PIN</h2>
      <form><input type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" aria-label="PIN"><button class="btn" type="submit">Unlock</button></form>
      <p class="muted" data-msg></p></div>`;
    document.body.appendChild(back);
    const input = back.querySelector('input');
    input.focus();
    const close = (ok) => { back.remove(); resolve(ok); };
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    back.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await tryWarden(input.value.trim(), endpoint)) close(true);
      else back.querySelector('[data-msg]').textContent = 'Wrong PIN, partner.';
    });
  });
}
