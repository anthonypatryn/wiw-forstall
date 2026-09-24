import { $, esc, api, startPolling, toast, mountNav, tryWarden, forgetWarden, savedPin, wardenModal } from './common.js';
import { mountTableLog } from './tablelog.js';

const EP = '/api/map';
mountTableLog();
mountNav('/map');

const TRADE_COLOR = {
  Doctor: '#2f6d73', Gunslinger: '#a4401f', Hunter: '#4d6b2f', Marshal: '#8a6a2a',
  Mechanic: '#3d5a7a', Prospector: '#b3702a', Trapper: '#6b3f5e',
};
const NEAR = 55; // map px: a token this close to a place counts as "at" it

let meta = null, data = null, warden = false, poller = null;
let selected = null;      // place id
let placing = false;      // Warden "add a place" mode
const view = { s: 1, x: 0, y: 0 };

const vp = $('#viewport');
const stage = $('#stage');

// ---------- pan & zoom ----------
function apply() {
  stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  // Markers keep a readable on-screen size, but shrink when zoomed far out so the map isn't buried.
  const screen = 0.42 + 0.58 * Math.min(1, view.s / 0.6);
  stage.style.setProperty('--inv', String(screen / view.s));
  vp.classList.toggle('far', view.s < 0.4);
  vp.classList.toggle('show-labels', view.s > 0.75);
}
function clamp() {
  const r = vp.getBoundingClientRect();
  const w = meta.size.w * view.s, h = meta.size.h * view.s;
  view.x = w < r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, view.x));
  view.y = h < r.height ? (r.height - h) / 2 : Math.min(0, Math.max(r.height - h, view.y));
}
const fitScale = () => { const r = vp.getBoundingClientRect(); return Math.min(r.width / meta.size.w, r.height / meta.size.h); };
function zoomAt(factor, cx, cy) {
  const r = vp.getBoundingClientRect();
  const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
  const s = Math.max(fitScale() * 0.9, Math.min(1.6, view.s * factor));
  view.x = px - ((px - view.x) / view.s) * s;
  view.y = py - ((py - view.y) / view.s) * s;
  view.s = s;
  clamp(); apply();
}
function fit() { view.s = fitScale(); view.x = 0; view.y = 0; clamp(); apply(); }
function centerOn(x, y, s = Math.max(view.s, 0.7)) {
  const r = vp.getBoundingClientRect();
  view.s = s; view.x = r.width / 2 - x * s; view.y = r.height / 2 - y * s;
  clamp(); apply();
}
const toMap = (clientX, clientY) => {
  const r = vp.getBoundingClientRect();
  return { x: (clientX - r.left - view.x) / view.s, y: (clientY - r.top - view.y) / view.s };
};

$('#zoom-in').addEventListener('click', () => zoomAt(1.35));
$('#zoom-out').addEventListener('click', () => zoomAt(1 / 1.35));
$('#zoom-fit').addEventListener('click', fit);
vp.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = vp.getBoundingClientRect();
  zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

// Drag to pan; two fingers to pinch.
const pointers = new Map();
let panStart = null, pinch = null, moved = false, downPlace = null;
vp.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.token, .map-ctrls, .map-banner')) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) downPlace = e.target.closest('.place'); // pointer capture changes e.target later
  vp.setPointerCapture(e.pointerId);
  moved = false;
  if (pointers.size === 1) panStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
  }
});
vp.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const r = vp.getBoundingClientRect();
    zoomAt((pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d) / view.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    moved = true;
  } else if (panStart) {
    const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; vp.classList.add('dragging'); }
    view.x = panStart.vx + dx; view.y = panStart.vy + dy;
    clamp(); apply();
  }
});
const endPointer = async (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) {
    vp.classList.remove('dragging');
    panStart = null;
    if (!moved) {
      const place = downPlace;
      if (place && !placing) select(place.dataset.id);
      else if (placing) await dropPin(toMap(e.clientX, e.clientY));
    }
  }
};
vp.addEventListener('pointerup', endPointer);
vp.addEventListener('pointercancel', endPointer);
window.addEventListener('resize', () => { clamp(); apply(); });

// ---------- places ----------
const allPlaces = () => [
  ...meta.places,
  ...(data?.pins || []).map((p) => ({ ...p, kind: 'pin', text: '', page: null })),
];
const placeById = (id) => allPlaces().find((p) => p.id === id);
const KIND_LABEL = { town: 'NOTABLE TOWN', rail: 'RAILROAD TOWN', settlement: 'SETTLEMENT', region: 'REGION', pin: 'MARKED BY THE WARDEN' };

function renderPlaces() {
  $('#places').innerHTML = allPlaces().map((p) => `<button type="button" class="place ${p.kind}${p.kind === 'pin' && !p.shared ? ' secret' : ''}${data?.notes?.[p.id] ? ' has-note' : ''}${selected === p.id ? ' sel' : ''}"
      data-id="${p.id}" style="left:${p.x}px;top:${p.y}px" aria-label="${esc(p.name)}"><span class="dot"></span><span class="tag">${esc(p.name)}</span></button>`).join('');
}

function tokensAt(place) {
  return (data?.posse || []).filter((c) => {
    const t = data.tokens[c.id];
    return t && Math.hypot(t.x - place.x, t.y - place.y) < NEAR;
  });
}
function nearestPlace(t) {
  let best = null, bd = Infinity;
  allPlaces().forEach((p) => { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = p; } });
  return bd < NEAR ? best : null;
}

function select(id) {
  selected = id;
  renderPlaces();
  renderPanel();
  if (window.matchMedia('(max-width: 900px)').matches) $('#panel').scrollIntoView({ behavior: 'smooth' });
}

function renderPanel() {
  const body = $('#panel-body');
  const p = selected && placeById(selected);
  if (!p) {
    body.innerHTML = `<div class="intro"><h2>The Uncivilized West</h2>
      <p>The American West begins at the Mississippi River and ends at the balmy, deadly shores of Isla California.</p>
      <p class="muted">Tap a town or region to read what the Guidebook says about it. Drag the posse’s tokens around to show where everyone is.</p></div>`;
    return;
  }
  const note = data?.notes?.[p.id];
  const here = tokensAt(p);
  const paras = (p.text || '').split('\n\n').filter(Boolean);
  body.innerHTML = `
    <div><div class="kind">${KIND_LABEL[p.kind] || ''}</div><h2>${esc(p.name)}</h2></div>
    ${here.length ? `<div><h3>WHO’S HERE</h3><div class="here">${here.map((c) => `<span style="background:${TRADE_COLOR[c.trade] || '#555'}">${esc(c.name)}</span>`).join('')}</div></div>` : ''}
    ${paras.length ? `<div class="book-text"><h3>FROM THE GUIDEBOOK</h3>${paras.map((t) => `<p>${esc(t)}</p>`).join('')}${p.page ? `<div class="src">Official Guidebook, p. ${p.page}</div>` : ''}</div>`
      : (p.kind !== 'pin' ? '<p class="muted">The Guidebook marks this on the map but doesn’t say more. Make it yours.</p>' : '')}
    ${warden ? `<div class="note-box"><div class="who">WARDEN’S NOTES</div>
        <textarea id="note-text" placeholder="Anything you like — NPCs, rumors, bounties, secrets…">${esc(note?.text || '')}</textarea>
        <div class="note-actions">
          <label class="check"><input type="checkbox" id="note-shared"${note?.shared ? ' checked' : ''}> Show to the posse</label>
          <button class="btn small" id="note-save" type="button">Save notes</button>
        </div>
        ${p.kind === 'pin' ? `<div class="note-actions">
          <label class="check"><input type="checkbox" id="pin-shared"${p.shared ? ' checked' : ''}> Pin visible to the posse</label>
          <button class="btn small secondary" id="pin-move" type="button">Move pin</button>
          <button class="btn small secondary danger" id="pin-remove" type="button">Delete pin</button></div>` : ''}
      </div>`
      : note ? `<div class="note-box"><div class="who">FROM THE WARDEN</div><p>${esc(note.text)}</p></div>` : ''}
    <div class="note-actions"><button class="btn small secondary" id="send-posse" type="button">Move the whole posse here</button></div>`;

  $('#note-save')?.addEventListener('click', () => act({ action: 'note', place: p.id, text: $('#note-text').value, shared: $('#note-shared').checked }, 'Notes saved.'));
  $('#pin-shared')?.addEventListener('change', (e) => act({ action: 'pinEdit', id: p.id, shared: e.target.checked }));
  $('#pin-remove')?.addEventListener('click', () => { if (confirm(`Delete ${p.name}?`)) { selected = null; act({ action: 'pinRemove', id: p.id }); } });
  $('#pin-move')?.addEventListener('click', () => startPlacing(p.id));
  $('#send-posse').addEventListener('click', async () => {
    const alive = (data?.posse || []).filter((c) => !c.dead);
    if (!alive.length) return toast('No characters yet — make some on Posse Sheets.', true);
    // fan them out around the spot so they don't stack
    for (const [i, c] of alive.entries()) {
      const a = (i / alive.length) * Math.PI * 2;
      await act({ action: 'token', id: c.id, x: p.x + Math.cos(a) * 36, y: p.y + Math.sin(a) * 36 - 12 });
    }
    toast(`The posse rides to ${p.name}.`);
  });
}

// ---------- tokens ----------
const initials = (n) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function renderTokens() {
  const layer = $('#tokens');
  layer.innerHTML = (data?.posse || []).filter((c) => data.tokens[c.id]).map((c) => {
    const t = data.tokens[c.id];
    return `<div class="token${c.dead ? ' dead' : ''}" data-id="${c.id}" style="left:${t.x}px;top:${t.y}px" title="${esc(c.name)} — drag to move">
      <span class="nm">${esc(c.name)}</span><span class="disc" style="background:${TRADE_COLOR[c.trade] || '#555'}">${esc(initials(c.name))}</span><span class="stem"></span></div>`;
  }).join('');
  layer.querySelectorAll('.token').forEach(wireToken);
}
function wireToken(el) {
  let start = null;
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    const t = data.tokens[el.dataset.id];
    start = { cx: e.clientX, cy: e.clientY, x: t.x, y: t.y, moved: false };
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!start) return;
    const x = start.x + (e.clientX - start.cx) / view.s, y = start.y + (e.clientY - start.cy) / view.s;
    if (Math.abs(e.clientX - start.cx) + Math.abs(e.clientY - start.cy) > 3) start.moved = true;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    start.nx = x; start.ny = y;
  });
  const end = async () => {
    if (!start) return;
    el.classList.remove('dragging');
    const s = start; start = null;
    if (!s.moved) return;
    await act({ action: 'token', id: el.dataset.id, x: s.nx, y: s.ny });
    const at = nearestPlace({ x: s.nx, y: s.ny });
    if (at) toast(`${data.posse.find((c) => c.id === el.dataset.id)?.name} is at ${at.name}.`);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function renderPosseList() {
  const box = $('#posse-list');
  const posse = data?.posse || [];
  if (!posse.length) { box.innerHTML = '<p class="muted">No characters yet — <a href="/posse">make some on Posse Sheets</a>.</p>'; return; }
  box.innerHTML = posse.map((c) => {
    const t = data.tokens[c.id];
    const at = t && nearestPlace(t);
    return `<div class="posse-row"><span class="chip" style="background:${TRADE_COLOR[c.trade] || '#555'}">${esc(initials(c.name))}</span>
      <span class="n">${esc(c.name)}<small>${t ? (at ? `at ${esc(at.name)}` : 'out on the trail') : 'not on the map'}</small></span>
      ${t ? `<button type="button" data-find="${c.id}">Find</button><button type="button" data-off="${c.id}">Remove</button>` : `<button type="button" data-place="${c.id}">Place</button>`}</div>`;
  }).join('');
  box.querySelectorAll('[data-find]').forEach((b) => b.addEventListener('click', () => { const t = data.tokens[b.dataset.find]; centerOn(t.x, t.y); }));
  box.querySelectorAll('[data-off]').forEach((b) => b.addEventListener('click', () => act({ action: 'token', id: b.dataset.off, remove: true })));
  box.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => {
    const r = vp.getBoundingClientRect();
    const c = toMap(r.left + r.width / 2, r.top + r.height / 2);
    act({ action: 'token', id: b.dataset.place, x: c.x, y: c.y });
  }));
}

// ---------- Warden pins ----------
let movingPin = null;
function startPlacing(pinId = null) {
  placing = true; movingPin = pinId;
  vp.classList.add('placing');
  const b = $('#banner');
  b.hidden = false;
  b.innerHTML = `${pinId ? 'Tap the new spot for this pin' : 'Tap the map to drop a new place'} <button type="button">Cancel</button>`;
  b.querySelector('button').addEventListener('click', stopPlacing);
}
function stopPlacing() { placing = false; movingPin = null; vp.classList.remove('placing'); $('#banner').hidden = true; }
async function dropPin(pt) {
  if (movingPin) { await act({ action: 'pinEdit', id: movingPin, x: pt.x, y: pt.y }, 'Pin moved.'); stopPlacing(); return; }
  const name = prompt('Name this place:');
  stopPlacing();
  if (!name) return;
  const pin = await act({ action: 'pin', name, x: pt.x, y: pt.y, shared: true }, `${name} added.`);
  if (pin?.id) select(pin.id);
}
$('#add-pin').addEventListener('click', () => startPlacing());

// ---------- data ----------
async function act(body, okMsg) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (okMsg) toast(okMsg);
    return res.result ?? true;
  } catch (e) { toast(e.message, true); return null; }
}
function onState(d) {
  data = d;
  if (selected && !placeById(selected)) selected = null;
  renderPlaces();
  renderTokens();
  renderPosseList();
  // don't wipe a note the Warden is typing
  if (!$('#panel-body').contains(document.activeElement)) renderPanel();
}
function connect() {
  poller?.stop();
  poller = startPolling(warden ? 'warden' : 'player', onState, (ok, e) => {
    if (e?.status === 401) { warden = false; forgetWarden(); setWarden(); connect(); }
  }, EP);
}
function setWarden() {
  $('#warden-btn').textContent = warden ? '⭐ Warden mode · lock' : '⭐ Warden';
  $('#warden-box').hidden = !warden;
  if (!warden) stopPlacing();
}
$('#warden-btn').addEventListener('click', async () => {
  if (warden) { warden = false; forgetWarden(); }
  else if (!(warden = await wardenModal(EP))) return;
  setWarden(); connect();
  if (warden) toast('Warden mode on — notes and pins unlocked.');
});

(async () => {
  meta = await api('GET', null, '?view=meta', EP);
  fit();
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWarden();
  renderPlaces();
  renderPanel();
  connect();
})();
