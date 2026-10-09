// Campaign (Warden): threads, the storylines behind the game. Each has the truth, what the posse knows, the next beat,
// a clock that ticks toward trouble, and links to the NPCs, factions, quests, clues, posters, towns and scenes it touches.
// Edits are a draft until Save (like Prep); ticking a saved thread's clock saves straight away.
import { $, esc, api, toast, mountNav, tryWarden, savedPin, wardenModal, ask, onChange } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';

mountTableLog();
mountNav('/campaign');
const EP = '/api/campaign';
const STATUS = [['active', 'Active', 'in play now'], ['brewing', 'Brewing', 'not met yet'], ['resolved', 'Resolved', 'it’s over'], ['dropped', 'Dropped', 'set aside']];
const KINDS = [['npc', 'People'], ['faction', 'Factions'], ['quest', 'Quests'], ['clue', 'Clues'], ['poster', 'Wanted'], ['town', 'Towns'], ['scene', 'Scenes']];
const KIND_ONE = { npc: 'person', faction: 'faction', quest: 'quest', clue: 'clue', poster: 'poster', town: 'town', scene: 'scene' };
let S = null, ed = null, dirty = false, ref = {}, linkQ = '', linkKind = '', showOld = false;

const blank = () => ({ title: '', status: 'brewing', truth: '', known: '', nextBeat: '', clock: { size: 0, filled: 0, doom: '' }, links: [] });
const copyOf = (t) => JSON.parse(JSON.stringify(t));

// ---------- everything a thread can link to, as {kind, id, name, sub, href} ----------
function buildRef(npcs, wanted, journal, scenes) {
  const list = [];
  for (const n of npcs.npcs || []) list.push({ kind: 'npc', id: n.id, name: n.name, sub: [n.faction, n.known ? 'met' : 'not met yet'].filter(Boolean).join(' · '), href: '/names' });
  for (const f of npcs.factions || []) list.push({ kind: 'faction', id: f.name, name: f.name, sub: f.known === false ? 'not known yet' : 'faction', href: '/names' });
  for (const q of journal.quests || []) list.push({ kind: 'quest', id: q.id, name: q.title, sub: `${q.status === 'open' ? 'quest' : `quest · ${q.status}`}${q.revealed ? '' : ' · hidden'}`, href: '/journal#quests' });
  for (const c of journal.clues || []) list.push({ kind: 'clue', id: c.id, name: c.title || c.text.slice(0, 40), sub: c.revealed ? 'clue' : 'clue · hidden', href: '/journal#clues' });
  for (const p of wanted.posters || []) list.push({ kind: 'poster', id: p.id, name: p.name, sub: `wanted · ${p.hidden ? 'hidden' : p.status}`, href: `/wanted#${encodeURIComponent(p.town || '')}` });
  for (const t of journal.towns || wanted.towns || []) list.push({ kind: 'town', id: t.id, name: t.name, sub: 'town', href: `/wanted#${encodeURIComponent(t.id)}` });
  for (const s of scenes.scenes || []) list.push({ kind: 'scene', id: s.id, name: s.title, sub: s.done ? 'scene · played' : 'scene', href: `/prep#${encodeURIComponent(s.id)}` });
  return { list, by: new Map(list.map((x) => [`${x.kind}:${x.id}`, x])) };
}

// ---------- the clock: a circle cut into 4, 6 or 8 slices ----------
function clockSVG(size, filled, { big = false } = {}) {
  if (!size) return '';
  const r = 44, c = 50, slice = (i) => {
    const a0 = (i / size) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / size) * 2 * Math.PI - Math.PI / 2;
    const p = (a) => `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
    return `M${c} ${c} L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`;
  };
  const parts = Array.from({ length: size }, (_, i) => big
    ? `<path d="${slice(i)}" class="cp-slice${i < filled ? ' on' : ''}" data-slice="${i}" tabindex="0" role="button" aria-label="Fill the clock to ${i + 1} of ${size}"/>`
    : `<path d="${slice(i)}" class="cp-slice${i < filled ? ' on' : ''}"/>`).join('');
  return `<svg class="cp-clock${big ? ' big' : ''}" viewBox="0 0 100 100" aria-hidden="${big ? 'false' : 'true'}">${parts}<circle cx="50" cy="50" r="44" class="cp-rim"/></svg>`;
}
const clockText = (k) => (k?.size ? `${k.filled}/${k.size}${k.filled >= k.size ? ' · it happened' : ''}` : '');

// ---------- the list ----------
function renderList() {
  const rank = (t) => STATUS.findIndex(([s]) => s === t.status);
  const cur = S.threads.filter((t) => t.status === 'active' || t.status === 'brewing').sort((a, b) => rank(a) - rank(b) || b.updated - a.updated);
  const old = S.threads.filter((t) => t.status === 'resolved' || t.status === 'dropped').sort((a, b) => b.updated - a.updated);
  const row = (t) => `<button type="button" class="cp-item${ed?.id === t.id ? ' on' : ''} st-${t.status}" data-open="${esc(t.id)}">
      ${t.clock?.size ? clockSVG(t.clock.size, t.clock.filled) : `<span class="cp-dot">${gl('scroll')}</span>`}
      <span class="cp-item-body"><b>${esc(t.title)}</b><small><span class="pill${t.status === 'active' ? ' hot' : t.status === 'resolved' ? ' ok' : ''}">${STATUS.find(([s]) => s === t.status)[1]}</span>${t.clock?.size ? ` Clock ${clockText(t.clock)}` : ''}</small>
      ${t.nextBeat ? `<small class="cp-next">Next: ${esc(t.nextBeat)}</small>` : ''}</span></button>`;
  $('#thread-list').innerHTML = (cur.length ? cur.map(row).join('') : `<p class="empty-note">No threads yet. A thread is one storyline: start one with “New thread”.</p>`)
    + (old.length ? `<button type="button" class="btn small secondary cp-old" data-old>${showOld ? 'Hide' : 'Show'} ${old.length} resolved or dropped</button>${showOld ? old.map(row).join('') : ''}` : '');
}

// ---------- the editor ----------
function linkRows() {
  if (!ed.links.length) return '<p class="muted small-text">Nothing linked yet. Search below to tie people, places and plans to this thread.</p>';
  return KINDS.map(([k, label]) => {
    const mine = ed.links.filter((l) => l.kind === k);
    if (!mine.length) return '';
    return `<div class="cp-links-group"><span>${label}</span><div class="chip-row">${mine.map((l) => {
      const x = ref.by.get(`${l.kind}:${l.id}`);
      return `<span class="cp-link${x ? '' : ' gone'}">${x ? `<a href="${esc(x.href)}">${esc(x.name)}</a>` : `<span>${esc(KIND_ONE[l.kind])} gone</span>`}<button type="button" data-unlink="${esc(`${l.kind}:${l.id}`)}" aria-label="Unlink ${esc(x?.name || 'it')}">×</button></span>`;
    }).join('')}</div></div>`;
  }).join('');
}
function linkResults() {
  const q = linkQ.trim().toLowerCase();
  if (!q && !linkKind) return '';
  const have = new Set(ed.links.map((l) => `${l.kind}:${l.id}`));
  const hits = ref.list.filter((x) => !have.has(`${x.kind}:${x.id}`) && (!linkKind || x.kind === linkKind) && (!q || x.name.toLowerCase().includes(q)));
  if (!hits.length) return '<p class="muted small-text">Nothing matches.</p>';
  return `<div class="chip-row cp-results">${hits.slice(0, 24).map((x) => `<button type="button" class="chip-btn" data-link="${esc(`${x.kind}:${x.id}`)}">${esc(x.name)}<small>${esc(x.sub || KIND_ONE[x.kind])}</small></button>`).join('')}</div>${hits.length > 24 ? `<p class="muted small-text">${hits.length - 24} more: type more of the name.</p>` : ''}`;
}

function renderEditor() {
  if (!ed) {
    $('#editor').innerHTML = `<div class="prep-empty cp-empty">${gl('scroll')}<p>Pick a thread, or start a new one.</p>
      <p class="muted small-text">A thread is one storyline running through the campaign: a land grab, a missing girl, a cursed mine. Write down what’s really going on, what the posse has figured out so far, and what happens next. Give it a clock if it gets worse while they’re busy elsewhere, and link the people, factions, quests and clues it touches.</p></div>`;
    return;
  }
  const k = ed.clock;
  $('#editor').innerHTML = `
    <div class="head-row"><h2 class="section-title">${ed.id ? 'Edit thread' : 'New thread'}</h2>${ed.id ? `<button type="button" class="btn small secondary danger" data-del>Delete</button>` : ''}</div>
    <div class="field-step"><span>THREAD</span><input data-f="title" maxlength="90" value="${esc(ed.title)}" placeholder="e.g. The Baron’s land grab"></div>
    <div class="field-step"><span>WHERE IT STANDS</span><div class="chip-row">${STATUS.map(([s, l, sub]) => `<button type="button" class="chip-btn${ed.status === s ? ' on' : ''}" data-status="${s}">${l}<small>${sub}</small></button>`).join('')}</div></div>
    <div class="field-step cp-secret"><span>THE TRUTH <small>what’s really going on</small></span><textarea data-f="truth" rows="4" maxlength="4000" placeholder="The Baron is buying up the valley because the Forstall survey found…">${esc(ed.truth)}</textarea></div>
    <div class="field-step"><span>WHAT THE POSSE KNOWS <small>in their words, so far</small></span><textarea data-f="known" rows="3" maxlength="3000" placeholder="Someone’s scaring the homesteaders off their land.">${esc(ed.known)}</textarea></div>
    <div class="field-step"><span>NEXT BEAT <small>what you’ve got planned next</small></span><textarea data-f="nextBeat" rows="2" maxlength="1000" placeholder="The Widow Mae asks the posse to guard her well.">${esc(ed.nextBeat)}</textarea></div>

    <h3 class="prep-h">${gl('hourglass')} The clock <small>ticks toward trouble while the posse is busy elsewhere</small></h3>
    <div class="field-step"><span>SLICES</span><div class="chip-row">${[[0, 'No clock'], [4, '4'], [6, '6'], [8, '8']].map(([n, l]) => `<button type="button" class="chip-btn${k.size === n ? ' on' : ''}" data-size="${n}">${l}</button>`).join('')}</div></div>
    ${k.size ? `<div class="cp-clock-row">${clockSVG(k.size, k.filled, { big: true })}
      <div class="cp-clock-side"><div class="cp-clock-num">${k.filled} <small>of ${k.size}</small></div>
        <div class="btn-row"><button type="button" class="pm-btn" data-tick="-1" aria-label="Take a slice back"${k.filled ? '' : ' disabled'}>−</button><button type="button" class="pm-btn" data-tick="1" aria-label="Tick the clock"${k.filled < k.size ? '' : ' disabled'}>+</button></div>
        <p class="muted small-text">${ed.id ? 'Tap a slice or ±: it saves straight away.' : 'Tap a slice or ± to set where it starts.'}</p></div></div>
      <div class="field-step"><span>WHEN IT FILLS</span><input data-f="doom" maxlength="300" value="${esc(k.doom)}" placeholder="The Baron’s men burn the Widow Mae’s ranch."></div>
      ${k.filled >= k.size ? `<p class="notice urgent cp-doom">${gl('fire')} The clock is full: ${esc(k.doom || 'it happens')}.</p>` : ''}` : ''}

    <h3 class="prep-h">${gl('lasso')} Tied to this <small>people, factions, quests, clues, posters, towns and scenes</small></h3>
    <div class="cp-links">${linkRows()}</div>
    <div class="field-step cp-linker"><span>LINK SOMETHING</span>
      <input data-link-q value="${esc(linkQ)}" placeholder="Search by name…" aria-label="Search things to link">
      <div class="chip-row">${[['', 'All'], ...KINDS].map(([v, l]) => `<button type="button" class="chip-btn${linkKind === v ? ' on' : ''}" data-kind="${v}">${l}</button>`).join('')}</div></div>
    <div id="link-results">${linkResults()}</div>

    <div class="btn-row prep-save"><button type="button" class="btn" data-save>${gl('scroll')} Save thread</button><span class="muted small-text" id="dirty">${dirty ? 'Unsaved changes' : ''}</span></div>`;
}
const touch = () => { dirty = true; const d = $('#dirty'); if (d) d.textContent = 'Unsaved changes'; };
const drawResults = () => { const r = $('#link-results'); if (r) r.innerHTML = linkResults(); };

// a saved thread's clock moves on the server right away; the rest of the draft stays as it is
async function setClock(to) {
  const k = ed.clock;
  to = Math.max(0, Math.min(k.size, to));
  if (to === k.filled) return;
  if (ed.id && S.threads.find((t) => t.id === ed.id)?.clock?.size === k.size) {
    const r = await api('POST', { action: 'tick', id: ed.id, to }, '', EP);
    S = r.state; k.filled = r.result.clock.filled;
    if (k.filled >= k.size) toast(`The clock is full: ${k.doom || 'it happens'}.`);
  } else { k.filled = to; touch(); }
  renderList(); renderEditor();
}

document.addEventListener('input', (e) => {
  const d = e.target.dataset;
  if (!ed) return;
  if (d.linkQ !== undefined) { linkQ = e.target.value; drawResults(); return; }
  if (d.f === 'doom') { ed.clock.doom = e.target.value; touch(); return; }
  if (d.f) { ed[d.f] = e.target.value; touch(); }
});
document.addEventListener('keydown', (e) => {
  const s = e.target.closest?.('[data-slice]');
  if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); s.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
document.addEventListener('click', async (e) => {
  const slice = e.target.closest('[data-slice]');
  const b = slice || e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  try {
    if (d.new !== undefined) { if (dirty && !await ask('Drop your unsaved changes?', { ok: 'Drop them' })) return; ed = blank(); dirty = false; linkQ = ''; linkKind = ''; renderList(); renderEditor(); $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('[data-f="title"]')?.focus(); return; }
    if (d.open) { if (dirty && !await ask('Drop your unsaved changes?', { ok: 'Drop them' })) return; ed = copyOf(S.threads.find((t) => t.id === d.open)); dirty = false; linkQ = ''; linkKind = ''; history.replaceState(null, '', `#${ed.id}`); renderList(); renderEditor(); if (innerWidth < 900) $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (d.old !== undefined) { showOld = !showOld; renderList(); return; }
    if (!ed) return;
    if (d.status) { ed.status = d.status; touch(); renderEditor(); return; }
    if (d.size !== undefined) { const n = Number(d.size); ed.clock.size = n; ed.clock.filled = Math.min(ed.clock.filled, n); touch(); renderEditor(); return; }
    if (d.slice !== undefined) { const i = Number(d.slice); await setClock(ed.clock.filled === i + 1 ? i : i + 1); return; } // tapping the last filled slice empties it
    if (d.tick) { await setClock(ed.clock.filled + Number(d.tick)); return; }
    if (d.kind !== undefined) { linkKind = linkKind === d.kind ? '' : d.kind; renderEditor(); return; }
    if (d.link) { const [kind, ...rest] = d.link.split(':'); ed.links.push({ kind, id: rest.join(':') }); touch(); renderEditor(); $('[data-link-q]')?.focus(); return; }
    if (d.unlink) { ed.links = ed.links.filter((l) => `${l.kind}:${l.id}` !== d.unlink); touch(); renderEditor(); return; }
    if (d.save !== undefined) {
      const r = await api('POST', { action: 'save', id: ed.id, thread: ed }, '', EP);
      S = r.state; ed = copyOf(r.result); dirty = false;
      history.replaceState(null, '', `#${ed.id}`);
      renderList(); renderEditor(); toast('Thread saved.'); return;
    }
    if (d.del !== undefined) {
      if (!await ask(`Delete the thread “${ed.title}”?`, { ok: 'Delete it' })) return;
      const r = await api('POST', { action: 'remove', id: ed.id }, '', EP);
      S = r.state; ed = null; dirty = false; history.replaceState(null, '', location.pathname); renderList(); renderEditor();
    }
  } catch (err) { toast(err.message, true); }
});
addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

async function loadRef() {
  const get = (q, ep) => api('GET', null, q, ep).catch(() => ({}));
  const [npcs, wanted, journal, scenes] = await Promise.all([get('?view=warden', '/api/npcs'), get('?view=warden', '/api/wanted'), get('?view=warden', '/api/journal'), get('', '/api/scenes')]);
  ref = buildRef(npcs, wanted, journal, scenes);
}
async function open() {
  $('#gate').hidden = true; $('#camp').hidden = false;
  const [c] = await Promise.all([api('GET', null, '', EP).catch(() => null), loadRef()]);
  S = c?.threads ? c : { v: 0, threads: [] };
  const want = location.hash.slice(1), t = S.threads.find((x) => x.id === want);
  if (t) ed = copyOf(t);
  renderList(); renderEditor();
  onChange(['campaign'], refresh);
  onChange(['npcs', 'journal', 'wanted', 'scenes', 'map'], async () => { await loadRef(); if (ed && !document.activeElement?.matches('input, textarea')) renderEditor(); });
}
// the threads changed somewhere else (an Undo, another tab): pick up the saved copy, unless there are unsaved edits here
async function refresh() {
  const c = await api('GET', null, '', EP).catch(() => null);
  if (!c?.threads || c.v === S?.v) return; // our own save, already shown
  S = c;
  if (ed?.id) {
    const saved = S.threads.find((t) => t.id === ed.id);
    if (!saved) { if (!dirty) ed = null; }
    else if (!dirty) ed = copyOf(saved);
    else toast('This thread was changed somewhere else. Saving now will replace that change.', true);
  }
  renderList(); renderEditor();
}
$('#unlock').addEventListener('click', async () => { if (await wardenModal(EP)) { mountNav('/campaign'); open(); } });
(async () => {
  const pin = savedPin();
  if (pin && await tryWarden(pin, EP)) open(); else $('#gate').hidden = false;
})();
