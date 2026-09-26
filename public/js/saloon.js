// The saloon card table: the Warden's Saloon card (Run the Game), the players' invite, and the full-screen poker table.
import { esc, api, toast, startPolling, savedPin, store, rollPopup, ask, onChange } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const EP = '/api/saloon';
const me = () => store.get('wiw.me', null);
const TOUGH = [['npc:Human - Weak Combatant', 'Green', 'weak Skills'], ['npc:Human - Moderate Combatant', 'Seasoned', 'fair Skills'], ['npc:Human - Strong Combatant', 'Sharp', 'strong Skills']];
const STYLE = { tight: 'Plays it close', loose: 'Calls anything', bluffer: 'Loves a bluff' };
const PHASE = { bet1: 'First betting round', draw: 'The draw', bet2: 'Second betting round (double stakes)', over: 'Hand over' };
const $$ = (n) => `$${Number(n || 0).toFixed(2)}`;
export function saloonStyles() {
  if (document.getElementById('saloon-css')) return;
  document.head.insertAdjacentHTML('beforeend', '<link id="saloon-css" rel="stylesheet" href="/css/saloon.css?v=9">');
}
// "A♠" → a playing card (same look as the lock-picking cards)
const RANKV = { A: 'A', K: 'K', Q: 'Q', J: 'J' };
function card(lbl, cls = '') {
  if (!lbl) return `<div class="lk-card lk-back ${cls}"></div>`;
  const s = lbl.slice(-1), r = lbl.slice(0, -1), red = s === '♥' || s === '♦';
  return `<div class="lk-card ${red ? 'red' : ''} ${cls}"><span class="pc-tl">${RANKV[r] || r}<br>${s}</span><span class="pc-mid">${s}</span><span class="pc-br">${RANKV[r] || r}<br>${s}</span></div>`;
}

// ---------- rules + the Skill key (what each move rolls, against what, and what winning gets you) ----------
const SK = { charm: 'Charm', finesse: 'Finesse', intuition: 'Intuition' };
const myPool = (t, k) => (t.me ? t.me.skills?.[k] || 'no dice' : '—');
const npcPool = (s, k) => s?.skills?.[k] || '?';
// "your 3B vs Doc 1B 2G" for a move button
function matchup(t, mine, theirs, seat) { return `your ${myPool(t, mine)} vs ${seat ? esc(seat.name) : 'them'} ${npcPool(seat, theirs)}`; }
const MOVES = {
  poker: [
    { key: 'tell', name: 'Read a tell', mine: 'intuition', theirs: 'charm', who: 'the NPC you pick', when: 'Any time during a hand you’re still in. Once a hand.', win: 'You see one of that NPC’s cards (it’s outlined in gold).', lose: 'Nothing, but you’ve used it for this hand.' },
    { key: 'bluff', name: 'Bluff', mine: 'charm', theirs: 'intuition', who: 'every NPC still in the hand', when: 'On your turn to bet, before you bet. Once a hand.', win: 'Each NPC you beat plays scared for the rest of the hand: folds to bets and stops betting. An NPC holding two pair or better isn’t fooled.', lose: 'Nothing. They just don’t buy it.' },
    { key: 'palm', name: 'Palm a card', mine: 'finesse', theirs: 'intuition', who: 'the sharpest-eyed NPC at the table', when: 'On your draw, with exactly one card picked. Once a hand.', win: 'That card is swapped for the better of two cards off the deck.', lose: 'You’re caught cheating. Your hand is thrown in (you lose what you bet) and the whole table hears about it.' },
  ],
  drinking: [
    { key: 'spittoon', name: 'Spittoon trick', mine: 'finesse', theirs: 'intuition', who: 'the sharpest-eyed NPC still upright', when: 'While your glass is full. Once a contest.', win: 'Your shot goes in the spittoon: you pass the round without rolling.', lose: 'You’re caught. You drink a double this round: two rolls, and both have to make it.' },
    { key: 'needle', name: 'Needle them', mine: 'charm', theirs: 'nerve', who: 'the NPC you pick', when: 'Before they drink (between rounds, or before they’ve had this one). Once a contest.', win: 'You get under their skin: they roll 2 fewer dice on their next shot.', lose: 'They shrug it off.' },
  ],
  blackjack: [
    { key: 'count', name: 'Count the cards', mine: 'intuition', theirs: 'finesse', who: 'the dealer', when: 'Any time in a round. Once a round.', win: 'You know whether the next card out of the shoe is high (a ten-card or an Ace), low (Two to Six) or middling. Good to know before you hit.', lose: 'You lose track. Nothing else.' },
    { key: 'shiner', name: 'Use a shiner', mine: 'finesse', theirs: 'intuition', who: 'the dealer', when: 'On your turn. Once a round.', win: 'Your little mirror shows you the dealer’s hole card.', lose: 'The dealer spots it. Your bet is forfeit, you’re out of the round, and the whole table hears about it.' },
  ],
  faro: [
    { key: 'watch', name: 'Watch the dealer', mine: 'intuition', theirs: 'finesse', who: 'the dealer', when: 'Any time during a deal. Once a deal.', win: 'If the dealing box is crooked, you catch it: everyone hears, and the game goes straight from there. If it’s honest, you know it’s honest.', lose: 'You can’t tell either way.' },
  ],
  liars: [
    { key: 'peek', name: 'Peek under a cup', mine: 'intuition', theirs: 'finesse', who: 'the NPC you pick', when: 'Any time you still have dice. Once a round.', win: 'You see one of that NPC’s dice for the rest of the round.', lose: 'Nothing.' },
    { key: 'stare', name: 'Stare them down', mine: 'charm', theirs: 'intuition', who: 'the NPC who plays after you', when: 'On your turn, before you bid. Once a round.', win: 'They can’t call you a liar on their next turn. They have to raise, however wild your bid is.', lose: 'Nothing. They play as normal.' },
  ],
};
const RULES = {
  poker: `<h3>Five-card draw</h3>
    <ol><li>Everyone puts in the <b>ante</b> and gets five cards.</li>
    <li><b>First bets.</b> On your turn: <i>check</i> (if nobody has bet), <i>bet</i>, <i>call</i> (match the bet), <i>raise</i>, or <i>fold</i> (throw in your hand). Bets are a set size; three raises a round at most.</li>
    <li><b>The draw.</b> Swap up to 3 cards for new ones, or 4 if you keep an Ace. Tap the cards you want gone.</li>
    <li><b>Second bets</b>, at double the size.</li>
    <li><b>Showdown.</b> The best hand still in takes the pot; ties split it. If everyone else folds, you win without showing.</li></ol>
    <h3>Hands, best to worst</h3>
    <p class="sl-ranks">Straight flush (five in a row, same suit) · Four of a kind · Full house (three + a pair) · Flush (same suit) · Straight (five in a row; Ace can be low) · Three of a kind · Two pair · One pair · High card</p>`,
  drinking: `<h3>Drinking contest — last one standing</h3>
    <ol><li>Everyone pays the entry into the pot. The last one upright takes it.</li>
    <li>Each round the bartender pours everyone a shot. To keep it down, roll <b>Nerve</b> and get at least as many Hits as the <b>round number</b>: 1 in round 1, 2 in round 2, and so on.</li>
    <li><b>Grit:</b> before you drink you can spend up to 3 Grit to steady yourself, +1 Black die each. It comes off your sheet and stays spent until you rest.</li>
    <li><b>Miss</b> and you’re a level more <b>Drunk</b> (1 fewer die on every shot after) and the rotgut costs you <b>1 Health</b>. The contest never kills you: at 1 Health you just pass out.</li>
    <li>At <b>3 Drunk</b> you pass out, and you wake up <b>Dazed</b> [1] (relieve it with Intuition as usual).</li>
    <li>The <b>first one to pass out pays the bar tab</b>: $0.10 for every shot poured. If the last drinkers all go down in the same round, they split the pot.</li>
    <li>Poisoned still rolls 2 fewer dice, and a Talent in Nerve rerolls Spurs.</li></ol>`,
  blackjack: `<h3>Blackjack — beat the dealer to 21</h3>
    <ol><li><b>Bet</b> between the table minimum and the house limit. The cards come out once everyone at the table has a bet down (or someone taps Deal the cards).</li>
    <li>You get two cards face up. The dealer gets one face up and one face down, the <b>hole card</b>.</li>
    <li>Cards count their number; Jacks, Queens and Kings count 10; an <b>Ace</b> counts 11 or 1, whichever helps.</li>
    <li>On your turn: <i>hit</i> (take a card), <i>stand</i> (stop), or <i>double down</i> on your first two cards (double the bet and take exactly one more card). Over 21 is a <b>bust</b>: you lose.</li>
    <li><b>Blackjack</b> (an Ace and a ten-card as your first two) pays 3 to 2.</li>
    <li>The dealer checks for blackjack when showing an Ace or a ten-card. Then the dealer turns the hole card and <b>draws to 16, stands on 17</b>.</li>
    <li>Closer to 21 than the dealer wins even money. A tie is a <b>push</b>: your bet comes back. No splitting pairs at this table.</li></ol>`,
  faro: `<h3>Faro — bet against the bank</h3>
    <ol><li>The dealer banks. Put money on any card on the <b>layout</b> (Ace to King); the suit doesn’t matter.</li>
    <li>The first card out, the <b>soda</b>, has no action.</li>
    <li>Each <b>turn</b> deals two cards. The first is the <b>bank’s card</b>: bets on that rank <i>lose</i>. The second is the <b>player’s card</b>: bets on that rank <i>win</i> even money, and your stake stays down.</li>
    <li><b>Copper</b> a bet to flip it: it wins as the bank’s card and loses as the player’s card.</li>
    <li>A <b>split</b> (both cards the same rank) costs half of any bet on that rank.</li>
    <li><b>Calling the turn:</b> with three cards left, call their exact order (bank’s card, player’s card, then the last card, the <b>hock</b>). Pays 4 to 1, or 2 to 1 if two of them pair.</li>
    <li>You can move or take back a bet between turns. When the deal runs out, everything still on the layout comes home.</li></ol>
    <p>The <b>casekeeper</b> beads show how many of each rank are already out. A rank with all four gone is dead.</p>`,
  liars: `<h3>Liar’s Dice</h3>
    <ol><li>Everyone puts in and rolls <b>five dice</b> under a cup. Only you see yours.</li>
    <li>Take turns <b>bidding</b> on how many of one face are showing across <i>every</i> cup on the table, like “four fives”. <b>Ones are wild</b>: they count as any face.</li>
    <li>Each bid must go <b>higher</b>: more dice, or the same number of a higher face.</li>
    <li>Instead of bidding, call <b>“Liar!”</b>. Every cup lifts. If there are fewer than the bid, the bidder loses a die; if the bid holds, the caller loses one.</li>
    <li>The loser starts the next round, and everyone rolls again.</li>
    <li>Out of dice, out of the game. The last one holding dice takes the pot.</li></ol>`,
};
function keyHTML(t) {
  const npcs = t.seats.filter((s) => s.kind === 'npc');
  const moves = MOVES[t.game] || [];
  const on = (m) => (t.hooks?.[m.key] ?? true);
  return `<h3>Skill moves — the key</h3>
    <p>Every Skill move is a <b>Challenge Roll</b> (p. 13). There’s no fixed number to hit: you roll your Skill, they roll theirs, and <b>more Hits wins</b>. A tie rolls again. ${t.me?.poisoned ? '<b>You’re Poisoned: 2 fewer dice</b> (already counted below).' : 'Poisoned rolls 2 fewer dice.'} A Talent in that Skill rerolls Spurs as usual.</p>
    ${moves.map((m) => `<div class="sl-key${on(m) ? '' : ' off'}"><b>${m.name}</b>${on(m) ? '' : ' <i>(the Warden isn’t using this one tonight)</i>'}
      <div class="sl-key-roll">You roll <b>${SK[m.mine]} ${myPool(t, m.mine)}</b> against ${m.who}’s <b>${SK[m.theirs]}</b>${npcs.length ? `: ${npcs.map((s) => `${esc(s.name)} ${npcPool(s, m.theirs)}`).join(' · ')}` : ''}</div>
      <div><small>WHEN</small> ${m.when}</div><div><small>WIN</small> ${m.win}</div><div><small>LOSE</small> ${m.lose}</div></div>`).join('') || '<p>No Skill moves at this game.</p>'}`;
}
function openRules(t, tab = 'rules') {
  const back = document.createElement('div');
  back.className = 'modal-back sl-rules-back';
  const draw = () => {
    back.innerHTML = `<div class="modal sl-rules" role="dialog" aria-modal="true" aria-label="How to play">
      <div class="sl-rules-tabs"><button type="button" class="chip-btn${tab === 'rules' ? ' on' : ''}" data-rt="rules">How to play</button><button type="button" class="chip-btn${tab === 'key' ? ' on' : ''}" data-rt="key">Skill moves</button><button type="button" class="sl-x dark" data-rx aria-label="Close">×</button></div>
      <div class="sl-rules-body">${tab === 'rules' ? RULES[t.game] || '' : keyHTML(t)}</div></div>`;
  };
  draw();
  document.body.append(back);
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-rx]')) { back.remove(); return; }
    const b = e.target.closest('[data-rt]');
    if (b) { tab = b.dataset.rt; draw(); }
  });
}
const rulesBtn = '<button type="button" class="btn small secondary sl-rulesbtn" data-sl="rules">Rules &amp; key</button>';

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
    if (t.hooks.bluff && !used.has('bluff')) moves.push(`<button type="button" class="btn small secondary skill" data-sl="bluff">${gl('hat')} Bluff<small>Charm ${myPool(t, 'charm')} vs each NPC’s Intuition</small></button>`);
  }
  if (myTurn && h.phase === 'draw') {
    moves.push(`<button type="button" class="btn" data-sl="draw">${sel.size ? `Swap ${sel.size} card${sel.size > 1 ? 's' : ''}` : 'Stand pat'}</button>`);
    if (t.hooks.palm && !used.has('palm') && sel.size === 1) moves.push(`<button type="button" class="btn small secondary skill" data-sl="palm">${gl('flash')} Palm it instead<small>Finesse ${myPool(t, 'finesse')} vs the sharpest eye’s Intuition</small></button>`);
  }
  if (t.hooks.tell && !used.has('tell')) {
    const npcs = t.seats.filter((s) => s.kind === 'npc' && h.order.includes(s.key) && !h.folded[s.key]);
    if (npcs.length) moves.push(`<span class="sl-tell">${gl('target')} Read a tell (Intuition vs Charm): ${npcs.map((s) => `<button type="button" class="linkish" data-tell="${esc(s.key)}">${esc(s.name)} <small>(${matchup(t, 'intuition', 'charm', s)})</small></button>`).join(' ')}</span>`);
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
  if (t.game === 'blackjack') { renderBj(t); return; }
  if (t.game === 'drinking') { renderDrinking(t); return; }
  const h = t.hand, key = `pc:${me()}`;
  const npcs = t.seats.filter((s) => s.kind === 'npc'), pcs = t.seats.filter((s) => s.kind !== 'npc' && (asWarden || s.key !== key));
  const mine = asWarden ? null : h?.mine;
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Poker at ${esc(t.where)}">
    <div class="sl-top"><div><small>FIVE-CARD DRAW · ${esc(t.where.toUpperCase())}</small><b>${h ? `Hand ${h.no} — ${PHASE[h.phase] || ''}` : t.status === 'closed' ? 'The game has broken up' : 'Waiting for the deal'}</b></div>
      <span class="sl-stakes">Ante ${$$(t.stakes.ante)} · bets ${$$(t.stakes.bet)} / ${$$(t.stakes.bet * 2)}</span>${rulesBtn}<button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
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
let lastRolls = [];
async function act(body) {
  const r = await api('POST', { ...body, pc: me() }, '', EP);
  lastRolls = r.rolls || [];
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
    const nextNpc = (() => { const i = L.order.indexOf(key); for (let n = 1; n <= L.order.length; n++) { const k = L.order[(i + n) % L.order.length]; if (L.counts[k] > 0) return t.seats.find((x) => x.key === k); } return null; })();
    if (t.hooks.stare && !used.has('stare') && nextNpc?.kind === 'npc') btns.push(`<button type="button" class="btn small secondary skill" data-ld="stare">${gl('hat')} Stare down ${esc(nextNpc.name)}<small>Charm: ${matchup(t, 'charm', 'intuition', nextNpc)}</small></button>`);
  } else {
    btns.push(`<span class="muted">Waiting on ${esc(t.seats.find((s) => s.key === L.turn)?.name || '…')}…</span>`);
    if (!inGame) btns.push('<button type="button" class="btn secondary" data-sl="leave">You’re out of dice — leave the table</button>');
  }
  const peekable = inGame && t.hooks.peek && !(L.used || []).includes('peek') ? t.seats.filter((s) => s.kind === 'npc' && L.counts[s.key] > 0) : [];
  const title = L ? (L.over ? `Game ${L.game} is over` : `Game ${L.game} — round ${L.round} · ${L.total} dice on the table`) : t.status === 'closed' ? 'The game has broken up' : 'Waiting for the first roll';
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Liar’s Dice at ${esc(t.where)}">
    <div class="sl-top"><div><small>LIAR’S DICE · ${esc(t.where.toUpperCase())}</small><b>${title}</b></div>
      <span class="sl-stakes">${$$(t.stakes.ante)} a head · ones are wild</span>${rulesBtn}<button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
    <div class="sl-felt">
      <div class="sl-seats">${others.map(seatBox).join('')}</div>
      <div class="sl-pot">${L ? `<b>POT ${$$(L.pot)}</b>` : ''}${L?.bid && !L.over ? `<p class="ld-bid">The bid: <b>${esc(bidText(L.bid))}</b> <small>by ${esc(t.seats.find((s) => s.key === L.bid.by)?.name || '?')}</small></p>` : ''}${L?.over && L.winner ? `<p class="sl-result">${esc(t.seats.find((s) => s.key === L.winner)?.name || '')} takes the pot.</p>` : ''}</div>
      ${reveal}
      ${L?.mine?.length && inGame ? `<div class="sl-mine"><small class="ld-lbl">UNDER YOUR CUP</small><div class="ld-mine">${L.mine.map((n) => die(n)).join('')}</div></div>` : ''}
    </div>
    ${peekable.length ? `<p class="sl-tell">${gl('target')} Peek under a cup (Intuition vs Finesse): ${peekable.map((s) => `<button type="button" class="linkish" data-lpeek="${esc(s.key)}">${esc(s.name)} <small>(${matchup(t, 'intuition', 'finesse', s)})</small></button>`).join(' ')}</p>` : ''}
    <div class="sl-controls"><div class="btn-row sl-moves">${btns.join('')}</div></div>
    ${L?.log?.length ? `<ol class="sl-log">${L.log.slice(-6).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
  </div>`;
}

// ---------- the drinking contest ----------
let drinkGrit = 0;
const GLASS = '<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M2 2h12l-1.6 15.2a1 1 0 0 1-1 .8H4.6a1 1 0 0 1-1-.8z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.1 7h9.8l-1.1 10H4.2z" fill="currentColor" opacity=".55"/></svg>';
function renderDrinking(t) {
  const D = t.drink, key = `pc:${me()}`, seated = !asWarden && t.seats.some((s) => s.key === key);
  const inIt = D && !D.over && D.order.includes(key), up = inIt && !D.out[key], myTurn = up && D.phase === 'pouring' && !D.drank[key];
  const drunkOf = (k) => D?.drunk?.[k] || 0;
  const seatHTML = (s) => {
    const k = s.key, n = drunkOf(k), out = D?.out?.[k], last = D?.last?.[k], lastRound = last && last.round === D.round;
    const glasses = [0, 1, 2].map((i) => `<i class="dk-glass${i < n ? ' tipped' : ''}" title="${i < n ? 'Drunk' : 'Steady'}">${GLASS}</i>`).join('');
    const hp = s.kind === 'npc' ? D?.hp?.[k] : k === key ? t.me?.health : null;
    const state = !D || !D.order.includes(k) ? 'sitting out' : out ? 'passed out' : D.phase === 'pouring' ? (D.drank[k] ? (lastRound && last.ok ? 'kept it down' : 'sputtering') : 'glass is full') : 'upright';
    return `<div class="sl-seat dk-seat${k === key ? ' me' : ''}${out ? ' folded' : ''}${D?.winners?.includes(k) ? ' won' : ''}${D?.phase === 'pouring' && D.order.includes(k) && !out && !D.drank[k] ? ' turn' : ''}">
      <div class="sl-who"><b>${esc(s.name)}${k === key ? ' (you)' : ''}</b><small>${s.kind === 'npc' ? `bank ${$$(s.bank)}` : `${s.net >= 0 ? '+' : '−'}${$$(Math.abs(s.net))}`}</small></div>
      <div class="dk-glasses" aria-label="Drunk ${n} of 3">${glasses}</div>
      <div class="sl-state">${state}${hp != null && D?.order?.includes(k) ? ` · Health ${hp}` : ''}${lastRound && last.hits.length ? ` · ${last.hits.join(' + ')} Hit${last.hits.length > 1 || last.hits[0] !== 1 ? 's' : ''}` : ''}${D?.needled?.includes(k) ? ' <i>needled</i>' : ''}</div></div>`;
  };
  const used = new Set(D?.used || []);
  const npcsUp = D ? D.order.map((k) => t.seats.find((s) => s.key === k)).filter((s) => s?.kind === 'npc' && !D.out[s.key] && !(D.phase === 'pouring' && D.drank[s.key])) : [];
  const needleHTML = up && t.hooks.needle && !used.has('needle') && npcsUp.length ? `<p class="sl-tell">${gl('hat')} Needle them (Charm vs Nerve): ${npcsUp.map((s) => `<button type="button" class="linkish" data-dneedle="${esc(s.key)}">${esc(s.name)} <small>(${matchup(t, 'charm', 'nerve', s)})</small></button>`).join(' ')}</p>` : '';
  const btns = [];
  if (asWarden) {
    if (!D || D.over) btns.push(`<button type="button" class="btn" data-sl="deal">${gl('die')} ${D ? 'Another contest' : 'Start the contest'}</button>`);
    else if (D.phase === 'ready') btns.push(`<button type="button" class="btn" data-dk="pour">${gl('die')} Pour a round</button>`);
    else btns.push('<span class="muted">Waiting on the posse to drink…</span>');
    btns.push('<button type="button" class="btn secondary" data-sl="close">Close the table</button>');
  } else if (!seated) {
    if (t.status !== 'closed') btns.push('<button type="button" class="btn" data-sl="join">Pull up a stool</button>');
  } else if (!D || D.over) {
    btns.push(`<button type="button" class="btn" data-sl="deal">${gl('die')} ${D ? 'Another contest' : 'Start the contest'}</button><button type="button" class="btn secondary" data-sl="leave">Cash out &amp; leave</button>`);
  } else if (myTurn) {
    const most = Math.min(3, t.me?.grit || 0);
    drinkGrit = Math.min(drinkGrit, most);
    const drunk = drunkOf(key);
    btns.push(`<div class="dk-grit"><span>Steady yourself with Grit</span><button type="button" class="pm-btn" data-dg="-1" aria-label="Less Grit">−</button><b>${drinkGrit}</b><button type="button" class="pm-btn" data-dg="1" aria-label="More Grit"${drinkGrit >= most ? ' disabled' : ''}>+</button><small class="muted">you have ${t.me?.grit || 0}; it stays spent till you rest</small></div>`);
    btns.push(`<button type="button" class="btn" data-dk="drink">${gl('drop')} Drink${D.myDouble ? ' the double' : ''}<small>Nerve ${myPool(t, 'nerve')}${drunk ? ` −${drunk} Drunk` : ''}${drinkGrit ? ` +${drinkGrit}B Grit` : ''} · need ${D.round} Hit${D.round > 1 ? 's' : ''}</small></button>`);
    if (t.hooks.spittoon && !used.has('spittoon') && !D.myDouble) btns.push(`<button type="button" class="btn small secondary skill" data-dk="spit">${gl('flash')} Spittoon trick<small>Finesse ${myPool(t, 'finesse')} vs the sharpest eye’s Intuition</small></button>`);
  } else if (D.phase === 'ready' && up) {
    btns.push(`<button type="button" class="btn" data-dk="pour">${gl('die')} Pour ${D.round ? 'the next round' : 'the first round'}</button>`);
  } else {
    btns.push(`<span class="muted">${D.out[key] ? 'You’re out cold. Watch the rest go down.' : !inIt ? 'You’re sitting this one out.' : 'Waiting on the others…'}</span>`);
  }
  const title = !D ? (t.status === 'closed' ? 'The bar is closed' : 'Glasses lined up') : D.over ? `Contest ${D.game} is over` : D.phase === 'pouring' ? `Round ${D.round} — need ${D.round} Hit${D.round > 1 ? 's' : ''}` : D.round ? `Round ${D.round} done — next needs ${D.round + 1} Hits` : 'Ready for the first pour';
  const drinkers = [...t.seats.filter((s) => s.kind === 'npc'), ...t.seats.filter((s) => s.kind === 'pc')];
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Drinking contest at ${esc(t.where)}">
    <div class="sl-top"><div><small>DRINKING CONTEST · ${esc(t.where.toUpperCase())}</small><b>${title}</b></div>
      <span class="sl-stakes">${$$(t.stakes.ante)} to get in · pot ${$$(D?.pot || 0)} · bar tab ${$$(D?.tab || 0)}</span>${rulesBtn}<button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
    ${D?.mySpit ? '<p class="bj-note">Your glass is going in the spittoon this round.</p>' : ''}${D?.myDouble ? '<p class="bj-note">Caught! You drink a double this round.</p>' : ''}
    <div class="sl-felt dk-bar"><div class="sl-seats">${drinkers.map(seatHTML).join('')}</div></div>
    <div class="sl-controls"><div class="btn-row sl-moves">${btns.join('')}</div>${needleHTML}</div>
    ${D?.log?.length ? `<ol class="sl-log">${D.log.slice(-6).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
  </div>`;
}
// ---------- blackjack ----------
let bjAmt = 0;
function renderBj(t) {
  const B = t.bj, key = `pc:${me()}`, seated = !asWarden && t.seats.some((s) => s.key === key), dealer = t.seats.find((s) => s.kind === 'npc');
  const min = t.stakes.ante, max = t.stakes.bet * 5;
  if (!bjAmt) bjAmt = min;
  bjAmt = Math.max(min, Math.min(max, bjAmt));
  const pcs = t.seats.filter((s) => s.kind === 'pc');
  const handHTML = (s) => {
    const h = B?.hands?.[s.key], res = B?.phase === 'done' ? B.results?.[s.key] : null, bet = B?.phase === 'bets' ? B.bets?.[s.key] : h?.bet;
    return `<div class="sl-seat bj-seat${B?.turn === s.key ? ' turn' : ''}${s.key === key ? ' me' : ''}${res?.win > 0 ? ' won' : ''}${h?.caught || (res && res.win < 0) ? ' folded' : ''}">
      <div class="sl-who"><b>${esc(s.name)}${s.key === key ? ' (you)' : ''}</b><small>${s.net >= 0 ? '+' : '−'}${$$(Math.abs(s.net))}</small></div>
      ${h ? `<div class="sl-cards">${h.cards.map((c) => card(c, s.key === key ? '' : 'sm')).join('')}</div><div class="bj-total">${h.blackjack ? 'Blackjack!' : `${h.total}${h.soft && h.total < 21 ? ' (soft)' : ''}${h.total > 21 ? ' — bust' : ''}`}</div>` : `<div class="sl-out">${B?.phase === 'bets' ? (bet ? 'bet down' : 'no bet yet') : 'sitting out'}</div>`}
      <div class="sl-state">${bet ? `bet ${$$(bet)}${h?.doubled ? ' (doubled)' : ''}` : ''}${res ? ` <i>${esc(res.text)}</i>` : ''}</div></div>`;
  };
  const used = new Set(B?.used || []), myHand = B?.hands?.[key], myTurn = B?.phase === 'play' && B.turn === key;
  const btns = [];
  if (asWarden) {
    if (!B || B.phase === 'done') btns.push(`<button type="button" class="btn" data-sl="deal">${gl('die')} ${B ? 'Next round' : 'Start the first round'}</button>`);
    else if (B.phase === 'bets') btns.push(`<button type="button" class="btn" data-bj="deal"${Object.keys(B.bets || {}).length ? '' : ' disabled'}>${gl('die')} Deal the cards</button>`);
    else btns.push(`<span class="muted">Waiting on ${esc(t.seats.find((s) => s.key === B.turn)?.name || '…')}</span>`);
    btns.push('<button type="button" class="btn secondary" data-sl="close">Close the table</button>');
  } else if (!seated) {
    if (t.status !== 'closed') btns.push('<button type="button" class="btn" data-sl="join">Pull up a chair</button>');
  } else if (!B || B.phase === 'done') {
    btns.push(`<button type="button" class="btn" data-sl="deal">${gl('die')} ${B ? 'Play another round' : 'Start the first round'}</button>`);
    btns.push('<button type="button" class="btn secondary" data-sl="leave">Cash out &amp; leave</button>');
  } else if (B.phase === 'bets') {
    const mine = B.bets?.[key];
    btns.push(`<div class="fr-amt bj-amt"><button type="button" class="pm-btn" data-bjd="-1" aria-label="Less">−</button><b>${$$(bjAmt)}</b><button type="button" class="pm-btn" data-bjd="1" aria-label="More">+</button></div>`);
    btns.push(`<button type="button" class="btn" data-bj="bet">${mine ? `Change bet to ${$$(bjAmt)}` : `Bet ${$$(bjAmt)}`}</button>`);
    if (mine) btns.push(`<button type="button" class="btn secondary" data-bj="deal">${gl('die')} Deal the cards</button><button type="button" class="btn secondary" data-bj="unbet">Take my bet back</button>`);
    btns.push('<button type="button" class="btn secondary" data-sl="leave">Cash out &amp; leave</button>');
  } else if (myTurn) {
    btns.push('<button type="button" class="btn" data-bjm="hit">Hit</button><button type="button" class="btn" data-bjm="stand">Stand</button>');
    if (B.canDouble) btns.push(`<button type="button" class="btn secondary" data-bjm="double">Double down (+${$$(myHand.bet)})</button>`);
    if (t.hooks.shiner && !used.has('shiner')) btns.push(`<button type="button" class="btn small secondary skill" data-bj="shiner">${gl('flash')} Use a shiner<small>Finesse: ${matchup(t, 'finesse', 'intuition', dealer)}</small></button>`);
  } else {
    btns.push(`<span class="muted">${myHand && !myHand.done ? 'Your turn is coming.' : myHand ? 'You’re done this round. Waiting on the others…' : 'You’re sitting this round out.'} ${B.turn ? `Now: ${esc(t.seats.find((s) => s.key === B.turn)?.name || '…')}` : ''}</span>`);
  }
  if (seated && B && B.phase !== 'done' && t.hooks.count && !used.has('count')) btns.push(`<button type="button" class="btn small secondary skill" data-bj="count">${gl('target')} Count the cards<small>Intuition: ${matchup(t, 'intuition', 'finesse', dealer)}</small></button>`);
  const title = !B ? (t.status === 'closed' ? 'The table is closed' : 'Waiting for the first round') : B.phase === 'bets' ? `Round ${B.round} — place your bets` : B.phase === 'play' ? `Round ${B.round} — cards are out` : `Round ${B.round} is done`;
  const dealerCards = B?.dealer?.length ? B.dealer.map((c, i) => card(c, i === 1 && B.holeSeen ? 'peeked' : '')).join('') : card(null) + card(null);
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Blackjack at ${esc(t.where)}">
    <div class="sl-top"><div><small>BLACKJACK · ${esc(t.where.toUpperCase())}</small><b>${title}</b></div>
      <span class="sl-stakes">${esc(dealer?.name || 'The dealer')} banks ${$$(dealer?.bank)} · bets ${$$(min)}–${$$(max)} · blackjack pays 3 to 2</span>${rulesBtn}<button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
    <div class="sl-felt bj-felt">
      <div class="bj-dealer"><small>${esc((dealer?.name || 'The dealer').toUpperCase())} · DEALER${B?.dealer?.length ? ` · ${B.phase === 'done' || asWarden ? B.dealerTotal : `showing ${B.dealerTotal}`}` : ''}</small><div class="sl-cards">${dealerCards}</div>${B?.holeSeen ? '<p class="bj-note">Your shiner shows the hole card.</p>' : ''}</div>
      <p class="bj-rule">Dealer draws to 16 and stands on all 17s</p>
      <div class="sl-seats bj-seats">${pcs.map(handHTML).join('')}</div>
      ${B?.count ? `<p class="bj-note">${gl('target')} Your count: the next card is <b>${esc(B.count)}</b>.</p>` : ''}
    </div>
    <div class="sl-controls"><div class="btn-row sl-moves">${btns.join('')}</div></div>
    ${B?.log?.length ? `<ol class="sl-log">${B.log.slice(-6).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
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
      if (!f.watched) btns.push(`<button type="button" class="btn small secondary skill" data-fr="watch">${gl('target')} Watch the dealer<small>Intuition: ${matchup(t, 'intuition', 'finesse', dealer)}</small></button>`);
    }
    btns.push('<button type="button" class="btn secondary" data-sl="leave">Cash out &amp; leave</button>');
  }
  const title = f ? (f.over ? `Deal ${f.deal} is done` : `Deal ${f.deal} — ${f.left} card${f.left === 1 ? '' : 's'} in the box`) : t.status === 'closed' ? 'The bank is closed' : 'Waiting for the shuffle';
  scene.innerHTML = `<div class="sl-table" role="dialog" aria-modal="true" aria-label="Faro at ${esc(t.where)}">
    <div class="sl-top"><div><small>FARO · ${esc(t.where.toUpperCase())}</small><b>${title}</b></div>
      <span class="sl-stakes">${esc(dealer?.name || 'The dealer')} banks ${$$(dealer?.bank)} · bets ${$$(t.stakes.ante)}–${$$(t.stakes.bet * 5)} a card</span>${rulesBtn}<button type="button" class="sl-x" data-sl="hide" aria-label="Step away">×</button></div>
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
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  // stepping away and the rules always work, even mid-action
  if (d.sl === 'rules') { openRules(view.table); return; }
  if (d.sl === 'hide') { busy = false; hideTable(); return; }
  if (busy) return;
  if (d.card !== undefined) {
    const h = view.table.hand, i = Number(d.card);
    if (h?.phase !== 'draw' || h.turn !== `pc:${me()}`) return;
    if (sel.has(i)) sel.delete(i); else if (sel.size < 4) sel.add(i);
    play('card'); render(); return;
  }
  busy = true;
  try {
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
    if (d.dg) { drinkGrit = Math.max(0, Math.min(3, view.table.me?.grit || 0, drinkGrit + Number(d.dg))); render(); return; }
    if (d.dk === 'pour') { await act({ action: 'drinkPour' }); play('chips'); return; }
    if (d.dk === 'drink') {
      play('drink');
      const r = await act({ action: 'drink', grit: drinkGrit });
      drinkGrit = 0;
      const mine = lastRolls.filter((x) => x.key === `pc:${me()}`);
      if (mine.length) await rollPopup(mine[mine.length - 1], `Your shot: ${r.rolls.join(' and ')} Hit${r.rolls.length > 1 || r.rolls[0] !== 1 ? 's' : ''} — needed ${r.need}`).catch(() => {});
      play(r.ok ? 'success' : 'fail');
      if (r.end) toast(r.end.winners.includes(view.table.seats.find((s) => s.key === `pc:${me()}`)?.name) ? 'Last one standing! The pot is yours.' : `${r.end.winners.join(' and ')} take${r.end.winners.length > 1 ? '' : 's'} the pot.`, !r.ok);
      else if (r.out) toast('The room spins… you pass out. You’ll wake up Dazed.', true);
      else toast(r.ok ? (r.rolls.length ? 'Down the hatch.' : 'Into the spittoon. Nobody saw a thing.') : `You sputter. Drunk ${r.drunk}, and it cost you 1 Health.`, !r.ok);
      return;
    }
    if (d.dk === 'spit') {
      if (!await ask('Try the spittoon trick?\n\nFinesse against the sharpest eye at the bar. Get away with it and you skip this shot. Get caught and you drink a double.', { ok: 'Try it', danger: false })) return;
      const r = await act({ action: 'drinkSpit' });
      await showRoll('Finesse'); play(r.won ? 'success' : 'fail');
      toast(r.won ? 'Slick. Now tap Drink to “finish” your glass.' : `${r.by} catches you. Drink a double.`, !r.won);
      return;
    }
    if (d.dneedle) {
      const r = await act({ action: 'drinkNeedle', target: d.dneedle });
      await showRoll('Charm'); play(r.won ? 'success' : 'fail');
      toast(r.won ? `${r.seat} is rattled: 2 fewer dice on their next shot.` : `${r.seat} laughs it off.`, !r.won);
      return;
    }
    if (d.bjd) { const t = view.table; bjAmt = Math.max(t.stakes.ante, Math.min(t.stakes.bet * 5, Math.round((bjAmt + Number(d.bjd) * t.stakes.ante) * 100) / 100)); render(); return; }
    if (d.bj === 'bet') { await act({ action: 'bjBet', amount: bjAmt }); play('chips'); return; }
    if (d.bj === 'unbet') { await act({ action: 'bjBet', amount: 0 }); return; }
    if (d.bj === 'deal') { await act({ action: 'bjDeal' }); play('card'); setTimeout(() => play('card'), 180); return; }
    if (d.bjm) {
      const r = await act({ action: 'bjMove', move: d.bjm }); play('card');
      const res = view.table.bj?.results?.[`pc:${me()}`];
      if (res && view.table.bj.phase === 'done') toast(res.win > 0 ? `You win ${$$(res.win)}: ${res.text}.` : res.win < 0 ? `You lose: ${res.text}.` : `Push: ${res.text}.`, res.win < 0);
      else if (r?.total > 21) toast(`Bust with ${r.total}.`, true);
      return;
    }
    if (d.bj === 'count') {
      const r = await act({ action: 'bjCount' });
      await showRoll('Intuition'); play(r.won ? 'success' : 'fail');
      toast(r.won ? `You’ve kept count. The next card is ${r.next}.` : 'You lose the count.', !r.won);
      return;
    }
    if (d.bj === 'shiner') {
      if (!await ask('Use a shiner?\n\nFinesse against the dealer’s Intuition. Get it right and you see the hole card. Get caught and your bet is forfeit and you’re out of the round.', { ok: 'Use it', danger: false })) return;
      const r = await act({ action: 'bjShiner' });
      await showRoll('Finesse');
      if (r.won) { play('success'); toast(`In your little mirror: the dealer’s hole card is the ${r.card}.`); }
      else { play('fail'); toast(`${r.by} spots the shiner! Your bet is forfeit.`, true); }
      return;
    }
    if (d.frRank) {
      const t = view.table, r = Number(d.frRank), cur = t.faro?.bets?.[`pc:${me()}`]?.[r];
      const bet = await betDialog(t, r, cur);
      if (bet) { await act({ action: 'faroBet', rank: r, ...bet }); play('chips'); }
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
    if (d.mv) { await act({ action: 'move', move: d.mv }); play(d.mv === 'fold' || d.mv === 'check' ? 'card' : 'chips'); }
    else if (d.sl === 'join') { await act({ action: 'join' }); toast('You’re at the table.'); }
    else if (d.sl === 'deal') { sel = new Set(); await act({ action: 'deal' }); play(view.table.game === 'liars' ? 'dice' : view.table.game === 'drinking' ? 'chips' : 'shuffle'); }
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
  const mine = lastRolls.filter((r) => r.key === `pc:${me()}`).pop(), theirs = lastRolls.filter((r) => r.key !== `pc:${me()}`).pop();
  if (!mine) return;
  const again = lastRolls.length > 2 ? ' (after a tie)' : '';
  await rollPopup(mine, `Your ${skill}: ${mine.hits} vs ${theirs ? `${theirs.who} ${theirs.hits}` : '—'}${again}`).catch(() => {});
}
// whose move it is, for any game (a drinking contest: your glass is full)
const glassFull = (t) => { const D = t?.drink, k = `pc:${me()}`; return D && D.phase === 'pouring' && D.order.includes(k) && !D.out[k] && !D.drank[k] ? k : null; };
const turnOf = (t) => t?.hand?.turn || t?.bj?.turn || t?.liars?.turn || glassFull(t) || null;
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
  const myTurn = turnOf(t) === `pc:${me()}`;
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
      const pitch = t.game === 'drinking' ? `A drinking contest at ${t.where}\n\n${$$(t.stakes.ante)} to get in, last one standing takes the pot. It’s Nerve, Grit and your Health against the whiskey. First to pass out pays the bar tab.` : t.game === 'blackjack' ? `Blackjack at ${t.where}\n\nBets from ${$$(t.stakes.ante)} to ${$$(t.stakes.bet * 5)}, blackjack pays 3 to 2. It’s your real money.` : t.game === 'liars' ? `Liar’s Dice at ${t.where}\n\n${$$(t.stakes.ante)} a head, winner takes the pot. Five dice each, ones are wild. It’s your real money.` : t.game === 'faro' ? `A faro bank at ${t.where}\n\nBet on any card from ${$$(t.stakes.ante)} to ${$$(t.stakes.bet * 5)}. It’s your real money.` : `A card game at ${t.where}\n\nFive-card draw, ${$$(t.stakes.ante)} ante, bets of ${$$(t.stakes.bet)} (${$$(t.stakes.bet * 2)} after the draw). It’s your real money.`;
      if (await ask(pitch, { ok: 'Take a seat', cancel: 'Not tonight', danger: false })) {
        try { await act({ action: 'join' }); openTable(false); } catch (err) { toast(err.message, true); }
      }
      return;
    }
    const myTurn = turnOf(t) === key && turnOf(before?.table) !== key;
    if (seated && myTurn && !scene) { play('chime'); openTable(false); }
    if (scene) render();
    showChip();
  }, null, EP);
}

// ---------- the Warden's Saloon card (Run the Game) ----------
export function mountSaloonDesk(el, getCombat) {
  const st = { game: 'poker', crooked: false, peek: true, stare: true, count: true, shiner: true, spittoon: true, needle: true, where: 'the saloon', ante: 1, bet: 2, npcs: [{ name: '', profile: 'npc:Human - Moderate Combatant', style: 'loose', bank: 50 }], invite: null, tell: true, bluff: true, palm: true };
  let ledger = [], data = null;
  api('GET', null, '?view=warden', '/api/npcs').then((d) => { ledger = d.npcs || []; draw(); }).catch(() => {});
  const refresh = () => api('GET', null, '?view=warden', EP).then((d) => { data = d; view = d; draw(); if (scene) render(); }).catch(() => {});
  onChange(['saloon', 'combat'], refresh); refresh(); // redraw when the table or a wallet changes
  function draw() {
    if (el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
    const t = data?.table;
    if (t && t.status !== 'closed') {
      const h = t.hand;
      el.innerHTML = `<p class="sl-desk-sum"><b>${{ faro: 'Faro', liars: 'Liar’s Dice', blackjack: 'Blackjack', drinking: 'Drinking contest' }[t.game] || 'Poker'} at ${esc(t.where)}</b> · ${t.handsPlayed || 0} hand${t.handsPlayed === 1 ? '' : 's'} played${h && h.phase !== 'over' ? ` · hand ${h.no}: ${esc(PHASE[h.phase])}, pot ${$$(h.pot)}` : ''}</p>
        <div class="sl-desk-seats">${t.seats.map((s) => `<div class="item-row"><span class="item-who"><b>${esc(s.name)}</b><small class="muted">${s.kind === 'npc' ? `${['faro', 'blackjack'].includes(t.game) ? 'the dealer' : esc(STYLE[s.style] || '')} · bank ${$$(s.bank)}` : `${s.net >= 0 ? 'up' : 'down'} ${$$(Math.abs(s.net))}`}${h?.all?.[s.key] ? ` · ${esc(h.all[s.key].name)}` : ''}${t.liars?.all?.[s.key] ? ` · cup: ${t.liars.all[s.key].join(' ')}` : ''}</small></span>${s.kind === 'pc' ? `<button type="button" class="btn small secondary" data-kick="${esc(s.key)}">Remove</button>` : ''}</div>`).join('')}</div>
        <div class="btn-row"><button type="button" class="btn" data-watch>${gl('die')} Watch the table</button>${t.game === 'drinking' ? (!t.drink || t.drink.over ? '<button type="button" class="btn secondary" data-deal>Start a contest</button>' : '') : t.game === 'blackjack' ? (!t.bj || t.bj.phase === 'done' ? '<button type="button" class="btn secondary" data-deal>Start a round</button>' : '') : t.game === 'liars' ? (!t.liars || t.liars.over ? '<button type="button" class="btn secondary" data-deal>Start a game</button>' : '') : t.game === 'faro' ? (!t.faro || t.faro.over ? '<button type="button" class="btn secondary" data-deal>Shuffle a deal</button>' : '') : !h || h.phase === 'over' ? '<button type="button" class="btn secondary" data-deal>Deal a hand</button>' : ''}<button type="button" class="btn secondary" data-close>Close the table</button></div>`;
      return;
    }
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    const faro = st.game === 'faro' || st.game === 'blackjack'; // both have one dealer who banks
    const bj = st.game === 'blackjack';
    el.innerHTML = `<div class="field-step"><span>GAME</span><button type="button" class="chip-btn${st.game === 'poker' ? ' on' : ''}" data-game="poker">Poker<small>five-card draw</small></button><button type="button" class="chip-btn${st.game === 'faro' ? ' on' : ''}" data-game="faro">Faro<small>bet against the bank</small></button><button type="button" class="chip-btn${st.game === 'liars' ? ' on' : ''}" data-game="liars">Liar’s Dice<small>bid and bluff</small></button><button type="button" class="chip-btn${st.game === 'blackjack' ? ' on' : ''}" data-game="blackjack">Blackjack<small>beat the dealer to 21</small></button><button type="button" class="chip-btn${st.game === 'drinking' ? ' on' : ''}" data-game="drinking">Drinking contest<small>last one standing</small></button></div>
      <div class="field-step"><span>WHERE</span><input data-s="where" maxlength="60" value="${esc(st.where)}" placeholder="e.g. the Long Branch Saloon"></div>
      ${faro ? `<div class="field-step"><span>BETS</span><label class="lp-num">Least $<input type="number" min="0.25" step="0.25" data-s="ante" value="${st.ante}"></label><label class="lp-num">Most ${bj ? 'a hand' : 'a card'} $<input type="number" min="1" step="1" data-faromax value="${st.bet * 5}"></label></div>`
        : st.game === 'liars' || st.game === 'drinking' ? `<div class="field-step"><span>STAKES</span><label class="lp-num">Each player puts in $<input type="number" min="0.25" step="0.25" data-s="ante" value="${st.ante}"></label><small class="muted">winner takes the pot</small></div>`
        : `<div class="field-step"><span>STAKES</span><label class="lp-num">Ante $<input type="number" min="0.25" step="0.25" data-s="ante" value="${st.ante}"></label><label class="lp-num">Bet $<input type="number" min="0.5" step="0.5" data-s="bet" value="${st.bet}"></label><small class="muted">doubles after the draw</small></div>`}
      ${(faro ? st.npcs.slice(0, 1) : st.npcs).map((n, i) => `<div class="field-step sl-npc">
        <span>${faro ? 'THE DEALER — banks the game' : `NPC ${i + 1} AT THE TABLE`}</span>
        <input data-n="${i}" data-k="name" maxlength="40" value="${esc(n.name)}" placeholder="Name">
        ${ledger.length ? `<select data-ledger="${i}" aria-label="Pick from the NPC ledger"><option value="">From the ledger…</option>${ledger.map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`).join('')}</select>` : ''}
        <div class="sl-npc-chips">${TOUGH.map(([v, l, d]) => `<button type="button" class="chip-btn${n.profile === v ? ' on' : ''}" data-tough="${i}" data-v="${v}">${l}<small>${d}</small></button>`).join('')}</div>
        ${faro || st.game === 'drinking' ? '' : `<div class="sl-npc-chips">${Object.entries(STYLE).map(([v, l]) => `<button type="button" class="chip-btn${n.style === v ? ' on' : ''}" data-style="${i}" data-v="${v}">${l}</button>`).join('')}</div>`}
        <label class="lp-num">Bank $<input type="number" min="1" data-n="${i}" data-k="bank" value="${n.bank}"></label>
        ${st.npcs.length > 1 && !faro ? `<button type="button" class="btn small secondary danger" data-rmnpc="${i}">Remove</button>` : ''}</div>`).join('')}
      ${st.npcs.length < 4 && !faro ? '<div class="btn-row sl-addnpc"><button type="button" class="btn small secondary" data-addnpc>+ Another NPC</button></div>' : ''}
      <div class="field-step"><span>WHO’S INVITED</span><button type="button" class="chip-btn${st.invite ? '' : ' on'}" data-inv-all>Everyone</button>${posse.map((p) => `<button type="button" class="chip-btn${st.invite?.has(p.id) ? ' on' : ''}" data-inv="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      ${st.game === 'drinking' ? `<div class="field-step"><span>SKILL MOVES</span>${[['spittoon', 'Spittoon trick', 'Finesse'], ['needle', 'Needle them', 'Charm']].map(([k, l, s]) => `<button type="button" class="chip-btn${st[k] ? ' on' : ''}" data-hook="${k}">${l}<small>${s}</small></button>`).join('')}</div>`
        : bj ? `<div class="field-step"><span>SKILL MOVES</span>${[['count', 'Count the cards', 'Intuition'], ['shiner', 'Use a shiner', 'Finesse']].map(([k, l, s]) => `<button type="button" class="chip-btn${st[k] ? ' on' : ''}" data-hook="${k}">${l}<small>${s}</small></button>`).join('')}</div>`
        : faro ? `<div class="field-step"><span>THE DEALING BOX — only you see this</span><button type="button" class="chip-btn${st.crooked ? '' : ' on'}" data-crook="0">Square</button><button type="button" class="chip-btn${st.crooked ? ' on' : ''}" data-crook="1">Crooked<small>stacks cards against big bets; Intuition can catch it</small></button></div>`
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
      if (d.tough !== undefined) { st.npcs[Number(d.tough)].profile = d.v; draw(); return; }
      if (d.style !== undefined) { st.npcs[Number(d.style)].style = d.v; draw(); return; }
      if (d.game) { st.game = d.game; draw(); return; }
      if (d.crook !== undefined) { st.crooked = d.crook === '1'; draw(); return; }
      if (d.open !== undefined) {
        const r = await api('POST', { action: 'open', game: st.game, crooked: st.crooked, where: st.where, ante: st.ante, bet: st.bet, npcs: ['faro', 'blackjack'].includes(st.game) ? st.npcs.slice(0, 1) : st.npcs, invite: st.invite ? [...st.invite] : [], tell: st.tell, bluff: st.bluff, palm: st.palm, peek: st.peek, stare: st.stare, count: st.count, shiner: st.shiner, spittoon: st.spittoon, needle: st.needle }, '', EP);
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
