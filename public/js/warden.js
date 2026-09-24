import {
  $, esc, api, setPin, startPolling, injectDefs, staticDice, diamondsHTML, chipsHTML, toast, store, timeAgo,
} from './common.js';
import { renderNotebook } from './notebook.js';

injectDefs();

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Titan'];
let data = null;
let poller = null;
let selectedTouched = false;

// ---------- PIN gate ----------
async function unlock(pin, quiet) {
  setPin(pin);
  try {
    await api('POST', { action: 'auth' });
    store.set('wiw.pin', pin);
    $('#gate').hidden = true;
    $('#station').hidden = false;
    $('#logout').hidden = false;
    poller?.stop();
    poller = startPolling('warden', onState, (ok, e) => {
      if (e?.status === 401) return lock('That PIN no longer works.');
      $('#conn').classList.toggle('off', !ok);
      $('#conn').textContent = ok ? 'Connected' : 'Reconnecting…';
    });
  } catch (e) {
    setPin(null);
    if (!quiet) $('#pin-msg').textContent = e.status === 401 ? 'Wrong PIN, partner.' : e.message;
  }
}
function lock(msg = '') {
  poller?.stop();
  store.set('wiw.pin', null);
  setPin(null);
  $('#gate').hidden = false;
  $('#station').hidden = true;
  $('#logout').hidden = true;
  $('#pin-msg').textContent = msg;
}
$('#pin-form').addEventListener('submit', (e) => { e.preventDefault(); unlock($('#pin').value.trim()); });
$('#logout').addEventListener('click', () => lock());
const saved = store.get('wiw.pin');
if (saved) unlock(saved, true);

async function act(body, okMsg) {
  try {
    const res = await api('POST', body);
    poller.push(res.state);
    if (okMsg) toast(okMsg);
  } catch (e) { toast(e.message, true); }
}

// ---------- target picker ----------
function renderSelect() {
  const sel = $('#monster-select');
  const current = selectedTouched ? sel.value : (data.active?.name || sel.value);
  const groups = {};
  data.monsters.forEach((m) => { const g = m.custom ? 'Homebrew' : m.size; (groups[g] ||= []).push(m); });
  const order = [...SIZES, 'Homebrew'].filter((g) => groups[g]);
  sel.innerHTML = '<option value="">— Choose a monster —</option>' + order.map((g) => `<optgroup label="${g}">${
    groups[g].map((m) => {
      const p = data.progress[m.name];
      const mark = p?.solved ? '✓ ' : p && (p.revealed.length || data.notebook.find((e) => e.name === m.name)?.guesses.length) ? '◐ ' : '';
      return `<option value="${esc(m.name)}">${mark}${esc(m.name)} — ${m.kz}${m.name === data.active?.name ? '  ◀ LOCKED' : ''}</option>`;
    }).join('')
  }</optgroup>`).join('');
  sel.value = current || '';
}
$('#monster-select').addEventListener('change', () => { selectedTouched = true; });
$('#lock').addEventListener('click', () => {
  const name = $('#monster-select').value;
  if (!name) return toast('Pick a monster first.', true);
  selectedTouched = false;
  act({ action: 'setTarget', name }, `Target locked: ${name}`);
});
$('#clear').addEventListener('click', () => { selectedTouched = false; act({ action: 'setTarget', name: null }, 'Forstall standing down.'); });

// ---------- current target ----------
function renderTarget() {
  const el = $('#w-target');
  const a = data.active;
  el.classList.toggle('idle', !a);
  if (!a) {
    el.innerHTML = '<div><div class="label">NO TARGET LOCKED</div><div class="name">Forstall idle…</div><div class="meta">Players see “waiting for the Warden”.</div></div>';
    return;
  }
  const m = data.monsters.find((x) => x.name === a.name);
  const digits = m.kz.replace(/\D/g, '').split('');
  const rev = new Set(data.progress[a.name]?.revealed || []);
  const slot = (i) => {
    const cls = a.solved ? 'solved' : rev.has(i) ? 'revealed' : a.positional[i] !== null ? 'green' : '';
    return `<button class="slot ${cls}" data-pos="${i}" title="${cls ? 'Known to players' : 'Click to hand this digit to the posse'}">${digits[i]}</button>`;
  };
  el.innerHTML = `
    <div>
      <div class="label">TARGET LOCKED</div>
      <div class="name">${esc(a.name)}</div>
      <div class="meta">${esc(a.size)}${m.page ? ` · Guidebook p. ${m.page}` : ' · Homebrew'} ${a.solved ? '<span class="badge green">DECODED</span>' : ''}
        ${a.scanHalf ? '<span class="badge">SPINAL DEFLECTORS — HALF POOL</span>' : ''}</div>
      <div class="w-kz">${slot(0)}<span class="dash">-</span>${slot(1)}<span class="dash">-</span>${slot(2)}${slot(3)}${slot(4)}${slot(5)}</div>
      <div class="w-legend"><b style="color:var(--brass)">■</b> given by Scan · <b style="color:#7fd08a">■</b> found by guessing · <b>■</b> still hidden — click to give</div>
      <div class="w-actions">
        <button class="btn small" data-act="solve" type="button">Reveal all (mark decoded)</button>
        <button class="btn small danger" data-act="reset" type="button">Reset scan progress</button>
      </div>
    </div>`;
  el.querySelectorAll('[data-pos]').forEach((b) => b.addEventListener('click', () => {
    if (a.solved || b.classList.contains('revealed')) return;
    act({ action: 'reveal', name: a.name, position: Number(b.dataset.pos) }, `Gave the posse a ${digits[b.dataset.pos]}.`);
  }));
  el.querySelector('[data-act="solve"]').addEventListener('click', () => {
    if (confirm(`Reveal ${a.name}'s full frequency to the posse?`)) act({ action: 'solve', name: a.name });
  });
  el.querySelector('[data-act="reset"]').addEventListener('click', () => {
    if (confirm(`Wipe all scan progress for ${a.name}? This clears its notebook entry.`)) act({ action: 'reset', name: a.name }, 'Progress wiped.');
  });
}

// ---------- live feed ----------
function renderFeed() {
  const a = data.active;
  const feed = $('#feed');
  if (!a) { feed.innerHTML = '<p class="empty-note">Lock a target to see rolls and guesses as they happen.</p>'; return; }
  const items = [
    ...a.rolls.map((r) => ({ at: r.at, type: 'roll', r })),
    ...a.guesses.map((g, i) => ({ at: g.at, type: 'guess', g, n: i + 1 })),
  ].sort((x, y) => y.at - x.at);
  if (!items.length) { feed.innerHTML = '<p class="empty-note">Quiet out here… no scans yet.</p>'; return; }
  feed.innerHTML = items.map((it) => {
    if (it.type === 'roll') {
      const r = it.r;
      const pool = `${r.pool.black ? r.pool.black + 'B' : ''}${r.pool.gold ? r.pool.gold + 'G' : ''}`;
      return `<div class="item roll"><span class="when">${timeAgo(r.at)}</span>
        <span class="what">${esc(r.operator || 'Someone')} scanned · ${pool}${r.halved ? ' (halved)' : ''} · ${r.hits} hit${r.hits === 1 ? '' : 's'}</span>
        <span class="dice-mini" data-dice='${esc(JSON.stringify(r.dice))}'></span>
        ${r.newDigits.length ? `<span>gave ${chipsHTML(r.newDigits)}</span>` : ''}</div>`;
    }
    const g = it.g;
    return `<div class="item guess"><span class="when">${timeAgo(g.at)}</span>
      <span class="what">#${it.n} ${esc(g.operator || '')}</span>${diamondsHTML(g.digits, g.result)}</div>`;
  }).join('');
  feed.querySelectorAll('[data-dice]').forEach((el) => staticDice(el, JSON.parse(el.dataset.dice)));
}

// ---------- settings / homebrew ----------
$('#easy').addEventListener('change', (e) => act({ action: 'setEasy', value: e.target.checked }, e.target.checked ? 'Warden’s aid on — positions shown.' : 'Warden’s aid off.'));

const rand6 = () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 10));
$('#c-rand').addEventListener('click', () => { const d = rand6(); $('#c-kz').value = `${d[0]}-${d[1]}-${d.slice(2).join('')}`; });
$('#custom-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await act({ action: 'addCustom', name: $('#c-name').value, size: $('#c-size').value, kz: $('#c-kz').value }, 'Homebrew monster added.');
  $('#c-name').value = ''; $('#c-kz').value = '';
});
function renderCustom() {
  const list = data.monsters.filter((m) => m.custom);
  $('#custom-list').innerHTML = list.map((m) => `<div class="custom-row"><span>${esc(m.name)} · ${m.kz}</span>
    <button class="btn small secondary danger" data-rm="${esc(m.name)}" type="button">Remove</button></div>`).join('');
  $('#custom-list').querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    if (confirm(`Remove ${b.dataset.rm} and its notebook entry?`)) act({ action: 'removeCustom', name: b.dataset.rm });
  }));
}

// ---------- notebook ----------
const nbBody = $('#nb-body');
const nbSearch = $('#nb-search');
function renderNb() {
  if (!data) return;
  renderNotebook(nbBody, data.notebook, {
    active: data.active?.name, filter: nbSearch.value,
    onNote: (name, text) => act({ action: 'note', name, text }, 'Note saved.'),
    wardenTools: (e) => `<div class="nb-tools">
      ${e.solved ? '' : `<button class="btn small secondary" data-nb="solve" data-name="${esc(e.name)}" type="button">Mark decoded</button>`}
      <button class="btn small secondary danger" data-nb="reset" data-name="${esc(e.name)}" type="button">Delete entry</button></div>`,
  });
  nbBody.querySelectorAll('[data-nb]').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.name;
    if (b.dataset.nb === 'solve') act({ action: 'solve', name }, `${name} marked decoded.`);
    else if (confirm(`Delete the notebook entry for ${name}?`)) act({ action: 'reset', name }, 'Entry deleted.');
  }));
}
nbSearch.addEventListener('input', renderNb);
nbBody.addEventListener('focusout', () => setTimeout(renderNb, 50));

function onState(d) {
  data = d;
  $('#easy').checked = !!d.settings.easyMode;
  $('#store-kind').textContent = d.store === 'redis' ? 'Saved to the cloud database' : d.store === 'file' ? 'Local dev storage' : '⚠ No database connected — progress resets when the server sleeps';
  renderSelect();
  renderTarget();
  renderFeed();
  renderCustom();
  renderNb();
}
