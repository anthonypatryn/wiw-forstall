// Run the Game — the Warden's one page: what needs you, the fight, the enemies and the posse at a glance.
import { $, esc, api, startPolling, toast, mountNav, tryWarden, savedPin, wardenModal, ask, tell, pickFighters } from './common.js';
import { gl } from './glyphs.js';
import { mountTableLog } from './tablelog.js';
import { mountRollCaller } from './rollcall.js';
import { faceUrl } from './portrait.js';
import { mountHandout } from './handout-send.js';
import { mountWardenWhisper } from './whisper.js';
import { mountLockSend } from './lockpick.js';
import { mountDesk, renderChecks, renderRecent } from './desk.js';

mountTableLog();
mountNav('/run');

let combat = null, poller = null, needsTimer = null;
const handout = mountHandout($('#handout'), () => combat);
const wwhisper = mountWardenWhisper($('#wwhisper'), () => combat);
const locks = mountLockSend($('#lockpick'), () => combat);
const caller = mountRollCaller($('#rollcall'), () => combat, () => { poller?.now?.(); refreshNeeds(); });

async function act(body, msg) {
  try {
    const res = await api('POST', body, '', '/api/combat');
    combat = res.state || combat; render();
    if (msg) toast(msg);
    refreshNeeds();
    return res.result ?? true;
  } catch (e) { toast(e.message, true); return null; }
}

// ---------- Needs you ----------
async function refreshNeeds() {
  try {
    const n = await api('GET', null, '?view=needs', '/api/combat');
    $('#needs').innerHTML = n.items.length ? n.items.map((x, i) => `<div class="notice${x.urgent ? ' urgent' : ''}">
        <a href="${esc(x.href)}">${esc(x.text)}</a>
        ${x.store ? `<span class="notice-btns"><button type="button" class="btn small" data-yes="${esc(x.store)}">Approve</button><button type="button" class="btn small secondary" data-no="${esc(x.store)}">Deny</button></span>` : ''}
      </div>`).join('') : '<p class="muted">All quiet — nothing is waiting on you.</p>';
    $('#needs').querySelectorAll('[data-yes], [data-no]').forEach((b) => b.addEventListener('click', async () => {
      try {
        const res = await api('POST', { action: 'decide', id: b.dataset.yes || b.dataset.no, approve: !!b.dataset.yes }, '', '/api/shop');
        if (res.result?.warning) await tell(`No room on the sheet\n\n${res.result.warning}`);
        else toast(b.dataset.yes ? `Approved${res.result?.placed ? ` — added to the sheet (${res.result.placed})` : ''}.` : 'Turned down.');
      } catch (e) { toast(e.message, true); }
      refreshNeeds();
    }));
  } catch { /* try again on the next tick */ }
}

// ---------- the fight ----------
const hpBar = (h, max) => { const pct = Math.max(0, Math.min(100, (h / Math.max(1, max)) * 100)); return `<span class="hp-bar"><i style="width:${pct}%"></i></span>`; };
const statusTags = (st) => Object.entries(st || {}).filter(([, v]) => v).map(([k, v]) => `<span class="pill">${esc(k)} ${v}</span>`).join('');
function renderFight() {
  const c = combat.combat || {};
  const box = $('#fight');
  if (!c.active) {
    const n = combat.enemies.filter((e) => !e.defeated).length, pcs = combat.posse.filter((p) => !p.dead).length;
    box.innerHTML = `<p class="muted">No fight running · ${pcs} in the posse · ${n} enem${n === 1 ? 'y' : 'ies'} ready${n ? '' : ' (add them in Combat Control)'}.</p>
      <button type="button" class="btn" data-start${pcs + n ? '' : ' disabled'}>${gl('revolver')} Start combat</button>`;
    box.querySelector('[data-start]')?.addEventListener('click', async () => { const who = await pickFighters(combat); if (who) act({ action: 'start', ...who }, 'Combat begins.'); });
    return;
  }
  const name = (k) => combat.posse.find((p) => p.id === k)?.name || combat.enemies.find((e) => e.id === k)?.name || '—';
  const order = c.turnList || [];
  const enemyTurn = combat.enemies.some((e) => e.id === c.current);
  box.innerHTML = `<div class="run-turn${enemyTurn ? ' enemy' : ''}"><small>ROUND ${c.round || 1}</small><b>${esc(name(c.current))}</b><span>${enemyTurn ? 'Enemy turn — your move' : 'Posse turn'}</span></div>
    <div class="run-order">${order.map((k) => `<span class="${k === c.current ? 'now' : ''}${combat.enemies.some((e) => e.id === k) ? ' foe' : ''}">${esc(name(k))}</span>`).join('<i>›</i>')}</div>
    <div class="run-fight-btns"><button type="button" class="btn" data-next>Next turn ›</button><span class="muted run-hint">Attacks and moves happen on the Battle Map.</span><button type="button" class="btn small secondary danger" data-end>End combat</button></div>`;
  // bring someone in mid-fight: a posse member sitting it out, or an enemy held back
  const party = c.party;
  const bench = [...combat.posse.filter((p) => !p.dead && party && !party.includes(p.id)).map((p) => [p.id, p.name]),
    ...combat.enemies.filter((e) => !e.defeated && e.out).map((e) => [e.id, `${e.name} (enemy)`])];
  box.insertAdjacentHTML('beforeend', `<div class="run-join">${bench.length ? `<select data-join-who aria-label="Who joins">${bench.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('')}</select><button type="button" class="btn small" data-join>+ Join the fight</button>` : '<span class="muted">Everyone’s in.</span>'}
    <a class="btn small secondary" href="/combat">+ New enemy</a><a class="btn small secondary" href="/posse">+ New character</a></div>`);
  box.querySelector('[data-join]')?.addEventListener('click', () => { const id = box.querySelector('[data-join-who]').value; act({ action: 'join', id }, 'They’re in — turn order updated.'); });
  box.querySelector('[data-next]').addEventListener('click', () => act({ action: 'next' }));
  box.querySelector('[data-end]').addEventListener('click', async () => { if (await ask('End combat? Grit refills and Dodge/Aim clear. Health and Statuses stay as they are.')) act({ action: 'end' }, 'Combat is over.'); });
}
function renderEnemies() {
  const list = combat.enemies.filter((e) => !e.defeated && !(combat.combat?.active && e.out));
  const gone = combat.enemies.length - list.length;
  $('#enemies').innerHTML = list.length ? list.map((e) => `<div class="item-row${combat.combat?.current === e.id ? ' now' : ''}">
      <div class="item-who"><b>${esc(e.name)}</b>${combat.combat?.active ? `<button type="button" class="run-out" data-leave="${esc(e.id)}" title="Take ${esc(e.name)} out of this fight">out</button>` : ''}${e.frenzied?.length ? '<span class="pill hot">FRENZIED</span>' : ''}${e.submerged ? '<span class="pill">submerged</span>' : ''}${statusTags(e.statuses)}</div>
      <div class="item-nums">${hpBar(e.health, e.maxHealth)}<span class="hp-num">${e.health}/${e.maxHealth}</span>
        <button type="button" class="pm-btn" data-e="${esc(e.id)}" data-d="-1" aria-label="${esc(e.name)} loses 1 Health">−</button><button type="button" class="pm-btn" data-e="${esc(e.id)}" data-d="1" aria-label="${esc(e.name)} gains 1 Health">+</button>
        <span class="stat" title="Grit">${e.grit ?? '—'} Grit</span></div></div>`).join('')
    + (gone ? `<p class="muted run-gone">${gone} down or fled — loot them in <a href="/combat">Combat Control</a>.</p>` : '')
    : `<p class="muted">No enemies standing.${gone ? ` ${gone} down or fled — <a href="/combat">loot them</a>.` : ' Add some in <a href="/combat">Combat Control</a>.'}</p>`;
  $('#enemies').querySelectorAll('[data-leave]').forEach((b) => b.addEventListener('click', () => act({ action: 'leave', id: b.dataset.leave })));
  $('#enemies').querySelectorAll('[data-e]').forEach((b) => b.addEventListener('click', () => act({ action: 'enemy', id: b.dataset.e, op: 'health', delta: Number(b.dataset.d) })));
}
function renderPosse() {
  const party = combat.combat?.active ? combat.combat.party : null;
  const list = combat.posse.filter((p) => !p.dead);
  $('#posse').innerHTML = list.length ? list.map((p) => {
    const sweep = combat.sweeps?.[`pc:${p.id}`];
    const sitting = party && !party.includes(p.id);
    return `<div class="item-row${combat.combat?.current === p.id ? ' now' : ''}${p.bleeding ? ' bleed' : ''}${sitting ? ' sitting' : ''}">
      <div class="item-who"><img class="row-face" src="${esc(faceUrl(p))}" alt=""><a href="/posse#${esc(p.id)}"><b>${esc(p.name)}</b></a><small>${esc(p.trade)}${p.player ? ` · ${esc(p.player)}` : ''}${sitting ? ' · not in this fight' : ''}</small>${combat.combat?.active ? (sitting ? `<button type="button" class="run-out in" data-pjoin="${esc(p.id)}">join</button>` : `<button type="button" class="run-out" data-pleave="${esc(p.id)}" title="Take ${esc(p.name)} out of this fight">out</button>`) : ''}
        ${p.bleeding ? '<span class="pill hot">BLEEDING OUT</span>' : ''}${statusTags(p.statuses)}
        ${p.forstall?.model ? `<span class="pill fs">${gl('forstall')} ${esc(p.forstall.model.replace(/ Forstall$/, ''))} · ${p.forstall.charges ?? 0} ch${sweep ? ` · Sweep ${sweep.hits}` : ''}</span>` : ''}</div>
      <div class="item-nums">${hpBar(p.health, p.maxHealth)}<span class="hp-num">${p.health}/${p.maxHealth}</span>
        <button type="button" class="pm-btn" data-p="${esc(p.id)}" data-d="-1" aria-label="${esc(p.name)} loses 1 Health">−</button><button type="button" class="pm-btn" data-p="${esc(p.id)}" data-d="1" aria-label="${esc(p.name)} gains 1 Health">+</button>
        ${combat.combat?.active ? `<span class="stat" title="Grit">${p.grit ?? 0} Grit</span>` : `<span class="stat" title="Wallet">$${esc(String(p.wallet || 0))}</span>`}</div></div>`;
  }).join('') : '<p class="muted">No characters yet.</p>';
  $('#posse').querySelectorAll('[data-pleave]').forEach((b) => b.addEventListener('click', () => act({ action: 'leave', id: b.dataset.pleave })));
  $('#posse').querySelectorAll('[data-pjoin]').forEach((b) => b.addEventListener('click', () => act({ action: 'join', id: b.dataset.pjoin }, 'They’re in — turn order updated.')));
  $('#posse').querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => act({ action: 'pc', id: b.dataset.p, op: 'health', delta: Number(b.dataset.d) })));
}
function render() {
  if (!combat) return;
  renderFight(); renderEnemies(); renderPosse(); caller.draw(); renderChecks(); renderRecent(); renderRewards(); handout.draw(); wwhisper.draw(); locks.draw();
}

// ---------- Rewards: award the posse, Jackpot, Town Rest (moved here from the Posse page) ----------
const aw = { who: null, jp: '' }; // who: null = everyone
function renderRewards() {
  const box = $('#award');
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  const alive = combat.posse.filter((p) => !p.dead);
  const keep = (id) => box.querySelector(`#${id}`)?.value || '';
  const vals = { p: keep('aw-prestige'), d: keep('aw-dollars'), s: keep('aw-scrap'), i: keep('aw-item'), r: keep('aw-reason') };
  box.innerHTML = `<div class="field-step"><span>WHO</span><button type="button" class="chip-btn${aw.who ? '' : ' on'}" data-aw-all>Everyone</button>
      ${alive.map((p) => `<button type="button" class="chip-btn${aw.who?.has(p.id) ? ' on' : ''}" data-aw="${esc(p.id)}">${esc(p.name)}</button>`).join('') || '<span class="muted">No characters yet.</span>'}</div>
    <div class="aw-nums">
      <label><span>${gl('star')} PRESTIGE</span><input id="aw-prestige" type="number" min="0" max="100" inputmode="numeric" placeholder="0" value="${esc(vals.p)}"></label>
      <label><span>$ DOLLARS</span><input id="aw-dollars" type="number" min="0" inputmode="numeric" placeholder="0" value="${esc(vals.d)}"></label>
      <label><span>${gl('wrench')} SCRAP</span><input id="aw-scrap" type="number" min="0" inputmode="numeric" placeholder="0" value="${esc(vals.s)}"></label>
    </div>
    <div class="field-step"><span>LOOT</span><input id="aw-item" maxlength="120" placeholder="e.g. Pristine Chupacabra pelt (goes into Other items)" value="${esc(vals.i)}"></div>
    <div class="field-step"><span>WHAT FOR</span><input id="aw-reason" maxlength="120" placeholder="e.g. Cleared the Copper Canyon mine" value="${esc(vals.r)}"></div>
    <button type="button" class="btn" data-aw-go>${gl('trophy')} Award ${aw.who ? `${aw.who.size} character${aw.who.size === 1 ? '' : 's'}` : 'everyone'}</button>`;
  const jb = $('#jackpot');
  if (jb.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  const why = jb.querySelector('#jp-why')?.value || '';
  jb.innerHTML = `<div class="field-step"><span>THE POSSE VOTES FOR</span>${alive.map((p) => `<button type="button" class="chip-btn${aw.jp === p.id ? ' on' : ''}" data-jp="${esc(p.id)}">${esc(p.name)}</button>`).join('') || '<span class="muted">No characters yet.</span>'}</div>
    <div class="field-step"><span>WHAT DID THEY DO?</span><input id="jp-why" maxlength="120" placeholder="e.g. roped the bear off the cliff" value="${esc(why)}"></div>
    <button type="button" class="btn" data-jp-go${aw.jp ? '' : ' disabled'}>${gl('star')} Jackpot! +1 Prestige</button>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('#award button, #jackpot button');
  if (!b) return;
  const alive = combat.posse.filter((p) => !p.dead);
  if (b.dataset.awAll !== undefined) { aw.who = null; renderRewards(); return; }
  if (b.dataset.aw) {
    aw.who ||= new Set();
    if (aw.who.has(b.dataset.aw)) aw.who.delete(b.dataset.aw); else aw.who.add(b.dataset.aw);
    if (!aw.who.size) aw.who = null;
    renderRewards(); return;
  }
  if (b.dataset.jp) { aw.jp = aw.jp === b.dataset.jp ? '' : b.dataset.jp; renderRewards(); return; }
  if (b.dataset.awGo !== undefined) {
    const ids = aw.who ? [...aw.who] : alive.map((p) => p.id);
    const r = await act({ action: 'award', ids, prestige: $('#aw-prestige').value, dollars: $('#aw-dollars').value, scrap: $('#aw-scrap').value, item: $('#aw-item').value, reason: $('#aw-reason').value });
    if (r) { toast(`Awarded ${r.what} to ${r.count} character${r.count > 1 ? 's' : ''}.`); ['#aw-prestige', '#aw-dollars', '#aw-scrap', '#aw-item', '#aw-reason'].forEach((id) => { $(id).value = ''; }); renderRewards(); }
    return;
  }
  if (b.dataset.jpGo !== undefined) {
    const r = await act({ action: 'jackpot', id: aw.jp, reason: $('#jp-why').value });
    if (r) { toast(`Jackpot for ${r.name}!`); aw.jp = ''; $('#jp-why').value = ''; renderRewards(); }
  }
});
$('#town-all').addEventListener('click', async () => {
  if (!await ask('Town Rest for the whole posse?')) return;
  const r = await act({ action: 'townRestAll' });
  if (r) toast(`${r.count} character${r.count === 1 ? '' : 's'} rested up in town.`);
});

// ---------- contents bar: sticks under the nav + Warden strip, highlights the band you're in ----------
function tocTop() {
  const h = [...document.querySelectorAll('.sitenav, .hud-myturn')].reduce((n, el) => n + (el.offsetHeight || 0), 0);
  document.documentElement.style.setProperty('--toc-top', `${h}px`);
}
window.addEventListener('resize', tocTop);
const bands = () => [...document.querySelectorAll('.band')];
window.addEventListener('scroll', () => {
  const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--toc-top')) || 0) + 80;
  let cur = bands()[0]?.id;
  bands().forEach((g) => { if (g.getBoundingClientRect().top <= line) cur = g.id; });
  document.querySelectorAll('#run-toc a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${cur}`));
}, { passive: true });

// ---------- boot ----------
function open() {
  $('#gate').hidden = true; $('#desk').hidden = false;
  tocTop(); setTimeout(tocTop, 800);
  mountDesk({ getCombat: () => combat, combatAct: (body) => act(body) });
  poller?.stop();
  poller = startPolling('warden', (d) => { combat = d; render(); refreshNeeds(); }, (ok) => { $('#conn').textContent = ok ? '● live' : 'reconnecting…'; }, '/api/combat');
  clearInterval(needsTimer);
  needsTimer = setInterval(refreshNeeds, 5000); // store requests live in another document
}
$('#unlock').addEventListener('click', async () => { if (await wardenModal('/api/combat')) { mountNav('/run'); open(); } });
(async () => {
  const pin = savedPin();
  if (pin && await tryWarden(pin, '/api/combat')) open(); else $('#gate').hidden = false;
})();
