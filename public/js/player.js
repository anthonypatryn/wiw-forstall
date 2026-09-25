import {
  $, esc, api, startPolling, injectDefs, bulletSVG, animateRoll, staticDice,
  readoutHTML, diamondsHTML, chipsHTML, WAVE_SVG, toast, store,
  mountNav, savedPin,
} from './common.js';
import { renderNotebook } from './notebook.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';

if (savedPin()) location.replace('/run'); // Warden mode stays on until "Switch to player view"
injectDefs();
mountTableLog();
mountNav('/');
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = bulletSVG(el.dataset.icon, 'hit'); });
$('#wave-holder').innerHTML = WAVE_SVG;

let data = null;
let input = Array(6).fill(null); // typed digits per slot; locked slots are filled from confirmed greens
let busy = false;
let shownRollAt = null;     // newest roll already drawn in the tray
let seenGuesses = null;     // guess count already drawn (to animate new rows)
let shownTarget = undefined;
const pool = { B: store.get('wiw.poolB', 2), G: store.get('wiw.poolG', 0) };

// ---------- pool controls ----------
const spur = $('#spur-talent');
spur.checked = store.get('wiw.spur', false);
spur.addEventListener('change', () => store.set('wiw.spur', spur.checked));

document.querySelectorAll('.stepper').forEach((s) => {
  const c = s.dataset.color;
  s.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    pool[c] = Math.max(0, Math.min(12, pool[c] + Number(b.dataset.d)));
    store.set('wiw.pool' + c, pool[c]);
    renderPool();
  }));
});

function renderPool() {
  $('#count-B').textContent = pool.B;
  $('#count-G').textContent = pool.G;
  const a = data?.active;
  const label = `${pool.B ? pool.B + 'B' : ''}${pool.G ? pool.G + 'G' : ''}` || '0 dice';
  $('#pool-note').innerHTML = data?.jammed
    ? '<span class="badge">' + gl('flash') + ' FORSTALL JAMMED</span> No Scanning until the signal comes back.'
    : a?.scanHalf
    ? `<span class="badge">SPINAL DEFLECTORS</span> Chupacabra — you roll half your pool (${esc(label)} → ${halfLabel()})`
    : `Rolling <b>${esc(label)}</b>`;
  $('#roll-btn').disabled = busy || !a || a.solved || data?.jammed || pool.B + pool.G === 0;
}
function halfLabel() {
  const total = Math.floor((pool.B + pool.G) / 2);
  const g = Math.min(pool.G, Math.ceil(total * (pool.G / Math.max(1, pool.B + pool.G))));
  const b = total - g;
  return `${b ? b + 'B' : ''}${g ? g + 'G' : ''}` || '0 dice';
}

// ---------- who's scanning: fill the pool from their sheet's Intuition + Talent ----------
let posse = [];
const scanner = () => posse.find((p) => p.id === $('#scanner').value);
function applyScanner() {
  const p = scanner();
  if (!p) return;
  const m = String(p.skills?.intuition || '').toUpperCase();
  pool.B = Number((m.match(/(\d+)B/) || [])[1] || 0); pool.G = Number((m.match(/(\d+)G/) || [])[1] || 0);
  spur.checked = (p.talents || []).includes('Intuition');
  store.set('wiw.poolB', pool.B); store.set('wiw.poolG', pool.G); store.set('wiw.spur', spur.checked);
  renderPool();
}
async function loadPosse() {
  try {
    const d = await api('GET', null, '?view=player', '/api/combat');
    posse = (d.posse || []).filter((p) => !p.dead);
    const sel = $('#scanner'), cur = sel.value || store.get('wiw.scanner', '') || store.get('wiw.me', '');
    sel.innerHTML = `<option value="">— pick a character (fills in their Intuition) —</option>${posse.map((p) => `<option value="${p.id}">${esc(p.name)} · Intuition ${esc(String(p.skills?.intuition || '—').toUpperCase())}${(p.talents || []).includes('Intuition') ? ' · Talent' : ''}</option>`).join('')}`;
    sel.value = posse.some((p) => p.id === cur) ? cur : '';
    applyScanner();
  } catch {}
}
$('#scanner').addEventListener('change', () => { store.set('wiw.scanner', $('#scanner').value); applyScanner(); });
loadPosse();
window.addEventListener('focus', loadPosse);

// ---------- roll ----------
$('#roll-btn').addEventListener('click', async () => {
  if (busy) return;
  busy = true; renderPool();
  try {
    const res = await api('POST', { action: 'roll', black: pool.B, gold: pool.G, spurTalent: spur.checked, who: scanner()?.name || '', whoId: scanner()?.id || '' });
    shownRollAt = res.result.at;
    poller.push(res.state);
    await showRoll(res.result, true);
  } catch (e) { toast(e.message, true); }
  busy = false; renderPool();
});

async function showRoll(roll, animate) {
  const tray = $('#tray');
  $('#tally').innerHTML = '';
  if (animate) await animateRoll(tray, roll.dice); else staticDice(tray, roll.dice);
  const pool = `${roll.pool.black ? roll.pool.black + 'B' : ''}${roll.pool.gold ? roll.pool.gold + 'G' : ''}`;
  $('#tally').innerHTML = `
    <span class="muted">Rolled ${pool}${roll.halved ? ' (halved)' : ''}</span>
    <span class="hits">${roll.hits} HIT${roll.hits === 1 ? '' : 'S'}</span>
    ${roll.newDigits.length
      ? `<span>Digits recovered: ${chipsHTML(roll.newDigits, roll.newDigits)}</span>`
      : `<span class="muted">${roll.hits ? 'Nothing new left to learn from Scanning.' : 'No luck, partner.'}</span>`}
    ${roll.hits > roll.newDigits.length && roll.newDigits.length ? '<span class="muted">(extra Hits wasted — nothing left to reveal)</span>' : ''}`;
}

// ---------- guessing ----------
function keyStates(a) {
  const rank = { red: 1, yellow: 2, green: 3 };
  const st = {};
  a?.guesses.forEach((g) => g.digits.forEach((d, i) => {
    const r = g.result[i];
    if (!st[d] || rank[r] > rank[st[d]]) st[d] = r;
  }));
  return st;
}

function buildKeypad() {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  $('#keypad').innerHTML = keys.map((k) => `<button class="key" type="button" data-k="${k}">${k}</button>`).join('')
    + '<button class="key wide" type="button" data-k="back" aria-label="Delete">⌫ DEL</button>'
    + '<button class="key wide go" type="button" data-k="enter">TRANSMIT ▶</button>'
    + '<button class="key wide" type="button" data-k="clear">CLEAR</button>';
  $('#keypad').addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k !== undefined) press(k);
  });
}

// Positions already confirmed (green in any guess, or placed by the Warden's aid) are locked in.
const lockedDigits = () => data?.active?.positional || Array(6).fill(null);
const openSlots = () => lockedDigits().map((d, i) => (d === null ? i : -1)).filter((i) => i >= 0);
const currentGuess = () => lockedDigits().map((d, i) => (d !== null ? d : input[i]));

function press(k) {
  const a = data?.active;
  if (!a || a.solved || data.jammed) return;
  const open = openSlots();
  if (k === 'back') {
    const last = [...open].reverse().find((i) => input[i] !== null);
    if (last !== undefined) input[last] = null;
  } else if (k === 'clear') input = Array(6).fill(null);
  else if (k === 'enter') return submitGuess();
  else {
    const next = open.find((i) => input[i] === null);
    if (next !== undefined) input[next] = Number(k);
  }
  renderBoard();
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
  else if (e.key === 'Enter') press('enter');
  else if (e.key === 'Escape') press('clear');
});

async function submitGuess() {
  if (busy) return;
  const guess = currentGuess();
  if (guess.some((d) => d === null)) {
    const row = $('#rows .row.input-row');
    row?.classList.remove('shake'); void row?.offsetWidth; row?.classList.add('shake');
    return toast('A frequency has six digits.');
  }
  busy = true;
  try {
    const res = await api('POST', { action: 'guess', digits: guess });
    input = Array(6).fill(null);
    poller.push(res.state);
    if (res.result.solved) toast('Frequency locked! It’s in the notebook.');
  } catch (e) { toast(e.message, true); }
  busy = false;
}

function renderBoard() {
  const a = data?.active;
  const rows = $('#rows');
  const jammed = !!data?.jammed;
  $('#lamp').classList.toggle('on', !!a && !a.solved && !jammed);
  $('#screen').classList.toggle('live', !!a && !a.solved && !jammed);
  $('#screen').classList.toggle('jammed', jammed);
  if (!a) {
    rows.innerHTML = '<div class="empty-msg">NO SIGNAL — awaiting target</div>';
    seenGuesses = null;
  } else {
    const fresh = seenGuesses !== null && a.guesses.length > seenGuesses ? seenGuesses : a.guesses.length;
    let html = a.guesses.map((g, i) => `
      <div class="row${i >= fresh ? ' fresh' : ''}"><span class="n">${i + 1}</span>${diamondsHTML(g.digits, g.result)}</div>`).join('');
    if (a.solved) {
      html += `<div class="solved-banner">FREQUENCY LOCKED · ${esc(a.kz)}</div>`;
    } else if (jammed) {
      html += '<div class="solved-banner jam">' + gl('flash') + ' SIGNAL LOST — FORSTALL JAMMED</div>';
    } else {
      const locked = lockedDigits();
      const cursor = openSlots().find((i) => input[i] === null);
      html += `<div class="row input-row"><span class="n">▶</span>${diamondsHTML(currentGuess(), [], (i) =>
        locked[i] !== null ? ' input locked' : ` input${i === cursor ? ' cursor' : ''}`)}</div>`;
      if (!a.guesses.length) html = '<div class="empty-msg">Punch in six digits and transmit.</div>' + html;
    }
    rows.innerHTML = html;
    rows.scrollTop = rows.scrollHeight;
    seenGuesses = a.guesses.length;
  }

  const st = keyStates(a);
  const known = new Set(a?.known || []);
  document.querySelectorAll('#keypad [data-k]').forEach((b) => {
    const k = b.dataset.k;
    b.disabled = !a || a.solved || jammed;
    if (/^\d$/.test(k)) {
      b.className = `key ${st[k] || ''}${known.has(Number(k)) ? ' known' : ''}`;
    }
  });
}

// ---------- target + known digits ----------
function renderTarget() {
  const a = data?.active;
  const el = $('#target');
  el.classList.toggle('idle', !a);
  if (!a) {
    el.innerHTML = `<div><div class="label">TARGET IN LINE OF SIGHT</div><div class="name">Forstall idle…</div>
      <div class="meta">Waiting for the Warden to point the antenna at a monster.</div></div>`;
    return;
  }
  el.innerHTML = `
    <div>
      <div class="label">TARGET IN LINE OF SIGHT</div>
      <div class="name">${esc(a.name)}</div>
      <div class="meta">${esc(a.size)}${a.page ? ` · Guidebook p. ${a.page}` : ''}
        ${a.solved ? ' <span class="badge green">DECODED</span>' : ''}
        ${data.jammed ? ' <span class="badge">' + gl('flash') + ' JAMMED</span>' : ''}
        ${data.settings.easyMode ? ' <span class="badge teal">WARDEN’S AID: POSITIONS SHOWN</span>' : ''}</div>
    </div>
    ${readoutHTML(a.positional)}`;
}

function renderKnown() {
  const a = data?.active;
  const box = $('#known-box');
  if (!a) { box.innerHTML = '<b>HOW IT WORKS</b> — the Warden locks on a target, you roll Intuition to recover digits, then guess the six-digit Kurtz Frequency.'; return; }
  if (a.solved) { box.innerHTML = `<b>DECODED</b> — ${esc(a.name)} is ${esc(a.kz)}. Your Forstall now Sweeps it at +1 and can Burst it.`; return; }
  box.innerHTML = `<b>DIGITS RECOVERED (${a.known.length}/6)</b> &nbsp;${a.known.length ? chipsHTML(a.known) : '<span class="muted">none yet — roll to Scan.</span>'}
    <div class="muted mt-2">${data.settings.easyMode ? 'The Warden is showing where each recovered digit goes.' : 'Shown in numerical order — not necessarily their spot in the frequency.'}</div>`;
}

function renderRollArea() {
  const a = data?.active;
  if (shownTarget !== (a?.name ?? null)) {
    shownTarget = a?.name ?? null;
    input = Array(6).fill(null);
    seenGuesses = null;
    const last = a?.rolls?.[0];
    shownRollAt = last?.at ?? null;
    if (last) showRoll(last, false);
    else { $('#tray').innerHTML = '<span class="empty">Your bullet dice land here.</span>'; $('#tally').innerHTML = ''; }
    return;
  }
  const last = a?.rolls?.[0];
  if (last && last.at !== shownRollAt) { shownRollAt = last.at; showRoll(last, true); } // someone else rolled
}

// ---------- notebook ----------
const nbBody = $('#nb-body');
const nbSearch = $('#nb-search');
function renderNb() {
  if (!data) return;
  renderNotebook(nbBody, data.notebook, {
    active: data.active?.name, filter: nbSearch.value,
    onNote: async (name, text) => {
      try { poller.push((await api('POST', { action: 'note', name, text })).state); toast('Note saved.'); }
      catch (e) { toast(e.message, true); }
    },
  });
}
nbSearch.addEventListener('input', renderNb);
nbBody.addEventListener('focusout', () => setTimeout(renderNb, 50));

// ---------- boot ----------
buildKeypad();
const poller = startPolling('player', (d) => {
  data = d;
  renderRollArea();
  renderTarget();
  renderKnown();
  renderPool();
  renderBoard();
  renderNb();
}, (ok) => {
  $('#conn').classList.toggle('off', !ok);
  $('#conn').textContent = ok ? 'Connected' : 'Reconnecting…';
});
renderBoard();
