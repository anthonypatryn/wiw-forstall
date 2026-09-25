import { $, esc, api, startPolling, toast, mountNav, tryWarden, forgetWarden, savedPin, wardenModal, timeAgo , ask, askText } from './common.js';
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
        return `<tr class="${p.dead ? 'dead' : ''}"><td><a href="/posse#${p.id}"><b>${esc(p.name)}</b></a><small>The ${esc(p.trade)}${p.player ? ` · ${esc(p.player)}` : ''}${p.title ? ` · “${esc(p.title)}”` : ''}</small>${flag}${STATUS_SHORT(p.statuses) ? `<small class="gl-st">${esc(STATUS_SHORT(p.statuses))}</small>` : ''}</td>
          <td class="${low ? 'low' : ''}">${p.health}/${p.maxHealth}</td><td>${p.grit}</td>
          <td>${p.prestige?.total ?? 0}${p.prestige?.unclaimed ? `<small>${p.prestige.unclaimed} to spend</small>` : ''}</td><td>${esc(String(p.wallet || '0'))}</td></tr>`;
      }).join('')}</tbody></table>` : '<p class="muted">No characters yet.</p>'}
    <h4 class="gl-h">IN THE FIGHT ${combat.combat?.active ? `<small>Round ${combat.combat.round}</small>` : '<small>no combat running</small>'}</h4>
    ${foes.length ? `<ul class="gl-foes">${foes.map((e) => `<li><b>${esc(e.name)}</b> ${e.health ?? '?'}/${e.maxHealth ?? '?'} Health${STATUS_SHORT(e.statuses) ? ` · ${esc(STATUS_SHORT(e.statuses))}` : ''}</li>`).join('')}</ul>` : '<p class="muted">No enemies on the field.</p>'}
    ${d ? `<p class="gl-duel">🤠 Duel: <b>${esc(d.names[0])}</b> vs <b>${esc(d.names[1])}</b> — ${d.done ? 'finished' : `next: ${['Charm', 'Finesse', 'Intuition', 'Nerve', 'Draw!'][d.step]}`}</p>` : ''}
    <div class="gl-links"><a class="btn small secondary" href="/combat">Combat</a><a class="btn small secondary" href="/posse">Posse Sheets</a><a class="btn small secondary" href="/names">NPCs</a><a class="btn small secondary" href="/map">Map</a><a class="btn small secondary" href="/battle">Battle Map</a><a class="btn small secondary" href="/store">Store</a></div>`;
  renderLogInto($('#glance-log'), (combat.log || []).slice(0, 12));
}

// ---------- Skill checks (pp. 12–13) ----------
const DIFF = [['Very Easy', 1], ['Easy', 2], ['Medium', 3], ['Difficult', 4], ['Very Difficult', 5]];
const ckSel = { who: new Set(), skill: 'Nerve', diff: 'Medium', target: 6, note: '' };
async function combatAct(body) {
  try { const res = await api('POST', body, '', '/api/combat'); combat = res.state || combat; renderChecks(true); return res.result ?? true; }
  catch (e) { toast(e.message, true); return null; }
}
function renderChecks(force) {
  if (!combat) return;
  const form = $('#check-form');
  const alive = (combat.posse || []).filter((p) => !p.dead && p.done !== false);
  if (force || !form.contains(document.activeElement)) {
    form.innerHTML = `<div class="ck-who">${alive.map((p) => `<label class="check"><input type="checkbox" data-ck-who value="${p.id}"${ckSel.who.has(p.id) ? ' checked' : ''}> ${esc(p.name)}</label>`).join('') || '<span class="muted">No characters yet.</span>'}</div>
      <div class="ck-row">
        <label>SKILL<select data-ck="skill">${['Charm', 'Finesse', 'Intuition', 'Nerve'].map((s) => `<option${s === ckSel.skill ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
        <label>DIFFICULTY<select data-ck="diff">${DIFF.map(([n, t]) => `<option value="${n}"${n === ckSel.diff ? ' selected' : ''}>${n} · ${t} Hit${t > 1 ? 's' : ''}</option>`).join('')}<option value="custom"${ckSel.diff === 'custom' ? ' selected' : ''}>Custom…</option><option value="challenge"${ckSel.diff === 'challenge' ? ' selected' : ''}>⚔️ Challenge (opposed roll)</option></select></label>
        ${ckSel.diff === 'custom' ? `<label>HITS<input type="number" min="1" max="20" data-ck="target" value="${ckSel.target}"></label>` : ''}
        ${ckSel.diff === 'challenge' ? `<label>AGAINST<select data-ck="npc"><option value="">— just the ticked characters —</option>
          ${(combat.enemies || []).filter((e) => !e.defeated).length ? `<optgroup label="In the fight">${combat.enemies.filter((e) => !e.defeated).map((e) => `<option value="en:${e.id}"${ckSel.npc === `en:${e.id}` ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>` : ''}
          <optgroup label="Book NPCs">${(combat.npcCatalog || []).map((n) => `<option value="np:${esc(n.key)}|${esc(n.faction ? n.name : '')}"${ckSel.npc === `np:${n.key}|${n.faction ? n.name : ''}` ? ' selected' : ''}>${esc(n.name.replace('Human - ', 'Human: '))}</option>`).join('')}</optgroup></select></label>` : ''}
        <label class="wide">FOR WHAT <input data-ck="note" maxlength="80" placeholder="e.g. climb the cliff" value="${esc(ckSel.note)}"></label>
      </div>
      <button type="button" class="btn" data-ck-go>🎯 Call for a roll</button>
      <span class="muted ck-tip">Lower the difficulty for clever ideas (p. 12). Anyone not called can Help with half their dice (p. 13).</span>`;
  }
  const nm = (pid) => combat.posse.find((p) => p.id === pid)?.name || '—';
  $('#check-list').innerHTML = (combat.checks || []).map((ck) => {
    const help = Math.max(0, ...Object.values(ck.helps || {}).map((h) => h.hits));
    if (ck.kind === 'challenge') {
      return `<div class="ck-item"><div class="ck-head"><b>⚔️ ${esc(ck.skill)} Challenge</b>${ck.round > 1 ? ` · round ${ck.round}` : ''}${ck.note ? ` · <i>${esc(ck.note)}</i>` : ''}<button type="button" class="btn small secondary" data-ck-close="${ck.id}">Done</button></div>
        <ul>${ck.who.map((pid) => `<li>${esc(nm(pid))}: ${ck.rolls[pid] ? `<b>${ck.rolls[pid].hits}</b>` : '<span class="muted">waiting…</span>'}</li>`).join('')}${ck.npc ? `<li>${esc(ck.npc.name)}: <span class="muted">rolls when the posse has</span></li>` : ''}</ul>
        ${ck.winner ? `<p class="ck-win">🏆 ${esc(ck.winner)} wins — ${(ck.last || []).map((x) => `${esc(x.name)} ${x.hits}`).join(' · ')}</p>` : ck.last ? `<p class="muted">Tied last round (${ck.last.map((x) => `${esc(x.name)} ${x.hits}`).join(' · ')}) — rolling again.</p>` : ''}</div>`;
    }
    return `<div class="ck-item"><div class="ck-head"><b>${esc(ck.skill)}</b> · ${esc(ck.diff)} (${ck.target})${ck.note ? ` · <i>${esc(ck.note)}</i>` : ''}<button type="button" class="btn small secondary" data-ck-close="${ck.id}">Done</button></div>
      <ul>${ck.who.map((pid) => { const r = ck.rolls[pid]; const tot = r ? r.hits + help : null;
        return `<li>${esc(nm(pid))}: ${r ? `<b class="${tot >= ck.target ? 'ok' : 'no'}">${tot >= ck.target ? '✓' : '✗'} ${tot}/${ck.target}</b>${help ? ` <small>(+${help} help)</small>` : ''}` : '<span class="muted">waiting…</span>'}</li>`; }).join('')}
      ${Object.values(ck.helps || {}).map((h) => `<li class="muted">🤝 ${esc(h.name)} helped: ${h.hits}</li>`).join('')}</ul></div>`;
  }).join('');
  $('#check-list').querySelectorAll('[data-ck-close]').forEach((b) => b.addEventListener('click', () => combatAct({ action: 'checkClose', id: b.dataset.ckClose })));
}
$('#check-form').addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('[data-ck-who]')) { if (el.checked) ckSel.who.add(el.value); else ckSel.who.delete(el.value); return; }
  if (el.dataset.ck) { ckSel[el.dataset.ck] = el.dataset.ck === 'target' ? Number(el.value) : el.value; if (el.dataset.ck === 'diff') renderChecks(true); }
});
$('#check-form').addEventListener('input', (e) => { if (e.target.dataset.ck === 'note') ckSel.note = e.target.value; });
$('#check-form').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-ck-go]')) return;
  if (!ckSel.who.size) return toast('Tick who rolls.', true);
  const r = await combatAct({ action: 'checkStart', who: [...ckSel.who], skill: ckSel.skill, diff: ckSel.diff === 'custom' ? '' : ckSel.diff, target: ckSel.target, note: ckSel.note, npc: ckSel.diff === 'challenge' ? ckSel.npc : '' });
  if (r) { toast('Roll called — it’s on their sheets.'); ckSel.note = ''; renderChecks(true); }
});

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
  if (await combatAct({ action: 'clearLog' })) { toast('Table Log cleared.'); renderGlance(); }
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

// ---------- boot ----------
function open() {
  $('#gate').hidden = true; $('#desk').hidden = false; $('#lock').hidden = false;
  poller?.stop(); combatPoller?.stop();
  poller = startPolling('warden', onSessions, (ok, e) => { if (e?.status === 401) lockUp(); }, EP);
  loadHomebrew();
  combatPoller = startPolling('warden', (d) => { combat = d; renderGlance(); renderChecks(); }, (ok) => { $('#glance-conn').textContent = ok ? '● live' : 'reconnecting…'; }, '/api/combat');
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
