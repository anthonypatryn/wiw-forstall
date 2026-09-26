// The shared Table Log: every roll from any page (combat, sheets, Forstall scans) in one place.
import { esc, api, startPolling, staticDice, timeAgo, injectDefs, savedPin, toast, store, rollPopup, animateRoll, ask, play, me } from './common.js';
import { gl } from './glyphs.js';
import { duelHud } from './duel-hud.js';
import { tradeHud, openTrade } from './trade.js';
import { attention } from './attention.js';

function logHTML(log) {
  if (!log.length) return '<p class="empty-note">Rolls and big moments show up here for everyone.</p>';
  return log.map((l) => {
    if (l.type === 'round') return `<div class="ent round">— ${esc(l.text)} —</div>`;
    if (l.type === 'roll') {
      return `<div class="ent roll${l.hidden ? ' secret-roll' : ''}"><div class="top"><b>${esc(l.who)}${l.hidden ? ' (secret)' : ''}</b><span class="when" data-at="${l.at}">${timeAgo(l.at)}</span></div>
        ${l.label ? `<div>${esc(l.label)}</div>` : ''}
        <div class="dice-mini" data-dice='${esc(JSON.stringify(l.dice))}'></div>
        <span class="res">${l.hits} hit${l.hits === 1 ? '' : 's'}</span> <span class="muted">· ${esc(l.pool)}${l.spur ? ' ↻' : ''}${l.aces ? ` · ${l.aces} Ace${l.aces > 1 ? 's' : ''}` : ''}</span></div>`;
    }
    return `<div class="ent ${l.type}"><div class="top"><span>${esc(l.text)}</span><span class="when" data-at="${l.at}">${timeAgo(l.at)}</span></div>${l.secret ? `<div class="secret">${esc(l.secret)}</div>` : ''}</div>`;
  }).join('');
}

const EMOJI = /[\u{1F000}-\u{1FFFF}\u2B50\u23F3\u23ED\u26A0\u26A1\u2694\u2705\u274C\u2728]\uFE0F?\s?/gu;
const noEmoji = (l) => (l.text || l.label ? { ...l, text: l.text?.replace(EMOJI, ''), label: l.label?.replace(EMOJI, '') } : l);
export function renderLogInto(box, log) {
  box.innerHTML = logHTML((log || []).map(noEmoji));
  box.querySelectorAll('[data-dice]').forEach((el) => staticDice(el, JSON.parse(el.dataset.dice)));
}

// Floating drawer for pages without a built-in log.
export function mountTableLog() {
  injectDefs();
  import('./handouts.js').then((m) => m.watchHandouts()).catch(() => {}); // “The Warden hands you…” pop-ups
  import('./lockpick.js').then((m) => m.watchLocks()).catch(() => {}); // a lock sent to you opens the lock-picking scene
  import('./paper.js').then((m) => m.watchPapers()).catch(() => {}); // a new issue of the paper: “Extra! Extra!”
  import('./saloon.js').then((m) => m.watchSaloon()).catch(() => {}); // a card game: the invite, and the table on your move
  import('./journal-watch.js').then((m) => m.watchJournal()).catch(() => {}); // a new quest or clue the Warden reveals
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'log-fab';
  btn.innerHTML = `${gl('scroll')} Table Log <span class="log-badge" hidden></span>`;
  btn.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('aside');
  panel.className = 'log-drawer';
  panel.setAttribute('aria-label', 'Table Log');
  panel.hidden = true;
  panel.innerHTML = `<div class="log-drawer-head"><b>TABLE LOG</b><a href="/battle">Battle Map ›</a><button type="button" class="log-clear" hidden>Clear</button><button type="button" class="log-close" aria-label="Close">×</button></div><div class="log"></div>`;
  // Roll dice + Table Log share one bottom-right row, so a wider button (unread badge) never overlaps
  const row = document.createElement('div');
  row.className = 'fab-row';
  row.append(btn);
  document.body.append(row, panel);
  mountDice(row);
  // Whisper to the Warden (players only) + pop-ups for whispers/replies
  import('./whisper.js').then((m) => {
    if (!savedPin()) {
      const wb = document.createElement('button');
      wb.type = 'button'; wb.className = 'log-fab whisper-fab'; wb.title = 'Whisper to the Warden';
      wb.innerHTML = `${gl('scroll')} <span>Whisper</span>`;
      wb.addEventListener('click', m.whisper);
      row.prepend(wb);
      const tb = document.createElement('button');
      tb.type = 'button'; tb.className = 'log-fab whisper-fab'; tb.title = 'Trade with the posse';
      tb.innerHTML = `${gl('satchel')} <span>Trade</span>`;
      tb.addEventListener('click', () => openTrade());
      row.prepend(tb);
    }
    m.watchWhispers();
  }).catch(() => {});
  askWhoIAm();
  // "Previously on…" once per written-up session (players only; waits for other pop-ups)
  if (!savedPin()) setTimeout(() => import('./previously.js').then((m) => m.showPreviously()).catch(() => {}), 2500);
  // any [data-trade] button (e.g. on a sheet's Inventory) opens a trade with that character
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-trade]'); if (b) openTrade(b.dataset.trade || null); });
  // any [data-stash] button opens the posse stash
  document.addEventListener('click', (e) => { if (e.target.closest('[data-stash]')) import('./stash.js').then((m) => m.openStash()); });

  let seenTop = null, unread = 0, latest = [];
  const badge = btn.querySelector('.log-badge');
  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { unread = 0; badge.hidden = true; renderLogInto(panel.querySelector('.log'), latest); panel.querySelector('.log-clear').hidden = !savedPin(); }
  };
  btn.addEventListener('click', () => setOpen(panel.hidden));
  panel.querySelector('.log-close').addEventListener('click', () => setOpen(false));
  // Warden only (the server checks the PIN too)
  panel.querySelector('.log-clear').addEventListener('click', async () => {
    if (!await ask('Clear the Table Log for everyone? This can’t be undone.')) return;
    try { await api('POST', { action: 'clearLog' }, '', '/api/combat'); latest = []; renderLogInto(panel.querySelector('.log'), latest); toast('Table Log cleared.'); }
    catch (e) { toast(e.message, true); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

  startPolling('log', (d) => {
    renderHud(d.hud);
    latest = d.log;
    const topId = latest[0]?.id ?? null;
    if (seenTop !== null && topId !== seenTop) {
      const idx = latest.findIndex((l) => l.id === seenTop);
      unread += idx === -1 ? latest.length : idx;
      if (panel.hidden && unread) { badge.textContent = unread > 9 ? '9+' : unread; badge.hidden = false; btn.classList.remove('ping'); void btn.offsetWidth; btn.classList.add('ping'); }
    }
    seenTop = topId;
    if (!panel.hidden) renderLogInto(panel.querySelector('.log'), latest);
  }, null, '/api/combat');
}

// ---------- HUD on every page: turn order strip, start-of-combat rolls, the Warden's Skill checks ----------
let hudEls = null;
function hudMount() {
  if (hudEls) return hudEls;
  const strip = document.createElement('div');
  strip.className = 'hud-strip'; strip.hidden = true;
  const pop = document.createElement('div');
  pop.className = 'hud-pop-back'; pop.hidden = true;
  const ck = document.createElement('div');
  ck.className = 'hud-check'; ck.hidden = true;
  document.body.append(strip, pop, ck);
  hudEls = { strip, pop, ck };
  return hudEls;
}
const seen = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const setSeen = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
let lastHud = null;
export function renderHud(h) {
  if (!h) return;
  lastHud = h;
  duelHud(h);
  tradeHud(h);
  // the tab title / icon / buzz for this device's player: their combat turn, or a roll the Warden asked them for
  if (!savedPin() && me()) {
    const mine = me(), cur = h.active && h.current === mine ? h.order.find((o) => o.key === mine) : null;
    attention('turn', cur ? `Your turn, ${cur.name}!` : null);
    attention('roll', (h.checks || []).some((ck) => ck.who.some((w) => w.id === mine && !w.rolled)) ? 'The Warden wants a roll' : null);
  }
  const { strip, pop, ck } = hudMount();
  // 1) turn order strip (collapsible; remembered per device)
  if (!h.active || !h.order.length) strip.hidden = true;
  else {
    strip.hidden = false;
    const closed = store.get('wiw.hudClosed', false);
    const i = h.order.findIndex((o) => o.key === h.current), cur = h.order[i];
    const rest = [...h.order.slice(i + 1), ...h.order.slice(0, Math.max(0, i))];
    strip.classList.toggle('closed', closed);
    strip.innerHTML = closed
      ? `<button type="button" class="hud-toggle" data-hud-open title="Show turn order">${gl('revolver')} ${esc(cur?.name || '—')}’s turn</button>`
      : `<span class="hud-r">R${h.round || 1}</span><b class="hud-now${cur && cur.key === me() ? ' mine' : ''}">${gl('revolver')} ${esc(cur?.name || '—')}</b>${rest.length ? '<i>›</i>' : ''}${rest.map((o) => `<span class="hud-next${o.key === me() ? ' mine' : ''}">${esc(o.name)}</span>`).join('<i>›</i>')}
        <button type="button" class="hud-toggle" data-hud-close title="Hide" aria-label="Hide turn order">–</button>`;
    strip.querySelector('[data-hud-open]')?.addEventListener('click', () => { store.set('wiw.hudClosed', false); renderHud(lastHud); });
    strip.querySelector('[data-hud-close]')?.addEventListener('click', () => { store.set('wiw.hudClosed', true); renderHud(lastHud); });
  }
  // 1b) it's my turn and I'm not on the map (or my sheet): nudge me there
  myTurn(h);
  // 2) the turn-order rolls when combat starts (once per device, only while it's fresh)
  if (h.start && seen('wiw.seenStart') !== String(h.start.at)) {
    setSeen('wiw.seenStart', String(h.start.at));
    if (Date.now() - h.start.at < 5 * 60 * 1000) {
      pop.hidden = false;
      pop.innerHTML = `<div class="hud-pop" role="dialog" aria-label="Turn order"><button type="button" class="hud-x" aria-label="Close">×</button>
        <small>COMBAT BEGINS — ROUND 1</small><h2>Turn order</h2><p class="muted">Everyone rolled Finesse; most Hits goes first (p. 40).</p>
        <ol>${h.start.rolls.map((r, k) => `<li class="${r.surprise ? 'surprise' : ''}"><span class="n">${k + 1}</span><div><b>${esc(r.name)}</b>${r.by ? `<small>rolled by ${esc(r.by)}</small>` : ''}${r.surprise ? '<small class="sup">SURPRISE — goes first</small>' : ''}</div>
          <div class="tray hud-tray" data-k="${k}"></div><span class="h">${r.hits ?? '—'}<small>hit${r.hits === 1 ? '' : 's'}</small></span></li>`).join('')}</ol></div>`;
      h.start.rolls.forEach((r, k) => { const t = pop.querySelector(`[data-k="${k}"]`); if (t && r.dice?.length) animateRoll(t, r.dice); });
      const close = () => { pop.hidden = true; };
      pop.querySelector('.hud-x').addEventListener('click', close);
      pop.addEventListener('click', (e) => { if (e.target === pop) close(); });
      setTimeout(close, 25000);
    }
  }
  // 3) your prepared Action has been set off — fire it from any page
  holdPopup(h);
  // 4) a Skill check / Challenge for this device's character — on any page
  const mine = me();
  const onMySheet = location.pathname.startsWith('/posse') && location.hash.slice(1).split('/')[0] === mine;
  const open = mine && !onMySheet ? (h.checks || []).find((c) => c.who.some((w) => w.id === mine && !w.rolled) && seen(`wiw.ck.${c.id}.${c.round}`) !== 'later') : null;
  if (!open) {
    // not called? You can Help (p. 13): roll half your dice and the best helper's Hits are added
    const assist = mine && !onMySheet ? (h.checks || []).find((c) => c.kind !== 'challenge' && !c.who.some((w) => w.id === mine) && !(c.helped || []).includes(mine) && seen(`wiw.help.${c.id}`) !== 'no') : null;
    if (!assist) { ck.hidden = true; ck.dataset.id = ''; return; }
    if (ck.dataset.id === `help.${assist.id}` && !ck.hidden) return;
    ck.dataset.id = `help.${assist.id}`;
    ck.hidden = false;
    const names = assist.who.map((w) => w.name);
    ck.innerHTML = `<div><small>WANT TO HELP?</small>
      <b>${esc(names.length > 2 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names.join(' & '))} ${names.length > 1 ? 'are' : 'is'} rolling ${esc(assist.skill)}</b> · ${esc(assist.diff)} — ${assist.target} Hit${assist.target === 1 ? '' : 's'}${assist.note ? ` · <i>${esc(assist.note)}</i>` : ''}
      <span class="hud-ck-sub">Roll half your ${esc(assist.skill)} dice — the best helper’s Hits are added to theirs.</span></div>
      <div class="hud-ck-btns"><button type="button" class="btn" data-help-go>Help</button><button type="button" class="btn small secondary" data-help-no>Not this time</button></div>`;
    ck.querySelector('[data-help-no]').addEventListener('click', () => { setSeen(`wiw.help.${assist.id}`, 'no'); ck.hidden = true; });
    ck.querySelector('[data-help-go]').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const res = await api('POST', { action: 'pc', id: mine, op: 'checkRoll', check: assist.id }, '', '/api/combat');
        ck.hidden = true; setSeen(`wiw.help.${assist.id}`, 'no');
        const r = res.result;
        if (r?.dice) { await rollPopup(r, `Helping · ${r.label || assist.skill}`); toast(`You helped with ${r.hits} Hit${r.hits === 1 ? '' : 's'}.`); }
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    });
    return;
  }
  if (ck.dataset.id === `${open.id}.${open.round}` && !ck.hidden) return;
  ck.dataset.id = `${open.id}.${open.round}`;
  const who = open.who.find((w) => w.id === mine);
  const others = open.who.filter((w) => w.id !== mine).map((w) => w.name).concat(open.vs ? [open.vs] : []);
  ck.hidden = false;
  play('chime');
  try { navigator.vibrate?.(150); } catch {}
  ck.innerHTML = `<div><small>${open.kind === 'challenge' ? `CHALLENGE${open.round > 1 ? ` · ROUND ${open.round} (TIE)` : ''} — MOST HITS WINS` : 'THE WARDEN ASKS YOU TO ROLL'}</small>
    <b>${esc(who.name)}: ${esc(open.skill)}</b> ${open.kind === 'challenge' ? `vs ${esc(others.join(' & '))}` : `· ${esc(open.diff)} — ${open.target} Hit${open.target === 1 ? '' : 's'}`}${open.note ? ` · <i>${esc(open.note)}</i>` : ''}</div>
    <div class="hud-ck-btns"><button type="button" class="btn" data-ck-go>Roll ${esc(open.skill)}</button><button type="button" class="btn small secondary" data-ck-later>Later</button></div>`;
  ck.querySelector('[data-ck-later]').addEventListener('click', () => { setSeen(`wiw.ck.${open.id}.${open.round}`, 'later'); ck.hidden = true; });
  ck.querySelector('[data-ck-go]').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const res = await api('POST', { action: 'pc', id: mine, op: 'checkRoll', check: open.id }, '', '/api/combat');
      const r = res.result;
      ck.hidden = true;
      if (r?.dice) {
        await rollPopup(r, `${who.name} · ${r.label}`);
        if (r.outcome) play(r.outcome.ok ? 'success' : 'fail');
        if (r.outcome) toast(r.outcome.ok ? `✓ Success — ${r.outcome.total}/${r.target} Hits!` : `✗ Short — ${r.outcome.total}/${r.target} Hits.`, !r.outcome.ok);
        else toast(`${r.hits} Hit${r.hits === 1 ? '' : 's'} — see the Table Log for who won.`);
      }
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
}

let holdEl = null;
function holdPopup(h) {
  const mine = me();
  const hot = mine && (h.holds || []).find((x) => x.id === mine && x.triggeredBy && seen(`wiw.hold.${x.at}.${x.triggeredBy.at}`) !== 'no');
  if (!holdEl) { holdEl = document.createElement('div'); holdEl.className = 'hud-check hud-hold'; holdEl.hidden = true; document.body.append(holdEl); }
  if (!hot) { holdEl.hidden = true; holdEl.dataset.k = ''; return; }
  const key = `${hot.at}.${hot.triggeredBy.at}`;
  if (holdEl.dataset.k === key && !holdEl.hidden) return;
  holdEl.dataset.k = key; holdEl.hidden = false;
  try { navigator.vibrate?.([100, 50, 100]); } catch {}
  holdEl.innerHTML = `<div><small>YOUR PREPARED ACTION CAN GO OFF</small><b>${gl('watch')} ${esc(hot.triggeredBy.text)}</b> — fire ${esc(hot.name)}’s ${esc(hot.label)}?</div>
    <div class="hud-ck-btns"><button type="button" class="btn" data-fire>${gl('flash')} Fire now</button><button type="button" class="btn small secondary" data-no>Not yet</button></div>`;
  holdEl.querySelector('[data-no]').addEventListener('click', () => { setSeen(`wiw.hold.${key}`, 'no'); holdEl.hidden = true; });
  holdEl.querySelector('[data-fire]').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const res = await api('POST', { action: 'pc', id: mine, op: 'fireHold', target: hot.triggeredBy.enemy }, '', '/api/combat');
      const r = res.result;
      holdEl.hidden = true;
      if (r?.dice) await rollPopup(r, `${hot.name} · prepared ${r.fired} · ${r.pool}`);
      toast(r?.dmg != null ? (r.dmg ? `${r.dmg} damage to ${r.target}` : `${r.target} shrugs it off`) : `${r?.fired || 'Fired'} — done!`);
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
}

// ---------- quick dice roller on every page (any mix of Black & Gold, logged for everyone) ----------
function mountDice(row) {
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'dice-fab';
  fab.innerHTML = `${gl('bullet')} Roll dice`;
  const box = document.createElement('aside');
  box.className = 'dice-drawer'; box.hidden = true;
  box.setAttribute('aria-label', 'Roll dice');
  row.prepend(fab);
  document.body.append(box);
  const pool = { B: store.get('wiw.rollB', 2), G: store.get('wiw.rollG', 0) };
  let posse = [];
  const draw = () => {
    const me = store.get('wiw.me', null), who = box.dataset.who ?? (me || '');
    box.innerHTML = `<div class="dd-head"><b>ROLL DICE</b><button type="button" class="dd-x" aria-label="Close">×</button></div>
      <div class="dd-pool">${[['B', 'Black'], ['G', 'Gold']].map(([c, n]) => `<div class="dd-step"><span class="dd-die" data-c="${c}">${n}</span>
        <button type="button" data-d="${c}" data-n="-1" aria-label="One fewer ${n}">−</button><b>${pool[c]}</b><button type="button" data-d="${c}" data-n="1" aria-label="One more ${n}">+</button></div>`).join('')}</div>
      <label>ROLLING AS<select data-who><option value="">— nobody in particular —</option>${posse.map((p) => `<option value="${p.id}"${p.id === who ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>FOR<input data-for maxlength="80" placeholder="e.g. climbing the water tower" value="${esc(box.dataset.for || '')}"></label>
      <label class="dd-check"><input type="checkbox" data-spur${box.dataset.spur === '1' ? ' checked' : ''}> Reroll Spurs (you have the Talent)</label>
      <button type="button" class="btn" data-roll>Roll ${pool.B ? pool.B + 'B' : ''}${pool.G ? pool.G + 'G' : ''}${pool.B + pool.G ? '' : '—'}</button>`;
    box.querySelector('.dd-x').addEventListener('click', () => { box.hidden = true; });
    box.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.d; pool[c] = Math.max(0, Math.min(12, pool[c] + Number(b.dataset.n))); store.set(`wiw.roll${c}`, pool[c]); draw();
    }));
    box.querySelector('[data-who]').addEventListener('change', (e) => { box.dataset.who = e.target.value; });
    box.querySelector('[data-for]').addEventListener('input', (e) => { box.dataset.for = e.target.value; });
    box.querySelector('[data-spur]').addEventListener('change', (e) => { box.dataset.spur = e.target.checked ? '1' : ''; });
    box.querySelector('[data-roll]').addEventListener('click', async (e) => {
      if (!pool.B && !pool.G) return toast('Add at least one die.', true);
      e.target.disabled = true;
      const whoId = box.dataset.who ?? (store.get('wiw.me', null) || '');
      try {
        const res = await api('POST', { action: 'roll', black: pool.B, gold: pool.G, who: whoId, whoName: 'Someone', label: box.dataset.for || '', spur: box.dataset.spur === '1' }, '', '/api/combat');
        const r = res.result;
        box.hidden = true; box.dataset.for = '';
        if (r?.dice) rollPopup(r, `${r.who}${r.label ? ` · ${r.label}` : ''} · ${r.pool}`);
      } catch (err) { toast(err.message, true); }
      e.target.disabled = false;
    });
  };
  fab.addEventListener('click', async () => {
    if (!box.hidden) { box.hidden = true; return; }
    try { posse = ((await api('GET', null, '?view=player', '/api/combat')).posse || []).filter((p) => !p.dead); } catch {}
    draw(); box.hidden = false;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.hidden = true; });
}

// ---------- "your turn" banner on every page but the Battle Map (the only turn alert off the map) ----------
let turnEl = null;
addEventListener('resize', () => setTurnH());
const setTurnH = () => document.documentElement.style.setProperty('--turnbar-h', turnEl && !turnEl.hidden ? `${turnEl.offsetHeight}px` : '0px');
function myTurn(h) { myTurnInner(h); setTurnH(); }
function myTurnInner(h) {
  const mine = me();
  const here = location.pathname.startsWith('/battle');
  const cur = h.active && mine && h.current === mine ? h.order.find((o) => o.key === mine) : null;
  if (!turnEl) { turnEl = document.createElement('div'); turnEl.className = 'hud-myturn'; turnEl.hidden = true; document.body.prepend(turnEl); }
  if (!cur || here) { turnEl.hidden = true; turnEl.dataset.k = ''; return; }
  const k = `${h.round}:${h.current}`;
  if (seen('wiw.turnHid') === k) { turnEl.hidden = true; return; }
  if (turnEl.dataset.k === k && !turnEl.hidden) return;
  turnEl.dataset.k = k; turnEl.hidden = false;
  play('chime'); // (attention.js buzzes the phone and marks the tab)
  turnEl.innerHTML = `<div>${gl('revolver')} <b>${esc(cur.name)}, it’s your turn!</b></div>
    <div class="hud-ck-btns"><a class="btn small" href="/battle">Go to Battle Map ›</a><button type="button" class="btn small secondary" data-end>End my turn</button></div><button type="button" class="hud-myturn-x" data-hide aria-label="Hide until my next turn" title="Hide until my next turn">×</button>`;
  turnEl.querySelector('[data-hide]').addEventListener('click', () => { setSeen('wiw.turnHid', k); turnEl.hidden = true; setTurnH(); });
  turnEl.querySelector('[data-end]').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await api('POST', { action: 'pc', id: mine, op: 'endTurn' }, '', '/api/combat'); turnEl.hidden = true; setTurnH(); toast('Turn ended.'); }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
}

// ---------- first visit: "Who are you playing?" (turn alerts, roll requests and dice all key off this) ----------
async function askWhoIAm() {
  if (me() || savedPin() || store.get('wiw.meAsked', false) || location.pathname.startsWith('/howto')) return;
  let posse = [];
  try { posse = ((await api('GET', null, '?view=player', '/api/combat')).posse || []).filter((p) => !p.dead); } catch { return; }
  if (!posse.length || me()) return;
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  back.innerHTML = `<div class="modal ask who-ask" role="dialog" aria-modal="true" aria-label="Who are you playing?">
    <h2>Who are you playing?</h2>
    <p class="ask-body">Pick your character so this phone gets your turn alerts and the Warden’s roll requests. Change it any time with “This is me” on a sheet.</p>
    <div class="who-list">${posse.map((p) => `<button type="button" class="who-pick" data-who="${p.id}">${gl('hat')}<span><b>${esc(p.name)}</b><small>${esc(p.trade || '')}${p.player ? ` · ${esc(p.player)}` : ''}</small></span></button>`).join('')}</div>
    <div class="ask-btns"><a class="btn small secondary" href="/howto">How to play online</a><button type="button" class="btn small secondary" data-skip>Just looking</button></div></div>`;
  document.body.append(back);
  const done = () => { store.set('wiw.meAsked', true); back.remove(); };
  back.querySelector('[data-skip]').addEventListener('click', done);
  back.querySelector('a[href="/howto"]').addEventListener('click', () => store.set('wiw.meAsked', true));
  back.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => {
    store.set('wiw.me', b.dataset.who); done();
    toast(`You’re playing ${b.querySelector('b').textContent}.`);
    if (location.pathname.startsWith('/posse')) location.reload();
  }));
}
