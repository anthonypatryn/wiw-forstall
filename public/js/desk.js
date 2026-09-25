// The Warden's desk on Run the Game: session notes, open rolls, homebrew, backup and the recent Table Log.
// (Once the Session page — now one page with Run the Game.)
import { $, esc, api, startPolling, toast, timeAgo, ask } from './common.js';
import { renderLogInto } from './tablelog.js';
import { gl } from './glyphs.js';

const EP = '/api/session';
let sessions = [], current = null, poller = null, getCombat = () => null, combatAct = async () => null;

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
      <button class="btn small" id="post-recap" type="button">${gl('scroll')} Post recap to the Table Log</button>
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
    if (!await ask(`Delete “${s.title}” and its notes? This can’t be undone.`)) return;
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


// ---------- open rolls ----------
export function renderChecks() {
  const combat = getCombat();
  if (!combat) return;
  const nm = (pid) => combat.posse.find((p) => p.id === pid)?.name || '—';
  const rows = (combat.checks || []).map((ck) => {
    const help = Math.max(0, ...Object.values(ck.helps || {}).map((h) => h.hits));
    const done = `<button type="button" class="btn small secondary" data-ck-close="${ck.id}">Done</button>`;
    if (ck.kind === 'challenge') {
      return `<div class="need${ck.winner ? '' : ' urgent'}"><div class="ck-body"><b>${gl('revolver')} ${esc(ck.skill)} Challenge</b>${ck.round > 1 ? ` · round ${ck.round}` : ''}${ck.note ? ` · <i>${esc(ck.note)}</i>` : ''}
        <div class="ck-who">${ck.who.map((pid) => `<span class="run-st${ck.rolls[pid] ? '' : ' wait'}">${esc(nm(pid))} ${ck.rolls[pid] ? `<b>${ck.rolls[pid].hits}</b>` : '…'}</span>`).join('')}${ck.npc ? `<span class="run-st">${esc(ck.npc.name)} rolls last</span>` : ''}</div>
        ${ck.winner ? `<div class="ck-win">${gl('trophy')} ${esc(ck.winner)} wins — ${(ck.last || []).map((x) => `${esc(x.name)} ${x.hits}`).join(' · ')}</div>` : ck.last ? `<div class="muted">Tied (${ck.last.map((x) => `${esc(x.name)} ${x.hits}`).join(' · ')}) — rolling again.</div>` : ''}</div>${done}</div>`;
    }
    const waiting = ck.who.some((pid) => !ck.rolls[pid]);
    return `<div class="need${waiting ? ' urgent' : ''}"><div class="ck-body"><b>${gl('die')} ${esc(ck.skill)}</b> · ${esc(ck.diff)} (${ck.target})${ck.note ? ` · <i>${esc(ck.note)}</i>` : ''}
      <div class="ck-who">${ck.who.map((pid) => { const r = ck.rolls[pid]; const tot = r ? r.hits + help : null;
        return `<span class="run-st${r ? (tot >= ck.target ? ' ok' : ' no') : ' wait'}">${esc(nm(pid))} ${r ? `${tot >= ck.target ? '✓' : '✗'} ${tot}/${ck.target}` : '…'}</span>`; }).join('')}
      ${Object.values(ck.helps || {}).map((h) => `<span class="run-st">${esc(h.name)} helped +${h.hits}</span>`).join('')}</div></div>${done}</div>`;
  }).join('');
  $('#check-list').innerHTML = rows || '<p class="muted">No rolls open. Call one above.</p>';
  $('#check-list').querySelectorAll('[data-ck-close]').forEach((b) => b.addEventListener('click', () => combatAct({ action: 'checkClose', id: b.dataset.ckClose })));
}

export function renderRecent() {
  const combat = getCombat();
  if (combat) renderLogInto($('#glance-log'), (combat.log || []).slice(0, 12));
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
    if (!await ask(`Delete ${name} for good?`)) return;
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
$('#clear-log').addEventListener('click', async () => {
  if (!await ask('Clear the Table Log for everyone? This can’t be undone. (Download a backup first if you want a record.)')) return;
  if (await combatAct({ action: 'clearLog' })) { toast('Table Log cleared.'); renderRecent(); }
});

// ---------- backup ----------
$('#backup').addEventListener('click', async () => {
  try {
    const b = await api('GET', null, '', '/api/backup');
    const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wiw-backup-${b.savedAt.slice(0, 16).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    const n = (b.data.combat?.posse || []).length;
    $('#backup-note').textContent = ` Saved ${n} character${n === 1 ? '' : 's'} and everything else — ${new Date().toLocaleTimeString()}.`;
  } catch (e) { toast(e.message, true); }
});


// ---------- start ----------
export function mountDesk(opts) {
  getCombat = opts.getCombat; combatAct = opts.combatAct;
  poller?.stop();
  poller = startPolling('warden', onSessions, null, EP);
  loadHomebrew();
}
