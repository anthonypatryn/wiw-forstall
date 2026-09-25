import { ICONS } from './icons.js';
import { gl } from './glyphs.js';

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

// Pop-up dice tray for rolls made away from a page's own tray (e.g. character sheets).
// Uses the same tumble animation as the Combat page; only the person who rolled sees it.
let popTimer;
// Bleeding Out panel (p. 54) for a character; buttons carry data-bleed-roll / data-op.
export function bleedPanel(p, skillsMeta) {
  if (!p.bleeding || p.dead) return '';
  const used = p.bleeding.skills;
  const left = skillsMeta.filter((s) => !used.includes(s));
  return `<div class="bleed-panel" role="alert"><b class="bp-title">${gl('drop')} BLEEDING OUT</b>
    <p>At the end of each ally’s turn, roll a Skill you haven’t used yet. Get at least <b>1 Hit</b> to hang on. No Hit, or no Skills left, and it’s over. Only an ally’s First Aid can save you.</p>
    <div class="bp-skills">${skillsMeta.map((s) => {
      const pool = (p.skills[s.toLowerCase()] || '').toUpperCase() || '—';
      return used.includes(s) ? `<span class="bp-used">✓ ${s}</span>`
        : `<button type="button" class="btn small" data-bleed-roll="${s}">${gl('die')} ${s} <small>${pool}</small></button>`;
    }).join('')}</div>
    ${left.length ? `<p class="muted">${left.length} Skill${left.length > 1 ? 's' : ''} left.</p>` : '<p class="bp-last"><b>No Skills left.</b> Without First Aid, they die at the end of the next ally’s turn.</p>'}
    <div class="bp-actions"><button type="button" class="btn small" data-op="stabilize">✚ Saved by First Aid</button><button type="button" class="btn small secondary danger" data-op="die">Didn’t make it</button></div></div>`;
}

export async function rollPopup(r, title = '') {
  let box = document.querySelector('.roll-pop');
  if (!box) {
    box = document.createElement('div');
    box.className = 'roll-pop';
    box.setAttribute('role', 'status');
    box.innerHTML = '<button type="button" class="rp-x" aria-label="Close">×</button><div class="rp-title"></div><div class="tray rp-tray"></div><div class="rp-tally"></div>';
    document.body.appendChild(box);
    const close = () => { box.classList.remove('show'); clearTimeout(popTimer); };
    box.querySelector('.rp-x').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }
  clearTimeout(popTimer);
  box.querySelector('.rp-title').textContent = title;
  box.querySelector('.rp-tally').innerHTML = '';
  box.classList.add('show');
  await animateRoll(box.querySelector('.rp-tray'), r.dice);
  box.querySelector('.rp-tally').innerHTML = `<span class="hits">${r.hits} HIT${r.hits === 1 ? '' : 'S'}</span>${r.aces ? `<span class="muted">${r.aces} Ace${r.aces > 1 ? 's' : ''}</span>` : ''}${r.spur ? '<span class="muted">Spurs rerolled</span>' : ''}`;
  popTimer = setTimeout(() => box.classList.remove('show'), 5000);
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
  ['/posse', 'Posse Sheets'],
  ['/names', 'NPCs'],
  ['/map', 'Map'],
  ['/battle', 'Battle Map'],
  ['/store', 'Store'],
  ['/howto', 'How to Play'],
];
export function mountNav(active) {
  const el = document.querySelector('[data-nav]');
  if (!el) return;
  // the Warden's Session page only shows up in the nav for the Warden
  // Warden mode sticks until "Switch to player view": the scanner link goes to the Warden's scanner
  const on = !!pinStore.get();
  // the Warden's home is Run the Game (first in the nav)
  const items = on ? [['/run', `${gl('star')} Run the Game`], ...NAV.map(([h, l]) => [h === '/' ? '/warden' : h, l]), ['/combat', `${gl('star')} Combat Control`]] : NAV;
  const cur = active === '/warden' ? (on ? '/warden' : '/') : active === '/' && on ? '/warden' : active;
  el.innerHTML = `<div class="sitenav-inner">${items.map(([href, label]) =>
    `<a href="${href}"${href === cur ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div>`;
  // static pages mark icons as <span data-gl="name"> — draw them
  document.querySelectorAll('[data-gl]').forEach((s) => { s.outerHTML = gl(s.dataset.gl); });
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
// Everything waiting on the Warden (store requests, open rolls, enemy turns…), refreshed every few seconds.
let needsTimer = null;
function pollNeeds(bar) {
  const btn = bar.querySelector('.needs-btn'), list = bar.querySelector('.needs-list');
  const tick = async () => {
    if (!document.body.contains(bar) || document.hidden) return;
    try {
      const n = await api('GET', null, '?view=needs', '/api/combat');
      btn.innerHTML = `Needs you <b class="${n.count ? 'hot' : ''}">${n.count}</b>`;
      list.innerHTML = `${n.items.length ? n.items.map((x) => `<a class="${x.urgent ? 'urgent' : ''}" href="${esc(x.href)}">${esc(x.text)}</a>`).join('') : '<span class="muted">All quiet — nothing waiting on you.</span>'}
        <div class="needs-links"><a href="/run"><b>Run the Game</b></a><a href="/combat">Combat Control</a><a href="/battle">Battle Map</a><a href="/store">Store</a><a href="/names">NPCs</a></div>`;
    } catch { /* offline for a moment */ }
  };
  clearInterval(needsTimer);
  setTimeout(tick, 400); setTimeout(tick, 1500); // the page sets the PIN a moment after the strip appears
  needsTimer = setInterval(tick, 6000);
}
export function markWarden(on) {
  let bar = document.querySelector('.warden-strip');
  const inner = document.querySelector('.sitenav-inner');
  if (inner && on && !inner.querySelector('a[href="/run"]')) {
    inner.insertAdjacentHTML('afterbegin', `<a href="/run"${location.pathname.startsWith('/run') ? ' aria-current="page"' : ''}>${gl('star')} Run the Game</a>`);
    inner.insertAdjacentHTML('beforeend', `<a href="/combat">${gl('star')} Combat Control</a>`);
  }
  if (inner && !on) { ['/session', '/combat', '/run'].forEach((h) => inner.querySelector(`a[href="${h}"]`)?.remove()); }
  const scan = inner?.querySelector('a[href="/"], a[href="/warden"]');
  if (scan) scan.setAttribute('href', on ? '/warden' : '/');
  if (on && !bar) {
    bar = document.createElement('div');
    bar.className = 'warden-strip';
    bar.innerHTML = gl('star') + ' WARDEN MODE <button type="button" class="needs-btn" aria-expanded="false">Needs you <b>·</b></button><button type="button" data-player>Switch to player view</button><div class="needs-list" hidden></div>';
    bar.querySelector('[data-player]').addEventListener('click', () => { forgetWarden(); if (location.pathname.startsWith('/warden')) location.href = '/'; else location.reload(); });
    const btn = bar.querySelector('.needs-btn'), list = bar.querySelector('.needs-list');
    btn.addEventListener('click', () => { list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden)); });
    (document.querySelector('.sitenav') || document.body.firstElementChild).after(bar);
    pollNeeds(bar);
  } else if (!on && bar) { clearInterval(needsTimer); bar.remove(); }
}

// ---------- dice-pool inputs: two numbers, never typed letters ----------
export function parsePoolStr(s) {
  const out = { B: 0, G: 0 };
  for (const [, n, c] of String(s || '').toUpperCase().matchAll(/(\d+)\s*([BG])/g)) out[c] += Number(n);
  return out;
}
export const composePool = (b, g) => `${b > 0 ? b + 'B' : ''}${g > 0 ? g + 'G' : ''}`;
export function poolHTML(attrs = '', label = '') {
  const one = (c, name) => `<label class="dp-${c.toLowerCase()}" title="${name} dice"><span class="dp-chip" aria-hidden="true">${miniBullet(c)}</span><input type="number" min="0" max="12" step="1" inputmode="numeric" data-c="${c}" placeholder="0" aria-label="${label ? label + ' — ' : ''}${name} dice"></label>`;
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

// ---------- styled dialogs (instead of the browser's confirm / prompt) ----------
// A short leading question becomes the heading; the rest is the body.
function splitMsg(msg) {
  const s = String(msg), i = s.indexOf('?');
  const para = s.indexOf('\n\n'); // a short first paragraph without a question is a heading ("No room on the sheet", then the details)
  if (para > 0 && para < 80 && !s.slice(0, para).includes('?')) return [s.slice(0, para), s.slice(para + 2).trim()];
  if (i > -1 && i < 80) return [s.slice(0, i + 1), s.slice(i + 1).trim()];
  return ['Are you sure?', s];
}
const DANGER = /delete|remove|wipe|clear|dead|can.t be undone|call off|end combat|let the prepared/i;
function dialog({ msg, input = null, ok = 'Yes', cancel = 'Cancel', danger }) {
  return new Promise((resolve) => {
    const [title, body] = input ? [String(msg), ''] : splitMsg(msg);
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    back.innerHTML = `<div class="modal ask" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>${body ? `<p class="ask-body">${esc(body)}</p>` : ''}
      <form>${input ? `<input class="ask-input" type="text" value="${esc(input.value ?? '')}" maxlength="80" aria-label="${esc(title)}">` : ''}
        <div class="ask-btns">${cancel ? `<button type="button" class="btn secondary" data-no>${esc(cancel)}</button>` : ''}<button type="submit" class="btn${(danger ?? DANGER.test(msg)) ? ' danger' : ''}">${esc(ok)}</button></div></form></div>`;
    document.body.appendChild(back);
    const prev = document.activeElement;
    const field = back.querySelector('.ask-input');
    (field || back.querySelector('[type=submit]')).focus();
    field?.select();
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey, true); prev?.focus?.(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(input ? null : false); } };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('click', (e) => { if (e.target === back) close(input ? null : false); });
    back.querySelector('[data-no]')?.addEventListener('click', () => close(input ? null : false));
    back.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); close(input ? field.value : true); });
  });
}
// await ask('Delete this?') → true / false
export const ask = (msg, opts = {}) => dialog({ msg, ...opts });
// Start combat: tap who's actually in this fight. Resolves { posse: [ids], enemies: [ids] } or null.
export function pickFighters(combat) {
  const posse = (combat?.posse || []).filter((p) => !p.dead), foes = (combat?.enemies || []).filter((e) => !e.defeated);
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    const row = (x, kind, sub) => `<label class="fight-pick"><input type="checkbox" data-${kind}="${esc(x.id)}" checked><span><b>${esc(x.name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
    back.innerHTML = `<div class="modal ask fight-ask" role="dialog" aria-modal="true" aria-label="Who's in this fight?">
      <h2>Who’s in this fight?</h2>
      <p class="ask-body">Untick anyone who isn’t here. You can bring people in (or out) once it’s going.</p>
      <div class="fight-cols">
        <div><div class="fight-h">THE POSSE <button type="button" data-all="pc">all</button><button type="button" data-none="pc">none</button></div>${posse.map((p) => row(p, 'pc', p.trade)).join('') || '<p class="muted">No characters.</p>'}</div>
        <div><div class="fight-h">ENEMIES <button type="button" data-all="en">all</button><button type="button" data-none="en">none</button></div>${foes.map((e) => row(e, 'en', e.size)).join('') || '<p class="muted">No enemies yet — add them in Combat Control.</p>'}</div>
      </div>
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>Start combat</button></div></div>`;
    document.body.append(back);
    const close = (v) => { back.remove(); resolve(v); };
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    back.querySelector('[data-no]').addEventListener('click', () => close(null));
    back.querySelectorAll('[data-all], [data-none]').forEach((b) => b.addEventListener('click', () => {
      back.querySelectorAll(`[data-${b.dataset.all || b.dataset.none}]`).forEach((c) => { c.checked = !!b.dataset.all; });
    }));
    back.querySelector('[data-go]').addEventListener('click', () => {
      const ids = (k) => [...back.querySelectorAll(`[data-${k}]:checked`)].map((c) => c.dataset[k]);
      const r = { posse: ids('pc'), enemies: ids('en') };
      if (!r.posse.length && !r.enemies.length) { toast('Pick at least one fighter.', true); return; }
      close(r);
    });
  });
}
// await tell('Heads up…') — a notice with just an OK button
export const tell = (msg, opts = {}) => dialog({ msg, ok: 'OK', cancel: null, danger: false, ...opts });
// await askText('Name this place:', 'default') → the text, or null if cancelled
export const askText = (msg, value = '', opts = {}) => dialog({ msg, input: { value }, ok: 'OK', danger: false, ...opts });

// ---------- tiny bullet icons (Black / Gold dice) ----------
export const miniBullet = (c) => `<svg class="mini-bullet" viewBox="0 0 180 60" aria-hidden="true">
  <rect x="3" y="6" width="11" height="48" rx="2" fill="url(#rim${c})"/><rect x="19" y="7" width="98" height="46" rx="3" fill="url(#case${c})"/>
  <path d="M117 9 C143 9 166 19 177 30 C166 41 143 51 117 51 Z" fill="url(#tip${c})"/></svg>`;
// "2B1G" -> 2 ▸black 1 ▸gold
export function poolIcons(pool) {
  const m = String(pool || '').toUpperCase().match(/^(?:(\d+)B)?(?:(\d+)G)?$/);
  if (!pool || !m || (!m[1] && !m[2])) return esc(pool || '—');
  return `<span class="pool-icons" title="${esc(pool)}">${m[1] ? `<b>${m[1]}</b>${miniBullet('B')}` : ''}${m[2] ? `<b>${m[2]}</b>${miniBullet('G')}` : ''}</span>`;
}

// ---------- Trade abilities: pick one, spend its Grit, roll its dice (2/day tracked; Town rest resets) ----------
export function abilityOptions(pc, meta) {
  const t = meta.trades[pc.trade], I = meta.abilityInfo || {};
  const list = t.abilities.filter((a) => pc.abilities.includes(a.name)).map((a) => ({ a, ace: false }));
  if ((pc.aces || 0) >= 6) t.aces.forEach((a, i) => { if (i === 0 || pc.aceTwo) list.push({ a, ace: true }); });
  return list.filter(({ a }) => I[a.name]?.usable).map(({ a, ace }) => {
    const info = I[a.name], used = pc.abilityUses?.[a.name] || 0;
    const out = info.daily && a.name !== 'Fired Up 2' && used >= 2;
    const bits = [info.cost ? `${info.cost} Grit` : a.name === 'Fired Up' ? '+3 Grit now' : 'no Grit', info.dice ? `roll ${info.dice}` : '', info.daily ? `${Math.min(used, 2)}/2 today` : '', ace ? 'Ace-in-the-Hole' : ''].filter(Boolean);
    return { name: a.name, info, out, label: `${a.name} · ${bits.join(' · ')}${out ? ' (used up)' : ''}` };
  });
}
export function abilityTargetsHTML(name, pc, posse, foes, sel) {
  const allies = posse.filter((x) => x.id !== pc.id && !x.dead);
  const opt = (list, v) => list.map((x) => `<option value="${x.id}"${x.id === v ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  if (name === 'Crippling Precision') return `<select data-ab="target" aria-label="Target">${opt(foes, sel.target)}</select>`;
  if (name === 'Biological Amplification') return `<select data-ab="target" aria-label="Ally">${opt(allies, sel.target)}</select><select data-ab="option" aria-label="Gift"><option value="aim"${sel.option !== 'dodge' ? ' selected' : ''}>free Aim</option><option value="dodge"${sel.option === 'dodge' ? ' selected' : ''}>free Dodge [1B]</option></select>`;
  if (name === 'Fired Up 2') return `<select data-ab="t1" aria-label="Ally 1"><option value="">— ally —</option>${opt(allies, sel.t1)}</select><select data-ab="t2" aria-label="Ally 2"><option value="">— ally —</option>${opt(allies, sel.t2)}</select>`;
  return '';
}
export function abilityBody(pc, sel) {
  return { action: 'pc', id: pc.id, op: 'useAbility', name: sel.name, target: sel.target, option: sel.option, targets: [sel.t1, sel.t2].filter(Boolean) };
}
