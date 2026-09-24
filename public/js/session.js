import { $, esc, api, startPolling, toast, mountNav, tryWarden, forgetWarden, savedPin, wardenModal, timeAgo } from './common.js';
import { renderLogInto, mountTableLog } from './tablelog.js';

const EP = '/api/session';
mountNav('/session');

let sessions = [], current = null, poller = null, combatPoller = null, combat = null;

async function act(body) {
  try {
    const res = await api('POST', body, '', EP);
    if (res.state) poller?.push(res.state);
    return res.result ?? true;
  } catch (e) { toast(e.message, true); return null; }
}

// ---------- session notes ----------
function renderTabs() {
  $('#sess-tabs').innerHTML = sessions.length ? sessions.map((s) =>
    `<button type="button" class="sess-tab${s.id === current ? ' on' : ''}" data-sid="${s.id}">${esc(s.title)}${s.date ? `<small>${esc(s.date)}</small>` : ''}</button>`).join('')
    : '<p class="muted">No sessions yet. Start one for tonight’s game.</p>';
  $('#sess-tabs').querySelectorAll('[data-sid]').forEach((b) => b.addEventListener('click', () => { current = b.dataset.sid; renderTabs(); renderEditor(true); }));
}

function renderEditor(force) {
  const box = $('#editor');
  const s = sessions.find((x) => x.id === current);
  if (!s) { box.innerHTML = ''; return; }
  // never overwrite what the Warden is typing
  if (!force && box.contains(document.activeElement)) return;
  box.innerHTML = `
    <div class="sess-head">
      <label>TITLE<input data-f="title" maxlength="80" value="${esc(s.title)}"></label>
      <label>DATE<input data-f="date" type="date" value="${esc(s.date)}"></label>
    </div>
    <label class="sess-notes">NOTES <small>just for you — plans, secrets, what happened, loose ends</small>
      <textarea data-f="notes" maxlength="20000" placeholder="Where the posse is, who they met, what they owe, what’s coming…">${esc(s.notes)}</textarea></label>
    <label class="sess-notes">RECAP FOR THE PLAYERS <small>short and spoiler-free</small>
      <textarea data-f="recap" maxlength="2000" class="short" placeholder="Last time, the posse…">${esc(s.recap)}</textarea></label>
    <div class="sess-actions">
      <button class="btn small" id="post-recap" type="button">📜 Post recap to the Table Log</button>
      <span class="muted" id="saved-note">Saves as you type · edited ${timeAgo(s.at)}</span>
      <button class="btn small secondary danger" id="del-session" type="button">Delete session</button>
    </div>`;
  const timers = {};
  box.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', () => {
    clearTimeout(timers[el.dataset.f]);
    $('#saved-note').textContent = 'Saving…';
    timers[el.dataset.f] = setTimeout(async () => {
      if (await act({ action: 'edit', id: s.id, [el.dataset.f]: el.value })) $('#saved-note').textContent = '✓ Saved';
      if (el.dataset.f === 'title' || el.dataset.f === 'date') renderTabs();
    }, 600);
  }));
  $('#post-recap').addEventListener('click', async () => {
    const recap = box.querySelector('[data-f="recap"]').value.trim();
    if (!recap) return toast('Write a recap first.', true);
    await act({ action: 'edit', id: s.id, recap });
    if (await act({ action: 'postRecap', id: s.id })) toast('Recap posted — the players can see it in the Table Log.');
  });
  $('#del-session').addEventListener('click', async () => {
    if (!confirm(`Delete “${s.title}” and its notes? This can’t be undone.`)) return;
    if (await act({ action: 'remove', id: s.id })) { current = null; toast('Session deleted.'); }
  });
}

$('#new-session').addEventListener('click', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const s = await act({ action: 'add', date: today });
  if (s) { current = s.id; renderTabs(); renderEditor(true); $('#editor [data-f="notes"]')?.focus(); }
});

function onSessions(d) {
  sessions = d.sessions || [];
  if (!sessions.some((s) => s.id === current)) current = sessions[0]?.id || null;
  renderTabs();
  renderEditor(false);
}

// ---------- at a glance (live from the Combat & sheets data) ----------
const STATUS_SHORT = (st) => Object.entries(st || {}).filter(([, v]) => v).map(([k, v]) => `${k}${v > 1 ? ` [${v}]` : ''}`).join(', ');
function renderGlance() {
  if (!combat) return;
  const posse = combat.posse || [];
  const foes = (combat.enemies || []).filter((e) => !e.defeated);
  const d = combat.duel;
  $('#glance').innerHTML = `
    ${posse.length ? `<table class="glance-table"><thead><tr><th>Character</th><th>Health</th><th>Grit</th><th>Prestige</th><th>$</th></tr></thead><tbody>
      ${posse.map((p) => {
        const flag = p.dead ? '<span class="gl-flag dead">FALLEN</span>' : p.bleeding ? '<span class="gl-flag">🩸 BLEEDING OUT</span>' : p.done === false ? '<span class="gl-flag wip">CREATING</span>' : '';
        const low = !p.dead && p.health <= Math.ceil(p.maxHealth / 3);
        return `<tr class="${p.dead ? 'dead' : ''}"><td><a href="/posse#${p.id}"><b>${esc(p.name)}</b></a><small>The ${esc(p.trade)}${p.title ? ` · “${esc(p.title)}”` : ''}</small>${flag}${STATUS_SHORT(p.statuses) ? `<small class="gl-st">${esc(STATUS_SHORT(p.statuses))}</small>` : ''}</td>
          <td class="${low ? 'low' : ''}">${p.health}/${p.maxHealth}</td><td>${p.grit}</td>
          <td>${p.prestige?.total ?? 0}${p.prestige?.unclaimed ? `<small>${p.prestige.unclaimed} to spend</small>` : ''}</td><td>${esc(String(p.wallet || '0'))}</td></tr>`;
      }).join('')}</tbody></table>` : '<p class="muted">No characters yet.</p>'}
    <h4 class="gl-h">IN THE FIGHT ${combat.combat?.active ? `<small>Round ${combat.combat.round}</small>` : '<small>no combat running</small>'}</h4>
    ${foes.length ? `<ul class="gl-foes">${foes.map((e) => `<li><b>${esc(e.name)}</b> ${e.health ?? '?'}/${e.maxHealth ?? '?'} Health${STATUS_SHORT(e.statuses) ? ` · ${esc(STATUS_SHORT(e.statuses))}` : ''}</li>`).join('')}</ul>` : '<p class="muted">No enemies on the field.</p>'}
    ${d ? `<p class="gl-duel">🤠 Duel: <b>${esc(d.names[0])}</b> vs <b>${esc(d.names[1])}</b> — ${d.done ? 'finished' : `next: ${['Charm', 'Finesse', 'Intuition', 'Nerve', 'Draw!'][d.step]}`}</p>` : ''}
    <div class="gl-links"><a class="btn small secondary" href="/combat">Combat</a><a class="btn small secondary" href="/posse">Posse Sheets</a><a class="btn small secondary" href="/names">NPCs</a><a class="btn small secondary" href="/map">Map</a><a class="btn small secondary" href="/battle">Battle Map</a><a class="btn small secondary" href="/store">Store</a></div>`;
  renderLogInto($('#glance-log'), (combat.log || []).slice(0, 12));
}

// ---------- homebrew: monsters (scanner), NPC ledger, store items ----------
async function loadHomebrew() {
  const box = $('#homebrew');
  const [scan, npcs, shop] = await Promise.all([
    api('GET', null, '?view=warden', '/api/scan').catch(() => null),
    api('GET', null, '?view=warden', '/api/npcs').catch(() => null),
    api('GET', null, '?view=warden', '/api/shop').catch(() => null),
  ]);
  const mons = (scan?.monsters || []).filter((m) => m.custom);
  const people = npcs?.npcs || [];
  const items = shop?.custom || [];
  const row = (label, sub, attrs) => `<li><span><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><button type="button" class="btn small secondary danger" ${attrs}>Delete</button></li>`;
  box.innerHTML = `
    <h4 class="hb-h">MONSTERS <small>${mons.length} · made on the Warden’s Station</small></h4>
    ${mons.length ? `<ul class="hb-list">${mons.map((m) => row(m.name, `${m.size} · Kz ${m.kz}`, `data-hb="monster" data-key="${esc(m.name)}"`)).join('')}</ul>` : '<p class="muted">None yet.</p>'}
    <h4 class="hb-h">NPC LEDGER <small>${people.length} · dealt, written or from the book</small></h4>
    ${people.length ? `<ul class="hb-list">${people.map((n) => row(n.name, [n.faction, n.personality].filter(Boolean).join(' · '), `data-hb="npc" data-key="${esc(n.id)}"`)).join('')}</ul>` : '<p class="muted">None yet.</p>'}
    <h4 class="hb-h">STORE ITEMS <small>${items.length} · made in the Store</small></h4>
    ${items.length ? `<ul class="hb-list">${items.map((i) => row(i.name, [i.cat, i.cost != null ? `$${i.cost}` : ''].filter(Boolean).join(' · '), `data-hb="item" data-key="${esc(i.id)}"`)).join('')}</ul>` : '<p class="muted">None yet.</p>'}`;
  box.querySelectorAll('[data-hb]').forEach((b) => b.addEventListener('click', async () => {
    const name = b.closest('li').querySelector('b').textContent;
    if (!confirm(`Delete ${name} for good?`)) return;
    const kind = b.dataset.hb, key = b.dataset.key;
    try {
      if (kind === 'monster') await api('POST', { action: 'removeCustom', name: key }, '', '/api/scan');
      if (kind === 'npc') await api('POST', { action: 'remove', id: key }, '', '/api/npcs');
      if (kind === 'item') await api('POST', { action: 'removeCustom', id: key }, '', '/api/shop');
      toast(`${name} deleted.`);
      loadHomebrew();
    } catch (e) { toast(e.message, true); }
  }));
}
$('#hb-refresh').addEventListener('click', loadHomebrew);

// ---------- boot ----------
function open() {
  $('#gate').hidden = true; $('#desk').hidden = false; $('#lock').hidden = false;
  poller?.stop(); combatPoller?.stop();
  poller = startPolling('warden', onSessions, (ok, e) => { if (e?.status === 401) lockUp(); }, EP);
  loadHomebrew();
  combatPoller = startPolling('warden', (d) => { combat = d; renderGlance(); }, (ok) => { $('#glance-conn').textContent = ok ? '● live' : 'reconnecting…'; }, '/api/combat');
}
function lockUp() {
  poller?.stop(); combatPoller?.stop();
  forgetWarden();
  $('#gate').hidden = false; $('#desk').hidden = true; $('#lock').hidden = true;
}
$('#unlock').addEventListener('click', async () => { if (await wardenModal(EP)) open(); });
$('#lock').addEventListener('click', lockUp);
mountTableLog?.();
(async () => {
  const pin = savedPin();
  if (pin && await tryWarden(pin, EP)) open(); else $('#gate').hidden = false;
})();
