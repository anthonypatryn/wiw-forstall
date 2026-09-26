// The posse stash: shared money and things anyone in the posse can put in or take out. Every move goes in the Table Log.
// The Warden can also drop loot straight in. Things keep their sheet data while stored (a gun's upgrades, a horse's Bond).
import { esc, api, toast, savedPin, store, me, dollars as $$ } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const post = (body) => api('POST', { action: 'stash', pc: me(), ...body }, '', '/api/combat');

// a one-line summary for a card ("$12.00 · Used Pistol, Biscuit (Morgan), 3× Bandages")
export const stashSummary = (s) => (!s || (!s.money && !s.items?.length) ? 'Empty. Put money or gear in from your sheet.'
  : [s.money ? $$(s.money) : '', s.items.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.name}`).join(', ')].filter(Boolean).join(' · '));

export async function openStash() {
  const warden = !!savedPin();
  if (!warden && !me()) { toast('Tap “This is me” on your character sheet first.', true); return; }
  let stash, mine = null, catalog = [];
  const load = async () => {
    const [c, s] = await Promise.all([api('GET', null, '', '/api/combat'), warden ? null : api('GET', null, '', '/api/shop')]);
    stash = c.stash || { money: 0, items: [] };
    if (s) mine = s.posse.find((p) => p.id === me());
  };
  try {
    await load();
    if (warden) catalog = (await api('GET', null, '?view=catalog', '/api/shop')).catalog || [];
  } catch (err) { toast(err.message, true); return; }
  if (!warden && !mine) { toast('Your character isn’t in the posse any more.', true); return; }
  const st = { take: {}, takeMoney: 0, put: {}, putMoney: 0, lootMoney: 0, lootItem: '', lootQty: 1 };
  const back = document.createElement('div');
  back.className = 'modal-back ask-back trade-back';
  const draw = () => {
    back.innerHTML = `<div class="modal ask trade-modal" role="dialog" aria-modal="true" aria-label="The posse stash">
      <div class="ho-kicker">${gl('satchel')} THE POSSE STASH</div><h2>What the posse keeps together</h2>
      <div class="field-step trade-side"><span>IN THE STASH</span>
        ${stash.items.length ? stash.items.map((i) => `<div class="item-row"><span class="item-who"><b>${esc(i.name)}</b><small class="muted">${i.qty > 1 ? `${i.qty} of them` : ''}${i.where ? `${i.qty > 1 ? ' · ' : ''}${esc(i.where)}` : ''}</small></span>${warden ? '' : `${i.qty > 1 ? `<span class="trade-money"><button type="button" class="pm-btn" data-tq="${esc(i.id)}" data-d="-1" aria-label="Fewer">−</button><b>${st.take[i.id] || 1}</b><button type="button" class="pm-btn" data-tq="${esc(i.id)}" data-d="1" aria-label="More">+</button></span>` : ''}<button type="button" class="btn small secondary" data-take="${esc(i.id)}">Take</button>`}</div>`).join('') : '<small class="muted">No things in here yet.</small>'}
        <div class="trade-money"><b>${$$(stash.money)}</b>${!warden && stash.money ? `<span class="muted">take</span><button type="button" class="pm-btn" data-tm="-1" aria-label="Less">−</button><label class="lp-num">$<input type="number" min="0" step="0.25" data-takemoney value="${st.takeMoney || ''}" placeholder="0"></label><button type="button" class="pm-btn" data-tm="1" aria-label="More">+</button><button type="button" class="btn small secondary" data-takecash>Take it</button>` : ''}</div></div>
      ${warden ? `<div class="field-step trade-side"><span>PUT LOOT IN (the posse finds…)</span>
          <label class="lp-num">$<input type="number" min="0" step="0.25" data-lootmoney value="${st.lootMoney || ''}" placeholder="0"></label>
          <select aria-label="An item from the Store" data-lootitem><option value="">An item from the Store…</option>${catalog.map((c) => `<option value="${esc(c.id)}"${st.lootItem === c.id ? ' selected' : ''}>${esc(c.name)} · ${esc(c.cat)}</option>`).join('')}</select>
          ${st.lootItem ? `<label class="lp-num">How many <input type="number" min="1" max="99" data-lootqty value="${st.lootQty}"></label>` : ''}
          <button type="button" class="btn small" data-loot>Put it in the stash</button></div>`
        : `<div class="field-step trade-side"><span>PUT IN FROM YOUR SHEET</span>
          <div class="trade-money"><button type="button" class="pm-btn" data-pm="-1" aria-label="Less">−</button><label class="lp-num">$<input type="number" min="0" step="0.25" data-putmoney value="${st.putMoney || ''}" placeholder="0"></label><button type="button" class="pm-btn" data-pm="1" aria-label="More">+</button><small class="muted">you have ${$$(mine.wallet)}</small></div>
          ${mine.sell.map((x) => { const q = st.put[x.key]; return `<button type="button" class="chip-btn${q ? ' on' : ''}" data-put="${esc(x.key)}">${esc(x.name)}${x.qty > 1 ? `<small>${q ? `${q} of ${x.qty} · tap for more` : `${x.qty} of them`}</small>` : x.where ? `<small>${esc(x.where)}</small>` : ''}</button>`; }).join('')}
          <button type="button" class="btn small" data-putgo${st.putMoney || Object.keys(st.put).length ? '' : ' disabled'}>Put it in</button></div>`}
      <p class="fine muted">Anyone in the posse can put in or take out. Every move shows up in the Table Log.</p>
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Close</button></div></div>`;
  };
  const refresh = async (msg) => { await load(); st.take = {}; st.takeMoney = 0; st.put = {}; st.putMoney = 0; draw(); if (msg) { play('success'); toast(msg); } };
  draw();
  document.body.append(back);
  back.addEventListener('input', (e) => {
    const d = e.target.dataset, v = Math.max(0, Number(e.target.value) || 0);
    if (d.takemoney !== undefined) st.takeMoney = v;
    if (d.putmoney !== undefined) st.putMoney = v;
    if (d.lootmoney !== undefined) st.lootMoney = v;
    if (d.lootqty !== undefined) st.lootQty = Math.max(1, Math.round(v));
  });
  back.addEventListener('change', (e) => { if (e.target.dataset.lootitem !== undefined) { st.lootItem = e.target.value; draw(); } });
  back.addEventListener('click', async (e) => {
    if (e.target === back) { back.remove(); return; }
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.no !== undefined) { back.remove(); return; }
    if (d.tq) { const i = stash.items.find((x) => x.id === d.tq); st.take[d.tq] = Math.max(1, Math.min(i.qty, (st.take[d.tq] || 1) + Number(d.d))); draw(); return; }
    if (d.tm) { st.takeMoney = Math.max(0, Math.min(stash.money, (st.takeMoney || 0) + Number(d.tm))); draw(); return; }
    if (d.pm) { st.putMoney = Math.max(0, (st.putMoney || 0) + Number(d.pm)); draw(); return; }
    if (d.put) { const x = mine.sell.find((y) => y.key === d.put); st.put[d.put] = (st.put[d.put] || 0) + 1; if (st.put[d.put] > x.qty) delete st.put[d.put]; draw(); return; }
    try {
      if (d.take) { const i = stash.items.find((x) => x.id === d.take); await post({ op: 'take', id: d.take, qty: st.take[d.take] || 1 }); await refresh(`You took ${i.name}.`); }
      else if (d.takecash !== undefined) { if (!st.takeMoney) return; await post({ op: 'take', money: st.takeMoney }); await refresh(`You took ${$$(st.takeMoney)}.`); }
      else if (d.putgo !== undefined) { await post({ op: 'put', money: st.putMoney, things: Object.entries(st.put).map(([key, qty]) => ({ key, qty })) }); await refresh('In the stash.'); }
      else if (d.loot !== undefined) {
        await post({ op: 'loot', money: st.lootMoney, itemId: st.lootItem, qty: st.lootQty });
        st.lootMoney = 0; st.lootItem = ''; st.lootQty = 1;
        await refresh('Loot’s in the stash.');
      }
    } catch (err) { toast(err.message, true); }
  });
}
