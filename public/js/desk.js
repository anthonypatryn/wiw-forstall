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
      <label>DATE<input data-f="date" inputmode="numeric" maxlength="10" placeholder="2026-09-25" value="${esc(s.date)}"></label>
    </div>
    <label class="sess-notes">NOTES <small>just for you — plans, secrets, what happened, loose ends</small>
      <textarea data-f="notes" maxlength="20000" placeholder="Where the posse is, who they met, what they owe, what’s coming…">${esc(s.notes)}</textarea></label>
    <label class="sess-notes">RECAP FOR THE PLAYERS <small>short and spoiler-free</small>
      <textarea data-f="recap" maxlength="2000" class="short" placeholder="Last time, the posse…">${esc(s.recap)}</textarea></label>
    <div class="sess-actions">
      <button class="btn small" id="summarize" type="button">${gl('star')} Write up this session</button>
      <button class="btn small secondary" id="post-recap" type="button">${gl('scroll')} Post recap to the Table Log</button>
    </div>
    <div class="sess-foot">
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
  $('#summarize').addEventListener('click', async (e) => {
    if (String(s.notes || '').includes('=== SUMMARY ===') && !await ask('Write it up again?\n\nThe summary at the top of your notes is replaced. Your own notes below it stay.', { ok: 'Rewrite', danger: false })) return;
    e.target.disabled = true; e.target.textContent = 'Reading the Table Log…';
    const r = await act({ action: 'summarize', id: s.id });
    if (r) toast(r.ai ? `Summary written from ${r.entries} log entries — add your notes under MY NOTES.` : `Listed ${r.entries} log entries — add an Anthropic API key on Vercel for a written summary.`);
    renderEditor(true);
  });
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
    // still waiting: "Call off" cancels it. Everyone's in: it's highlighted with a clear "Close it" (Help still works until then)
    const finished = ck.kind === 'challenge' ? !!ck.winner : ck.who.every((pid) => ck.rolls[pid]);
    const done = finished ? `<button type="button" class="btn small" data-ck-close="${ck.id}">${gl('pin')} Close it</button>` : `<span class="ck-btns"><button type="button" class="btn small" data-ck-nudge="${ck.id}" title="Pop it up again for whoever hasn’t rolled">${gl('sound')} Nudge</button><button type="button" class="btn small secondary" data-ck-close="${ck.id}" title="Cancel this roll">Call off</button></span>`;
    const helpNote = finished && ck.kind !== 'challenge' ? '<div class="muted ck-help-note">Everyone’s rolled. The posse can still Help until you close it.</div>' : '';
    if (ck.kind === 'challenge') {
      return `<div class="notice${ck.winner ? ' ck-finished' : ' urgent'}"><div class="ck-body"><b>${gl('revolver')} ${esc(ck.skill)} Challenge</b>${ck.round > 1 ? ` · round ${ck.round}` : ''}${ck.note ? ` · <i>${esc(ck.note)}</i>` : ''}
        <div class="ck-who">${ck.who.map((pid) => `<span class="pill${ck.rolls[pid] ? '' : ' wait'}">${esc(nm(pid))} ${ck.rolls[pid] ? `<b>${ck.rolls[pid].hits}</b>` : '…'}</span>`).join('')}${ck.npc ? `<span class="pill">${esc(ck.npc.name)} rolls last</span>` : ''}</div>
        ${ck.winner ? `<div class="ck-win">${gl('trophy')} ${esc(ck.winner)} wins — ${(ck.last || []).map((x) => `${esc(x.name)} ${x.hits}`).join(' · ')}</div>` : ck.last ? `<div class="muted">Tied (${ck.last.map((x) => `${esc(x.name)} ${x.hits}`).join(' · ')}) — rolling again.</div>` : ''}</div>${done}</div>`;
    }
    const waiting = ck.who.some((pid) => !ck.rolls[pid]);
    return `<div class="notice${waiting ? ' urgent' : ' ck-finished'}"><div class="ck-body"><b>${gl('die')} ${esc(ck.skill)}</b> · ${esc(ck.diff)} (${ck.target})${ck.faction ? ` · with ${esc(ck.faction)}` : ''}${ck.note ? ` · <i>${esc(ck.note)}</i>` : ''}
      <div class="ck-who">${ck.who.map((pid) => { const r = ck.rolls[pid]; const tot = r ? r.hits + help : null;
        return `<span class="pill${r ? (tot >= ck.target ? ' ok' : ' no') : ' wait'}">${esc(nm(pid))} ${r ? `${tot >= ck.target ? '✓' : '✗'} ${tot}/${ck.target}` : '…'}</span>`; }).join('')}
      ${Object.values(ck.helps || {}).map((h) => `<span class="pill">${esc(h.name)} helped +${h.hits}</span>`).join('')}</div>${helpNote}</div>${done}</div>`;
  }).join('');
  $('#check-list').innerHTML = rows || '<p class="muted">No rolls open. Call one from <a href="#grp-start">Start Something</a>.</p>';
  $('#check-list').querySelectorAll('[data-ck-close]').forEach((b) => b.addEventListener('click', () => combatAct({ action: 'checkClose', id: b.dataset.ckClose })));
  $('#check-list').querySelectorAll('[data-ck-nudge]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const r = await combatAct({ action: 'checkNudge', id: b.dataset.ckNudge });
    if (r?.names?.length) toast(`Nudged ${r.names.join(' & ')}.`);
  }));
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
    ${mons.length ? `<ul class="hb-list">${mons.map((m) => row(m.name, `${m.size} · Kz ${m.kz}`, `data-hb="monster" data-key="${esc(m.name)}"`)).join('')}</ul>` : '<p class="muted">None yet. Make one on the Store, NPCs or Forstall Scanner page and it shows up here.</p>'}
    <h4 class="hb-h">NPC LEDGER <small>${people.length} · dealt, written or from the book</small></h4>
    ${people.length ? `<ul class="hb-list">${people.map((n) => row(n.name, [n.faction, n.personality].filter(Boolean).join(' · '), `data-hb="npc" data-key="${esc(n.id)}"`)).join('')}</ul>` : '<p class="muted">None yet. Make one on the Store, NPCs or Forstall Scanner page and it shows up here.</p>'}
    <h4 class="hb-h">STORE ITEMS <small>${items.length} · made in the Store</small></h4>
    ${items.length ? `<ul class="hb-list">${items.map((i) => row(i.name, [i.cat, i.cost != null ? `$${i.cost}` : ''].filter(Boolean).join(' · '), `data-hb="item" data-key="${esc(i.id)}"`)).join('')}</ul>` : '<p class="muted">None yet. Make one on the Store, NPCs or Forstall Scanner page and it shows up here.</p>'}`;
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


// ---------- nightly backups: list, back up now, restore (a snapshot or a downloaded file) ----------
const when = (t) => new Date(t).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const KIND = { nightly: 'nightly', manual: 'by hand', 'before-restore': 'just before a restore' };
async function renderSnaps() {
  const box = $('#snaps');
  if (!box) return;
  let list = [];
  try { list = (await api('GET', null, '?view=snaps', '/api/backup')).list || []; } catch { box.innerHTML = '<p class="muted">Couldn’t load the backups.</p>'; return; }
  box.innerHTML = list.length ? list.map((x) => `<div class="item-row snap-row"><span class="item-who"><b>${esc(when(x.at))}</b><small>${KIND[x.kind] || x.kind} · ${Math.max(1, Math.round(x.size / 1024))} KB</small></span>
      <button type="button" class="btn small secondary" data-restore="${esc(x.key)}">Restore</button></div>`).join('')
    : '<p class="muted">None yet. The first one is taken tonight, or press Back up now.</p>';
  box.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
    const x = list.find((y) => y.key === b.dataset.restore);
    if (!await ask(`Restore everything to ${when(x.at)}?\n\nSheets, NPCs, the fight, the Journal, the Store and notes all go back to how they were then. A copy of right now is saved first, so you can undo this.`, { ok: 'Restore it', danger: true })) return;
    try { const r = await api('POST', { action: 'restoreSnap', key: x.key }, '', '/api/backup'); toast(`Restored ${r.result.restored} parts of the game. Reloading…`); setTimeout(() => location.reload(), 1200); }
    catch (e) { toast(e.message, true); }
  }));
}
$('#snap-now')?.addEventListener('click', async () => {
  try { await api('POST', { action: 'snapshot' }, '', '/api/backup'); toast('Backed up.'); renderSnaps(); } catch (e) { toast(e.message, true); }
});
$('#restore-file')?.addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file isn’t a backup.', true); return; }
  if (!await ask(`Restore everything from “${file.name}”?\n\nThe whole game goes back to that file. A copy of right now is saved first, so you can undo this.`, { ok: 'Restore it', danger: true })) return;
  try { const r = await api('POST', { action: 'restoreFile', data }, '', '/api/backup'); toast(`Restored ${r.result.restored} parts of the game. Reloading…`); setTimeout(() => location.reload(), 1200); }
  catch (err) { toast(err.message, true); }
});

// ---------- Bug reports (Menu → Report a bug) ----------
let bugsShowFixed = false;
function renderBugs(bugs) {
  const box = $('#bugs'); if (!box) return;
  const names = Object.fromEntries((getCombat?.()?.posse || []).map((p) => [p.id, p.name]));
  const open = bugs.filter((b) => b.status !== 'fixed'), fixed = bugs.filter((b) => b.status === 'fixed');
  $('#bugs-count').textContent = open.length ? `${open.length} open` : '';
  const row = (b) => `<div class="notice bug-row${b.status === 'fixed' ? ' ck-finished' : b.blocking ? ' urgent' : ''}"><div class="ck-body">
      <b>BUG-${b.no} · ${esc(b.kind)} · ${esc(b.area)}</b>${b.blocking ? ' <span class="pill hot">blocking</span>' : ''}${b.status === 'fixed' ? ' <span class="pill ok">fixed</span>' : ''}
      <p class="bug-what">${esc(b.what)}</p>${b.expected ? `<p class="muted small-text">Expected: ${esc(b.expected)}</p>` : ''}${b.steps ? `<p class="muted small-text">Steps: ${esc(b.steps)}</p>` : ''}
      <div class="muted prob-meta">${esc(names[b.who] || b.who || 'someone')} · ${esc(b.page)} · ${esc(timeAgo(b.at))}${b.fixNote ? ` · <i>${esc(b.fixNote)}</i>` : ''}</div></div>
      <div class="ck-btns"><button type="button" class="btn small secondary" data-bug-copy="${b.no}">Copy for Claude</button>${b.status === 'fixed' ? `<button type="button" class="btn small secondary" data-bug-reopen="${b.no}">Reopen</button>` : `<button type="button" class="btn small secondary" data-bug-fix="${b.no}">Mark fixed</button>`}<button type="button" class="btn small secondary danger" data-bug-rm="${b.no}" aria-label="Delete BUG-${b.no}">×</button></div></div>`;
  box.innerHTML = (open.length ? open.map(row).join('') : '<p class="muted">No open bugs.</p>')
    + (fixed.length ? `<button type="button" class="btn small secondary" data-bug-fixed>${bugsShowFixed ? 'Hide' : 'Show'} ${fixed.length} fixed</button>${bugsShowFixed ? fixed.map(row).join('') : ''}` : '');
  box.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset, bug = bugs.find((x) => String(x.no) === (d.bugCopy || d.bugFix || d.bugReopen || d.bugRm));
    try {
      if (d.bugFixed !== undefined) { bugsShowFixed = !bugsShowFixed; renderBugs(bugs); return; }
      if (d.bugCopy) { const { bugText } = await import('./bugreport.js'); await navigator.clipboard.writeText(bugText(bug, names)); toast(`BUG-${bug.no} copied. Paste it to Claude.`); return; }
      if (d.bugFix) { await api('POST', { action: 'bugFix', no: bug.no }, '', '/api/problems'); toast(`BUG-${bug.no} marked fixed.`); }
      if (d.bugReopen) await api('POST', { action: 'bugReopen', no: bug.no }, '', '/api/problems');
      if (d.bugRm) { if (!await ask(`Delete BUG-${bug.no}?`, { ok: 'Delete it' })) return; await api('POST', { action: 'bugRemove', no: bug.no }, '', '/api/problems'); }
      renderProblems();
    } catch (err) { toast(err.message, true); }
  };
}

// ---------- Problems: errors reported from anyone's screen ----------
async function renderProblems() {
  const box = $('#problems');
  if (!box) return;
  let r;
  try { r = await api('GET', null, '', '/api/problems'); } catch { return; }
  renderBugs(r.bugs || []);
  const fresh = r.list.filter((x) => x.last > (r.seenAt || 0)).length + (r.bugs || []).filter((b) => b.status !== 'fixed' && b.at > (r.seenAt || 0)).length;
  const badge = $('#rn-tools'); if (badge) { badge.hidden = !fresh; badge.textContent = fresh; }
  const names = Object.fromEntries((getCombat?.()?.posse || []).map((p) => [p.id, p.name]));
  const who = (w) => String(w || '').split(', ').map((x) => names[x] || x).filter(Boolean).join(', ');
  box.innerHTML = r.list.length ? r.list.map((x) => `<div class="notice${x.last > (r.seenAt || 0) ? ' urgent' : ''}"><div class="ck-body"><b>${esc(x.msg)}</b>
      <div class="muted prob-meta">${esc(x.page)}${x.where ? ` · ${esc(x.where)}` : ''} · ${x.count > 1 ? `${x.count} times, last ` : ''}${esc(timeAgo(x.last))}${x.who ? ` · ${esc(who(x.who))}` : ''}${x.ua ? ` · ${esc(x.ua)}` : ''}</div></div></div>`).join('')
    : '<p class="muted">No problems reported. Nice.</p>';
}
$('#problems-clear')?.addEventListener('click', async () => {
  if (!await ask('Clear the Problems list?', { ok: 'Clear it' })) return;
  try { await api('POST', { action: 'clear' }, '', '/api/problems'); renderProblems(); } catch (e) { toast(e.message, true); }
});
// looking at Tools counts as having seen them
document.querySelector('#run-nav [data-view="grp-tools"]')?.addEventListener('click', async () => { try { await api('POST', { action: 'seen' }, '', '/api/problems'); } catch {} setTimeout(renderProblems, 300); });

// ---------- start ----------
export function mountDesk(opts) {
  getCombat = opts.getCombat; combatAct = opts.combatAct;
  poller?.stop();
  poller = startPolling('warden', onSessions, null, EP);
  renderSnaps(); renderProblems(); setInterval(renderProblems, 60000);
  loadHomebrew();
}
