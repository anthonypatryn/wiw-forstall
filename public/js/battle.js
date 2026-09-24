import { $, esc, api, startPolling, toast, mountNav, tryWarden, forgetWarden, savedPin, wardenModal } from './common.js';
import { mountTableLog } from './tablelog.js';
import { panZoom } from './panzoom.js';

const EP = '/api/battle';
mountTableLog();
mountNav('/battle');

const TRADE_COLOR = {
  Doctor: '#2f6d73', Gunslinger: '#a4401f', Hunter: '#4d6b2f', Marshal: '#8a6a2a',
  Mechanic: '#3d5a7a', Prospector: '#b3702a', Trapper: '#6b3f5e',
};
const color = (t) => (t.kind === 'enemy' ? '#5a1a12' : t.kind === 'npc' ? '#5e5750' : TRADE_COLOR[t.trade] || '#555');
const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// Guidebook ranges in inches (1 hex = 1").
const band = (d) => (d <= 1 ? 'arm' : d <= 6 ? 'short' : d <= 18 ? 'long' : 'distant');
const BAND_LABEL = { arm: 'Arm’s Reach', short: 'Short', long: 'Long', distant: 'Distant' };

let data = null, warden = false, poller = null, selected = null, dragging = null;
const vp = $('#viewport'), stage = $('#stage');
const pz = panZoom(vp, stage, {
  maxScale: 2.5, ignore: '.btoken, .map-ctrls',
  onTap: (target) => { if (!target.closest('.btoken')) select(null); },
});
$('#zoom-in').addEventListener('click', () => pz.zoom(1.35));
$('#zoom-out').addEventListener('click', () => pz.zoom(1 / 1.35));
$('#zoom-fit').addEventListener('click', () => pz.fit());

// ---------- hex math: pointy-top, odd rows shifted right ----------
const R = () => data.grid.ppi / Math.sqrt(3);
function center(col, row) {
  const r = R(), w = data.grid.ppi;
  return { x: data.grid.dx + w * (col + 0.5 * (row & 1)) + w / 2, y: data.grid.dy + 1.5 * r * row + r };
}
function toHex(x, y) {
  const r = R(), w = data.grid.ppi;
  const px = x - data.grid.dx - w / 2, py = y - data.grid.dy - r;
  let q = ((Math.sqrt(3) / 3) * px - py / 3) / r, rr = ((2 / 3) * py) / r, s = -q - rr;
  let [rq, rr2, rs] = [Math.round(q), Math.round(rr), Math.round(s)];
  const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr2 - rr), Math.abs(rs - s)];
  if (dq > dr && dq > ds) rq = -rr2 - rs; else if (dr > ds) rr2 = -rq - rs;
  const row = Math.max(0, Math.min(data.size.rows - 1, rr2));
  const col = Math.max(0, Math.min(data.size.cols - 1, rq + (rr2 - (rr2 & 1)) / 2));
  return { col, row };
}
const cube = (col, row) => { const q = col - (row - (row & 1)) / 2; return { q, r: row, s: -q - row }; };
function dist(a, b) {
  const A = cube(a.col, a.row), B = cube(b.col, b.row);
  return (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.s - B.s)) / 2;
}
function hexPath(col, row) {
  const c = center(col, row), r = R();
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    d += `${i ? 'L' : 'M'}${(c.x + r * Math.cos(a)).toFixed(1)} ${(c.y + r * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
}

// ---------- rendering ----------
let gridKey = '';
function renderStage() {
  const { map, grid } = data;
  stage.style.width = `${map.w}px`; stage.style.height = `${map.h}px`;
  const src = map.kind === 'upload' ? `/api/battle?view=img&v=${map.imgV}` : `/img/battle/${map.id}.jpg`;
  const bg = $('#bg');
  if (bg.getAttribute('src') !== src) { bg.src = src; bg.width = map.w; bg.height = map.h; pz.setSize(map.w, map.h); pz.fit(); }
  const key = `${map.w}x${map.h}|${grid.ppi}|${grid.dx}|${grid.dy}|${grid.show}|${grid.opacity}`;
  if (key !== gridKey) {
    gridKey = key;
    const svg = $('#grid');
    svg.setAttribute('width', map.w); svg.setAttribute('height', map.h);
    let d = '';
    if (grid.show) for (let row = 0; row < data.size.rows; row++) for (let col = 0; col < data.size.cols; col++) d += hexPath(col, row);
    svg.innerHTML = `<path d="${d}" style="stroke-opacity:${grid.opacity}"/>`;
    $('#ranges').setAttribute('width', map.w); $('#ranges').setAttribute('height', map.h);
  }
}

function renderRanges() {
  const svg = $('#ranges');
  const t = selected && data.tokens.find((x) => x.id === selected);
  if (!t) { svg.innerHTML = ''; return; }
  const paths = { arm: '', short: '', long: '' };
  for (let row = Math.max(0, t.row - 19); row <= Math.min(data.size.rows - 1, t.row + 19); row++) {
    for (let col = Math.max(0, t.col - 20); col <= Math.min(data.size.cols - 1, t.col + 20); col++) {
      const d = dist(t, { col, row });
      if (d === 0 || d > 18) continue;
      paths[band(d)] += hexPath(col, row);
    }
  }
  svg.innerHTML = Object.entries(paths).map(([k, d]) => `<path class="${k}" d="${d}"/>`).join('');
}

const canMove = (t) => warden || t.kind === 'pc';
function renderTokens() {
  const layer = $('#tokens');
  const size = data.grid.ppi * 0.84, font = data.grid.ppi * 0.3, labFont = data.grid.ppi * 0.2;
  const sel = selected && data.tokens.find((x) => x.id === selected);
  layer.innerHTML = data.tokens.map((t) => {
    const c = center(t.col, t.row);
    const d = sel && sel.id !== t.id ? dist(sel, t) : null;
    return `<div class="btoken ${t.kind}${canMove(t) ? ' movable' : ''}${t.id === selected ? ' sel' : ''}${t.ref && t.ref === data.current ? ' turn' : ''}${t.hidden ? ' hidden-tok' : ''}${t.down ? ' down' : ''}"
      data-id="${t.id}" style="left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;background:${color(t)};font-size:${font}px;border-width:${data.grid.ppi * 0.05}px"
      title="${esc(t.name)}">${esc(initials(t.name))}
      <span class="lab" style="font-size:${labFont}px">${esc(t.name)}</span>
      ${d !== null ? `<span class="dist ${band(d)}" style="font-size:${labFont}px">${d}″ · ${BAND_LABEL[band(d)]}</span>` : ''}</div>`;
  }).join('');
  layer.querySelectorAll('.btoken').forEach(wireToken);
}

function renderPanel() {
  const sel = selected && data.tokens.find((x) => x.id === selected);
  const box = $('#sel-box');
  if (!sel) {
    box.innerHTML = `<div class="sel-card"><div class="kind">RANGE METER</div><h2>Tap a token</h2>
      <p>You’ll see its Arm’s Reach, Short and Long Range, and how far away everyone else is.</p></div>`;
  } else {
    const others = data.tokens.filter((t) => t.id !== sel.id).map((t) => ({ t, d: dist(sel, t) })).sort((a, b) => a.d - b.d);
    box.innerHTML = `<div class="sel-card"><div class="kind">${sel.kind === 'pc' ? 'POSSE' : sel.kind === 'enemy' ? 'ENEMY' : 'NPC'}${sel.hidden ? ' · HIDDEN FROM POSSE' : ''}</div><h2>${esc(sel.name)}</h2>
      ${others.length ? others.map(({ t, d }) => `<div class="tok-row" data-pick="${t.id}"><span class="chip" style="background:${color(t)}">${esc(initials(t.name))}</span>
        <span class="n">${esc(t.name)}</span><span class="d ${band(d)}">${d}″ · ${BAND_LABEL[band(d)]}</span></div>`).join('') : '<p class="muted">Nobody else on the board.</p>'}</div>`;
  }
  const list = $('#token-list');
  list.innerHTML = data.tokens.length ? data.tokens.map((t) => `<div class="tok-row${t.id === selected ? ' sel' : ''}" data-pick="${t.id}">
      <span class="chip" style="background:${color(t)}">${esc(initials(t.name))}</span>
      <span class="n">${esc(t.name)}<small>${t.kind === 'pc' ? `The ${esc(t.trade || '')}` : t.kind === 'enemy' ? 'Enemy' : 'NPC'}${t.down ? ' · down' : ''}${t.gone ? ' · removed from Combat' : ''}</small></span>
      ${warden ? `<button type="button" data-hide="${t.id}">${t.hidden ? 'Reveal' : 'Hide'}</button><button type="button" data-rm="${t.id}">✕</button>` : ''}</div>`).join('')
    : `<p class="muted">${warden ? 'Use “Add posse & enemies from Combat” below.' : 'The Warden hasn’t set the board yet.'}</p>`;
  document.querySelectorAll('#panel [data-pick]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    select(el.dataset.pick);
    const t = data.tokens.find((x) => x.id === el.dataset.pick);
    if (t) { const c = center(t.col, t.row); pz.centerOn(c.x, c.y, Math.max(pz.view.s, 0.45)); }
  }));
  list.querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', () => {
    const t = data.tokens.find((x) => x.id === b.dataset.hide);
    act({ action: 'tokenEdit', id: t.id, hidden: !t.hidden });
  }));
  list.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => act({ action: 'removeToken', id: b.dataset.rm })));
}

function renderWarden() {
  $('#warden-box').hidden = !warden;
  if (!warden) return;
  const pre = $('#presets');
  pre.innerHTML = data.presets.map((p) => `<button type="button" data-preset="${p.id}" aria-pressed="${data.map.kind === 'preset' && data.map.id === p.id}">
    <img src="${p.thumb}" alt="" loading="lazy"><span>${esc(p.name)}</span></button>`).join('');
  pre.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => act({ action: 'preset', id: b.dataset.preset }, 'Map changed.')));
  if (document.activeElement?.id !== 'g-ppi') $('#g-ppi').value = data.grid.ppi;
  if (document.activeElement?.id !== 'g-op') $('#g-op').value = data.grid.opacity;
  $('#g-show').checked = data.grid.show;
}

function render() {
  if (dragging) return; // don't yank a token out from under a drag
  renderStage();
  renderRanges();
  renderTokens();
  renderPanel();
  renderWarden();
}
function select(id) { selected = id; renderRanges(); renderTokens(); renderPanel(); }

// ---------- dragging tokens ----------
function wireToken(el) {
  const t = data.tokens.find((x) => x.id === el.dataset.id);
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!canMove(t)) { select(t.id); return; }
    try { el.setPointerCapture(e.pointerId); } catch {}
    const start = center(t.col, t.row);
    dragging = { id: t.id, cx: e.clientX, cy: e.clientY, x: start.x, y: start.y, moved: false, hex: { col: t.col, row: t.row } };
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging || dragging.id !== t.id) return;
    const dx = (e.clientX - dragging.cx) / pz.view.s, dy = (e.clientY - dragging.cy) / pz.view.s;
    if (Math.abs(e.clientX - dragging.cx) + Math.abs(e.clientY - dragging.cy) > 4) { dragging.moved = true; el.classList.add('dragging'); }
    if (!dragging.moved) return;
    el.style.left = `${dragging.x + dx}px`; el.style.top = `${dragging.y + dy}px`;
    dragging.hex = toHex(dragging.x + dx, dragging.y + dy);
    const d = dist(t, dragging.hex);
    const ro = $('#readout');
    ro.hidden = false;
    // Normal speed: 1 Grit per Short Range distance (6"); Long needs 2+, Distant 6 over two turns.
    ro.textContent = d === 0 ? 'Drop to stay put' : `${t.name} moves ${d}″ · ${Math.ceil(d / 6)} Grit at Normal speed`;
  });
  const end = async () => {
    if (!dragging || dragging.id !== t.id) return;
    const drag = dragging;
    dragging = null;
    $('#readout').hidden = true;
    el.classList.remove('dragging');
    if (!drag.moved) { select(t.id); return; }
    if (drag.hex.col === t.col && drag.hex.row === t.row) { render(); return; }
    t.col = drag.hex.col; t.row = drag.hex.row; // move locally right away
    selected = t.id;
    render();
    await act({ action: 'move', id: t.id, ...drag.hex });
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---------- Warden controls ----------
$('#g-show').addEventListener('change', (e) => act({ action: 'grid', show: e.target.checked }));
$('#g-ppi').addEventListener('change', (e) => act({ action: 'grid', ppi: Number(e.target.value) }));
$('#g-op').addEventListener('change', (e) => act({ action: 'grid', opacity: Number(e.target.value) }));
document.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => {
  const [x, y] = b.dataset.n.split(',').map(Number);
  act({ action: 'grid', dx: data.grid.dx + x, dy: data.grid.dy + y });
}));
$('#sync').addEventListener('click', () => act({ action: 'syncCombat', hidden: $('#sync-hidden').checked }, 'Tokens added.'));
$('#npc-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#npc-name').value.trim();
  if (!name) return;
  if (await act({ action: 'addToken', kind: 'npc', name })) $('#npc-name').value = '';
});
$('#clear').addEventListener('click', () => { if (confirm('Remove every token from the board?')) { selected = null; act({ action: 'clearTokens' }); } });

// Shrink uploads in the browser so they fit comfortably in the database.
$('#upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  toast('Preparing the map…');
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const scale = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    let q = 0.82, data64 = c.toDataURL('image/jpeg', q);
    while (data64.length > 2_700_000 && q > 0.4) { q -= 0.1; data64 = c.toDataURL('image/jpeg', q); }
    const inches = Number($('#inches').value) || 36;
    await act({ action: 'upload', data: data64, name: file.name.replace(/\.[^.]+$/, ''), w, h, inches }, 'Map uploaded.');
  } catch { toast('Couldn’t read that image.', true); }
});

// ---------- data & boot ----------
async function act(body, okMsg) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (okMsg) toast(okMsg);
    return res.result ?? true;
  } catch (e) { toast(e.message, true); render(); return null; }
}
function connect() {
  poller?.stop();
  poller = startPolling(warden ? 'warden' : 'player', (d) => {
    data = d;
    if (selected && !data.tokens.some((t) => t.id === selected)) selected = null;
    render();
  }, (ok, e) => { if (e?.status === 401) { warden = false; forgetWarden(); setWarden(); connect(); } }, EP);
}
function setWarden() {
  $('#warden-btn').textContent = warden ? '⭐ Warden mode · lock' : '⭐ Warden';
  if (data) render();
}
$('#warden-btn').addEventListener('click', async () => {
  if (warden) { warden = false; forgetWarden(); }
  else if (!(warden = await wardenModal(EP))) return;
  setWarden(); connect();
});

(async () => {
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWarden();
  connect();
})();
