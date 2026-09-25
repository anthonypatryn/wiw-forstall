// Run the Game — the Warden's one page: what needs you, the fight, the enemies and the posse at a glance.
import { $, esc, api, startPolling, toast, mountNav, tryWarden, savedPin, wardenModal, ask, tell, pickFighters } from './common.js';
import { gl } from './glyphs.js';
import { mountTableLog } from './tablelog.js';
import { mountRollCaller } from './rollcall.js';

mountTableLog();
mountNav('/run');

let combat = null, poller = null, needsTimer = null;
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
    $('#needs').innerHTML = n.items.length ? n.items.map((x, i) => `<div class="need${x.urgent ? ' urgent' : ''}">
        <a href="${esc(x.href)}">${esc(x.text)}</a>
        ${x.store ? `<span class="need-btns"><button type="button" class="btn small" data-yes="${esc(x.store)}">Approve</button><button type="button" class="btn small secondary" data-no="${esc(x.store)}">Deny</button></span>` : ''}
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
const hpBar = (h, max) => { const pct = Math.max(0, Math.min(100, (h / Math.max(1, max)) * 100)); return `<span class="run-hp"><i style="width:${pct}%"></i></span>`; };
const statusTags = (st) => Object.entries(st || {}).filter(([, v]) => v).map(([k, v]) => `<span class="run-st">${esc(k)} ${v}</span>`).join('');
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
    <div class="run-fight-btns"><button type="button" class="btn" data-next>Next turn ›</button><a class="btn secondary" href="/battle">${gl('pin')} Act on the Battle Map</a><button type="button" class="btn small secondary danger" data-end>End combat</button></div>`;
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
  $('#enemies').innerHTML = list.length ? list.map((e) => `<div class="run-row${combat.combat?.current === e.id ? ' now' : ''}">
      <div class="run-who"><b>${esc(e.name)}</b>${combat.combat?.active ? `<button type="button" class="run-out" data-leave="${esc(e.id)}" title="Take ${esc(e.name)} out of this fight">out</button>` : ''}${e.frenzied?.length ? '<span class="run-st hot">FRENZIED</span>' : ''}${e.submerged ? '<span class="run-st">submerged</span>' : ''}${statusTags(e.statuses)}</div>
      <div class="run-nums">${hpBar(e.health, e.maxHealth)}<span class="run-hpn">${e.health}/${e.maxHealth}</span>
        <button type="button" class="run-pm" data-e="${esc(e.id)}" data-d="-1" aria-label="${esc(e.name)} loses 1 Health">−</button><button type="button" class="run-pm" data-e="${esc(e.id)}" data-d="1" aria-label="${esc(e.name)} gains 1 Health">+</button>
        <span class="run-grit" title="Grit">${e.grit ?? '—'} Grit</span></div></div>`).join('')
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
    return `<div class="run-row${combat.combat?.current === p.id ? ' now' : ''}${p.bleeding ? ' bleed' : ''}${sitting ? ' sitting' : ''}">
      <div class="run-who"><a href="/posse#${esc(p.id)}"><b>${esc(p.name)}</b></a><small>${esc(p.trade)}${p.player ? ` · ${esc(p.player)}` : ''}${sitting ? ' · not in this fight' : ''}</small>${combat.combat?.active ? (sitting ? `<button type="button" class="run-out in" data-pjoin="${esc(p.id)}">join</button>` : `<button type="button" class="run-out" data-pleave="${esc(p.id)}" title="Take ${esc(p.name)} out of this fight">out</button>`) : ''}
        ${p.bleeding ? '<span class="run-st hot">BLEEDING OUT</span>' : ''}${statusTags(p.statuses)}
        ${p.forstall?.model ? `<span class="run-st fs">${gl('forstall')} ${esc(p.forstall.model.replace(/ Forstall$/, ''))} · ${p.forstall.charges ?? 0} ch${sweep ? ` · Sweep ${sweep.hits}` : ''}</span>` : ''}</div>
      <div class="run-nums">${hpBar(p.health, p.maxHealth)}<span class="run-hpn">${p.health}/${p.maxHealth}</span>
        <button type="button" class="run-pm" data-p="${esc(p.id)}" data-d="-1" aria-label="${esc(p.name)} loses 1 Health">−</button><button type="button" class="run-pm" data-p="${esc(p.id)}" data-d="1" aria-label="${esc(p.name)} gains 1 Health">+</button>
        ${combat.combat?.active ? `<span class="run-grit" title="Grit">${p.grit ?? 0} Grit</span>` : `<span class="run-grit" title="Wallet">$${esc(String(p.wallet || 0))}</span>`}</div></div>`;
  }).join('') : '<p class="muted">No characters yet.</p>';
  $('#posse').querySelectorAll('[data-pleave]').forEach((b) => b.addEventListener('click', () => act({ action: 'leave', id: b.dataset.pleave })));
  $('#posse').querySelectorAll('[data-pjoin]').forEach((b) => b.addEventListener('click', () => act({ action: 'join', id: b.dataset.pjoin }, 'They’re in — turn order updated.')));
  $('#posse').querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => act({ action: 'pc', id: b.dataset.p, op: 'health', delta: Number(b.dataset.d) })));
}
function render() {
  if (!combat) return;
  renderFight(); renderEnemies(); renderPosse(); caller.draw();
}

// ---------- boot ----------
function open() {
  $('#gate').hidden = true; $('#desk').hidden = false;
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
