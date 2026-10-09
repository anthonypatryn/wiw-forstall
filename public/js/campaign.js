// Campaign (Warden): the notebook and story layer over the whole game. Three tabs:
//   Notes    named notebook pages, saved as you type, with any game thing pinned to them
//   Threads  storylines: the truth, what the posse knows, the next beat, a clock, and what's tied to them
//            (a draft until Save, like Prep; ticking a saved thread's clock saves straight away)
//   In play  everything live in the game right now (quests, clues, posters, handouts, people met), what's still hidden
//            (with Reveal), and handouts written ahead, ready to hand out
// Anything can be pinned (searched by name) or made new right here (hidden until revealed, like Prep's quick forms).
import { $, esc, api, toast, mountNav, tryWarden, savedPin, wardenModal, ask, onChange } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';

mountTableLog();
mountNav('/campaign');
const EP = '/api/campaign';
const STATUS = [['active', 'Active', 'in play now'], ['brewing', 'Brewing', 'not met yet'], ['resolved', 'Resolved', 'it’s over'], ['dropped', 'Dropped', 'set aside']];
const KINDS = [['npc', 'People'], ['faction', 'Factions'], ['quest', 'Quests'], ['clue', 'Clues'], ['poster', 'Wanted'], ['handout', 'Handouts'], ['draft', 'To hand out'], ['item', 'Items'], ['town', 'Towns'], ['scene', 'Scenes']];
const KIND_ONE = { npc: 'person', faction: 'faction', quest: 'quest', clue: 'clue', poster: 'poster', handout: 'handout', draft: 'handout to give', item: 'item', town: 'town', scene: 'scene' };
const TABS = [['notes', 'Notes', 'pencil'], ['threads', 'Threads', 'lasso'], ['inplay', 'In play', 'star']];

let S = null, ref = { list: [], by: new Map(), raw: {} };
let tab = 'notes';
let ed = null, dirty = false, showOld = false; // the thread being edited
let noteId = '', pinTo = ''; // the open note; "Pin" on In play adds to the last note you opened
let linkQ = '', linkKind = '', adding = '', draft = {}; // the link search and the quick "+ New" form
let saveTimer = null, saving = false;

const blankThread = () => ({ title: '', status: 'brewing', truth: '', known: '', nextBeat: '', clock: { size: 0, filled: 0, doom: '' }, links: [] });
const copyOf = (t) => JSON.parse(JSON.stringify(t));
const notes = () => S?.notes || [];
const drafts = () => S?.drafts || [];
const curNote = () => notes().find((n) => n.id === noteId) || null;
// where In play's "Pin" goes: the note you have open, else the last one you opened, else the latest you wrote in
const pinNote = () => curNote() || notes().find((n) => n.id === pinTo) || [...notes()].sort((a, b) => b.updated - a.updated)[0] || null;
const post = async (body) => { const r = await api('POST', body, '', EP); S = r.state; return r.result; };

// ---------- everything that can be pinned or linked, as {kind, id, name, sub, href} ----------
function buildRef() {
  const { npcs = {}, wanted = {}, journal = {}, scenes = {}, handouts = {}, shop = {} } = ref.raw;
  const list = [];
  for (const n of npcs.npcs || []) list.push({ kind: 'npc', id: n.id, name: n.name, sub: [n.faction, n.known ? 'met' : 'not met yet'].filter(Boolean).join(' · '), href: '/names' });
  for (const f of npcs.factions || []) list.push({ kind: 'faction', id: f.name, name: f.name, sub: f.known === false ? 'faction · not known yet' : 'faction', href: '/names' });
  for (const q of journal.quests || []) list.push({ kind: 'quest', id: q.id, name: q.title, sub: `${q.status === 'open' ? 'quest' : `quest · ${q.status}`}${q.revealed ? '' : ' · hidden'}`, href: '/journal#quests' });
  for (const c of journal.clues || []) list.push({ kind: 'clue', id: c.id, name: c.title || c.text.slice(0, 40), sub: c.revealed ? 'clue' : 'clue · hidden', href: '/journal#clues' });
  for (const p of wanted.posters || []) list.push({ kind: 'poster', id: p.id, name: p.name, sub: `wanted · ${p.hidden ? 'hidden' : p.status}`, href: `/wanted#${encodeURIComponent(p.town || '')}` });
  for (const h of handouts.list || []) list.push({ kind: 'handout', id: h.id, name: h.title, sub: `handout · ${h.kind}`, href: '/backpack' });
  for (const d of drafts()) list.push({ kind: 'draft', id: d.id, name: d.title || d.text.slice(0, 40), sub: `${d.kind} · not handed out yet`, href: '#inplay' });
  for (const t of journal.towns || wanted.towns || []) list.push({ kind: 'town', id: t.id, name: t.name, sub: 'town', href: `/wanted#${encodeURIComponent(t.id)}` });
  for (const s of scenes.scenes || []) list.push({ kind: 'scene', id: s.id, name: s.title, sub: s.done ? 'scene · played' : 'scene', href: `/prep#${encodeURIComponent(s.id)}` });
  for (const it of shop.catalog || []) list.push({ kind: 'item', id: it.id, name: it.name, sub: ['item', it.sub || it.cat].filter(Boolean).join(' · '), href: '/store' });
  ref.list = list; ref.by = new Map(list.map((x) => [`${x.kind}:${x.id}`, x]));
}
async function loadRef(which = ['npcs', 'wanted', 'journal', 'scenes', 'handouts', 'shop']) {
  const get = (q, ep) => api('GET', null, q, ep).catch(() => ({}));
  const src = { npcs: ['?view=warden', '/api/npcs'], wanted: ['?view=warden', '/api/wanted'], journal: ['?view=warden', '/api/journal'], scenes: ['', '/api/scenes'], handouts: ['?view=warden', '/api/handouts'], shop: ['?view=catalog', '/api/shop'] };
  const got = await Promise.all(which.map((k) => get(...src[k])));
  which.forEach((k, i) => { ref.raw[k] = got[i]; });
  buildRef();
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

// ---------- pins: shown grouped by kind, added by search or made new ----------
function linkRows(links, empty) {
  if (!links.length) return `<p class="muted small-text">${empty}</p>`;
  return KINDS.map(([k, label]) => {
    const mine = links.filter((l) => l.kind === k);
    if (!mine.length) return '';
    return `<div class="cp-links-group"><span>${label}</span><div class="chip-row">${mine.map((l) => {
      const x = ref.by.get(`${l.kind}:${l.id}`);
      return `<span class="cp-link${x ? '' : ' gone'}">${x ? `<a href="${esc(x.href)}"${x.href.startsWith('#') ? ' data-go-tab="inplay"' : ''}>${esc(x.name)}</a>` : `<span>${esc(KIND_ONE[l.kind])} gone</span>`}<button type="button" data-unlink="${esc(`${l.kind}:${l.id}`)}" aria-label="Unpin ${esc(x?.name || 'it')}">×</button></span>`;
    }).join('')}</div></div>`;
  }).join('');
}
function linkResults(links) {
  const q = linkQ.trim().toLowerCase();
  if (!q && !linkKind) return '';
  const have = new Set(links.map((l) => `${l.kind}:${l.id}`));
  const hits = ref.list.filter((x) => !have.has(`${x.kind}:${x.id}`) && (!linkKind || x.kind === linkKind) && (!q || x.name.toLowerCase().includes(q)));
  if (!hits.length) return '<p class="muted small-text">Nothing matches.</p>';
  return `<div class="chip-row cp-results">${hits.slice(0, 24).map((x) => `<button type="button" class="chip-btn" data-link="${esc(`${x.kind}:${x.id}`)}">${esc(x.name)}<small>${esc(x.sub || KIND_ONE[x.kind])}</small></button>`).join('')}</div>${hits.length > 24 ? `<p class="muted small-text">${hits.length - 24} more: type more of the name.</p>` : ''}`;
}
function linker(links, label) {
  return `<div class="field-step cp-linker"><span>${label}</span>
      <input data-link-q value="${esc(linkQ)}" placeholder="Search by name…" aria-label="Search things to pin">
      <div class="chip-row">${[['', 'All'], ...KINDS].map(([v, l]) => `<button type="button" class="chip-btn${linkKind === v ? ' on' : ''}" data-kind="${v}">${l}</button>`).join('')}</div></div>
    <div id="link-results">${linkResults(links)}</div>
    ${newBtns()}`;
}

// ---------- quick "+ New": made straight away, hidden from the posse, and pinned here ----------
const NEW = {
  npc: { label: 'NPC', fields: [['name', 'Name', 60], ['personality', 'Personality (e.g. jumpy, owes money)', 140], ['physical', 'Looks', 180], ['where', 'Where they’re found', 80]] },
  poster: { label: 'poster', fields: [['name', 'Who’s wanted', 60], ['crime', 'For what', 300], ['reward', 'Reward ($)', 6]] },
  quest: { label: 'quest', fields: [['title', 'Quest name', 90], ['text', 'What it’s about', 3000], ['reward', 'Reward', 120]] },
  clue: { label: 'clue', fields: [['title', 'Clue name', 90], ['text', 'What the posse learns', 2000]] },
  handout: { label: 'handout', fields: [['title', 'Item name or note heading', 80], ['text', 'What it looks like, or the note as it’s written', 4000]] },
};
const towns = () => ref.raw.journal?.towns || ref.raw.wanted?.towns || [];
const newBtns = () => `<div class="btn-row cp-new-btns"><span class="muted small-text">or make one:</span>${Object.entries(NEW).map(([k, v]) => `<button type="button" class="btn small secondary" data-new-kind="${k}"${adding === k ? ' disabled' : ''}>+ ${v.label}</button>`).join('')}</div>${adding ? newForm() : ''}`;
function newForm() {
  const k = NEW[adding];
  const extra = adding === 'poster' ? `<select aria-label="Town" data-nf="town">${towns().map((t) => `<option value="${esc(t.id)}"${t.id === draft.town ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`
    : adding === 'handout' ? `<div class="chip-row">${[['item', 'Item'], ['note', 'Note']].map(([v, l]) => `<button type="button" class="chip-btn${(draft.kind || 'item') === v ? ' on' : ''}" data-nf-kind="${v}">${l}</button>`).join('')}</div>` : '';
  return `<div class="prep-new cp-new" role="group" aria-label="New ${k.label}"><b class="prep-new-h">NEW ${k.label.toUpperCase()} <small>${adding === 'handout' ? 'kept here until you hand it out (In play)' : 'hidden from the posse until you reveal it'}</small></b>
    ${extra}${k.fields.map(([f, ph, max]) => f === 'text' ? `<textarea data-nf="${f}" rows="2" maxlength="${max}" placeholder="${esc(ph)}">${esc(draft[f] || '')}</textarea>` : `<input data-nf="${f}" maxlength="${max}"${f === 'reward' && adding === 'poster' ? ' type="number" min="0" step="1"' : ''} value="${esc(draft[f] || '')}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`).join('')}
    <div class="btn-row"><button type="button" class="btn small" data-nf-make>Make it${tab === 'inplay' ? '' : ' and pin it'}</button><button type="button" class="btn small secondary" data-nf-cancel>Cancel</button></div></div>`;
}
async function makeNew() {
  const kind = adding, d = { ...draft };
  let link;
  if (kind === 'handout') { const x = await post({ action: 'draftSave', draft: { kind: d.kind || 'item', title: d.title, text: d.text } }); link = { kind: 'draft', id: x.id }; }
  else {
    const body = kind === 'npc' ? ['/api/npcs', { action: 'add', name: d.name, personality: d.personality, physical: d.physical, where: d.where, known: false }]
      : kind === 'poster' ? ['/api/wanted', { action: 'add', name: d.name, crime: d.crime, town: d.town || towns()[0]?.id, reward: Number(String(d.reward || '').replace(/[^0-9.]/g, '')) || 0, hidden: true }]
      : kind === 'quest' ? ['/api/journal', { action: 'saveQuest', title: d.title, text: d.text, reward: d.reward, revealed: false }]
      : ['/api/journal', { action: 'saveClue', title: d.title, text: d.text, revealed: false }];
    const r = await api('POST', body[1], '', body[0]);
    link = { kind, id: r.result.id };
    await loadRef([{ npc: 'npcs', poster: 'wanted', quest: 'journal', clue: 'journal' }[kind]]);
  }
  buildRef();
  adding = ''; draft = {};
  if (tab === 'notes' && curNote()) await pin(link);
  else if (tab === 'threads' && ed) { ed.links.push(link); touch(); }
  toast(tab === 'inplay' ? 'Made. It’s waiting under Not revealed yet.' : 'Made, and pinned here.');
  render();
}

// add a pin to the open note (saved at once; a thread's pins save with the thread)
async function pin(link) {
  const n = curNote(); if (!n) return;
  await post({ action: 'noteLinks', id: n.id, links: [...n.links, link] });
}

// ---------- tabs ----------
function renderTabs() {
  $('#cp-tabs').innerHTML = TABS.map(([k, l, icon]) => `<button type="button" class="chip-btn${tab === k ? ' on' : ''}" data-tab="${k}" role="tab" aria-selected="${tab === k}">${gl(icon)} ${l}</button>`).join('');
}
function setTab(t, keepHash = false) {
  tab = t; linkQ = ''; linkKind = ''; adding = ''; draft = {};
  if (!keepHash) history.replaceState(null, '', `#${t === 'notes' && noteId ? `n-${noteId}` : t === 'threads' && ed?.id ? `t-${ed.id}` : t}`);
  render();
}
function render() {
  renderTabs();
  $('#cp-two').hidden = tab === 'inplay'; $('#cp-inplay').hidden = tab !== 'inplay';
  if (tab === 'inplay') return renderInPlay();
  $('#cp-list-h').textContent = tab === 'notes' ? 'Notes' : 'Threads';
  $('#cp-new').textContent = tab === 'notes' ? '+ New note' : '+ New thread';
  if (tab === 'notes') { renderNoteList(); renderNote(); } else { renderThreadList(); renderThread(); }
}

// ---------- Notes ----------
function renderNoteList() {
  const list = [...notes()].sort((a, b) => b.updated - a.updated);
  $('#cp-list').innerHTML = list.length ? list.map((n) => `<button type="button" class="cp-item${n.id === noteId ? ' on' : ''}" data-note="${esc(n.id)}"><span class="cp-dot">${gl('pencil')}</span>
      <span class="cp-item-body"><b>${esc(n.title.trim() || 'Untitled')}</b><small>${esc(n.text.trim().slice(0, 90) || 'Empty')}</small>${n.links.length ? `<small>${n.links.length} pinned</small>` : ''}</span></button>`).join('')
    : '<p class="empty-note">No notes yet. “New note” starts a page: plans, ideas, what happened, anything.</p>';
}
function renderNote() {
  const n = curNote();
  if (!n) {
    $('#editor').innerHTML = `<div class="prep-empty cp-empty">${gl('pencil')}<p>Pick a note, or start a new one.</p><p class="muted small-text">Your campaign notebook: only you see it. Write anything, and pin the clues, quests, posters, people, handouts and items it’s about, so they’re one tap away.</p></div>`;
    return;
  }
  $('#editor').innerHTML = `
    <div class="head-row"><input class="cp-note-title" data-note-f="title" maxlength="90" value="${esc(n.title)}" placeholder="Note title" aria-label="Note title"><button type="button" class="btn small secondary danger" data-note-del>Delete</button></div>
    <textarea class="cp-note-text" data-note-f="text" rows="14" maxlength="20000" placeholder="Anything: plans, what happened, ideas for later, who knows what…">${esc(n.text)}</textarea>
    <p class="muted small-text cp-saved" id="note-saved">Saves as you type.</p>
    <h3 class="prep-h">${gl('pin')} Pinned to this note</h3>
    <div class="cp-links">${linkRows(n.links, 'Nothing pinned yet. Search below, or make something new.')}</div>
    ${linker(n.links, 'PIN SOMETHING')}`;
}
function queueNoteSave() {
  const el = $('#note-saved'); if (el) el.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNoteNow, 700);
}
async function saveNoteNow() {
  clearTimeout(saveTimer); saveTimer = null;
  const n = curNote(); if (!n) return;
  const title = $('[data-note-f="title"]')?.value, text = $('[data-note-f="text"]')?.value;
  if (title === undefined || (title === n.title && text === n.text && !saving)) { const el = $('#note-saved'); if (el) el.textContent = 'Saved.'; return; }
  saving = true;
  try {
    await post({ action: 'noteText', id: n.id, title, text });
    const el = $('#note-saved'); if (el) el.textContent = 'Saved.';
    renderNoteList();
  } catch (err) { toast(err.message, true); const el = $('#note-saved'); if (el) el.textContent = 'Not saved: try again.'; }
  finally { saving = false; }
}

// ---------- Threads ----------
function renderThreadList() {
  const rank = (t) => STATUS.findIndex(([s]) => s === t.status);
  const cur = S.threads.filter((t) => t.status === 'active' || t.status === 'brewing').sort((a, b) => rank(a) - rank(b) || b.updated - a.updated);
  const old = S.threads.filter((t) => t.status === 'resolved' || t.status === 'dropped').sort((a, b) => b.updated - a.updated);
  const row = (t) => `<button type="button" class="cp-item${ed?.id === t.id ? ' on' : ''} st-${t.status}" data-open="${esc(t.id)}">
      ${t.clock?.size ? clockSVG(t.clock.size, t.clock.filled) : `<span class="cp-dot">${gl('lasso')}</span>`}
      <span class="cp-item-body"><b>${esc(t.title)}</b><small><span class="pill${t.status === 'active' ? ' hot' : t.status === 'resolved' ? ' ok' : ''}">${STATUS.find(([s]) => s === t.status)[1]}</span>${t.clock?.size ? ` Clock ${clockText(t.clock)}` : ''}</small>
      ${t.nextBeat ? `<small class="cp-next">Next: ${esc(t.nextBeat)}</small>` : ''}</span></button>`;
  $('#cp-list').innerHTML = (cur.length ? cur.map(row).join('') : '<p class="empty-note">No threads yet. A thread is one storyline: start one with “New thread”.</p>')
    + (old.length ? `<button type="button" class="btn small secondary cp-old" data-old>${showOld ? 'Hide' : 'Show'} ${old.length} resolved or dropped</button>${showOld ? old.map(row).join('') : ''}` : '');
}
function renderThread() {
  if (!ed) {
    $('#editor').innerHTML = `<div class="prep-empty cp-empty">${gl('lasso')}<p>Pick a thread, or start a new one.</p>
      <p class="muted small-text">A thread is one storyline running through the campaign: a land grab, a missing girl, a cursed mine. Write down what’s really going on, what the posse has figured out so far, and what happens next. Give it a clock if it gets worse while they’re busy elsewhere, and tie on the people, factions, quests and clues it touches.</p></div>`;
    return;
  }
  const k = ed.clock;
  $('#editor').innerHTML = `
    <div class="head-row"><h2 class="section-title">${ed.id ? 'Edit thread' : 'New thread'}</h2>${ed.id ? '<button type="button" class="btn small secondary danger" data-del>Delete</button>' : ''}</div>
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

    <h3 class="prep-h">${gl('lasso')} Tied to this <small>people, factions, quests, clues, posters, handouts, items, towns and scenes</small></h3>
    <div class="cp-links">${linkRows(ed.links, 'Nothing tied on yet. Search below, or make something new.')}</div>
    ${linker(ed.links, 'TIE SOMETHING ON')}

    <div class="btn-row prep-save"><button type="button" class="btn" data-save>${gl('scroll')} Save thread</button><span class="muted small-text" id="dirty">${dirty ? 'Unsaved changes' : ''}</span></div>`;
}
const touch = () => { dirty = true; const d = $('#dirty'); if (d) d.textContent = 'Unsaved changes'; };

// a saved thread's clock moves on the server right away; the rest of the draft stays as it is
async function setClock(to) {
  const k = ed.clock;
  to = Math.max(0, Math.min(k.size, to));
  if (to === k.filled) return;
  if (ed.id && S.threads.find((t) => t.id === ed.id)?.clock?.size === k.size) {
    const t = await post({ action: 'tick', id: ed.id, to });
    k.filled = t.clock.filled;
    if (k.filled >= k.size) toast(`The clock is full: ${k.doom || 'it happens'}.`);
  } else { k.filled = to; touch(); }
  renderThreadList(); renderThread();
}

// ---------- In play ----------
function renderInPlay() {
  const { npcs = {}, wanted = {}, journal = {}, handouts = {} } = ref.raw;
  const quests = journal.quests || [], clues = journal.clues || [], posters = (wanted.posters || []).filter((p) => p.status === 'wanted'), people = npcs.npcs || [];
  const note = pinNote();
  const pinBtn = (kind, id) => (note ? `<button type="button" class="btn small secondary" data-pin="${esc(`${kind}:${id}`)}" title="Pin to “${esc(note.title || 'Untitled')}”">${gl('pin')} Pin</button>` : '');
  const row = (kind, id, name, meta, extra = '') => {
    const x = ref.by.get(`${kind}:${id}`);
    return `<div class="cp-row"><div class="cp-row-body"><a href="${esc(x?.href || '#')}"><b>${esc(name)}</b></a>${meta ? `<small>${meta}</small>` : ''}</div><div class="btn-row">${extra}${pinBtn(kind, id)}</div></div>`;
  };
  const card = (icon, title, body, empty, cls = '') => `<section class="card corner cp-card${cls}"><h2 class="section-title">${gl(icon)} ${title}</h2>${body || `<p class="muted small-text">${empty}</p>`}</section>`;
  const nextStep = (q) => q.steps.find((s) => !s.done && !s.hidden)?.text;
  const open = quests.filter((q) => q.revealed && q.status === 'open');
  const known = clues.filter((c) => c.revealed);
  const up = posters.filter((p) => !p.hidden);
  const met = people.filter((n) => n.known);
  const hidden = [
    ...quests.filter((q) => !q.revealed && q.status === 'open').map((q) => row('quest', q.id, q.title, 'quest', `<button type="button" class="btn small" data-reveal="quest:${esc(q.id)}">Reveal</button>`)),
    ...clues.filter((c) => !c.revealed).map((c) => row('clue', c.id, c.title || c.text.slice(0, 40), 'clue', `<button type="button" class="btn small" data-reveal="clue:${esc(c.id)}">Reveal</button>`)),
    ...posters.filter((p) => p.hidden).map((p) => row('poster', p.id, p.name, `wanted · $${esc(p.reward)}`, `<button type="button" class="btn small" data-reveal="poster:${esc(p.id)}">Put it up</button>`)),
    ...people.filter((n) => !n.known).map((n) => row('npc', n.id, n.name, esc(n.faction || 'person'), `<button type="button" class="btn small" data-reveal="npc:${esc(n.id)}">Meet them</button>`)),
  ];
  const given = handouts.list || [];
  $('#cp-inplay').innerHTML = `
    <section class="card corner cp-inplay-top"><p class="cp-inplay-hint">Everything live in the game right now, and what’s still hidden.${note ? ` <b>Pin</b> adds a thing to your note “${esc(note.title || 'Untitled')}”.` : ' Write a note first to pin things to it from here.'}</p>${newBtns()}</section>
    <div class="stack-grid"><div class="stack-col">
      ${card('scroll', 'Ready to hand out', drafts().map((d) => `<div class="cp-row"><div class="cp-row-body"><b>${esc(d.title || 'A note')}</b><small>${d.kind}${d.text ? ` · ${esc(d.text.slice(0, 80))}` : ''}</small></div><div class="btn-row"><button type="button" class="btn small" data-give="${esc(d.id)}">Hand to the posse</button>${pinBtn('draft', d.id)}<button type="button" class="rm-btn" data-undraft="${esc(d.id)}" aria-label="Delete ${esc(d.title)}">×</button></div></div>`).join(''), 'Nothing waiting. “+ handout” writes one ahead of time.')}
      ${card('star', 'Open quests', open.map((q) => row('quest', q.id, q.title, nextStep(q) ? `Next: ${esc(nextStep(q))}` : 'quest')).join(''), 'No open quests the posse knows about.')}
      ${card('bulb', 'Clues they have', known.map((c) => row('clue', c.id, c.title || c.text.slice(0, 40), esc(c.text.slice(0, 80)))).join(''), 'No clues revealed yet.')}
      ${card('lasso', 'Wanted posters up', up.map((p) => row('poster', p.id, p.name, `$${esc(p.reward)} · ${esc(p.crime.slice(0, 60))}`)).join(''), 'No posters up.')}
    </div><div class="stack-col">
      ${card('lock', 'Not revealed yet', hidden.join(''), 'Nothing hidden: everything you’ve made is out in the open.', ' cp-hidden-card')}
      ${card('satchel', 'Handouts given', given.map((h) => row('handout', h.id, h.title, `${h.kind} · ${h.to === 'all' || h.shared ? 'the posse' : 'private'}`)).join(''), 'No handouts given yet.')}
      ${card('hat', 'People they’ve met', met.length ? `<div class="chip-row">${met.map((n) => `<span class="cp-link"><a href="/names">${esc(n.name)}</a>${note ? `<button type="button" data-pin="npc:${esc(n.id)}" aria-label="Pin ${esc(n.name)}" title="Pin">${gl('pin')}</button>` : ''}</span>`).join('')}</div>` : '', 'They haven’t met anyone yet.')}
    </div></div>`;
}

// ---------- events ----------
document.addEventListener('input', (e) => {
  const d = e.target.dataset;
  if (d.linkQ !== undefined) { linkQ = e.target.value; const r = $('#link-results'); if (r) r.innerHTML = linkResults(tab === 'notes' ? curNote()?.links || [] : ed?.links || []); return; }
  if (d.nf) { draft[d.nf] = e.target.value; return; }
  if (d.noteF) { queueNoteSave(); return; }
  if (!ed || tab !== 'threads') return;
  if (d.f === 'doom') { ed.clock.doom = e.target.value; touch(); return; }
  if (d.f) { ed[d.f] = e.target.value; touch(); }
});
document.addEventListener('change', (e) => { if (e.target.dataset.nf) draft[e.target.dataset.nf] = e.target.value; });
document.addEventListener('focusout', (e) => { if (e.target.dataset?.noteF && saveTimer) saveNoteNow(); });
document.addEventListener('keydown', (e) => {
  const s = e.target.closest?.('[data-slice]');
  if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); s.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
const leaveThread = async () => !dirty || await ask('Drop your unsaved changes to this thread?', { ok: 'Drop them' });
document.addEventListener('click', async (e) => {
  const go = e.target.closest('[data-go-tab]');
  if (go) { e.preventDefault(); setTab(go.dataset.goTab); return; }
  const slice = e.target.closest('[data-slice]');
  const b = slice || e.target.closest('button'); if (!b || !S) return;
  const d = b.dataset;
  try {
    if (d.tab) { if (d.tab === tab) return; if (tab === 'threads' && !await leaveThread()) return; if (saveTimer) await saveNoteNow(); if (d.tab !== 'threads') { ed = null; dirty = false; } setTab(d.tab); return; }
    if (d.newKind) { adding = d.newKind; draft = d.newKind === 'poster' ? { town: towns()[0]?.id } : {}; render(); document.querySelector('.cp-new [data-nf]')?.focus(); return; }
    if (d.nfKind) { draft.kind = d.nfKind; render(); return; }
    if (d.nfCancel !== undefined) { adding = ''; draft = {}; render(); return; }
    if (d.nfMake !== undefined) { b.disabled = true; try { await makeNew(); } finally { b.disabled = false; } return; }
    if (d.kind !== undefined) { linkKind = linkKind === d.kind ? '' : d.kind; render(); $('[data-link-q]')?.focus(); return; }
    if (d.cpNew !== undefined) {
      if (tab === 'notes') { if (saveTimer) await saveNoteNow(); const n = await post({ action: 'noteNew' }); noteId = pinTo = n.id; history.replaceState(null, '', `#n-${n.id}`); render(); $('[data-note-f="title"]')?.select(); return; }
      if (!await leaveThread()) return;
      ed = blankThread(); dirty = false; linkQ = ''; linkKind = ''; adding = ''; render(); $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('[data-f="title"]')?.focus(); return;
    }
    // ---- notes ----
    if (d.note) { if (saveTimer) await saveNoteNow(); noteId = pinTo = d.note; linkQ = ''; linkKind = ''; adding = ''; history.replaceState(null, '', `#n-${noteId}`); render(); if (innerWidth < 900) $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (d.noteDel !== undefined) {
      const n = curNote(); if (!n || !await ask(`Delete the note “${n.title || 'Untitled'}”?`, { ok: 'Delete it' })) return;
      clearTimeout(saveTimer); saveTimer = null;
      await post({ action: 'noteRemove', id: n.id }); noteId = ''; history.replaceState(null, '', '#notes'); render(); return;
    }
    if (d.link) {
      const [kind, ...rest] = d.link.split(':'), link = { kind, id: rest.join(':') };
      if (tab === 'notes') { await pin(link); render(); } else { ed.links.push(link); touch(); render(); }
      $('[data-link-q]')?.focus(); return;
    }
    if (d.unlink) {
      if (tab === 'notes') { const n = curNote(); await post({ action: 'noteLinks', id: n.id, links: n.links.filter((l) => `${l.kind}:${l.id}` !== d.unlink) }); render(); }
      else { ed.links = ed.links.filter((l) => `${l.kind}:${l.id}` !== d.unlink); touch(); render(); }
      return;
    }
    // ---- in play ----
    if (d.pin) {
      const target = pinNote(); if (!target) return;
      const [kind, ...rest] = d.pin.split(':'), link = { kind, id: rest.join(':') };
      if (target.links.some((l) => l.kind === link.kind && l.id === link.id)) { toast(`Already pinned to “${target.title || 'Untitled'}”.`); return; }
      await post({ action: 'noteLinks', id: target.id, links: [...target.links, link] });
      toast(`Pinned to “${target.title || 'Untitled'}”.`); return;
    }
    if (d.reveal) {
      const [kind, id] = d.reveal.split(':');
      if (kind === 'npc') await api('POST', { action: 'known', id, value: true }, '', '/api/npcs');
      if (kind === 'poster') await api('POST', { action: 'edit', id, hidden: false }, '', '/api/wanted');
      if (kind === 'quest' || kind === 'clue') await api('POST', { action: 'reveal', kind, id, value: true }, '', '/api/journal');
      await loadRef([kind === 'npc' ? 'npcs' : kind === 'poster' ? 'wanted' : 'journal']);
      render(); toast(kind === 'npc' ? 'The posse has met them now.' : kind === 'poster' ? 'The poster is up.' : 'Revealed to the posse.'); return;
    }
    if (d.give) {
      const x = drafts().find((y) => y.id === d.give); if (!x) return;
      if (!await ask(`Hand “${x.title || 'the note'}” to the whole posse now?`, { ok: 'Hand it out' })) return;
      const r = await api('POST', { action: 'send', kind: x.kind, title: x.title, text: x.text, to: 'all' }, '', '/api/handouts');
      await post({ action: 'draftUsed', id: x.id, handout: r.result?.id });
      await loadRef(['handouts']); render(); toast('Handed to the posse.'); return;
    }
    if (d.undraft) {
      const x = drafts().find((y) => y.id === d.undraft); if (!x || !await ask(`Delete “${x.title || 'this handout'}”? It was never handed out.`, { ok: 'Delete it' })) return;
      await post({ action: 'draftRemove', id: x.id }); buildRef(); render(); return;
    }
    // ---- threads ----
    if (d.open) { if (d.open !== ed?.id && !await leaveThread()) return; ed = copyOf(S.threads.find((t) => t.id === d.open)); dirty = false; linkQ = ''; linkKind = ''; adding = ''; history.replaceState(null, '', `#t-${ed.id}`); render(); if (innerWidth < 900) $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (d.old !== undefined) { showOld = !showOld; renderThreadList(); return; }
    if (!ed) return;
    if (d.status) { ed.status = d.status; touch(); renderThread(); return; }
    if (d.size !== undefined) { const n = Number(d.size); ed.clock.size = n; ed.clock.filled = Math.min(ed.clock.filled, n); touch(); renderThread(); return; }
    if (d.slice !== undefined) { const i = Number(d.slice); await setClock(ed.clock.filled === i + 1 ? i : i + 1); return; } // tapping the last filled slice empties it
    if (d.tick) { await setClock(ed.clock.filled + Number(d.tick)); return; }
    if (d.save !== undefined) {
      ed = copyOf(await post({ action: 'save', id: ed.id, thread: ed })); dirty = false;
      history.replaceState(null, '', `#t-${ed.id}`);
      render(); toast('Thread saved.'); return;
    }
    if (d.del !== undefined) {
      if (!await ask(`Delete the thread “${ed.title}”?`, { ok: 'Delete it' })) return;
      await post({ action: 'remove', id: ed.id }); ed = null; dirty = false; history.replaceState(null, '', '#threads'); render();
    }
  } catch (err) { toast(err.message, true); }
});
addEventListener('beforeunload', (e) => {
  if (saveTimer) saveNoteNow();
  if (dirty || saveTimer) { e.preventDefault(); e.returnValue = ''; }
});

// ---------- start ----------
async function open() {
  $('#gate').hidden = true; $('#camp').hidden = false;
  const [c] = await Promise.all([api('GET', null, '', EP).catch(() => null), loadRef()]);
  S = c?.threads ? c : { v: 0, threads: [], notes: [], drafts: [] };
  buildRef();
  fromHash();
  render();
  // a link to #notes, #inplay, #n-<note> or #t-<thread> from elsewhere on the page
  addEventListener('hashchange', async () => { if (dirty && !await leaveThread()) return; if (saveTimer) await saveNoteNow(); fromHash(); render(); });
  onChange(['campaign'], refresh);
  onChange(['npcs', 'journal', 'wanted', 'scenes', 'map', 'handouts'], async () => { await loadRef(['npcs', 'wanted', 'journal', 'scenes', 'handouts']); if (!typing()) render(); });
}
// #n-<note>, #t-<thread>, an old #<thread id>, or a tab name
function fromHash() {
  const h = location.hash.slice(1), thread = (id) => { const t = S.threads.find((x) => x.id === id); if (t) { tab = 'threads'; ed = copyOf(t); dirty = false; } return !!t; };
  if (h.startsWith('n-') && notes().some((n) => n.id === h.slice(2))) { tab = 'notes'; noteId = pinTo = h.slice(2); }
  else if (h.startsWith('t-') && thread(h.slice(2))) { /* opened */ }
  else if (thread(h)) { /* an old link */ }
  else if (['notes', 'threads', 'inplay'].includes(h)) tab = h;
  linkQ = ''; linkKind = ''; adding = ''; draft = {};
}
const typing = () => !!document.activeElement?.matches('input, textarea');
// the campaign changed somewhere else (an Undo, another tab): pick up the saved copy, keeping anything being typed here
async function refresh() {
  const c = await api('GET', null, '', EP).catch(() => null);
  if (!c?.threads || c.v === S?.v) return; // our own save, already shown
  S = c; buildRef();
  if (noteId && !curNote()) noteId = '';
  if (ed?.id) {
    const saved = S.threads.find((t) => t.id === ed.id);
    if (!saved) { if (!dirty) ed = null; }
    else if (!dirty) ed = copyOf(saved);
    else toast('This thread was changed somewhere else. Saving now will replace that change.', true);
  }
  if (tab === 'notes' && (typing() || saveTimer)) { renderNoteList(); return; } // don't yank the note out from under the cursor
  render();
}
$('#unlock').addEventListener('click', async () => { if (await wardenModal(EP)) { mountNav('/campaign'); open(); } });
(async () => {
  const pin = savedPin();
  if (pin && await tryWarden(pin, EP)) open(); else $('#gate').hidden = false;
})();
