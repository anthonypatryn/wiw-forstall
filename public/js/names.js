import { $, esc, api, toast, store, mountNav, startPolling, timeAgo, tryWarden, forgetWarden, savedPin, wardenModal , ask, askText, play } from './common.js';
import { NPC } from './npc-data.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';

mountTableLog();
mountNav('/names');

const COLS = ['first', 'last', 'personality', 'physical'];
const SUIT = { Hearts: '♥', Diamonds: '♦', Clubs: '♣', Spades: '♠' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

let deck = [];
let style = store.get('wiw.npcStyle', 'either'); // 'first1' male · 'first2' female · 'either' random
const hand = {};           // col → { card, pick: 'first1'|'first2' }
let busy = false;

// ---------- deck ----------
function shuffleDeck() {
  deck = [...Array(52).keys()];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  // Cards already on the table stay out of the deck, like a real hand.
  const out = new Set(Object.values(hand).map((h) => h.card));
  deck = deck.filter((c) => !out.has(c));
  renderDeck();
}
function renderDeck() {
  const el = $('#deck');
  const n = Math.min(6, Math.ceil(deck.length / 9));
  el.innerHTML = Array.from({ length: n }, (_, i) => `<div class="dcard" style="transform:translate(${-i * 1.5}px, ${-i * 1.5}px)"></div>`).join('');
  $('#deck-count').textContent = `${deck.length} card${deck.length === 1 ? '' : 's'}`;
}
async function animateShuffle() {
  const el = $('#deck');
  el.classList.remove('shuffling'); void el.offsetWidth; el.classList.add('shuffling');
  await wait(720);
  el.classList.remove('shuffling');
}

// ---------- cards ----------
function cardFace(col, idx, pick) {
  const name = NPC.cards[idx];
  const [rank, suit] = name.split(' of ');
  const r = rank === 'Ace' ? 'A' : rank === 'Jack' ? 'J' : rank === 'Queen' ? 'Q' : rank === 'King' ? 'K' : rank;
  const red = suit === 'Hearts' || suit === 'Diamonds';
  let val;
  if (col === 'first') val = NPC[pick][idx]; // first1 = men's names, first2 = women's (p. 204)
  else val = NPC[col][idx];
  return `<div class="face${red ? ' red' : ''}" aria-label="${esc(name)}: ${esc(val)}">
    <div class="corner tl">${r}<span>${SUIT[suit]}</span></div>
    <div class="pip-big">${SUIT[suit]}</div>
    <div class="val">${esc(val)}</div>
    <div class="corner br">${r}<span>${SUIT[suit]}</span></div>
  </div>`;
}

// Shrink a card's text until every word fits whole (hyphenated words stay together) in at most ~3 lines.
function fitText(el) {
  if (!el) return;
  const text = el.textContent.replace(/-/g, '‑'); // non-breaking hyphen
  el.innerHTML = text.split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
  const words = [...el.querySelectorAll('.w')];
  const maxH = el.parentElement.clientHeight * 0.42;
  const fits = () => el.scrollHeight <= maxH && words.every((w) => w.getBoundingClientRect().width <= el.clientWidth - 2);
  let size = 20;
  el.style.fontSize = `${size}px`;
  while (size > 10 && !fits()) { size -= 1; el.style.fontSize = `${size}px`; }
}

const slotEl = (col) => document.querySelector(`.slot[data-col="${col}"]`);
function deckOffset(target) {
  const d = $('#deck').getBoundingClientRect();
  const t = target.getBoundingClientRect();
  return { x: d.left + d.width / 2 - (t.left + t.width / 2), y: d.top + d.height / 2 - (t.top + t.height / 2), s: d.width / t.width };
}

async function dealTo(col) {
  if (!deck.length) { shuffleDeck(); await animateShuffle(); }
  const card = deck.pop();
  renderDeck();
  const pick = col === 'first' ? (style === 'either' ? (Math.random() < 0.5 ? 'first1' : 'first2') : style) : null;
  hand[col] = { card, pick };
  const el = document.createElement('div');
  el.className = 'pcard';
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `Swap the ${col} card`);
  el.innerHTML = `<div class="flip"><div class="back"></div>${cardFace(col, card, pick)}</div>`;
  slotEl(col).appendChild(el);
  fitText(el.querySelector('.val'));
  const o = deckOffset(el);
  if (!reduceMotion) {
    await el.animate([
      { transform: `translate(${o.x}px, ${o.y}px) scale(${o.s}) rotate(-8deg)` },
      { transform: 'translate(0, 0) scale(1) rotate(2deg)', offset: 0.85 },
      { transform: 'none' },
    ], { duration: 460, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished;
  }
  el.addEventListener('click', () => swap(col));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); swap(col); } });
  return el;
}
const flipUp = (el) => { el.classList.add('up'); play('card'); };

async function sweep(col) {
  const el = slotEl(col).querySelector('.pcard');
  if (!el) return;
  el.classList.remove('up');
  await wait(300);
  const o = deckOffset(el);
  if (!reduceMotion) {
    await el.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${o.x}px, ${o.y}px) scale(${o.s}) rotate(10deg)`, opacity: 0 }],
      { duration: 360, easing: 'ease-in' }).finished;
  }
  el.remove();
  delete hand[col];
}

// ---------- deal / swap ----------
async function deal() {
  if (busy) return;
  busy = true;
  $('#deal').disabled = true;
  await Promise.all(COLS.map((c, i) => wait(i * 60).then(() => sweep(c))));
  if (deck.length < 4) shuffleDeck();
  await animateShuffle();
  const els = [];
  for (const c of COLS) { els.push(await dealTo(c)); await wait(60); }
  for (const el of els) { flipUp(el); await wait(260); }
  await wait(350);
  showResult();
  busy = false;
  $('#deal').disabled = false;
}

async function swap(col) {
  if (busy || !hand[col]) return;
  busy = true;
  await sweep(col);
  const el = await dealTo(col);
  flipUp(el);
  await wait(500);
  showResult();
  busy = false;
}

function npcFromHand() {
  if (!COLS.every((c) => hand[c])) return null;
  const f = hand.first;
  const add = (base, id) => { const x = ($(id)?.value || '').trim(); return x ? `${base}, ${x}` : base; };
  return {
    name: `${NPC[f.pick][f.card]} ${NPC.last[hand.last.card]}`,
    personality: add(NPC.personality[hand.personality.card], '#x-pers'),
    physical: add(NPC.physical[hand.physical.card], '#x-phys'),
  };
}
function showResult() {
  const npc = npcFromHand();
  if (!npc) return;
  $('#result').hidden = false;
  $('#npc-line').innerHTML = `${esc(npc.name)}<small>${esc(npc.personality)} · ${esc(npc.physical.toLowerCase())}</small>`;
}

// ---------- shared NPC ledger ----------
const EP = '/api/npcs';
let npcs = [], factions = [], warden = false, poller = null, pendingLedger = false;

async function npcAct(body, el) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (el) { el.classList.remove('saved'); void el.offsetWidth; el.classList.add('saved'); }
    return res.result ?? true;
  } catch (e) { toast(e.message, true); return null; }
}

const factionOptions = (cur) => `<option value="">— none —</option>${factions.map((f) => `<option value="${esc(f.name)}"${f.name === cur ? ' selected' : ''}>${esc(f.name)}${f.known ? '' : ' (secret)'}</option>`).join('')}`;

// ---------- Warden: factions ----------
const openFac = new Set();
function renderFactions() {
  const box = $('#factions');
  if (!warden || box.contains(document.activeElement)) return;
  box.innerHTML = factions.map((f) => {
    const members = npcs.filter((n) => n.faction === f.name);
    const bookPeople = f.book && book ? (book.factions.find((b) => b.faction === f.name)?.people || []) : [];
    const loose = npcs.filter((n) => n.faction !== f.name);
    return `<details class="fac" data-fid="${esc(f.id)}"${openFac.has(f.id) ? ' open' : ''}><summary><h3>${esc(f.name)}<small>${f.book ? `GUIDEBOOK P. ${f.page}` : f.known ? 'YOUR FACTION · POSSE KNOWS' : 'YOUR FACTION · SECRET'} · ${members.length} IN LEDGER</small></h3></summary>
      ${f.book ? '' : `<label class="f">DESCRIPTION<textarea data-fdesc maxlength="1000" placeholder="Who they are, what they want">${esc(f.desc || '')}</textarea></label>`}
      ${bookPeople.length ? `<p class="muted fac-book">Guidebook members: ${bookPeople.map((pp) => esc(pp.name)).join(', ')}</p>` : ''}
      <div class="fac-members">${members.length ? members.map((n) => `<span class="mem">${esc(n.name)}${n.known ? '' : ' <i>(hidden)</i>'}<button type="button" data-unfac="${n.id}" aria-label="Take ${esc(n.name)} out of ${esc(f.name)}">×</button></span>`).join('') : '<span class="muted">No NPCs from the ledger yet.</span>'}</div>
      <div class="fac-add"><select data-addmem aria-label="Add an NPC to ${esc(f.name)}"><option value="">+ add an NPC from the ledger…</option>${loose.map((n) => `<option value="${n.id}">${esc(n.name)}${n.faction ? ` (now: ${esc(n.faction)})` : ''}</option>`).join('')}</select></div>
      ${f.book ? '' : `<div class="npc-tools"><label class="check"><input type="checkbox" data-fknown${f.known ? ' checked' : ''}> Posse knows about them</label><button class="btn small secondary danger" type="button" data-fremove>Delete faction</button></div>`}
    </details>`;
  }).join('');
  box.querySelectorAll('details.fac').forEach((d) => {
    const fid = d.dataset.fid;
    d.addEventListener('toggle', () => { if (d.open) openFac.add(fid); else openFac.delete(fid); });
    const f = factions.find((x) => x.id === fid);
    d.querySelector('[data-addmem]').addEventListener('change', (e) => { if (e.target.value) npcAct({ action: 'setFaction', id: e.target.value, faction: f.name }); });
    d.querySelectorAll('[data-unfac]').forEach((b) => b.addEventListener('click', () => npcAct({ action: 'setFaction', id: b.dataset.unfac, faction: '' })));
    const desc = d.querySelector('[data-fdesc]');
    if (desc) {
      let sent = desc.value;
      desc.addEventListener('change', () => { if (desc.value !== sent) { sent = desc.value; npcAct({ action: 'editFaction', id: fid, desc: desc.value }, desc); } });
    }
    d.querySelector('[data-fknown]')?.addEventListener('change', (e) => npcAct({ action: 'editFaction', id: fid, known: e.target.checked }));
    d.querySelector('[data-fremove]')?.addEventListener('click', async () => {
      if (await ask(`Delete ${f.name}? NPCs in it keep their notes but lose the faction.`)) npcAct({ action: 'removeFaction', id: fid });
    });
  });
}
$('#factions').addEventListener('focusout', () => setTimeout(renderFactions, 60));
$('#faction-new').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const r = await npcAct({ action: 'addFaction', name: f.name.value.trim(), desc: f.desc.value.trim(), known: f.known.checked });
  if (r) { toast(`${r.name} created.`); openFac.add(r.id); f.reset(); f.known.checked = true; renderFactions(); }
});

// call an NPC out: the Warden gets the challenge and accepts or says no (High-Noon Duel, p. 58)
async function challenge(n) {
  if (!n) return;
  const pc = store.get('wiw.me', null);
  if (!pc) return toast('Pick who you’re playing first — the “This is me” star on your sheet.', true);
  if (!await ask(`Challenge ${n.name} to a Duel?

A High-Noon Duel is do-or-die (p. 58): gear set aside, both roll every Skill, then DRAW! 1–2 Hits against you is a minor injury, 3–4 a severe one and Bleeding Out, 5 or more and you're dead. The Warden decides whether ${n.name} accepts.`, { ok: 'Throw down the challenge', danger: false })) return;
  const reason = await askText(`What's it over? (optional — the Warden sees this)`, '', { ok: 'Send the challenge' });
  if (reason === null) return;
  try { await api('POST', { action: 'duelRequest', pc, npcId: n.id, npcName: n.name, reason }, '', '/api/combat'); toast(`Challenge sent. The Warden will answer for ${n.name}.`); }
  catch (e) { toast(e.message, true); }
}

function renderLedger() {
  const box = $('#ledger');
  // Don't wipe out a note someone is typing; re-render when they leave the field.
  if (box.contains(document.activeElement) && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName)) { pendingLedger = true; return; }
  pendingLedger = false;
  const q = $('#npc-search').value.trim().toLowerCase();
  const list = npcs.filter((n) => !q || [n.name, n.personality, n.physical, n.where, n.posseNotes, n.wardenNotes].join(' ').toLowerCase().includes(q));
  box.innerHTML = list.length ? list.map((n) => `<article class="npc${n.known ? '' : ' hidden-npc'}" data-id="${n.id}">
      <div class="npc-top"><div><div class="npc-name">${esc(n.name)}</div><div class="npc-traits">${esc(n.personality)}${n.physical ? ` · ${esc(n.physical.toLowerCase())}` : ''}</div></div>
        <span class="when">${n.known ? '' : 'HIDDEN · '}${timeAgo(n.at)}</span></div>
      ${warden ? `<label class="f">FACTION<select data-faction>${factionOptions(n.faction)}</select></label>` : n.faction ? `<div class="npc-faction">${esc(n.faction)}</div>` : ''}
      <label class="f">WHERE THEY MET<input type="text" data-f="where" maxlength="80" value="${esc(n.where || '')}" placeholder="e.g. the saloon in Dodge"></label>
      <label class="f">POSSE NOTES<textarea data-f="posseNote" maxlength="3000" placeholder="What does the posse know about them?">${esc(n.posseNotes || '')}</textarea></label>
      ${warden ? `<label class="f secret-note">WARDEN NOTES — SECRET<textarea data-f="wardenNote" maxlength="3000" placeholder="Secrets, motives, stats…">${esc(n.wardenNotes || '')}</textarea></label>
        <div class="npc-tools"><label class="check"><input type="checkbox" data-known${n.known ? ' checked' : ''}> Posse has met them</label>
          <button class="btn small secondary danger" data-remove type="button">Remove</button></div>` : ''}
      ${!warden && n.known ? `<div class="npc-tools"><button class="btn small secondary" data-duel type="button">${gl('revolver')} Challenge to a Duel</button></div>` : ''}
    </article>`).join('') : `<p class="empty-note">${q ? 'Nobody matches.' : (warden ? 'Nobody yet — deal a stranger and add them.' : 'Nobody yet — folks show up here as the posse meets them.')}</p>`;
  box.querySelectorAll('.npc').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-f]').forEach((el) => {
      // save shortly after typing stops, and again on leaving the box if anything changed
      let timer, sent = el.value;
      const save = () => { clearTimeout(timer); if (el.value !== sent) { sent = el.value; npcAct({ action: el.dataset.f, id, text: el.value }, el); } };
      el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 800); });
      el.addEventListener('change', save);
    });
    card.querySelector('[data-faction]')?.addEventListener('change', (e) => npcAct({ action: 'setFaction', id, faction: e.target.value }, e.target));
    card.querySelector('[data-known]')?.addEventListener('change', (e) => npcAct({ action: 'known', id, value: e.target.checked }));
    card.querySelector('[data-duel]')?.addEventListener('click', () => challenge(npcs.find((x) => x.id === id)));
    card.querySelector('[data-remove]')?.addEventListener('click', async () => { if (await ask('Remove this NPC from the ledger?')) npcAct({ action: 'remove', id }); });
  });
}
$('#ledger').addEventListener('focusout', () => setTimeout(() => { if (pendingLedger) renderLedger(); }, 60));
$('#npc-search').addEventListener('input', renderLedger);

['#x-pers', '#x-phys'].forEach((id) => $(id).addEventListener('input', showResult));
$('#save').addEventListener('click', async () => {
  const npc = npcFromHand();
  if (!npc) return;
  const r = await npcAct({ action: 'add', ...npc, known: $('#save-known').checked });
  if (r) { toast(`${npc.name} is in the NPC ledger.`); $('#x-pers').value = ''; $('#x-phys').value = ''; }
});
$('#copy').addEventListener('click', async () => {
  const npc = npcFromHand();
  if (!npc) return;
  try { await navigator.clipboard.writeText(`${npc.name} — ${npc.personality}, ${npc.physical.toLowerCase()}`); toast('Copied.'); }
  catch { toast('Couldn’t copy — select the text instead.', true); }
});

function connect() {
  poller?.stop();
  poller = startPolling(warden ? 'warden' : 'player', (d) => { npcs = d.npcs; factions = d.factions || []; renderLedger(); renderFactions(); }, (ok, e) => {
    if (e?.status === 401) { warden = false; forgetWarden(); setWarden(); connect(); }
  }, EP);
}
function setWarden() {
  $('#warden-btn').innerHTML = `${gl('star')} ${warden ? 'Warden mode · lock' : 'Warden'}`;
  $('#known-wrap').hidden = !warden;
  $('#manual-card').hidden = !warden;
  $('#book-card').hidden = !warden;
  $('#faction-card').hidden = !warden;
  // dealing strangers is the Warden's job; the posse just sees the NPC ledger
  $('.table-felt').hidden = !warden;
  document.querySelector('.masthead .sub').textContent = warden ? 'Deal from the saloon deck — Official Guidebook, pages 203–204' : 'Everyone the posse has met, and what you know about them';
  document.querySelector('.masthead .kicker').textContent = warden ? 'PICK A CARD OR ROLL THEM BONES' : 'WHO’S WHO IN THE WEST';
  $('#ledger-blurb').textContent = warden
    ? 'Shared with the whole posse once they’ve met someone. Posse notes are for everyone; your Warden notes stay secret.'
    : 'Everyone the posse has met. Jot down what you learn about them — the whole posse sees your notes.';
  if (!warden) $('#result').hidden = true;
  if (warden) loadBook(); else { book = null; $('#book').innerHTML = ''; }
}
$('#warden-btn').addEventListener('click', async () => {
  if (warden) { warden = false; forgetWarden(); }
  else if (!(warden = await wardenModal(EP))) return;
  setWarden(); connect();
});


// ---------- Warden: write an NPC by hand ----------
$('#dl-pers').innerHTML = [...new Set(NPC.personality)].map((v) => `<option value="${esc(v)}">`).join('');
$('#dl-phys').innerHTML = [...new Set(NPC.physical)].map((v) => `<option value="${esc(v)}">`).join('');
$('#manual').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = `${f.first.value.trim()} ${f.last.value.trim()}`.trim();
  const r = await npcAct({ action: 'add', name, personality: f.personality.value.trim(), physical: f.physical.value.trim(), known: f.known.checked });
  if (r) { toast(`${name} is in the NPC ledger.`); f.reset(); f.known.checked = true; }
});

// ---------- Warden: NPCs from the Guidebook ----------
let book = null;
const randomName = () => {
  const i = Math.floor(Math.random() * 52), j = Math.floor(Math.random() * 52);
  return `${NPC[Math.random() < 0.5 ? 'first1' : 'first2'][i]} ${NPC.last[j]}`;
};
function statBlock(p) {
  const atk = p.attacks.map((w) => `<p><b>${esc(w.weapon)}</b> — ${w.ranges.map((r) => `${esc(r.range)} (${esc(r.grit)} Grit): ${esc(r.damage)}`).join(' · ')}${w.notes ? ` <i>${esc(w.notes)}</i>` : ''}</p>`).join('');
  return `<div class="statline"><span><b>HEALTH</b>${esc(p.health)}</span><span><b>DEF</b>${esc(p.defense)}</span><span><b>SPEED</b>${esc(p.speed)}</span>
      <span><b>CHA</b>${esc(p.charm)}</span><span><b>FIN</b>${esc(p.finesse)}</span><span><b>INT</b>${esc(p.intuition)}</span><span><b>NRV</b>${esc(p.nerve)}</span></div>
    <details><summary>Abilities, attacks &amp; items</summary>
      ${p.talents ? `<p><b>Talents:</b> ${esc(p.talents)}</p>` : ''}${p.abilities.map((a) => `<p>${esc(a)}</p>`).join('')}${atk}${p.items ? `<p><b>Items:</b> ${esc(p.items)}</p>` : ''}
    </details>`;
}
const openFactions = new Set();

// Every titled section folds open/closed; the choice is remembered on this device.
const ACC_KEY = 'wiw-names-closed';
function readClosed() { try { return new Set(JSON.parse(localStorage.getItem(ACC_KEY) || '[]')); } catch { return new Set(); } }
function initAccordions() {
  const closed = readClosed();
  document.querySelectorAll('section.card[data-acc]').forEach((sec) => {
    const title = sec.querySelector('.section-title');
    title.setAttribute('role', 'button'); title.tabIndex = 0;
    const set = (shut) => { sec.classList.toggle('collapsed', shut); title.setAttribute('aria-expanded', String(!shut)); };
    set(closed.has(sec.dataset.acc));
    const flip = () => {
      set(!sec.classList.contains('collapsed'));
      const now = readClosed();
      if (sec.classList.contains('collapsed')) now.add(sec.dataset.acc); else now.delete(sec.dataset.acc);
      try { localStorage.setItem(ACC_KEY, JSON.stringify([...now])); } catch {}
    };
    title.addEventListener('click', flip);
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });
}
initAccordions();

function renderBook() {
  if (!book) return;
  const person = (pp, faction, prof) => `<article class="bnpc" data-name="${esc(pp.name)}" data-faction="${esc(faction)}">
      <div class="hd">${prof ? `<img src="/img/tokens/npc-${esc(prof.img)}.webp" alt="" loading="lazy">` : ''}<div><div class="nm">${esc(pp.name)}</div><div class="tag">${esc(faction.toUpperCase())} · P. ${pp.page}</div></div></div>
      ${pp.quote ? `<q>${esc(pp.quote.replace(/^“|”$/g, ''))}</q>` : ''}<p>${esc(pp.desc)}</p>
      ${prof ? statBlock(prof) : ''}
      <div class="acts"><button class="btn small secondary" data-ledger type="button">+ NPC ledger</button>${prof ? '<button class="btn small" data-fight type="button">' + gl('revolver') + ' Add to Combat</button>' : ''}</div>
    </article>`;
  const openAttr = (k) => (openFactions.has(k) ? ' open' : '');
  $('#book').innerHTML = `<div class="acc-all"><button class="btn small secondary" type="button" data-acc-all="1">Open all</button><button class="btn small secondary" type="button" data-acc-all="0">Close all</button></div>`
    + book.factions.map((f) => `<details class="faction" data-k="${esc(f.faction)}"${openAttr(f.faction)}><summary><h3>${esc(f.faction)}<small>P. ${f.page} · ${f.people.length} ${f.people.length === 1 ? 'PERSON' : 'PEOPLE'}</small></h3></summary><div class="book-grid">
      ${f.people.map((pp) => person(pp, f.faction, pp.name === f.profile.name ? f.profile : null)).join('')}</div></details>`).join('')
    + `<details class="faction" data-k="generic"${openAttr('generic')}><summary><h3>Ready-Made Enemies<small>P. 191 · JUST ADD A NAME</small></h3></summary><div class="book-grid">${book.generic.map((g) => `<article class="bnpc" data-generic="${esc(g.name)}">
      <div class="hd"><div><div class="nm">${esc(g.name.replace('Human - ', ''))}</div><div class="tag">HUMAN ENEMY PROFILE</div></div></div>
      ${statBlock(g)}
      <div class="acts"><input placeholder="Name them…" maxlength="40" data-gname><button class="btn small secondary" data-roll type="button" title="Random name from the card table">${gl('die')}</button>
        <button class="btn small secondary" data-ledger type="button">+ Ledger</button><button class="btn small" data-fight type="button">${gl('revolver')} Combat</button></div></article>`).join('')}</div></details>`;
  $('#book').querySelectorAll('details.faction').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) openFactions.add(d.dataset.k); else openFactions.delete(d.dataset.k);
  }));
  $('#book').querySelectorAll('[data-acc-all]').forEach((b) => b.addEventListener('click', () => {
    $('#book').querySelectorAll('details.faction').forEach((d) => { d.open = b.dataset.accAll === '1'; });
  }));

  $('#book').querySelectorAll('.bnpc').forEach((card) => {
    const generic = card.dataset.generic;
    const g = generic && book.generic.find((x) => x.name === generic);
    const nameOf = () => (generic ? (card.querySelector('[data-gname]').value.trim() || randomName()) : card.dataset.name);
    card.querySelector('[data-roll]')?.addEventListener('click', () => { card.querySelector('[data-gname]').value = randomName(); });
    card.querySelector('[data-ledger]').addEventListener('click', async () => {
      const name = nameOf();
      const f = book.factions.find((x) => x.faction === card.dataset.faction);
      const pp = f?.people.find((x) => x.name === name);
      const r = await npcAct({
        action: 'add', name, faction: card.dataset.faction || '', known: false,
        personality: '', physical: '',
        wardenNotes: pp ? `${pp.quote} ${pp.desc}`.trim() : (g ? `Uses the ${g.name} profile (p. 191).` : ''),
        img: f && f.profile.name === name ? `npc-${f.profile.img}` : '',
      });
      if (r) toast(`${name} added to the ledger (hidden from the posse until you tick “met”).`);
    });
    card.querySelector('[data-fight]')?.addEventListener('click', async () => {
      const name = nameOf();
      try {
        await api('POST', { action: 'addEnemy', profile: `npc:${generic || name}`, name: generic ? name : undefined }, '', '/api/combat');
        toast(`${name} joins the fight — they’re on the Battle Map.`);
      } catch (err) { toast(err.message, true); }
    });
  });
}
async function loadBook() {
  if (book || !warden) return;
  try { book = await api('GET', null, '?view=book', EP); renderBook(); renderFactions(); } catch {}
}

// ---------- controls ----------
document.querySelectorAll('.seg [data-style]').forEach((b) => {
  b.setAttribute('aria-checked', String(b.dataset.style === style));
  b.addEventListener('click', () => {
    style = b.dataset.style;
    store.set('wiw.npcStyle', style);
    document.querySelectorAll('.seg [data-style]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    // Re-face the first-name card to match, without redrawing it.
    if (hand.first && style !== 'either') {
      hand.first.pick = style;
      const card = slotEl('first').querySelector('.pcard .flip');
      card.querySelector('.face').outerHTML = cardFace('first', hand.first.card, style);
      fitText(card.querySelector('.val'));
      showResult();
    }
  });
});
$('#deal').addEventListener('click', () => { $('#x-pers').value = ''; $('#x-phys').value = ''; deal(); });
$('#shuffle').addEventListener('click', async () => { if (busy) return; busy = true; shuffleDeck(); await animateShuffle(); busy = false; toast('Fresh deck — all 52 cards.'); });

shuffleDeck();
(async () => {
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWarden();
  connect();
})();
