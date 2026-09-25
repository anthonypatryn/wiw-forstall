// Player-to-player trading: make an offer (money and/or things, asking money and/or things back), and the pop-ups
// that let the other player accept or decline. Fed by the Table Log poll (logView().hud.trades) via renderHud.
import { esc, api, toast, savedPin, store, tell } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const me = () => store.get('wiw.me', null);
const $$ = (n) => `$${Number(n || 0).toFixed(2)}`;
const post = (body) => api('POST', { action: 'trade', pc: me(), ...body }, '', '/api/combat');
const describe = (s) => [s?.money ? $$(s.money) : '', ...(s?.things || []).map((t) => `${t.qty > 1 ? `${t.qty}× ` : ''}${t.name}`)].filter(Boolean).join(', ') || 'nothing';
const tabSeen = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const setTabSeen = (k) => { try { sessionStorage.setItem(k, '1'); } catch {} };

let lastHud = null, busy = false;

// ---------- make an offer ----------
export async function openTrade(withId = null) {
  if (!me()) { toast('Tap “This is me” on your character sheet first.', true); return; }
  let posse;
  try { posse = (await api('GET', null, '', '/api/shop')).posse || []; } catch (err) { toast(err.message, true); return; }
  const mine = posse.find((p) => p.id === me());
  if (!mine) { toast('Your character isn’t in the posse any more.', true); return; }
  const others = posse.filter((p) => p.id !== me());
  if (!others.length) { toast('Nobody else in the posse to trade with.', true); return; }
  const st = { to: others.some((p) => p.id === withId) ? withId : others.length === 1 ? others[0].id : null, give: { money: 0, things: {} }, get: { money: 0, things: {} }, note: '' };
  const back = document.createElement('div');
  back.className = 'modal-back ask-back trade-back';
  const open = () => (lastHud?.trades || []).filter((t) => t.from === me() && t.status === 'pending');
  const sideHTML = (label, who, s, k) => `<div class="field-step trade-side"><span>${label}</span>
      <div class="trade-money"><button type="button" class="pm-btn" data-m="${k}" data-d="-1" aria-label="Less">−</button><label class="lp-num">$<input type="number" min="0" step="0.25" data-money="${k}" value="${s.money || ''}" placeholder="0"></label><button type="button" class="pm-btn" data-m="${k}" data-d="1" aria-label="More">+</button><small class="muted">has ${$$(who.wallet)}</small></div>
      ${who.sell.length ? who.sell.map((x) => { const q = s.things[x.key]; return `<button type="button" class="chip-btn${q ? ' on' : ''}" data-thing="${k}" data-key="${esc(x.key)}">${esc(x.name)}${x.qty > 1 ? `<small>${q ? `${q} of ${x.qty}` : `${x.qty} of them`}${q ? ' · tap for more' : ''}</small>` : x.where ? `<small>${esc(x.where)}</small>` : ''}</button>`; }).join('') : '<small class="muted">Nothing to trade.</small>'}</div>`;
  const draw = () => {
    const them = others.find((p) => p.id === st.to);
    back.innerHTML = `<div class="modal ask trade-modal" role="dialog" aria-modal="true" aria-label="Trade">
      <div class="ho-kicker">${gl('satchel')} TRADE</div><h2>Make a trade</h2>
      ${open().length ? `<div class="trade-open"><b>Waiting on an answer:</b>${open().map((t) => `<div class="item-row"><span class="item-who">${esc(t.toName)} · you give ${esc(describe(t.give))}${describe(t.get) !== 'nothing' ? ` for ${esc(describe(t.get))}` : ''}</span><button type="button" class="btn small secondary" data-cancel="${esc(t.id)}">Take it back</button></div>`).join('')}</div>` : ''}
      <div class="field-step"><span>TRADE WITH</span>${others.map((p) => `<button type="button" class="chip-btn${st.to === p.id ? ' on' : ''}" data-to="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      ${sideHTML('YOU GIVE', mine, st.give, 'give')}
      ${them ? sideHTML(`YOU WANT FROM ${them.name.toUpperCase()} (optional)`, them, st.get, 'get') : ''}
      <div class="field-step"><span>A NOTE (optional)</span><input data-note maxlength="140" value="${esc(st.note)}" placeholder="e.g. for the horse, like we said"></div>
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-send${them ? '' : ' disabled'}>Send the offer</button></div></div>`;
  };
  const pack = (s, list) => ({ money: s.money, things: Object.entries(s.things).map(([key, qty]) => ({ key, qty, name: list.find((x) => x.key === key)?.name })) });
  draw();
  document.body.append(back);
  back.addEventListener('input', (e) => {
    if (e.target.dataset.money) st[e.target.dataset.money].money = Math.max(0, Number(e.target.value) || 0);
    if (e.target.dataset.note !== undefined) st.note = e.target.value;
  });
  back.addEventListener('click', async (e) => {
    if (e.target === back) { back.remove(); return; }
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.no !== undefined) { back.remove(); return; }
    if (d.to) { if (st.to !== d.to) st.get = { money: 0, things: {} }; st.to = d.to; draw(); return; }
    if (d.m) { const s = st[d.m]; s.money = Math.max(0, Math.round(((s.money || 0) + Number(d.d)) * 100) / 100); draw(); return; }
    if (d.thing) {
      const who = d.thing === 'give' ? mine : others.find((p) => p.id === st.to), x = who.sell.find((y) => y.key === d.key), things = st[d.thing].things;
      // one tap picks it; on a stack, each tap adds one more until it goes back to none
      things[d.key] = (things[d.key] || 0) + 1;
      if (things[d.key] > x.qty) delete things[d.key];
      draw(); return;
    }
    try {
      if (d.cancel) { await post({ op: 'cancel', id: d.cancel }); lastHud.trades = lastHud.trades.map((t) => (t.id === d.cancel ? { ...t, status: 'cancelled' } : t)); toast('Offer taken back.'); draw(); return; }
      if (d.send !== undefined) {
        const them = others.find((p) => p.id === st.to);
        await post({ op: 'offer', to: st.to, give: pack(st.give, mine.sell), get: pack(st.get, them.sell), note: st.note });
        back.remove();
        toast(`Offer sent to ${them.name}.`);
      }
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- the pop-ups ----------
export function tradeHud(h) {
  lastHud = h;
  if (savedPin() || !me() || busy) return;
  const trades = h.trades || [];
  // your offers that got an answer: say so once
  const seen = new Set(store.get('wiw.tradeSeen', []));
  for (const t of trades.filter((x) => x.from === me() && ['accepted', 'declined', 'failed'].includes(x.status) && !seen.has(x.id))) {
    seen.add(t.id);
    store.set('wiw.tradeSeen', [...seen].slice(-40));
    if (t.status === 'accepted') { play('success'); toast(`${t.toName} took your trade.`); }
    else if (t.status === 'declined') toast(`${t.toName} turned down your trade.`, true);
    else toast(`Your trade with ${t.toName} didn’t go through: ${t.why}`, true);
  }
  const offer = trades.find((x) => x.to === me() && x.status === 'pending' && !tabSeen(`wiw.tradeLater.${x.id}`));
  if (offer) answer(offer);
}

function answer(t) {
  busy = true;
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const gets = describe(t.get);
  back.innerHTML = `<div class="modal ask trade-modal" role="dialog" aria-modal="true" aria-label="A trade offer">
    <div class="ho-kicker">${gl('satchel')} A TRADE OFFER</div>
    <h2>${esc(t.fromName)} wants to trade</h2>
    ${t.note ? `<blockquote class="whisper-quote">${esc(t.note)}</blockquote>` : ''}
    <div class="trade-sum"><div><small>YOU GET</small><b>${esc(describe(t.give))}</b></div><div><small>YOU GIVE</small><b>${esc(gets === 'nothing' ? 'nothing — it’s a gift' : gets)}</b></div></div>
    <p class="ask-body">Things move sheet and all: a gun keeps its upgrades and ammo, a horse keeps its Bond.</p>
    <div class="ask-btns"><button type="button" class="btn secondary" data-later>Later</button><button type="button" class="btn secondary" data-no>No thanks</button><button type="button" class="btn" data-yes>Deal</button></div></div>`;
  document.body.append(back);
  play('chime');
  const close = () => { back.remove(); busy = false; };
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.later !== undefined) { setTabSeen(`wiw.tradeLater.${t.id}`); close(); return; }
    try {
      const r = await post({ op: 'answer', id: t.id, accept: b.dataset.yes !== undefined });
      close();
      const res = r.result;
      if (res?.status === 'accepted') { play('success'); toast(`Deal. You got ${describe(t.give)}.`); }
      else if (res?.status === 'failed') await tell(`The trade didn’t go through.\n\n${res.why}`);
      else toast('You turned it down.');
    } catch (err) { toast(err.message, true); close(); }
  });
}
