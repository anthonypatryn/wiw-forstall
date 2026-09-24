import { $, esc, api, toast, store, mountNav, startPolling, timeAgo, tryWarden, forgetWarden, savedPin, wardenModal } from './common.js';
import { NPC } from './npc-data.js';
import { mountTableLog } from './tablelog.js';

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
const flipUp = (el) => el.classList.add('up');

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
  return {
    name: `${NPC[f.pick][f.card]} ${NPC.last[hand.last.card]}`,
    personality: NPC.personality[hand.personality.card],
    physical: NPC.physical[hand.physical.card],
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
let npcs = [], warden = false, poller = null, pendingLedger = false;

async function npcAct(body, el) {
  try {
    const res = await api('POST', body, '', EP);
    poller.push(res.state);
    if (el) { el.classList.remove('saved'); void el.offsetWidth; el.classList.add('saved'); }
    return res.result ?? true;
  } catch (e) { toast(e.message, true); return null; }
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
      <label class="f">WHERE THEY MET<input type="text" data-f="where" maxlength="80" value="${esc(n.where || '')}" placeholder="e.g. the saloon in Dodge"></label>
      <label class="f">POSSE NOTES<textarea data-f="posseNote" maxlength="3000" placeholder="What does the posse know about them?">${esc(n.posseNotes || '')}</textarea></label>
      ${warden ? `<label class="f secret-note">WARDEN NOTES — SECRET<textarea data-f="wardenNote" maxlength="3000" placeholder="Secrets, motives, stats…">${esc(n.wardenNotes || '')}</textarea></label>
        <div class="npc-tools"><label class="check"><input type="checkbox" data-known${n.known ? ' checked' : ''}> Posse has met them</label>
          <button class="btn small secondary danger" data-remove type="button">Remove</button></div>` : ''}
    </article>`).join('') : `<p class="empty-note">${q ? 'Nobody matches.' : 'Nobody yet — deal a stranger and add them.'}</p>`;
  box.querySelectorAll('.npc').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-f]').forEach((el) => {
      // save shortly after typing stops, and again on leaving the box if anything changed
      let timer, sent = el.value;
      const save = () => { clearTimeout(timer); if (el.value !== sent) { sent = el.value; npcAct({ action: el.dataset.f, id, text: el.value }, el); } };
      el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 800); });
      el.addEventListener('change', save);
    });
    card.querySelector('[data-known]')?.addEventListener('change', (e) => npcAct({ action: 'known', id, value: e.target.checked }));
    card.querySelector('[data-remove]')?.addEventListener('click', () => { if (confirm('Remove this NPC from the ledger?')) npcAct({ action: 'remove', id }); });
  });
}
$('#ledger').addEventListener('focusout', () => setTimeout(() => { if (pendingLedger) renderLedger(); }, 60));
$('#npc-search').addEventListener('input', renderLedger);

$('#save').addEventListener('click', async () => {
  const npc = npcFromHand();
  if (!npc) return;
  const r = await npcAct({ action: 'add', ...npc, known: $('#save-known').checked });
  if (r) toast(`${npc.name} is in the NPC ledger.`);
});
$('#copy').addEventListener('click', async () => {
  const npc = npcFromHand();
  if (!npc) return;
  try { await navigator.clipboard.writeText(`${npc.name} — ${npc.personality}, ${npc.physical.toLowerCase()}`); toast('Copied.'); }
  catch { toast('Couldn’t copy — select the text instead.', true); }
});

function connect() {
  poller?.stop();
  poller = startPolling(warden ? 'warden' : 'player', (d) => { npcs = d.npcs; renderLedger(); }, (ok, e) => {
    if (e?.status === 401) { warden = false; forgetWarden(); setWarden(); connect(); }
  }, EP);
}
function setWarden() {
  $('#warden-btn').textContent = warden ? '⭐ Warden mode · lock' : '⭐ Warden';
  $('#known-wrap').hidden = !warden;
  $('#manual-card').hidden = !warden;
  $('#book-card').hidden = !warden;
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
function renderBook() {
  if (!book) return;
  const person = (pp, faction, prof) => `<article class="bnpc" data-name="${esc(pp.name)}" data-faction="${esc(faction)}">
      <div class="hd">${prof ? `<img src="/img/tokens/npc-${esc(prof.img)}.webp" alt="">` : ''}<div><div class="nm">${esc(pp.name)}</div><div class="tag">${esc(faction.toUpperCase())} · P. ${pp.page}</div></div></div>
      ${pp.quote ? `<q>${esc(pp.quote.replace(/^“|”$/g, ''))}</q>` : ''}<p>${esc(pp.desc)}</p>
      ${prof ? statBlock(prof) : ''}
      <div class="acts"><button class="btn small secondary" data-ledger type="button">+ NPC ledger</button>${prof ? '<button class="btn small" data-fight type="button">⚔ Add to Combat</button>' : ''}</div>
    </article>`;
  $('#book').innerHTML = book.factions.map((f) => `<div class="faction"><h3>${esc(f.faction)}<small>P. ${f.page}</small></h3><div class="book-grid">
      ${f.people.map((pp) => person(pp, f.faction, pp.name === f.profile.name ? f.profile : null)).join('')}</div></div>`).join('')
    + `<div class="faction"><h3>Ready-Made Enemies<small>P. 191 · JUST ADD A NAME</small></h3><div class="book-grid">${book.generic.map((g) => `<article class="bnpc" data-generic="${esc(g.name)}">
      <div class="hd"><div><div class="nm">${esc(g.name.replace('Human - ', ''))}</div><div class="tag">HUMAN ENEMY PROFILE</div></div></div>
      ${statBlock(g)}
      <div class="acts"><input placeholder="Name them…" maxlength="40" data-gname><button class="btn small secondary" data-roll type="button" title="Random name from the card table">🎲</button>
        <button class="btn small secondary" data-ledger type="button">+ Ledger</button><button class="btn small" data-fight type="button">⚔ Combat</button></div></article>`).join('')}</div></div>`;

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
        toast(`${name} joins the fight — see Combat & Dice.`);
      } catch (err) { toast(err.message, true); }
    });
  });
}
async function loadBook() {
  if (book || !warden) return;
  try { book = await api('GET', null, '?view=book', EP); renderBook(); } catch {}
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
$('#deal').addEventListener('click', deal);
$('#shuffle').addEventListener('click', async () => { if (busy) return; busy = true; shuffleDeck(); await animateShuffle(); busy = false; toast('Fresh deck — all 52 cards.'); });

shuffleDeck();
(async () => {
  const pin = savedPin();
  if (pin) warden = await tryWarden(pin, EP);
  setWarden();
  connect();
})();
