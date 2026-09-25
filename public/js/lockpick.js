// Lock picking — the player's scene (old brass padlock + High/Low cards) and the Warden's "Lock Pick" card.
import { esc, api, toast, startPolling, savedPin, store, rollPopup, ask } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const EP = '/api/lockpick';
const RANK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const isRed = (c) => c && (c.s === '♥' || c.s === '♦');
const cardHTML = (c, cls = '') => (c ? `<div class="lk-card ${isRed(c) ? 'red' : ''} ${cls}"><span class="pc-tl">${RANK[c.r] || c.r}<br>${c.s}</span><span class="pc-mid">${c.s}</span><span class="pc-br">${RANK[c.r] || c.r}<br>${c.s}</span></div>` : `<div class="lk-card lk-back ${cls}"></div>`);
const DIFF = ['Very Easy', 'Easy', 'Medium', 'Difficult', 'Very Difficult'];

// an old-timey brass padlock: engraved body, rivets, keyhole, pin stack, tension wrench + hook pick
function lockSVG(need, wins) {
  const pins = Array.from({ length: need }, (_, i) => {
    const x = 60 + (i - (need - 1) / 2) * 20;
    return `<g class="pin${i < wins ? ' set' : ''}" style="--d:${i * 60}ms"><rect x="${x - 4}" y="118" width="8" height="26" rx="2"/><rect class="pin-top" x="${x - 4}" y="108" width="8" height="10" rx="2"/></g>`;
  }).join('');
  return `<svg class="padlock" viewBox="0 0 120 210" aria-hidden="true">
    <defs>
      <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7c77a"/><stop offset=".45" stop-color="#b8892b"/><stop offset="1" stop-color="#6e4f14"/></linearGradient>
      <linearGradient id="iron" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a423d"/><stop offset=".5" stop-color="#8a8076"/><stop offset="1" stop-color="#2b2522"/></linearGradient>
    </defs>
    <path class="shackle" d="M28 96 V52 a32 32 0 0 1 64 0 V96" fill="none" stroke="url(#iron)" stroke-width="13" stroke-linecap="round"/>
    <g class="lock-body">
      <rect x="10" y="88" width="100" height="112" rx="16" fill="url(#brass)" stroke="#3a2a10" stroke-width="3"/>
      <rect x="18" y="96" width="84" height="96" rx="11" fill="none" stroke="#6e4f14" stroke-width="1.5" stroke-dasharray="3 3"/>
      ${[[22, 100], [98, 100], [22, 188], [98, 188]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#6e4f14"/><circle cx="${x - .8}" cy="${y - .8}" r="1.2" fill="#f0d48a"/>`).join('')}
      <rect class="pin-window" x="26" y="104" width="68" height="44" rx="6" fill="#2a1d0e" stroke="#6e4f14"/>
      ${pins}
      <path d="M60 158 a9 9 0 1 1 0.1 0 l5 22 h-10.2 z" fill="#1a120a"/>
      <text x="60" y="198" text-anchor="middle" class="lock-stamp">EDISON &amp; CO.</text>
    </g>
    <g class="picks"><path class="wrench" d="M58 176 v14 h-26" fill="none" stroke="#9c9084" stroke-width="3.2" stroke-linecap="round"/>
      <path class="pick" d="M62 170 l30 26 l10 -3" fill="none" stroke="#cfc3ad" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>
  </svg>`;
}

// ---------- the player's scene ----------
let scene = null, cur = null, busy = false;
const me = () => store.get('wiw.me', null);
async function act(action, extra = {}) {
  const res = await api('POST', { action, id: cur.id, pc: me(), ...extra }, '', EP);
  const a = (res.state?.list || []).find((x) => x.id === cur.id);
  if (a) cur = a;
  return res.result;
}
function render(anim = '') {
  if (!scene || !cur) return;
  const a = cur, last = a.history?.[a.history.length - 1];
  const done = a.status === 'picked' || a.status === 'failed';
  scene.className = `modal-back lock-back${a.status === 'picked' ? ' opened' : ''}${a.status === 'failed' ? ' snapped' : ''}${anim ? ` ${anim}` : ''}`;
  scene.innerHTML = `<div class="lock-scene" role="dialog" aria-modal="true" aria-label="Pick the lock">
    <div class="lock-head"><small>PICK THE LOCK · ${DIFF[a.need - 1].toUpperCase()}</small><b>${esc(a.what)}</b>
      <span class="lock-prog">${Array.from({ length: a.need }, (_, i) => `<i class="${i < a.wins ? 'on' : ''}"></i>`).join('')}<em>${a.wins}/${a.need} pins</em></span></div>
    <div class="lock-stage">${lockSVG(a.need, a.wins)}
      <div class="lock-cards">${a.status === 'finesse' ? '' : `
        <div class="lc-col"><small>CURRENT</small>${cardHTML(a.cur)}${a.cur?.r === 14 && a.status !== 'ace' ? `<span class="ace-note">Ace counts ${a.curVal === 1 ? 'LOW' : 'HIGH'}</span>` : ''}</div>
        <div class="lc-col"><small>NEXT</small>${done && last ? cardHTML(last.card, last.ok ? 'flip-in' : 'flip-in bad') : `<div class="lk-card lk-back">${a.peek ? `<span class="peek-chip ${a.peek}">${a.peek}</span>` : ''}</div>`}</div>`}</div>
    </div>
    <div class="lock-controls">${controls(a, last)}</div>
    ${a.history?.length ? `<div class="lock-trail">${a.history.map((h) => `<span class="${h.ok ? 'ok' : 'no'}">${RANK[h.from.r] || h.from.r}${h.from.s} ${h.dir === 'higher' ? '▲' : '▼'} ${RANK[h.card.r] || h.card.r}${h.card.s}</span>`).join('')}</div>` : ''}
  </div>`;
}
function controls(a) {
  if (a.status === 'finesse') return `<p class="lock-tip">Before you start, roll <b>Finesse</b> — every Hit is one <b>peek</b> at the next card’s color. Then call each card <b>Higher</b> or <b>Lower</b>; a tie breaks the pick. Set ${a.need} pin${a.need > 1 ? 's' : ''} in a row to open it.</p>
    <button type="button" class="btn" data-lp="finesse">${gl('die')} Roll Finesse</button>`;
  if (a.status === 'ace') return `<p class="lock-tip">Your first card is an <b>Ace</b>. Call it:</p><div class="btn-row"><button type="button" class="btn" data-lp="ace-high">Ace is HIGH</button><button type="button" class="btn" data-lp="ace-low">Ace is LOW</button></div>`;
  if (a.status === 'playing') return `<div class="btn-row lock-guess"><button type="button" class="btn" data-lp="higher">▲ Higher</button><button type="button" class="btn" data-lp="lower">▼ Lower</button>
    <button type="button" class="btn small secondary" data-lp="peek"${a.peeks < 1 || a.peek ? ' disabled' : ''}>${gl('target')} Peek (${a.peeks})</button></div>
    <button type="button" class="linkish" data-lp="walk">Walk away</button>`;
  if (a.status === 'picked') return `<p class="lock-result good">${gl('trophy')} Click — it’s open!</p><button type="button" class="btn" data-lp="close">Done</button>`;
  return `<p class="lock-result bad">The pick slips${a.history.length && !a.history[a.history.length - 1].ok && a.history[a.history.length - 1].card.r === a.history[a.history.length - 1].fromVal ? ' — a tie breaks it' : ''}.</p>
    <div class="btn-row">${a.retriesLeft > 0 ? `<button type="button" class="btn" data-lp="retry">Try again${a.retryCost ? ` · costs ${esc(a.retryCost)}` : ''}</button>` : ''}<button type="button" class="btn ${a.retriesLeft > 0 ? 'secondary' : ''}" data-lp="close">${a.retriesLeft > 0 ? 'Give up' : 'Close'}</button></div>`;
}
async function onClick(e) {
  const b = e.target.closest('[data-lp]');
  if (!b || busy) return;
  busy = true;
  try {
    const k = b.dataset.lp;
    if (k === 'finesse') { const r = await act('finesse'); if (r?.roll) await rollPopup({ ...r.roll, pool: r.roll.pool }, `Finesse · ${r.peeks} peek${r.peeks === 1 ? '' : 's'}`); play('card'); render(); }
    else if (k === 'ace-high' || k === 'ace-low') { await act('ace', { value: k === 'ace-low' ? 'low' : 'high' }); render(); }
    else if (k === 'peek') { await act('peek'); play('card'); render(); }
    else if (k === 'higher' || k === 'lower') {
      const r = await act('guess', { dir: k });
      play('card');
      if (!r.ok) { play('lockSnap'); setTimeout(() => play('fail'), 250); render('fresh'); }
      else if (r.status === 'picked') { play('lockClick'); setTimeout(() => { play('lockOpen'); play('success'); }, 200); render('fresh'); }
      else { play('lockClick'); render('fresh'); }
    } else if (k === 'retry') {
      if (!await ask(`Try again?\n\nThe Warden set the cost: ${cur.retryCost || 'nothing'}. Pay it at the table.`, { ok: 'Pay and try again', danger: false })) { busy = false; return; }
      await act('retry'); render();
    } else if (k === 'walk') {
      if (!await ask('Walk away from the lock? It stays locked.', { ok: 'Walk away' })) { busy = false; return; }
      await act('giveUp'); closeScene();
    } else if (k === 'close') { await act('giveUp'); closeScene(); }
  } catch (err) { toast(err.message, true); }
  busy = false;
}
function openScene(a) {
  cur = a;
  scene = document.createElement('div');
  scene.addEventListener('click', onClick);
  document.body.append(scene);
  play('chime');
  render();
}
function closeScene() { scene?.remove(); scene = null; cur = null; }

// a lock sent to this device's character opens the scene on any page
export function watchLocks() {
  if (!me() || savedPin()) return;
  startPolling(`player&pc=${encodeURIComponent(me())}`, (d) => {
    const a = (d.list || [])[0];
    if (!a) { if (scene && !busy) closeScene(); return; }
    if (!scene) openScene(a);
    else if (!busy && a.id === cur?.id && JSON.stringify(a) !== JSON.stringify(cur)) { cur = a; render(); }
  }, null, EP);
}

// ---------- the Warden's card (Run the Game → Rolls) ----------
export function mountLockSend(el, getCombat) {
  const st = { who: null, need: 3, retries: 1, cost: 'one lockpick', what: '' };
  let recent = [];
  const refresh = () => api('GET', null, '?view=warden', EP).then((d) => { recent = d.list || []; draw(true); }).catch(() => {});
  setInterval(refresh, 5000); refresh();
  function draw(listOnly) {
    const list = el.querySelector('.lp-recent');
    const listHTML = recent.slice(0, 6).map((a) => `<div class="notice${a.status === 'picked' ? '' : a.status === 'failed' ? ' urgent' : ''}"><span><b>${esc(a.name)}</b> · ${esc(a.what)} · ${a.wins}/${a.need} · <i>${{ finesse: 'rolling Finesse', ace: 'calling an Ace', playing: 'picking…', picked: 'OPENED', failed: a.retriesLeft ? `failed (${a.retriesLeft} tr${a.retriesLeft === 1 ? 'y' : 'ies'} left)` : 'failed' }[a.status]}</i>${a.tries > 1 ? ` · try ${a.tries}` : ''}</span><button type="button" class="btn small secondary" data-lp-clear="${esc(a.id)}">Clear</button></div>`).join('') || '<p class="muted small-text">No locks out right now.</p>';
    if (listOnly && list) { list.innerHTML = listHTML; return; }
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') { if (list) list.innerHTML = listHTML; return; }
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    el.innerHTML = `<div class="field-step"><span>WHO</span><button type="button" class="chip-btn${st.who ? '' : ' on'}" data-lp-all>Everyone</button>
        ${posse.map((p) => `<button type="button" class="chip-btn${st.who?.has(p.id) ? ' on' : ''}" data-lp-who="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      <div class="field-step"><span>WHAT LOCK</span><input data-lp-f="what" maxlength="60" value="${esc(st.what)}" placeholder="e.g. the sheriff’s strongbox"></div>
      <div class="field-step"><span>HOW HARD — pins to set in a row</span>${DIFF.map((d, i) => `<button type="button" class="chip-btn${st.need === i + 1 ? ' on' : ''}" data-lp-need="${i + 1}">${d}<small>${i + 1} in a row</small></button>`).join('')}</div>
      <div class="field-step"><span>RETRIES AFTER A FAIL</span>${[0, 1, 2, 3].map((n) => `<button type="button" class="chip-btn${st.retries === n ? ' on' : ''}" data-lp-retries="${n}">${n === 0 ? 'None' : n}</button>`).join('')}
        ${st.retries ? `<input data-lp-f="cost" maxlength="60" value="${esc(st.cost)}" placeholder="each retry costs… e.g. one lockpick, 2 Grit">` : ''}</div>
      <button type="button" class="btn" data-lp-send>${gl('lock')} Send the lock</button>
      <div class="lp-recent">${listHTML}</div>`;
  }
  el.addEventListener('input', (e) => { const k = e.target.dataset.lpF; if (k) st[k] = e.target.value; });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lpAll !== undefined) { st.who = null; draw(); return; }
    if (b.dataset.lpWho) { st.who ||= new Set(); if (st.who.has(b.dataset.lpWho)) st.who.delete(b.dataset.lpWho); else st.who.add(b.dataset.lpWho); if (!st.who.size) st.who = null; draw(); return; }
    if (b.dataset.lpNeed) { st.need = Number(b.dataset.lpNeed); draw(); return; }
    if (b.dataset.lpRetries) { st.retries = Number(b.dataset.lpRetries); draw(); return; }
    if (b.dataset.lpClear) { await api('POST', { action: 'clear', id: b.dataset.lpClear }, '', EP).catch(() => {}); refresh(); return; }
    if (b.dataset.lpSend !== undefined) {
      try {
        const r = await api('POST', { action: 'start', to: st.who ? [...st.who] : 'all', difficulty: st.need, retries: st.retries, retryCost: st.cost, what: st.what }, '', EP);
        toast(`Lock sent to ${r.result.ids.length === 1 ? 'them' : `${r.result.ids.length} players`} — it opens on their phones.`);
        st.what = ''; refresh();
      } catch (err) { toast(err.message, true); }
    }
  });
  return { draw: () => draw() };
}
