// The saloon card table: the Warden's Saloon card (Run the Game), the players' invite, and the full-screen poker table.
import { esc, api, toast, startPolling, savedPin, store, rollPopup, ask } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const EP = '/api/saloon';
const me = () => store.get('wiw.me', null);
const STYLE = { tight: 'Plays it close', loose: 'Calls anything', bluffer: 'Loves a bluff' };
const PHASE = { bet1: 'First betting round', draw: 'The draw', bet2: 'Second betting round (double stakes)', over: 'Hand over' };
const $$ = (n) => `$${Number(n || 0).toFixed(2)}`;
export function saloonStyles() {
  if (document.getElementById('saloon-css')) return;
  document.head.insertAdjacentHTML('beforeend', '<link id="saloon-css" rel="stylesheet" href="/css/saloon.css?v=4">');
}
// "A♠" → a playing card (same look as the lock-picking cards)
const RANKV = { A: 'A', K: 'K', Q: 'Q', J: 'J' };
function card(lbl, cls = '') {
  if (!lbl) return `<div class="lk-card lk-back ${cls}"></div>`;
  const s = lbl.slice(-1), r = lbl.slice(0, -1), red = s === '♥' || s === '♦';
  return `<div class="lk-card ${red ? 'red' : ''} ${cls}"><span class="pc-tl">${RANKV[r] || r}<br>${s}</span><span class="pc-mid">${s}</span><span class="pc-br">${RANKV[r] || r}<br>${s}</span></div>`;
}

// ---------- the table (players and the Warden) ----------
let scene = null, view = null, sel = new Set(), busy = false, asWarden = false, lastLog = 0;
function seatHTML(t, s) {
  const h = t.hand, inHand = h && h.order.includes(s.key), folded = h?.folded?.[s.key];
  const shown = h?.shown?.[s.key] || h?.all?.[s.key];
  const peeks = (Array.isArray(h?.peeks) ? h.peeks : []).filter((p) => p.seat === s.key).map((p) => p.card);
  const cards = !inHand ? '' : shown ? shown.cards.map((c) => card(c, 'sm')).join('') : Array.from({ length: 5 }, (_, i) => card(peeks[i] || null, `sm${peeks[i] ? ' peeked' : ''}`)).join('');
  return `<div class="sl-seat${h?.turn === s.key ? ' turn' : ''}${folded ? ' folded' : ''}${h?.winners?.includes(s.key) ? ' won' : ''}">
    <div class="sl-who"><b>${esc(s.name)}</b><small>${s.kind === 'npc' ? `${asWarden ? `${esc(STYLE[s.style] || '')} · ` : ''}bank ${$$(s.bank)}` : `${s.net >= 0 ? '+' : '−'}${$$(Math.abs(s.net))}`}</small></div>
    ${inHand ? `<div class="sl-cards">${cards}</div>` : '<div class="sl-out">sitting out</div>'}
    <div class="sl-state">${folded ? 'folded' : h?.bets?.[s.key] ? `in for ${$$(h.bets[s.key])}` : ''}${shown?.name && h.phase === 'over' ? ` <i>${esc(shown.name)}</i>` : ''}${peeks.length && !shown ? ' <i>you peeked</i>' : ''}</div></div>`;
}
function controls(t) {
  const h = t.hand, key = `pc:${me()}`, seated = t.seats.some((s) => s.key === key);
  if (asWarden) return `<div class="btn-row">${!h || h.phase === 'over' ? `<button type="button" class="btn" data-sl="deal">${gl('die')} Deal ${h ? 'the next' : 'the first'} hand</button>` : `<span class="muted">Waiting on ${esc(t.seats.find((s) => s.key === h.turn)?.name || '…')}</span>`}<button type="button" class="btn secondary" data-sl="close">Close the table</button></div>`;
  if (!seated) return t.status === 'closed' ? '' : `<button type="button" class="btn" data-sl="join">Pull up a chair</button>`;
  if (!h || h.phase === 'over') return `<div class="btn-row"><button type="button" class="btn" data-sl="deal">${gl('die')} Deal ${h ? 'another' : 'the first'} hand</button><button type="button" class="btn secondary" data-sl="leave">Cash out &amp; leave</button></div>`;
  const mine = h.order.includes(key) && !h.folded[key];
  if (!mine) return '<p class="muted">You’re out of this hand. Watch and wait for the next deal.</p>';
  const myTurn = h.turn === key, used = new Set(h.used || []);
  const moves = [];
  if (myTurn && ['bet1', 'bet2'].includes(h.phase)) {
    if (h.owe > 0) moves.push(`<button type="button" class="btn" data-mv="call">Call ${$$(h.owe)}</button>`);
    else moves.push('<button type="button" class="btn" data-mv="check">Check</button>');
    if (h.raises < 3) moves.push(`<button type="button" class="btn" data-mv="${h.owe > 0 || h.high > 0 ? 'raise' : 'bet'}">${h.owe > 0 || h.high > 0 ? 'Raise' : 'Bet'} ${$$(h.betSize)}</button>`);
    moves.push('<button type="button" class="btn secondary" data-mv="fold">Fold</button>');
    if (t.hooks.bluff && !used.has('bluff')) moves.push(`<button type="button" class="btn small secondary skill" data-sl="bluff">${gl('hat')} Bluff (Charm)</button>`);
  }
  if (myTurn && h.phase === 'draw') {
    moves.push(`<button type="button" class="btn" data-sl="draw">${sel.size ? `Swap ${sel.size} card${sel.size > 1 ? 's' : ''}` : 'Stand pat'}</button>`);
    if (t.hooks.palm && !used.has('palm') && sel.size === 1) moves.push(`<button type="button" class="btn small secondary skill" data-sl="palm">${gl('flash')} Palm it instead (Finesse)</button>`);
  }
  if (t.hooks.tell && !used.has('tell')) {
    const npcs = t.seats.filter((s) => s.kind === 'npc' && h.order.includes(s.key) && !h.folded[s.key]);
    if (npcs.length) moves.push(`<span class="sl-tell">${gl('target')} Read a tell (Intuition): ${npcs.map((s) => `<button type="button" class="linkish" data-tell="${esc(s.key)}">${esc(s.name)}</button>`).join(' ')}</span>`);
  }
  const tip = !myTurn ? `<p class="muted">Waiting on ${esc(t.seats.find((s) => s.key === h.turn)?.name || '…')}…</p>`
    : h.phase === 'draw' ? `<p class="sl-tip">Tap up to ${h.drawLimit} card${h.drawLimit > 1 ? 's' : ''} to throw away${h.drawLimit === 4 ? ' (4 only if you keep your Ace)' : ''}, then draw.</p>` : '';
  return `${tip}<div class="btn-row sl-moves">${moves.join('')}</div>`;
}
function render() {
  if (!scene || !view) return;
  const t = view.table;
  if (!t) { closeTable(); return; }
  if (t.game === 'faro') { renderFaro(t); return; }
  if (t.game === 'liars') { renderLiars(t); return; }
  const h = t.hand, key = `pc:${me()}`;
  const npcs = t.seats.filter((s) => s.kind === 'npc'), pcs = t.seats.filter((s) => s.kind !== 'npc' && (asWarden || s.key !== key));
  const mine = asWarden ? null : h?.mine;
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Poker at ${esc(t.where)}">
    <div class="sl-top"><div><small>FIVE-CARD DRAW · ${esc(t.where.toUpperCase())}</small><b>${h ? `Hand ${h.no} — ${PHASE[h.phase] || ''}` : t.status === 'closed' ? 'The game has broken up' : 'Waiting for the deal'}</b></div>
      <span class="sl-stakes">Ante ${$$(t.stakes.ante)} · bets ${$$(t.stakes.bet)} / ${$$(t.stakes.bet * 2)}</span><button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
    <div class="sl-felt">
      <div class="sl-seats">${[...npcs, ...pcs].map((s) => seatHTML(t, s)).join('')}</div>
      <div class="sl-pot">${h ? `<span class="chips" aria-hidden="true">${'<i></i>'.repeat(Math.min(12, Math.ceil((h.pot || 0) / Math.max(1, t.stakes.bet))))}</span><b>POT ${$$(h.pot)}</b>` : ''}${h?.result ? `<p class="sl-result">${esc(h.result)}</p>` : ''}</div>
      ${mine ? `<div class="sl-mine"><div class="sl-hand${h.phase === 'draw' && h.turn === key ? ' picking' : ''}">${mine.map((c, i) => `<button type="button" class="sl-card${sel.has(i) ? ' out' : ''}" data-card="${i}">${card(c)}</button>`).join('')}</div><div class="sl-rank">${esc(h.myRank)}</div></div>`
        : ''}
    </div>
    <div class="sl-controls">${controls(t)}</div>
    ${h?.log?.length ? `<ol class="sl-log">${h.log.slice(-6).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
  </div>`;
}
async function act(body) {
  const r = await api('POST', { ...body, pc: me() }, '', EP);
  view = r.state; render();
  return r.result;
}
// ---------- Liar's Dice ----------
const FACE = { 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes' };
const bidText = (b) => `${b.qty} ${b.qty === 1 ? FACE[b.face].replace(/s$/, '').replace(/xe$/, 'x') : FACE[b.face]}`;
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const die = (n, cls = '') => (n ? `<span class="ld-die ${cls}${n === 1 ? ' wild' : ''}" aria-label="${n}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => `<i class="${PIPS[n].includes(p) ? 'on' : ''}"></i>`).join('')}</span>` : `<span class="ld-die cup ${cls}"></span>`);
const legal = (bid, qty, face) => !bid || qty > bid.qty || (qty === bid.qty && face > bid.face);
let lb = null; // the bid picker: { qty, face, for: bid signature }
function renderLiars(t) {
  const L = t.liars, key = `pc:${me()}`, seated = !asWarden && t.seats.some((s) => s.key === key);
  const inGame = seated && L && !L.over && L.counts[key] > 0, myTurn = inGame && L.turn === key;
  const sig = JSON.stringify(L?.bid || null) + (L?.round || 0);
  if (!lb || lb.for !== sig) {
    const b = L?.bid;
    lb = { for: sig, qty: b ? b.qty : 1, face: b ? b.face : 2 };
    if (b) { if (b.face < 6) lb.face = b.face + 1; else { lb.qty = b.qty + 1; lb.face = 2; } }
  }
  const seatBox = (s) => {
    const n = L?.counts?.[s.key] || 0, peeks = (L?.peeks || []).filter((p) => p.seat === s.key).map((p) => p.die);
    const shown = asWarden && L?.all?.[s.key];
    return `<div class="sl-seat${L?.turn === s.key ? ' turn' : ''}${L && !n ? ' folded' : ''}${L?.winner === s.key ? ' won' : ''}">
      <div class="sl-who"><b>${esc(s.name)}</b><small>${s.kind === 'npc' ? `${asWarden ? `${esc(STYLE[s.style] || '')} · ` : ''}bank ${$$(s.bank)}` : `${s.net >= 0 ? '+' : '−'}${$$(Math.abs(s.net))}`}</small></div>
      ${L && L.order.includes(s.key) ? `<div class="ld-cup">${n ? Array.from({ length: n }, (_, i) => (shown ? die(shown[i], 'sm') : die(peeks[i] || 0, `sm${peeks[i] ? ' peeked' : ''}`))).join('') : '<span class="sl-out">out of dice</span>'}</div>` : '<div class="sl-out">sitting out</div>'}
      <div class="sl-state">${L?.bid?.by === s.key ? `bid ${esc(bidText(L.bid))}` : ''}${peeks.length && !shown ? ' <i>you peeked</i>' : ''}</div></div>`;
  };
  const others = t.seats.filter((s) => asWarden || s.key !== key);
  const last = L?.last;
  const reveal = last ? `<div class="ld-reveal"><b>${esc(last.caller)} called ${esc(last.by)} a liar on ${esc(bidText(last.bid))}: there ${last.count === 1 ? 'was' : 'were'} ${last.count}. ${esc(last.loser)} lost a die.</b>
    <div class="ld-reveal-cups">${Object.entries(last.dice).map(([k, d]) => `<span><small>${esc(t.seats.find((s) => s.key === k)?.name || '?')}</small>${d.map((n) => die(n, `sm${n === last.bid.face || n === 1 ? ' hit' : ''}`)).join('')}</span>`).join('')}</div></div>` : '';
  const btns = [];
  if (asWarden) {
    btns.push(!L || L.over ? `<button type="button" class="btn" data-sl="deal">${gl('die')} ${L ? 'Start another game' : 'Start the game'}</button>` : `<span class="muted">Waiting on ${esc(t.seats.find((s) => s.key === L.turn)?.name || '…')}</span>`);
    btns.push('<button type="button" class="btn secondary" data-sl="close">Close the table</button>');
  } else if (!seated) {
    if (t.status !== 'closed') btns.push('<button type="button" class="btn" data-sl="join">Pull up a chair</button>');
  } else if (!L || L.over) {
    btns.push(`<button type="button" class="btn" data-sl="deal">${gl('die')} ${L ? 'Another game' : 'Start the game'}</button>`, '<button type="button" class="btn secondary" data-sl="leave">Cash out &amp; leave</button>');
  } else if (myTurn) {
    const ok = legal(L.bid, lb.qty, lb.face) && lb.qty <= L.total;
    btns.push(`<div class="ld-picker"><div class="fr-amt"><button type="button" class="pm-btn" data-lq="-1">−</button><b>${lb.qty}</b><button type="button" class="pm-btn" data-lq="1">+</button></div>
      <div class="ld-faces">${[2, 3, 4, 5, 6].map((f) => `<button type="button" class="ld-face${lb.face === f ? ' on' : ''}" data-lf="${f}">${die(f, 'sm')}</button>`).join('')}</div></div>`);
    btns.push(`<button type="button" class="btn" data-ld="bid"${ok ? '' : ' disabled'}>Bid ${esc(bidText({ qty: lb.qty, face: lb.face }))}</button>`);
    if (L.bid) btns.push('<button type="button" class="btn danger" data-ld="call">Liar!</button>');
    const used = new Set(L.used || []);
    if (t.hooks.stare && !used.has('stare')) btns.push(`<button type="button" class="btn small secondary skill" data-ld="stare">${gl('hat')} Stare them down (Charm)</button>`);
  } else btns.push(`<span class="muted">Waiting on ${esc(t.seats.find((s) => s.key === L.turn)?.name || '…')}…</span>`);
  const peekable = inGame && t.hooks.peek && !(L.used || []).includes('peek') ? t.seats.filter((s) => s.kind === 'npc' && L.counts[s.key] > 0) : [];
  const title = L ? (L.over ? `Game ${L.game} is over` : `Game ${L.game} — round ${L.round} · ${L.total} dice on the table`) : t.status === 'closed' ? 'The game has broken up' : 'Waiting for the first roll';
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Liar’s Dice at ${esc(t.where)}">
    <div class="sl-top"><div><small>LIAR’S DICE · ${esc(t.where.toUpperCase())}</small><b>${title}</b></div>
      <span class="sl-stakes">${$$(t.stakes.ante)} a head · ones are wild</span><button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
    <div class="sl-felt">
      <div class="sl-seats">${others.map(seatBox).join('')}</div>
      <div class="sl-pot">${L ? `<b>POT ${$$(L.pot)}</b>` : ''}${L?.bid && !L.over ? `<p class="ld-bid">The bid: <b>${esc(bidText(L.bid))}</b> <small>by ${esc(t.seats.find((s) => s.key === L.bid.by)?.name || '?')}</small></p>` : ''}${L?.over && L.winner ? `<p class="sl-result">${esc(t.seats.find((s) => s.key === L.winner)?.name || '')} takes the pot.</p>` : ''}</div>
      ${reveal}
      ${L?.mine?.length && inGame ? `<div class="sl-mine"><small class="ld-lbl">UNDER YOUR CUP</small><div class="ld-mine">${L.mine.map((n) => die(n)).join('')}</div></div>` : ''}
    </div>
    ${peekable.length ? `<p class="sl-tell">${gl('target')} Peek under a cup (Intuition): ${peekable.map((s) => `<button type="button" class="linkish" data-lpeek="${esc(s.key)}">${esc(s.name)}</button>`).join(' ')}</p>` : ''}
    <div class="sl-controls"><div class="btn-row sl-moves">${btns.join('')}</div></div>
    ${L?.log?.length ? `<ol class="sl-log">${L.log.slice(-6).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
  </div>`;
}

// ---------- faro ----------
const LAYOUT = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const RN = { 14: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const rn = (r) => RN[r] || String(r);
function renderFaro(t) {
  const f = t.faro, key = `pc:${me()}`, seated = !asWarden && t.seats.some((s) => s.key === key), dealer = t.seats.find((s) => s.kind === 'npc');
  const last = f?.turns?.[f.turns.length - 1];
  const others = (r) => Object.entries(f?.bets || {}).filter(([k, b]) => (asWarden || k !== key) && b[r]).map(([k, b]) => ({ name: t.seats.find((x) => x.key === k)?.name || '?', ...b[r] }));
  const myBets = asWarden ? {} : f?.bets?.[key] || {};
  const cell = (r) => {
    const dead = (f?.case?.[r] || 0) >= 4, mb = myBets[r], ob = others(r);
    return `<button type="button" class="fr-card${dead ? ' dead' : ''}${mb ? ' bet' : ''}" data-fr-rank="${r}"${dead || !seated || !f || f.over ? ' disabled' : ''}>
      ${card(`${rn(r)}♠`)}${mb ? `<span class="fr-chip${mb.copper ? ' copper' : ''}">${$$(mb.amt)}${mb.copper ? '<small>coppered</small>' : ''}</span>` : ''}
      ${ob.length ? `<span class="fr-others">${ob.map((o) => `<i class="${o.copper ? 'copper' : ''}" title="${esc(`${o.name} ${$$(o.amt)}${o.copper ? ' coppered' : ''}`)}"></i>`).join('')}</span>` : ''}</button>`;
  };
  const casekeeper = `<div class="fr-case" aria-label="Casekeeper: cards already out">${LAYOUT.map((r) => `<div class="fr-col"><b>${rn(r)}</b>${[0, 1, 2, 3].map((i) => `<i class="${i < (f?.case?.[r] || 0) ? 'out' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
  const btns = [];
  if (asWarden) {
    btns.push(!f || f.over ? `<button type="button" class="btn" data-sl="deal">${gl('die')} ${f ? 'Shuffle a new deal' : 'Shuffle and show the soda'}</button>` : `<button type="button" class="btn" data-fr="turn">${gl('die')} Deal the turn</button>`);
    btns.push('<button type="button" class="btn secondary" data-sl="close">Close the table</button>');
  } else if (!seated) {
    if (t.status !== 'closed') btns.push('<button type="button" class="btn" data-sl="join">Pull up a chair</button>');
  } else {
    if (!f || f.over) btns.push(`<button type="button" class="btn" data-sl="deal">${gl('die')} ${f ? 'New deal' : 'Start the deal'}</button>`);
    else {
      btns.push(`<button type="button" class="btn" data-fr="turn">${gl('die')} Deal the turn</button>`);
      if (f.canCall) btns.push('<button type="button" class="btn secondary" data-fr="call">Call the turn (4 to 1)</button>');
      if (!f.watched) btns.push(`<button type="button" class="btn small secondary skill" data-fr="watch">${gl('target')} Watch the dealer (Intuition)</button>`);
    }
    btns.push('<button type="button" class="btn secondary" data-sl="leave">Cash out &amp; leave</button>');
  }
  const title = f ? (f.over ? `Deal ${f.deal} is done` : `Deal ${f.deal} — ${f.left} card${f.left === 1 ? '' : 's'} in the box`) : t.status === 'closed' ? 'The bank is closed' : 'Waiting for the shuffle';
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Faro at ${esc(t.where)}">
    <div class="sl-top"><div><small>FARO · ${esc(t.where.toUpperCase())}</small><b>${title}</b></div>
      <span class="sl-stakes">${esc(dealer?.name || 'The dealer')} banks ${$$(dealer?.bank)} · bets ${$$(t.stakes.ante)}–${$$(t.stakes.bet * 5)} a card</span><button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
    ${asWarden && f ? `<p class="fr-secret">${f.crooked ? `Crooked box: on${f.cheats ? ` (stacked ${f.cheats} turn${f.cheats > 1 ? 's' : ''} so far)` : ''}` : 'The box is square.'}</p>` : ''}
    <div class="sl-felt fr-felt">
      <div class="fr-box">
        <div class="fr-slot"><small>SODA</small>${f ? card(f.soda, 'sm') : card(null, 'sm')}</div>
        <div class="fr-slot"><small>BANK’S CARD · loses</small>${last ? card(last.loser) : card(null)}</div>
        <div class="fr-slot"><small>PLAYER’S CARD · wins</small>${last ? card(last.winner) : card(null)}</div>
        ${f?.hock ? `<div class="fr-slot"><small>HOCK</small>${card(f.hock, 'sm')}</div>` : ''}
      </div>
      <div class="fr-layout">${LAYOUT.map(cell).join('')}</div>
      ${casekeeper}
    </div>
    ${seated && f && !f.over ? '<p class="sl-tip">Tap a card to bet on it. It wins when it comes up as the player’s card and loses as the bank’s card. Copper a bet to flip that around.</p>' : ''}
    <div class="sl-controls"><div class="btn-row sl-moves">${btns.join('')}</div></div>
    ${f?.log?.length ? `<ol class="sl-log">${f.log.slice(-6).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
  </div>`;
}
// a styled little dialog for one bet (never a browser prompt)
function betDialog(t, r, cur) {
  return new Promise((resolve) => {
    const st = { amt: cur?.amt || t.stakes.ante, copper: !!cur?.copper };
    const max = t.stakes.bet * 5, step = t.stakes.ante;
    const back = document.createElement('div');
    back.className = 'modal-back ask-back fr-bet-back';
    const draw = () => {
      back.innerHTML = `<div class="modal ask" role="dialog" aria-modal="true" aria-label="Bet on the ${esc(rn(r))}"><h2>Bet on the ${esc(rn(r))}</h2>
        <div class="fr-amt"><button type="button" class="pm-btn" data-d="-1">−</button><b>${$$(st.amt)}</b><button type="button" class="pm-btn" data-d="1">+</button></div>
        <div class="field-step"><button type="button" class="chip-btn${st.copper ? '' : ' on'}" data-cop="0">Straight<small>wins as the player’s card</small></button><button type="button" class="chip-btn${st.copper ? ' on' : ''}" data-cop="1">Coppered<small>wins as the bank’s card</small></button></div>
        <div class="ask-btns">${cur ? '<button type="button" class="btn secondary" data-take>Take it back</button>' : ''}<button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>${cur ? 'Change the bet' : 'Place the bet'}</button></div></div>`;
    };
    draw();
    document.body.append(back);
    back.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) { if (e.target === back) { back.remove(); resolve(null); } return; }
      if (b.dataset.d) { st.amt = Math.max(step, Math.min(max, Math.round((st.amt + Number(b.dataset.d) * step) * 100) / 100)); draw(); return; }
      if (b.dataset.cop !== undefined) { st.copper = b.dataset.cop === '1'; draw(); return; }
      if (b.dataset.no !== undefined) { back.remove(); resolve(null); return; }
      if (b.dataset.take !== undefined) { back.remove(); resolve({ amount: 0 }); return; }
      if (b.dataset.go !== undefined) { back.remove(); resolve({ amount: st.amt, copper: st.copper }); }
    });
  });
}
// call the last three cards in order (only ranks still in the box)
function callDialog(t) {
  return new Promise((resolve) => {
    const f = t.faro, pick = [];
    const left = (r) => 4 - (f.case[r] || 0) - pick.filter((x) => x === r).length;
    const back = document.createElement('div');
    back.className = 'modal-back ask-back fr-bet-back';
    const draw = () => {
      back.innerHTML = `<div class="modal ask" role="dialog" aria-modal="true" aria-label="Call the turn"><h2>Call the turn</h2>
        <p class="ask-body">Three cards are left. Call them in order: the bank’s card, the player’s card, then the hock. Pays 4 to 1 (2 to 1 if two of them pair). Stake ${$$(t.stakes.ante)}.</p>
        <div class="fr-callpick">${[0, 1, 2].map((i) => `<span class="fr-callslot">${pick[i] ? card(`${rn(pick[i])}♠`, 'sm') : card(null, 'sm')}<small>${['bank', 'player', 'hock'][i]}</small></span>`).join('')}</div>
        <div class="fr-callranks">${LAYOUT.filter((r) => left(r) > 0).map((r) => `<button type="button" class="chip-btn" data-r="${r}"${pick.length >= 3 ? ' disabled' : ''}>${rn(r)}</button>`).join('')}</div>
        <div class="ask-btns"><button type="button" class="btn secondary" data-clear>Start over</button><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go${pick.length === 3 ? '' : ' disabled'}>Call it</button></div></div>`;
    };
    draw();
    document.body.append(back);
    back.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) { if (e.target === back) { back.remove(); resolve(null); } return; }
      if (b.dataset.r) { pick.push(Number(b.dataset.r)); draw(); return; }
      if (b.dataset.clear !== undefined) { pick.length = 0; draw(); return; }
      if (b.dataset.no !== undefined) { back.remove(); resolve(null); return; }
      if (b.dataset.go !== undefined && pick.length === 3) { back.remove(); resolve(pick.slice()); }
    });
  });
}

async function onClick(e) {
  const b = e.target.closest('button'); if (!b || busy) return;
  const d = b.dataset;
  if (d.card !== undefined) {
    const h = view.table.hand, i = Number(d.card);
    if (h?.phase !== 'draw' || h.turn !== `pc:${me()}`) return;
    if (sel.has(i)) sel.delete(i); else if (sel.size < 4) sel.add(i);
    play('card'); render(); return;
  }
  busy = true;
  try {
    if (d.sl === 'hide') { hideTable(); return; }
    if (d.lq) { lb.qty = Math.max(1, Math.min(view.table.liars?.total || 30, lb.qty + Number(d.lq))); render(); return; }
    if (d.lf) { lb.face = Number(d.lf); render(); return; }
    if (d.ld === 'bid') { await act({ action: 'liarsBid', qty: lb.qty, face: lb.face }); play('dice'); return; }
    if (d.ld === 'call') { const r = await act({ action: 'liarsCall' }); play('dice'); if (r) toast(`There ${r.count === 1 ? 'was' : 'were'} ${r.count}. ${r.loser} loses a die.`, r.loser === view.table.seats.find((s) => s.key === `pc:${me()}`)?.name); return; }
    if (d.ld === 'stare') {
      const r = await act({ action: 'liarsStare' });
      await showRoll('Charm'); play(r.won ? 'success' : 'fail');
      toast(r.won ? `${r.seat} looks away. Whatever you bid, they won’t call it.` : `${r.seat} stares right back.`, !r.won);
      return;
    }
    if (d.lpeek) {
      const r = await act({ action: 'liarsPeek', target: d.lpeek });
      await showRoll('Intuition'); play(r.won ? 'success' : 'fail');
      toast(r.won ? `You glimpse a ${r.die} under ${r.seat}’s cup.` : `${r.seat} keeps the cup tight.`, !r.won);
      return;
    }
    if (d.frRank) {
      const t = view.table, r = Number(d.frRank), cur = t.faro?.bets?.[`pc:${me()}`]?.[r];
      const bet = await betDialog(t, r, cur);
      if (bet) { await act({ action: 'faroBet', rank: r, ...bet }); play('card'); }
      return;
    }
    if (d.fr === 'turn') { const r = await act({ action: 'faroTurn' }); play('card'); setTimeout(() => play('card'), 180); if (r?.split) toast('A split — the bank takes half.'); return; }
    if (d.fr === 'call') { const order = await callDialog(view.table); if (order) { await act({ action: 'faroCall', order, amount: view.table.stakes.ante }); toast('Called. Deal the turn to see.'); } return; }
    if (d.fr === 'watch') {
      const r = await act({ action: 'faroWatch' });
      await showRoll('Intuition');
      if (r.won && r.crooked) { play('success'); toast('You catch the dealer stacking the box! The game goes square from here.'); }
      else if (r.won) { play('success'); toast('You watch every card. The box is square.'); }
      else { play('fail'); toast('The dealer’s hands are too quick to read.', true); }
      return;
    }
    if (d.mv) { await act({ action: 'move', move: d.mv }); play('card'); }
    else if (d.sl === 'join') { await act({ action: 'join' }); toast('You’re at the table.'); }
    else if (d.sl === 'deal') { sel = new Set(); await act({ action: 'deal' }); play('card'); }
    else if (d.sl === 'draw') { await act({ action: 'draw', discard: [...sel] }); sel = new Set(); play('card'); }
    else if (d.sl === 'leave') { if (await ask('Cash out and leave the table?', { ok: 'Leave the table', danger: false })) { await act({ action: 'leave' }); closeTable(); } }
    else if (d.sl === 'close') { if (await ask('Close the table? An unfinished hand gets called off and bets go back.', { ok: 'Close it' })) { await act({ action: 'close' }); } }
    else if (d.tell) {
      const r = await act({ action: 'tell', target: d.tell });
      await showRoll('Intuition'); play(r.won ? 'success' : 'fail');
      toast(r.won ? `You catch ${r.seat} glancing at a card: the ${r.card}.` : `${r.seat} gives nothing away.`, !r.won);
    } else if (d.sl === 'bluff') {
      const r = await act({ action: 'bluff' });
      await showRoll('Charm'); play(r.rattled.length ? 'success' : 'fail');
      toast(r.rattled.length ? `${r.rattled.join(' and ')} look${r.rattled.length === 1 ? 's' : ''} rattled.` : 'Nobody buys it.', !r.rattled.length);
    } else if (d.sl === 'palm') {
      if (!await ask('Palm a card?\n\nFinesse against the sharpest eye at the table. Get it right and you swap that card for a better one. Get caught and your hand is thrown in, and the Warden hears about it.', { ok: 'Palm it', danger: false })) return;
      const r = await act({ action: 'palm', card: [...sel][0] });
      sel = new Set();
      await showRoll('Finesse');
      if (r.won) { play('success'); toast(`Slick. You palm in the ${r.card}.`); }
      else { play('fail'); toast(`${r.by} catches you cheating! Your hand is thrown in.`, true); }
    }
  } catch (err) { toast(err.message, true); } finally { busy = false; render(); }
}
// show your own Challenge roll (the Table Log has both sides)
async function showRoll(skill) {
  try {
    const log = (await api('GET', null, '?view=log', '/api/combat')).log || [];
    const mine = log.find((l) => l.type === 'roll' && l.label === `Poker · ${skill}` && l.at > lastLog);
    if (mine) { lastLog = mine.at; await rollPopup(mine, `${mine.who} · ${skill}`); }
  } catch { /* the toast still says how it went */ }
}
function openTable(warden = false) {
  saloonStyles();
  asWarden = warden;
  if (!scene) {
    scene = document.createElement('div');
    scene.className = 'modal-back saloon-back';
    scene.addEventListener('click', onClick);
    document.body.append(scene);
    document.body.classList.add('nav-open');
  }
  render();
}
function hideTable() { scene?.remove(); scene = null; document.body.classList.remove('nav-open'); store.set('wiw.saloonHidden', view?.table?.id || ''); showChip(); }
function closeTable() { scene?.remove(); scene = null; document.body.classList.remove('nav-open'); showChip(); }
// a small "Back to the table" chip while you're seated but stepped away
let chip = null;
function showChip() {
  const t = view?.table, seated = t && t.status !== 'closed' && t.seats.some((s) => s.key === `pc:${me()}`);
  if (!seated || scene) { chip?.remove(); chip = null; return; }
  if (!chip) {
    chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'sl-chip';
    chip.addEventListener('click', () => { store.set('wiw.saloonHidden', ''); openTable(false); showChip(); });
    document.body.append(chip);
  }
  const h = t.hand, myTurn = h && h.turn === `pc:${me()}`;
  chip.classList.toggle('turn', !!myTurn);
  chip.innerHTML = `${gl('die')} ${myTurn ? 'Your move at the card table' : 'Back to the card table'}`;
}

// players: an invite pops up once per table; the table opens itself when it's your move
export function watchSaloon() {
  if (savedPin() || !me()) return;
  startPolling(`player&pc=${encodeURIComponent(me())}`, async (d) => {
    const before = view;
    view = d;
    const t = d.table;
    if (!t || t.status === 'closed') { if (scene) render(); showChip(); return; }
    const key = `pc:${me()}`, seated = t.seats.some((s) => s.key === key);
    const invited = !t.invite?.length || t.invite.includes(me());
    if (!seated && invited && store.get('wiw.saloonAsked', '') !== t.id && !scene && !busy) {
      store.set('wiw.saloonAsked', t.id);
      play('chime');
      const pitch = t.game === 'liars' ? `Liar’s Dice at ${t.where}\n\n${$$(t.stakes.ante)} a head, winner takes the pot. Five dice each, ones are wild. It’s your real money.` : t.game === 'faro' ? `A faro bank at ${t.where}\n\nBet on any card from ${$$(t.stakes.ante)} to ${$$(t.stakes.bet * 5)}. It’s your real money.` : `A card game at ${t.where}\n\nFive-card draw, ${$$(t.stakes.ante)} ante, bets of ${$$(t.stakes.bet)} (${$$(t.stakes.bet * 2)} after the draw). It’s your real money.`;
      if (await ask(pitch, { ok: 'Take a seat', cancel: 'Not tonight', danger: false })) {
        try { await act({ action: 'join' }); openTable(false); } catch (err) { toast(err.message, true); }
      }
      return;
    }
    const myTurn = t.hand && t.hand.turn === key && (!before?.table?.hand || before.table.hand.turn !== key || before.table.hand.phase !== t.hand.phase);
    if (seated && myTurn && !scene) { play('chime'); openTable(false); }
    if (scene) render();
    showChip();
  }, null, EP);
}

// ---------- the Warden's Saloon card (Run the Game) ----------
export function mountSaloonDesk(el, getCombat) {
  const st = { game: 'poker', crooked: false, peek: true, stare: true, where: 'the saloon', ante: 1, bet: 2, npcs: [{ name: '', profile: 'npc:Human - Moderate Combatant', style: 'loose', bank: 50 }], invite: null, tell: true, bluff: true, palm: true };
  let ledger = [], data = null;
  api('GET', null, '?view=warden', '/api/npcs').then((d) => { ledger = d.npcs || []; draw(); }).catch(() => {});
  const refresh = () => api('GET', null, '?view=warden', EP).then((d) => { data = d; view = d; draw(); if (scene) render(); }).catch(() => {});
  setInterval(refresh, 4000); refresh();
  function draw() {
    if (el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
    const t = data?.table;
    if (t && t.status !== 'closed') {
      const h = t.hand;
      el.innerHTML = `<p class="sl-desk-sum"><b>${t.game === 'faro' ? 'Faro' : t.game === 'liars' ? 'Liar’s Dice' : 'Poker'} at ${esc(t.where)}</b> · ${t.handsPlayed || 0} hand${t.handsPlayed === 1 ? '' : 's'} played${h && h.phase !== 'over' ? ` · hand ${h.no}: ${esc(PHASE[h.phase])}, pot ${$$(h.pot)}` : ''}</p>
        <div class="sl-desk-seats">${t.seats.map((s) => `<div class="item-row"><span class="item-who"><b>${esc(s.name)}</b><small class="muted">${s.kind === 'npc' ? `${t.game === 'faro' ? 'the dealer' : esc(STYLE[s.style] || '')} · bank ${$$(s.bank)}` : `${s.net >= 0 ? 'up' : 'down'} ${$$(Math.abs(s.net))}`}${h?.all?.[s.key] ? ` · ${esc(h.all[s.key].name)}` : ''}${t.liars?.all?.[s.key] ? ` · cup: ${t.liars.all[s.key].join(' ')}` : ''}</small></span>${s.kind === 'pc' ? `<button type="button" class="btn small secondary" data-kick="${esc(s.key)}">Remove</button>` : ''}</div>`).join('')}</div>
        <div class="btn-row"><button type="button" class="btn" data-watch>${gl('die')} Watch the table</button>${t.game === 'liars' ? (!t.liars || t.liars.over ? '<button type="button" class="btn secondary" data-deal>Start a game</button>' : '') : t.game === 'faro' ? (!t.faro || t.faro.over ? '<button type="button" class="btn secondary" data-deal>Shuffle a deal</button>' : '') : !h || h.phase === 'over' ? '<button type="button" class="btn secondary" data-deal>Deal a hand</button>' : ''}<button type="button" class="btn secondary" data-close>Close the table</button></div>`;
      return;
    }
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    const faro = st.game === 'faro';
    el.innerHTML = `<div class="field-step"><span>GAME</span><button type="button" class="chip-btn${st.game === 'poker' ? ' on' : ''}" data-game="poker">Poker<small>five-card draw</small></button><button type="button" class="chip-btn${faro ? ' on' : ''}" data-game="faro">Faro<small>bet against the bank</small></button><button type="button" class="chip-btn${st.game === 'liars' ? ' on' : ''}" data-game="liars">Liar’s Dice<small>bid and bluff</small></button></div>
      <div class="field-step"><span>WHERE</span><input data-s="where" maxlength="60" value="${esc(st.where)}" placeholder="e.g. the Long Branch Saloon"></div>
      ${faro ? `<div class="field-step"><span>BETS</span><label class="lp-num">Least $<input type="number" min="0.25" step="0.25" data-s="ante" value="${st.ante}"></label><label class="lp-num">Most a card $<input type="number" min="1" step="1" data-faromax value="${st.bet * 5}"></label></div>`
        : st.game === 'liars' ? `<div class="field-step"><span>STAKES</span><label class="lp-num">Each player puts in $<input type="number" min="0.25" step="0.25" data-s="ante" value="${st.ante}"></label><small class="muted">winner takes the pot</small></div>`
        : `<div class="field-step"><span>STAKES</span><label class="lp-num">Ante $<input type="number" min="0.25" step="0.25" data-s="ante" value="${st.ante}"></label><label class="lp-num">Bet $<input type="number" min="0.5" step="0.5" data-s="bet" value="${st.bet}"></label><small class="muted">doubles after the draw</small></div>`}
      <div class="field-step"><span>${faro ? 'THE DEALER — banks the game' : 'AT THE TABLE — NPCs'}</span></div>
      ${(faro ? st.npcs.slice(0, 1) : st.npcs).map((n, i) => `<div class="sl-npc-row">
        <input data-n="${i}" data-k="name" maxlength="40" value="${esc(n.name)}" placeholder="Name">
        ${ledger.length ? `<select data-ledger="${i}" aria-label="Pick from the NPC ledger"><option value="">From the ledger…</option>${ledger.map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`).join('')}</select>` : ''}
        <select data-n="${i}" data-k="profile">${[['npc:Human - Weak Combatant', 'Green'], ['npc:Human - Moderate Combatant', 'Seasoned'], ['npc:Human - Strong Combatant', 'Sharp']].map(([v, l]) => `<option value="${v}"${n.profile === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        ${faro ? '' : `<select data-n="${i}" data-k="style">${Object.entries(STYLE).map(([v, l]) => `<option value="${v}"${n.style === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`}
        <label class="lp-num">Bank $<input type="number" min="1" data-n="${i}" data-k="bank" value="${n.bank}"></label>
        ${st.npcs.length > 1 && !faro ? `<button type="button" class="rm-btn" data-rmnpc="${i}" aria-label="Remove">×</button>` : ''}</div>`).join('')}
      ${st.npcs.length < 4 && !faro ? '<button type="button" class="btn small secondary" data-addnpc>+ Another NPC</button>' : ''}
      <div class="field-step"><span>WHO’S INVITED</span><button type="button" class="chip-btn${st.invite ? '' : ' on'}" data-inv-all>Everyone</button>${posse.map((p) => `<button type="button" class="chip-btn${st.invite?.has(p.id) ? ' on' : ''}" data-inv="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      ${faro ? `<div class="field-step"><span>THE DEALING BOX — only you see this</span><button type="button" class="chip-btn${st.crooked ? '' : ' on'}" data-crook="0">Square</button><button type="button" class="chip-btn${st.crooked ? ' on' : ''}" data-crook="1">Crooked<small>stacks cards against big bets; Intuition can catch it</small></button></div>`
        : st.game === 'liars' ? `<div class="field-step"><span>SKILL MOVES</span>${[['peek', 'Peek under a cup', 'Intuition'], ['stare', 'Stare them down', 'Charm']].map(([k, l, s]) => `<button type="button" class="chip-btn${st[k] ? ' on' : ''}" data-hook="${k}">${l}<small>${s}</small></button>`).join('')}</div>`
        : `<div class="field-step"><span>SKILL MOVES</span>${[['tell', 'Read a tell', 'Intuition'], ['bluff', 'Bluff', 'Charm'], ['palm', 'Palm a card', 'Finesse']].map(([k, l, s]) => `<button type="button" class="chip-btn${st[k] ? ' on' : ''}" data-hook="${k}">${l}<small>${s}</small></button>`).join('')}</div>`}
      <button type="button" class="btn" data-open>${gl('die')} Open the table</button>`;
  }
  el.addEventListener('input', (e) => { const d = e.target.dataset; if (d.s) st[d.s] = e.target.value; if (d.n !== undefined) st.npcs[Number(d.n)][d.k] = e.target.value; if (d.faromax !== undefined) st.bet = (Number(e.target.value) || 5) / 5; });
  el.addEventListener('change', (e) => {
    const d = e.target.dataset;
    if (d.s) st[d.s] = e.target.value;
    if (d.n !== undefined) st.npcs[Number(d.n)][d.k] = e.target.value;
    if (d.ledger !== undefined && e.target.value) { st.npcs[Number(d.ledger)].name = e.target.value; e.target.blur(); draw(); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    try {
      if (d.addnpc !== undefined) { st.npcs.push({ name: '', profile: 'npc:Human - Moderate Combatant', style: 'tight', bank: 50 }); draw(); return; }
      if (d.rmnpc !== undefined) { st.npcs.splice(Number(d.rmnpc), 1); draw(); return; }
      if (d.invAll !== undefined) { st.invite = null; draw(); return; }
      if (d.inv) { st.invite ||= new Set(); if (st.invite.has(d.inv)) st.invite.delete(d.inv); else st.invite.add(d.inv); if (!st.invite.size) st.invite = null; draw(); return; }
      if (d.hook) { st[d.hook] = !st[d.hook]; draw(); return; }
      if (d.game) { st.game = d.game; draw(); return; }
      if (d.crook !== undefined) { st.crooked = d.crook === '1'; draw(); return; }
      if (d.open !== undefined) {
        const r = await api('POST', { action: 'open', game: st.game, crooked: st.crooked, where: st.where, ante: st.ante, bet: st.bet, npcs: st.game === 'faro' ? st.npcs.slice(0, 1) : st.npcs, invite: st.invite ? [...st.invite] : [], tell: st.tell, bluff: st.bluff, palm: st.palm, peek: st.peek, stare: st.stare }, '', EP);
        data = r.state; view = r.state; draw(); toast('The table is open — the posse gets an invite.');
        return;
      }
      if (d.watch !== undefined) { openTable(true); return; }
      if (d.deal !== undefined) { const r = await api('POST', { action: 'deal' }, '', EP); data = r.state; view = r.state; draw(); return; }
      if (d.kick) { const r = await api('POST', { action: 'kick', key: d.kick }, '', EP); data = r.state; view = r.state; draw(); return; }
      if (d.close !== undefined) { if (!await ask('Close the table? An unfinished hand gets called off and bets go back.', { ok: 'Close it' })) return; const r = await api('POST', { action: 'close' }, '', EP); data = r.state; view = r.state; draw(); toast('The game breaks up.'); }
    } catch (err) { toast(err.message, true); }
  });
  return { draw };
}
