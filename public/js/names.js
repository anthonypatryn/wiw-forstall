import { $, esc, toast, store, mountNav } from './common.js';
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
    <div class="val${val.length > 14 ? ' long' : ''}">${esc(val)}</div>
    <div class="corner br">${r}<span>${SUIT[suit]}</span></div>
  </div>`;
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

// ---------- ledger ----------
function renderLedger() {
  const list = store.get('wiw.npcLedger', []);
  $('#ledger').innerHTML = list.length ? list.map((n, i) => `<li><b>${esc(n.name)}</b> — ${esc(n.personality)}, <span class="muted">${esc(n.physical.toLowerCase())}</span>
    <button type="button" data-rm="${i}" aria-label="Remove">✕</button></li>`).join('') : '<p class="empty-note">Nobody yet.</p>';
  $('#ledger').querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    const l = store.get('wiw.npcLedger', []); l.splice(Number(b.dataset.rm), 1); store.set('wiw.npcLedger', l); renderLedger();
  }));
}
$('#save').addEventListener('click', () => {
  const npc = npcFromHand();
  if (!npc) return;
  store.set('wiw.npcLedger', [npc, ...store.get('wiw.npcLedger', [])].slice(0, 60));
  renderLedger();
  toast(`${npc.name} is in the ledger.`);
});
$('#copy').addEventListener('click', async () => {
  const npc = npcFromHand();
  if (!npc) return;
  try { await navigator.clipboard.writeText(`${npc.name} — ${npc.personality}, ${npc.physical.toLowerCase()}`); toast('Copied.'); }
  catch { toast('Couldn’t copy — select the text instead.', true); }
});
$('#clear-ledger').addEventListener('click', () => { if (confirm('Clear the ledger on this device?')) { store.set('wiw.npcLedger', []); renderLedger(); } });

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
      showResult();
    }
  });
});
$('#deal').addEventListener('click', deal);
$('#shuffle').addEventListener('click', async () => { if (busy) return; busy = true; shuffleDeck(); await animateShuffle(); busy = false; toast('Fresh deck — all 52 cards.'); });

shuffleDeck();
renderLedger();
