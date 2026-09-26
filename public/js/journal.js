// The Journal: quests (step checklists), clues (a corkboard of pinned notes) and the newspapers.
// Players read what the Warden has revealed and keep the posse's own notes; the Warden writes, reveals and ticks things off here.
import { $, esc, api, startPolling, toast, mountNav, tryWarden, savedPin, ask, store, paras } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';
import { paperHTML, openPaper } from './paper.js';
import { shrink, showImage, loadImg } from './portrait.js';

mountTableLog();
mountNav('/journal');
const EP = '/api/journal';
let J = null, papers = null, warden = false, filter = '';
let tab = ['quests', 'clues', 'papers'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'quests';

const npcName = (id) => J?.npcs.find((n) => n.id === id)?.name || '';
const townName = (id) => J?.towns.find((t) => t.id === id)?.name || '';
const questName = (id) => J?.quests.find((q) => q.id === id)?.title || '';
const STATUS = { open: ['Open', 'info'], done: ['Complete', 'ok'], failed: ['Failed', 'no'] };
const tilt = (id) => ((parseInt(id, 16) % 9) - 4) * 0.7;

function showTab() {
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  document.querySelectorAll('[data-warden-only]').forEach((x) => { x.hidden = !warden; });
}

// ---------- quests ----------
function questHTML(q) {
  const [label, cls] = STATUS[q.status] || STATUS.open;
  const meta = [q.giver && npcName(q.giver) && `From ${esc(npcName(q.giver))}`, q.where && townName(q.where) && esc(townName(q.where))].filter(Boolean).join(' · ');
  const links = (J.clues || []).filter((c) => c.quest === q.id);
  return `<article class="jq ${q.status}" data-q="${esc(q.id)}">
    <div class="jq-head"><h3>${esc(q.title)}</h3><span class="pill ${cls}">${label}</span>${warden && !q.revealed ? '<span class="pill secret">hidden from the posse</span>' : ''}</div>
    ${meta ? `<div class="jq-meta">${meta}</div>` : ''}
    ${q.text ? `<div class="jq-text">${paras(q.text)}</div>` : ''}
    ${q.steps.length ? `<ul class="jq-steps">${q.steps.map((s) => `<li class="${s.done ? 'done' : ''}${s.hidden ? ' secret' : ''}">
        ${warden ? `<button type="button" class="jq-tick" data-tick="${esc(s.id)}" aria-label="${s.done ? 'Not done' : 'Done'}">${s.done ? '✓' : ''}</button>` : `<span class="jq-tick">${s.done ? '✓' : ''}</span>`}
        <span>${esc(s.text)}</span>${warden ? `<button type="button" class="linkish" data-stephide="${esc(s.id)}">${s.hidden ? 'show the posse' : 'hide'}</button>` : ''}</li>`).join('')}</ul>` : ''}
    ${q.reward ? `<div class="jq-reward">${gl('trophy')} Reward: ${esc(q.reward)}</div>` : ''}
    ${links.length ? `<div class="jq-links">Clues: ${links.map((c) => `<button type="button" class="linkish" data-openclue="${esc(c.id)}">${esc(c.title || c.text.slice(0, 40))}</button>`).join(' · ')}</div>` : ''}
    <label class="jn-notes"><span>POSSE NOTES</span><textarea data-notes="quest" data-id="${esc(q.id)}" rows="2" maxlength="3000" placeholder="What the posse has worked out…">${esc(q.posseNotes || '')}</textarea></label>
    ${warden ? `<div class="btn-row jq-tools">
      <button type="button" class="btn small secondary" data-editq>Edit</button>
      <button type="button" class="btn small secondary" data-revealq>${q.revealed ? 'Hide from the posse' : 'Reveal to the posse'}</button>
      ${q.status === 'open' ? '<button type="button" class="btn small" data-qstatus="done">Complete</button><button type="button" class="btn small secondary" data-qstatus="failed">Failed</button>' : '<button type="button" class="btn small secondary" data-qstatus="open">Reopen</button>'}
      <button type="button" class="btn small secondary danger" data-delq>Delete</button></div>` : ''}
  </article>`;
}
function renderQuests() {
  const qs = [...J.quests].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || (b.updated || b.at) - (a.updated || a.at));
  $('#quests').innerHTML = qs.length ? qs.map(questHTML).join('')
    : `<p class="empty-note">${warden ? 'No quests yet. “New quest” writes one — keep it hidden until the posse takes the job.' : 'No quests yet. When the posse takes on a job, it’s written down here.'}</p>`;
}

// ---------- clues ----------
function clueNote(c) {
  return `<button type="button" class="jc-note${warden && !c.revealed ? ' secret' : ''}" data-clue="${esc(c.id)}" style="--tilt:${tilt(c.id)}deg">
    <span class="jc-pin" aria-hidden="true"></span>
    ${c.img ? `<img src="/api/image?ns=clue&id=${esc(c.id)}&size=head&v=${c.img}" alt="">` : ''}
    ${c.title ? `<b>${esc(c.title)}</b>` : ''}<span class="jc-text">${esc(c.text.length > 140 ? `${c.text.slice(0, 140)}…` : c.text)}</span>
    ${warden && !c.revealed ? '<small class="jc-hid">hidden</small>' : ''}</button>`;
}
function renderClues() {
  const opts = [['', 'Every clue'], ...J.quests.filter((q) => J.clues.some((c) => c.quest === q.id)).map((q) => [`q:${q.id}`, `Quest: ${q.title}`]),
    ...J.npcs.filter((n) => J.clues.some((c) => c.npcs.includes(n.id))).map((n) => [`n:${n.id}`, `About ${n.name}`]),
    ...J.towns.filter((t) => J.clues.some((c) => c.places.includes(t.id))).map((t) => [`t:${t.id}`, `In ${t.name}`])];
  if (!opts.some(([v]) => v === filter)) filter = '';
  $('#clue-filter').innerHTML = opts.length > 1 ? `<select data-filter aria-label="Filter the clues">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === filter ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` : '';
  const [k, v] = filter.split(':');
  const list = J.clues.filter((c) => !k || (k === 'q' ? c.quest === v : k === 'n' ? c.npcs.includes(v) : c.places.includes(v)));
  $('#clues').innerHTML = list.length ? list.map(clueNote).join('')
    : `<p class="empty-note">${warden ? 'No clues yet. “New clue” pins one up — hidden until you reveal it.' : 'Nothing pinned up yet. Clues the posse turns up will land here.'}</p>`;
}
function openClue(c) {
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const links = [...c.npcs.map(npcName), ...c.places.map(townName)].filter(Boolean);
  back.innerHTML = `<div class="modal ask jc-big" role="dialog" aria-modal="true" aria-label="${esc(c.title || 'Clue')}">
    <span class="jc-pin" aria-hidden="true"></span>
    ${c.title ? `<h2>${esc(c.title)}</h2>` : ''}
    ${c.img ? `<button type="button" class="jc-img" data-img><img src="/api/image?ns=clue&id=${esc(c.id)}&size=full&v=${c.img}" alt=""></button>` : ''}
    <div class="jc-body">${paras(c.text)}</div>
    ${links.length || c.quest ? `<p class="jc-links">${c.quest && questName(c.quest) ? `Quest: <b>${esc(questName(c.quest))}</b>` : ''}${links.length ? `${c.quest ? ' · ' : ''}${links.map(esc).join(', ')}` : ''}</p>` : ''}
    <label class="jn-notes"><span>POSSE NOTES</span><textarea data-notes="clue" data-id="${esc(c.id)}" rows="3" maxlength="3000" placeholder="What does it mean?">${esc(c.posseNotes || '')}</textarea></label>
    <div class="ask-btns">${warden ? `<button type="button" class="btn secondary danger" data-delc>Delete</button><button type="button" class="btn secondary" data-revealc>${c.revealed ? 'Hide' : 'Reveal to the posse'}</button><button type="button" class="btn secondary" data-editc>Edit</button>` : ''}<button type="button" class="btn" data-close>Close</button></div></div>`;
  document.body.append(back);
  const close = () => back.remove();
  back.addEventListener('click', async (e) => {
    if (e.target === back || e.target.closest('[data-close]')) return close();
    if (e.target.closest('[data-img]')) return showImage(`/api/image?ns=clue&id=${c.id}&size=full&v=${c.img}`, c.title);
    if (e.target.closest('[data-editc]')) { close(); return editClue(c); }
    if (e.target.closest('[data-revealc]')) { await act({ action: 'reveal', kind: 'clue', id: c.id, value: !c.revealed }, c.revealed ? 'Hidden.' : 'Revealed — it pops up for the posse.'); return close(); }
    if (e.target.closest('[data-delc]') && await ask('Delete this clue?')) { await act({ action: 'remove', kind: 'clue', id: c.id }, 'Deleted.'); close(); }
  });
}

// ---------- the Warden's forms ----------
function modal(html) {
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  back.innerHTML = `<div class="modal ask jn-form" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(back);
  return back;
}
const pick = (list, cur, none) => `<option value="">${none}</option>${list.map((x) => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name || x.title)}</option>`).join('')}`;

function editQuest(q = null) {
  const st = q ? JSON.parse(JSON.stringify(q)) : { title: '', text: '', giver: '', where: '', reward: '', steps: [], revealed: false };
  const back = modal('');
  const draw = () => {
    back.querySelector('.modal').innerHTML = `<h2>${q ? 'Edit the quest' : 'A new quest'}</h2>
      <div class="field-step"><span>QUEST</span><input data-f="title" maxlength="90" value="${esc(st.title)}" placeholder="e.g. The Missing Kurtz Crystal"></div>
      <div class="field-step"><span>WHO GAVE IT · WHERE</span><select data-f="giver">${pick(J.npcs, st.giver, 'Nobody in particular')}</select><select data-f="where">${pick(J.towns, st.where, 'Anywhere')}</select></div>
      <div class="field-step"><span>THE JOB</span><textarea data-f="text" rows="3" maxlength="3000" placeholder="What they were asked to do, in a sentence or two">${esc(st.text)}</textarea></div>
      <div class="field-step"><span>STEPS — hidden ones stay secret until you show them</span>
        <div class="jn-steps">${st.steps.map((s, i) => `<div class="jn-step"><input data-step="${i}" maxlength="200" value="${esc(s.text)}"><button type="button" class="chip-btn${s.hidden ? ' on' : ''}" data-hide="${i}">hidden</button><button type="button" class="rm-btn" data-rm="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
        <button type="button" class="btn small secondary" data-addstep>+ Add a step</button></div>
      <div class="field-step"><span>REWARD (optional)</span><input data-f="reward" maxlength="120" value="${esc(st.reward)}" placeholder="e.g. $200 and the sheriff’s favor"></div>
      ${q ? '' : `<label class="check"><input type="checkbox" data-reveal${st.revealed ? ' checked' : ''}> Show it to the posse now</label>`}
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>Save</button></div>`;
  };
  draw();
  back.addEventListener('input', (e) => { const d = e.target.dataset; if (d.f) st[d.f] = e.target.value; if (d.step) st.steps[Number(d.step)].text = e.target.value; });
  back.addEventListener('change', (e) => { const d = e.target.dataset; if (d.f) st[d.f] = e.target.value; if (d.reveal !== undefined) st.revealed = e.target.checked; });
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.no !== undefined) return back.remove();
    if (d.addstep !== undefined) { st.steps.push({ text: '', hidden: false, done: false }); draw(); back.querySelector(`[data-step="${st.steps.length - 1}"]`)?.focus(); return; }
    if (d.hide) { const s = st.steps[Number(d.hide)]; s.hidden = !s.hidden; draw(); return; }
    if (d.rm) { st.steps.splice(Number(d.rm), 1); draw(); return; }
    if (d.go !== undefined) {
      try { await act({ action: 'saveQuest', ...(q ? { id: q.id } : {}), ...st }, q ? 'Saved.' : st.revealed ? 'Quest added — it pops up for the posse.' : 'Quest added (hidden until you reveal it).'); back.remove(); }
      catch (err) { toast(err.message, true); }
    }
  });
}
function editClue(c = null) {
  const st = c ? JSON.parse(JSON.stringify(c)) : { title: '', text: '', quest: '', npcs: [], places: [], revealed: false };
  let photo = null;
  const back = modal('');
  const draw = () => {
    back.querySelector('.modal').innerHTML = `<h2>${c ? 'Edit the clue' : 'Pin up a clue'}</h2>
      <div class="field-step"><span>CLUE</span><input data-f="title" maxlength="90" value="${esc(st.title)}" placeholder="e.g. Muddy boot prints"></div>
      <div class="field-step"><span>WHAT THEY FOUND</span><textarea data-f="text" rows="3" maxlength="2000" placeholder="Size 13, heading toward the old mine…">${esc(st.text)}</textarea></div>
      <div class="field-step"><span>PART OF A QUEST?</span><select data-f="quest">${pick(J.quests, st.quest, 'No quest')}</select></div>
      ${J.npcs.length ? `<div class="field-step"><span>WHO IT’S ABOUT</span>${J.npcs.map((n) => `<button type="button" class="chip-btn${st.npcs.includes(n.id) ? ' on' : ''}" data-npc="${esc(n.id)}">${esc(n.name)}</button>`).join('')}</div>` : ''}
      <div class="field-step"><span>WHERE</span><select data-place>${pick(J.towns, st.places[0] || '', 'Nowhere in particular')}</select></div>
      <div class="ho-photo">${photo ? `<img src="${photo.head}" alt="">` : c?.img ? `<img src="/api/image?ns=clue&id=${esc(c.id)}&size=head&v=${c.img}" alt="">` : ''}<button type="button" class="btn small secondary" data-photo>${gl('camera')} ${photo || c?.img ? 'Change picture' : 'Add a picture'}</button></div>
      ${c ? '' : `<label class="check"><input type="checkbox" data-reveal${st.revealed ? ' checked' : ''}> Show it to the posse now</label>`}
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>Save</button></div>`;
  };
  draw();
  back.addEventListener('input', (e) => { const d = e.target.dataset; if (d.f) st[d.f] = e.target.value; });
  back.addEventListener('change', (e) => { const d = e.target.dataset; if (d.f) st[d.f] = e.target.value; if (d.place !== undefined) st.places = e.target.value ? [e.target.value] : []; if (d.reveal !== undefined) st.revealed = e.target.checked; });
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.no !== undefined) return back.remove();
    if (d.npc) { st.npcs = st.npcs.includes(d.npc) ? st.npcs.filter((x) => x !== d.npc) : [...st.npcs, d.npc]; draw(); return; }
    if (d.photo !== undefined) {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
      input.addEventListener('change', async () => {
        const f = input.files[0]; input.remove(); if (!f) return;
        try { const img = await loadImg(f); photo = { head: shrink(img, 480, 0.84), full: shrink(img) }; draw(); } catch { toast('Couldn’t read that picture.', true); }
      });
      document.body.append(input); input.click();
      return;
    }
    if (d.go !== undefined) {
      b.disabled = true;
      try {
        const r = await act({ action: 'saveClue', ...(c ? { id: c.id } : {}), title: st.title, text: st.text, quest: st.quest, npcs: st.npcs, places: st.places, ...(c ? {} : { revealed: st.revealed }) });
        if (photo) { await api('POST', { action: 'upload', ns: 'clue', id: r.id, head: photo.head, full: photo.full }, '', '/api/image'); J = await api('GET', null, `?view=${warden ? 'warden' : 'player'}`, EP); render(); }
        toast(c ? 'Saved.' : st.revealed ? 'Pinned up — it pops up for the posse.' : 'Pinned up (hidden until you reveal it).');
        back.remove();
      } catch (err) { toast(err.message, true); b.disabled = false; }
    }
  });
}

// ---------- newspapers ----------
function renderPapers() {
  if (!papers) return;
  const list = papers.issues || [];
  $('#papers').innerHTML = list.length ? list.map((p) => `<div><button type="button" class="jn-paper" data-paper="${esc(p.id)}">${p.published ? '' : '<span class="pill wait jn-draft">not printed yet</span>'}<div class="np-mini">${paperHTML(p, papers.posse)}</div></button>
      ${warden ? `<div class="jn-tools">${p.published ? `<button type="button" class="btn small secondary" data-unprint="${esc(p.id)}">Take it back</button>` : `<button type="button" class="btn small" data-print="${esc(p.id)}">Print it for the posse</button>`}<button type="button" class="btn small secondary danger" data-delp="${esc(p.id)}">Delete</button></div>` : ''}</div>`).join('')
    : `<p class="empty-note">${warden ? 'No papers yet. End Session sets tonight’s front page.' : 'No papers yet. When the posse makes the news, the front page lands here.'}</p>`;
}

function render() { if (!J) return; showTab(); if (!document.querySelector('.jn-form')) { renderQuests(); renderClues(); } }
async function act(body, msg) {
  const r = await api('POST', body, '', EP);
  J = r.state; render();
  if (msg) toast(msg);
  return r.result;
}
const paperAct = (body, msg) => api('POST', body, '', '/api/papers').then((r) => { papers = r.state; renderPapers(); if (msg) toast(msg); }).catch((err) => toast(err.message, true));

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset, q = b.closest('[data-q]') && J.quests.find((x) => x.id === b.closest('[data-q]').dataset.q);
  try {
    if (d.tab) { tab = d.tab; history.replaceState(null, '', `#${tab}`); showTab(); return; }
    if (d.newQuest !== undefined) return editQuest();
    if (d.newClue !== undefined) return editClue();
    if (d.clue) { const c = J.clues.find((x) => x.id === d.clue); if (c) openClue(c); return; }
    if (d.openclue) { const c = J.clues.find((x) => x.id === d.openclue); if (c) openClue(c); return; }
    if (d.paper) { const p = papers.issues.find((x) => x.id === d.paper); if (p) openPaper(p, papers.posse); return; }
    if (d.print) return paperAct({ action: 'publish', id: d.print }, 'Printed — it pops up for the posse.');
    if (d.unprint) return paperAct({ action: 'unpublish', id: d.unprint }, 'Taken back.');
    if (d.delp) { if (await ask('Delete this issue for everyone?')) paperAct({ action: 'remove', id: d.delp }, 'Deleted.'); return; }
    if (!q) return;
    if (d.tick) { const s = q.steps.find((x) => x.id === d.tick); await act({ action: 'step', id: q.id, step: s.id, done: !s.done }); }
    else if (d.stephide) { const s = q.steps.find((x) => x.id === d.stephide); await act({ action: 'step', id: q.id, step: s.id, hidden: !s.hidden }, s.hidden ? 'Shown to the posse.' : 'Hidden.'); }
    else if (d.editq !== undefined) editQuest(q);
    else if (d.revealq !== undefined) await act({ action: 'reveal', kind: 'quest', id: q.id, value: !q.revealed }, q.revealed ? 'Hidden.' : 'Revealed — it pops up for the posse.');
    else if (d.qstatus) await act({ action: 'status', id: q.id, status: d.qstatus });
    else if (d.delq !== undefined) { if (await ask(`Delete the quest “${q.title}”?`)) await act({ action: 'remove', kind: 'quest', id: q.id }, 'Deleted.'); }
  } catch (err) { toast(err.message, true); }
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (['quests', 'clues', 'papers'].includes(h)) { tab = h; showTab(); } });
document.addEventListener('change', (e) => { if (e.target.dataset.filter !== undefined) { filter = e.target.value; renderClues(); } });
// posse notes save shortly after typing stops
let noteTimer = null;
document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.dataset.notes) return;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => api('POST', { action: 'posseNote', kind: t.dataset.notes, id: t.dataset.id, text: t.value }, '', EP)
    .then((r) => { J = r.state; }).catch((err) => toast(err.message, true)), 800);
});

(async () => {
  showTab();
  if (savedPin()) warden = await tryWarden(savedPin(), EP);
  // don't redraw under someone typing notes
  startPolling(warden ? 'warden' : 'player', (d) => { J = d; if (!warden) store.set('wiw.journalSeenAt', Date.now()); if (!document.activeElement?.dataset?.notes) render(); }, null, EP);
  startPolling(warden ? 'warden' : 'player', (d) => { papers = d; renderPapers(); }, null, '/api/papers');
})();
