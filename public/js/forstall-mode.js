// Forstall mode: the Battle Map's full-screen Forstall, built from the same device as the Forstall Scanner page
// (index.html / player.js): the target in line of sight, the Scan button and the bullet-dice tray, the Kurtz Display
// with its guess rows, and the keypad. It works through the fight's own Scan rules (lib/routes/scan.js combatScan /
// combatGuess: the operator's turn, Grit, Range, one Scanner per round, one guess per Scan).
// openForstallMode(ctx): ctx = { f (the Forstall field), pc (who's at the controls), fight, cost, pool (text),
//   easy (Warden's aid), targets() → [{ name, d, why, decoded }], getF() (the Forstall now), controls() → HTML for
//   Sweep / Burst / memory slots (battle.js forstallCard full), wireControls(el), onChange() (refresh the map) }.
// No `pc` (the Warden, or an owner out of their turn): just the controls; Scanning is for whoever's turn it is.
import { esc, api, toast, injectDefs, animateRoll, staticDice, readoutHTML, diamondsHTML, chipsHTML, WAVE_SVG } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

let open = null; // the one open device
// the map or the fight changed: redraw the controls and the monster list (not the device, so typing isn't lost)
export function refreshForstallMode() { open?.refresh(); }

export function openForstallMode(ctx) {
  if (open) return;
  injectDefs();
  const st = { sel: null, nb: [], pending: null, input: Array(6).fill(null), busy: false, seen: null, lastRoll: null };
  const back = document.createElement('div');
  back.className = 'modal-back fsm-back';
  back.innerHTML = '<div class="fsm" role="dialog" aria-modal="true" aria-label="Forstall"></div>';
  const box = back.firstElementChild;
  document.body.append(back);
  document.body.classList.add('nav-open');
  open = { back, close, refresh: () => { if (!st.busy && !back.contains(document.activeElement?.closest?.('select'))) drawSide(); } };

  const entry = (name) => st.nb.find((e) => e.name === name) || { name, known: [], guesses: [], positional: Array(6).fill(null), solved: false };
  const myGuess = () => !!ctx.pc && !!st.pending && st.pending.pc === ctx.pc.id && st.pending.name === st.sel;
  const locked = () => entry(st.sel).positional || Array(6).fill(null);
  const openSlots = () => locked().map((d, i) => (d === null ? i : -1)).filter((i) => i >= 0);
  const current = () => locked().map((d, i) => (d !== null ? d : st.input[i]));

  async function load() {
    try {
      const sv = await api('GET', null, '?view=player', '/api/scan');
      st.nb = sv.notebook || []; st.pending = sv.pending || null;
    } catch { /* keep what we had */ }
    const list = ctx.targets();
    // the monster with a guess waiting comes first, then the one picked, then the first we can Scan
    if (ctx.pc && st.pending?.pc === ctx.pc.id) st.sel = st.pending.name;
    else if (!list.some((t) => t.name === st.sel)) st.sel = (list.find((t) => !t.why) || list[0])?.name || null;
  }

  function keyStates(e) {
    const rank = { red: 1, yellow: 2, green: 3 }, out = {};
    (e.guesses || []).forEach((g) => g.digits.forEach((d, i) => { const r = g.result[i]; if (!out[d] || rank[r] > rank[out[d]]) out[d] = r; }));
    return out;
  }

  function draw() {
    const list = ctx.targets(), t = list.find((x) => x.name === st.sel), e = entry(st.sel), live = myGuess();
    const waiting = !!ctx.pc && st.pending?.pc === ctx.pc.id; // a guess from the last Scan comes first (one Scan, one guess)
    const canScan = !!ctx.pc && !!t && !t.why && !waiting && !st.busy;
    // why the Scan button is off, said right under it
    const whyNot = st.busy ? '' : !ctx.pc ? 'Scanning is done by the character whose turn it is, from their own Forstall (or one within 1″).'
      : waiting ? (live ? `${esc(ctx.pc.name)} has a guess waiting from the last Scan. Punch six digits into the keypad below and Transmit, then Scan again.` : `${esc(ctx.pc.name)} has a guess waiting on the ${esc(st.pending.name)}. Pick it on the left and make the guess first.`)
      : !st.sel ? 'No monster in sight to Scan.' : t?.why ? `Can’t Scan: ${esc(t.why)}.` : '';
    const fresh = st.seen !== null && (e.guesses || []).length > st.seen ? st.seen : (e.guesses || []).length;
    const rows = !st.sel ? '<div class="empty-msg">NO SIGNAL — no monster in sight</div>'
      : `${(e.guesses || []).map((g, i) => `<div class="row${i >= fresh ? ' fresh' : ''}"><span class="n">${i + 1}</span>${diamondsHTML(g.digits, g.result)}</div>`).join('')}
        ${e.solved ? `<div class="solved-banner">FREQUENCY LOCKED · ${esc(e.kz || '')}</div>`
        : live ? `${(e.guesses || []).length ? '' : '<div class="empty-msg">Punch in six digits and transmit.</div>'}<div class="row input-row"><span class="n">▶</span>${diamondsHTML(current(), [], (i) => (locked()[i] !== null ? ' input locked' : ` input${i === openSlots().find((k) => st.input[k] === null) ? ' cursor' : ''}`))}</div>`
        : `<div class="empty-msg">${ctx.pc && st.pending?.pc === ctx.pc.id ? `A guess is waiting on the ${esc(st.pending.name)}.` : ctx.pc ? 'Scan to earn a guess.' : 'Scanning is done by the character whose turn it is.'}</div>`}`;
    const ks = keyStates(e), known = new Set(e.known || []);
    box.innerHTML = `
      <div class="fsm-head"><div><small>EDISON FORSTALL · ${esc(ctx.f.name.toUpperCase())}</small><b>${ctx.pc ? `${esc(ctx.pc.name)} at the controls` : 'The Forstall’s controls'}</b>
        <span class="fsm-sub">${subLine()}</span></div>
        <button type="button" class="btn secondary fsm-x" data-fsm-x>${gl('pin')} Back to the map</button></div>
      <div class="fsm-grid">
        <section class="fsm-side"></section>
        <section class="fsm-main">
          <div class="card target${st.sel ? '' : ' idle'}"><div><div class="label">TARGET IN LINE OF SIGHT</div><div class="name">${st.sel ? esc(st.sel) : 'Nothing in sight'}</div>
            <div class="meta">${t ? esc(t.why || `${t.d}″ away`) : ''}${ctx.easy ? ' <span class="badge teal">WARDEN’S AID: POSITIONS SHOWN</span>' : ''}</div></div>${st.sel ? readoutHTML(e.positional) : ''}</div>
          <div class="fsm-scan">
            <button type="button" class="btn" data-fsm-scan${canScan ? '' : ' disabled'}>${gl('target')} ${waiting ? 'Guess first' : st.sel ? `Scan the ${esc(st.sel)}` : 'Scan'}${ctx.fight && !waiting ? ` · ${ctx.cost} Grit` : ''}</button>
            ${whyNot ? `<span class="note fsm-why">${whyNot}</span>` : '<span class="note">Each Hit earns one digit; an Ace counts as two. Then one guess.</span>'}
          </div>
          <div class="tray fsm-tray"><span class="empty">Your bullet dice land here.</span></div>
          <div class="tally fsm-tally"></div>
          <div class="tip">${e.solved ? `<b>DECODED</b>: the ${esc(st.sel)} is ${esc(e.kz || '')}. Put it in a memory slot to Sweep it at +1 and Burst it.` : `<b>DIGITS RECOVERED (${(e.known || []).length}/6)</b> ${(e.known || []).length ? chipsHTML(e.known) : '<span class="muted">none yet</span>'}`}</div>
          <div class="forstall">
            <div class="forstall-top${live ? ' your-guess' : ''}"><span class="lamp${live ? ' on' : ''}"></span><span class="model">EDISON FORSTALL · KURTZ DISPLAY</span></div>
            <div class="screen${live ? ' live' : ''}">${WAVE_SVG}<div class="rows">${rows}</div></div>
            <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((k) => `<button class="key ${ks[k] || ''}${known.has(k) ? ' known' : ''}" type="button" data-k="${k}"${live ? '' : ' disabled'}>${k}</button>`).join('')}
              <button class="key wide" type="button" data-k="back"${live ? '' : ' disabled'} aria-label="Delete">⌫ DEL</button><button class="key wide go" type="button" data-k="enter"${live ? '' : ' disabled'}>TRANSMIT ▶</button><button class="key wide" type="button" data-k="clear"${live ? '' : ' disabled'}>CLEAR</button></div>
            <div class="legend"><span><i style="background:var(--green)"></i>Right digit, right spot</span><span><i style="background:var(--yellow)"></i>In the frequency, wrong spot</span><span><i style="background:var(--red)"></i>Not in the frequency</span></div>
          </div>
        </section>
      </div>`;
    drawSide();
    const rowsEl = box.querySelector('.rows'); rowsEl.scrollTop = rowsEl.scrollHeight;
    st.seen = (e.guesses || []).length;
    if (st.lastRoll) staticDice(box.querySelector('.fsm-tray'), st.lastRoll.dice), tally(st.lastRoll);
  }

  // under the name: Grit (fresh, so a Sweep or Scan shows), the Scan cost, Intuition, Range
  function subLine() {
    const pc = ctx.getPc?.() || ctx.pc, f = ctx.getF?.() || ctx.f;
    return `${pc ? `${ctx.fight ? `${pc.grit ?? 0} Grit left · a Scan costs ${ctx.cost}` : 'Out of a fight: Scanning is free'} · Intuition ${esc(ctx.pool)} · ` : ''}Range ${f.rangeIn >= 999 ? 'the whole map' : `${f.rangeIn}″`}`;
  }
  // the left column: the monsters to Scan, then the Forstall's own controls (Sweep, Burst, memory slots, EMP state)
  function drawSide() {
    const sub = box.querySelector('.fsm-sub'); if (sub) sub.textContent = subLine();
    const side = box.querySelector('.fsm-side'); if (!side) return;
    const list = ctx.targets();
    side.innerHTML = `${ctx.pc ? `<div class="fsm-h">MONSTERS ON THE BOARD</div>
      <div class="fsm-tgts">${list.length ? list.map((x) => `<button type="button" class="fsm-tgt${x.name === st.sel ? ' on' : ''}${x.why ? ' off' : ''}" data-fsm-sel="${esc(x.name)}">
          <b>${esc(x.name)}</b><small>${x.decoded ? '<span class="badge green">DECODED</span> ' : ''}${esc(x.why || `${x.d}″ away · in Range`)}</small></button>`).join('')
        : '<p class="muted">No monsters on the board to Scan.</p>'}</div>` : ''}
      <div class="fsm-h">THE FORSTALL</div><div class="fsm-ctl">${ctx.controls ? ctx.controls() : ''}</div>`;
    if (ctx.wireControls) ctx.wireControls(side.querySelector('.fsm-ctl'));
  }

  function tally(r) {
    box.querySelector('.fsm-tally').innerHTML = `<span class="muted">Rolled ${esc(r.pool)}${r.halved ? ' (halved)' : ''}</span><span class="hits">${r.hits} HIT${r.hits === 1 ? '' : 'S'}</span>
      ${r.newDigits?.length ? `<span>Digits recovered: ${chipsHTML(r.newDigits, r.newDigits)}</span>` : `<span class="muted">${r.hits ? 'Nothing new to learn.' : 'No luck, partner.'}</span>`}`;
  }

  async function scan() {
    if (st.busy || !st.sel) return;
    st.busy = true; draw();
    play('fsScan');
    try {
      const r = await api('POST', { action: 'combatScan', pc: ctx.pc.id, key: ctx.f.key, monster: st.sel }, '', '/api/scan');
      const res = r.result;
      await animateRoll(box.querySelector('.fsm-tray'), res.dice);
      if (res.newDigits?.length) play('fsReadout');
      st.lastRoll = { dice: res.dice, hits: res.hits, newDigits: res.newDigits, pool: res.pool, halved: res.halved };
      await load(); st.input = Array(6).fill(null);
      toast(res.newDigits?.length ? `Picked up ${res.newDigits.join(', ')}. Now make your guess.` : 'No new digits. You still get your guess.');
      ctx.onChange?.();
    } catch (err) { toast(err.message, true); }
    st.busy = false; draw();
  }

  async function transmit() {
    if (st.busy || !myGuess()) return;
    const guess = current();
    if (guess.some((d) => d === null)) {
      const row = box.querySelector('.row.input-row'); row?.classList.remove('shake'); void row?.offsetWidth; row?.classList.add('shake');
      toast('A frequency has six digits.'); return;
    }
    st.busy = true;
    try {
      const r = (await api('POST', { action: 'combatGuess', pc: ctx.pc.id, digits: guess }, '', '/api/scan')).result;
      play('fsReadout');
      const n = (k) => r.result.filter((x) => x === k).length;
      if (r.solved) { play('success'); toast(`Decoded! The ${r.name}’s frequency can go in a memory slot now.`); }
      else toast(`${n('green')} green, ${n('yellow')} yellow, ${n('red')} red.`);
      st.input = Array(6).fill(null);
      await load();
      ctx.onChange?.();
    } catch (err) { toast(err.message, true); }
    st.busy = false; draw();
  }

  function press(k) {
    if (!myGuess() || st.busy) return;
    const slots = openSlots();
    if (k === 'back') { const last = [...slots].reverse().find((i) => st.input[i] !== null); if (last !== undefined) st.input[last] = null; }
    else if (k === 'clear') st.input = Array(6).fill(null);
    else if (k === 'enter') { transmit(); return; }
    else { const next = slots.find((i) => st.input[i] === null); if (next !== undefined) st.input[next] = Number(k); }
    draw();
  }

  function close() {
    back.remove(); document.body.classList.remove('nav-open');
    document.removeEventListener('keydown', onKey, true);
    open = null;
    ctx.onChange?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Enter' && myGuess()) { e.preventDefault(); press('enter'); }
  }
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-fsm-x]')) return close();
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.fsmSel) { if (!(st.pending?.pc === ctx.pc.id)) { st.sel = b.dataset.fsmSel; st.lastRoll = null; st.seen = null; draw(); } else toast(`Make your guess at the ${st.pending.name} first.`, true); return; }
    if (b.dataset.fsmScan !== undefined) { scan(); return; }
    if (b.dataset.k) press(b.dataset.k);
  });
  draw();
  load().then(draw);
  return { close };
}
export const forstallModeOpen = () => !!open;
