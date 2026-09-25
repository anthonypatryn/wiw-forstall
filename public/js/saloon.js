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
  document.head.insertAdjacentHTML('beforeend', '<link id="saloon-css" rel="stylesheet" href="/css/saloon.css?v=1">');
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
      if (await ask(`A card game at ${t.where}\n\nFive-card draw, ${$$(t.stakes.ante)} ante, bets of ${$$(t.stakes.bet)} (${$$(t.stakes.bet * 2)} after the draw). It’s your real money.`, { ok: 'Take a seat', cancel: 'Not tonight', danger: false })) {
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
  const st = { where: 'the saloon', ante: 1, bet: 2, npcs: [{ name: '', profile: 'npc:Human - Moderate Combatant', style: 'loose', bank: 50 }], invite: null, tell: true, bluff: true, palm: true };
  let ledger = [], data = null;
  api('GET', null, '?view=warden', '/api/npcs').then((d) => { ledger = d.npcs || []; draw(); }).catch(() => {});
  const refresh = () => api('GET', null, '?view=warden', EP).then((d) => { data = d; view = d; draw(); if (scene) render(); }).catch(() => {});
  setInterval(refresh, 4000); refresh();
  function draw() {
    if (el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
    const t = data?.table;
    if (t && t.status !== 'closed') {
      const h = t.hand;
      el.innerHTML = `<p class="sl-desk-sum"><b>Poker at ${esc(t.where)}</b> · ${t.handsPlayed || 0} hand${t.handsPlayed === 1 ? '' : 's'} played${h && h.phase !== 'over' ? ` · hand ${h.no}: ${esc(PHASE[h.phase])}, pot ${$$(h.pot)}` : ''}</p>
        <div class="sl-desk-seats">${t.seats.map((s) => `<div class="item-row"><span class="item-who"><b>${esc(s.name)}</b><small class="muted">${s.kind === 'npc' ? `${esc(STYLE[s.style] || '')} · bank ${$$(s.bank)}` : `${s.net >= 0 ? 'up' : 'down'} ${$$(Math.abs(s.net))}`}${h?.all?.[s.key] ? ` · ${esc(h.all[s.key].name)}` : ''}</small></span>${s.kind === 'pc' ? `<button type="button" class="btn small secondary" data-kick="${esc(s.key)}">Remove</button>` : ''}</div>`).join('')}</div>
        <div class="btn-row"><button type="button" class="btn" data-watch>${gl('die')} Watch the table</button>${!h || h.phase === 'over' ? '<button type="button" class="btn secondary" data-deal>Deal a hand</button>' : ''}<button type="button" class="btn secondary" data-close>Close the table</button></div>`;
      return;
    }
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    el.innerHTML = `<div class="field-step"><span>WHERE</span><input data-s="where" maxlength="60" value="${esc(st.where)}" placeholder="e.g. the Long Branch Saloon"></div>
      <div class="field-step"><span>STAKES</span><label class="lp-num">Ante $<input type="number" min="0.25" step="0.25" data-s="ante" value="${st.ante}"></label><label class="lp-num">Bet $<input type="number" min="0.5" step="0.5" data-s="bet" value="${st.bet}"></label><small class="muted">doubles after the draw</small></div>
      <div class="field-step"><span>AT THE TABLE — NPCs</span></div>
      ${st.npcs.map((n, i) => `<div class="sl-npc-row">
        <input data-n="${i}" data-k="name" maxlength="40" value="${esc(n.name)}" placeholder="Name">
        ${ledger.length ? `<select data-ledger="${i}" aria-label="Pick from the NPC ledger"><option value="">From the ledger…</option>${ledger.map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`).join('')}</select>` : ''}
        <select data-n="${i}" data-k="profile">${[['npc:Human - Weak Combatant', 'Green'], ['npc:Human - Moderate Combatant', 'Seasoned'], ['npc:Human - Strong Combatant', 'Sharp']].map(([v, l]) => `<option value="${v}"${n.profile === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <select data-n="${i}" data-k="style">${Object.entries(STYLE).map(([v, l]) => `<option value="${v}"${n.style === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <label class="lp-num">Bank $<input type="number" min="1" data-n="${i}" data-k="bank" value="${n.bank}"></label>
        ${st.npcs.length > 1 ? `<button type="button" class="rm-btn" data-rmnpc="${i}" aria-label="Remove">×</button>` : ''}</div>`).join('')}
      ${st.npcs.length < 4 ? '<button type="button" class="btn small secondary" data-addnpc>+ Another NPC</button>' : ''}
      <div class="field-step"><span>WHO’S INVITED</span><button type="button" class="chip-btn${st.invite ? '' : ' on'}" data-inv-all>Everyone</button>${posse.map((p) => `<button type="button" class="chip-btn${st.invite?.has(p.id) ? ' on' : ''}" data-inv="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      <div class="field-step"><span>SKILL MOVES</span>${[['tell', 'Read a tell', 'Intuition'], ['bluff', 'Bluff', 'Charm'], ['palm', 'Palm a card', 'Finesse']].map(([k, l, s]) => `<button type="button" class="chip-btn${st[k] ? ' on' : ''}" data-hook="${k}">${l}<small>${s}</small></button>`).join('')}</div>
      <button type="button" class="btn" data-open>${gl('die')} Open the table</button>`;
  }
  el.addEventListener('input', (e) => { const d = e.target.dataset; if (d.s) st[d.s] = e.target.value; if (d.n !== undefined) st.npcs[Number(d.n)][d.k] = e.target.value; });
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
      if (d.open !== undefined) {
        const r = await api('POST', { action: 'open', where: st.where, ante: st.ante, bet: st.bet, npcs: st.npcs, invite: st.invite ? [...st.invite] : [], tell: st.tell, bluff: st.bluff, palm: st.palm }, '', EP);
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
