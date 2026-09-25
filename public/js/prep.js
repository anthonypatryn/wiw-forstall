// Scene Prep (Warden): build scenes ahead of game night. Run them from Run the Game → Tonight's Scene.
import { $, esc, api, toast, mountNav, tryWarden, savedPin, wardenModal, ask } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';

mountTableLog();
mountNav('/prep');
const EP = '/api/scenes';
const SKILLS = ['Charm', 'Finesse', 'Intuition', 'Nerve'];
const DIFFS = ['Very Easy', 'Easy', 'Medium', 'Difficult', 'Very Difficult'];
const MAPS = [['', 'No battle map'], ['imaginary-town', 'Imaginary Town'], ['great-plains', 'Great Plains'], ['red-rock-canyon', 'Red Rock Canyon'], ['mountain-pass', 'Mountain Pass'], ['monster-burrow', 'Monster Burrow']];
let S = null, ref = { npcs: [], posters: [], quests: [], clues: [], towns: [], catalog: [], npcCatalog: [] }, ed = null, dirty = false;

const blank = () => ({ title: '', town: '', readAloud: '', notes: '', npcs: [], wanted: [], journal: [], battleMap: '', enemies: [], handouts: [], locks: [], checks: [] });
const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
const count = (s) => [s.npcs.length && `${s.npcs.length} NPC${s.npcs.length > 1 ? 's' : ''}`, s.enemies.length && 'a fight', s.handouts.length && `${s.handouts.length} handout${s.handouts.length > 1 ? 's' : ''}`, s.locks.length && `${s.locks.length} lock${s.locks.length > 1 ? 's' : ''}`, s.checks.length && `${s.checks.length} roll${s.checks.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ');

function renderList() {
  const list = S.scenes;
  $('#scene-list').innerHTML = list.length ? list.map((s) => `<button type="button" class="prep-item${ed?.id === s.id ? ' on' : ''}${s.done ? ' done' : ''}" data-open="${esc(s.id)}">
      <b>${esc(s.title)}</b><small>${s.id === S.current ? '<span class="pill hot">tonight</span> ' : ''}${s.done ? '<span class="pill ok">played</span> ' : ''}${esc(count(s) || 'nothing added yet')}</small></button>`).join('')
    : '<p class="empty-note">No scenes yet. Start one with “New scene”.</p>';
}

const chipSet = (key, items, label) => `<div class="field-step"><span>${label}</span>${items.length ? items.map((x) => `<button type="button" class="chip-btn${ed[key].includes(x.id) ? ' on' : ''}" data-toggle="${key}" data-id="${esc(x.id)}">${esc(x.name)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('') : '<span class="muted small-text">Nothing to add yet.</span>'}</div>`;
function renderEditor() {
  if (!ed) {
    $('#editor').innerHTML = `<div class="prep-empty">${gl('scroll')}<p>Pick a scene, or start a new one.</p><p class="muted small-text">A scene holds everything for one beat of the story: what you read aloud, who the posse meets, the fight, handouts, locks and rolls. At the table, open Run the Game → Tonight’s Scene and tap each beat when its moment comes.</p></div>`;
    return;
  }
  const monsters = ref.catalog, npcProfiles = ref.npcCatalog;
  const jn = [...ref.quests.map((q) => ({ id: `quest:${q.id}`, name: q.title, sub: q.revealed ? 'quest · already shown' : 'quest' })), ...ref.clues.map((c) => ({ id: `clue:${c.id}`, name: c.title || c.text.slice(0, 30), sub: c.revealed ? 'clue · already shown' : 'clue' }))];
  $('#editor').innerHTML = `
    <div class="head-row"><h2 class="section-title">${ed.id ? 'Edit scene' : 'New scene'}</h2><span class="btn-row">${ed.id ? `<button type="button" class="btn small secondary" data-copy>Copy</button><button type="button" class="btn small secondary danger" data-del>Delete</button>` : ''}</span></div>
    <div class="field-step"><span>SCENE</span><input data-f="title" maxlength="90" value="${esc(ed.title)}" placeholder="e.g. Ambush at Dry Gulch"></div>
    <div class="field-step"><span>WHERE</span><select data-f="town">${opt('', 'Anywhere', ed.town)}${ref.towns.map((t) => opt(t.id, t.name, ed.town)).join('')}</select></div>
    <div class="field-step"><span>READ ALOUD <small>what you say to set the scene</small></span><textarea data-f="readAloud" rows="4" maxlength="4000" placeholder="The wind dies. Somewhere up the canyon, a horse whinnies…">${esc(ed.readAloud)}</textarea></div>
    <div class="field-step"><span>YOUR NOTES <small>only you see these</small></span><textarea data-f="notes" rows="3" maxlength="4000" placeholder="What the NPCs want, what happens if the posse runs…">${esc(ed.notes)}</textarea></div>

    <h3 class="prep-h">${gl('hat')} Set the stage <small>one tap reveals all of these</small></h3>
    ${chipSet('npcs', ref.npcs.map((n) => ({ id: n.id, name: n.name, sub: n.known ? 'already met' : 'not met yet' })), 'NPCS THE POSSE MEETS')}
    ${chipSet('wanted', ref.posters.map((p) => ({ id: p.id, name: p.name, sub: p.hidden ? 'hidden poster' : 'already up' })), 'WANTED POSTERS TO PUT UP')}
    ${chipSet('journal', jn, 'QUESTS &amp; CLUES TO REVEAL')}

    <h3 class="prep-h">${gl('revolver')} The fight</h3>
    <div class="field-step"><span>BATTLE MAP</span>${MAPS.map(([v, l]) => `<button type="button" class="chip-btn${ed.battleMap === v ? ' on' : ''}" data-map="${v}">${l}</button>`).join('')}</div>
    <div class="prep-rows">${ed.enemies.map((e, i) => `<div class="prep-row">
        <select data-row="enemies" data-i="${i}" data-k="profile"><option value="">Pick a monster or NPC…</option>
          <optgroup label="Monsters">${monsters.map((m) => opt(m.name, m.name, e.profile)).join('')}</optgroup>
          <optgroup label="Book NPCs">${npcProfiles.filter((n) => n.faction).map((n) => opt(n.key, n.name, e.profile)).join('')}</optgroup>
          <optgroup label="Human combatants (p. 191)">${npcProfiles.filter((n) => !n.faction).map((n) => opt(n.key, n.name.replace('Human - ', ''), e.profile)).join('')}</optgroup></select>
        <input data-row="enemies" data-i="${i}" data-k="name" maxlength="40" value="${esc(e.name)}" placeholder="Name (optional)">
        <label class="prep-num">×<input type="number" min="1" max="8" data-row="enemies" data-i="${i}" data-k="count" value="${e.count}"></label>
        <button type="button" class="rm-btn" data-rm="enemies" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
    <button type="button" class="btn small secondary" data-add="enemies">+ Add enemies</button>

    <h3 class="prep-h">${gl('satchel')} Handouts <small>go to the whole posse</small></h3>
    <div class="prep-rows">${ed.handouts.map((h, i) => `<div class="prep-row wrap">
        <span class="prep-kind">${['item', 'note'].map((k) => `<button type="button" class="chip-btn${h.kind === k ? ' on' : ''}" data-kind="${i}" data-v="${k}">${k === 'item' ? 'Item' : 'Note'}</button>`).join('')}</span>
        <input data-row="handouts" data-i="${i}" data-k="title" maxlength="80" value="${esc(h.title)}" placeholder="${h.kind === 'note' ? 'Heading (optional)' : 'Item name'}">
        <textarea data-row="handouts" data-i="${i}" data-k="text" rows="2" maxlength="4000" placeholder="${h.kind === 'note' ? 'The note, as it’s written' : 'What it looks like'}">${esc(h.text)}</textarea>
        <button type="button" class="rm-btn" data-rm="handouts" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
    <button type="button" class="btn small secondary" data-add="handouts">+ Add a handout</button>

    <h3 class="prep-h">${gl('lock')} Locks <small>you pick who picks it when you send it</small></h3>
    <div class="prep-rows">${ed.locks.map((l, i) => `<div class="prep-row wrap">
        <input data-row="locks" data-i="${i}" data-k="what" maxlength="60" value="${esc(l.what)}" placeholder="What lock, e.g. the sheriff’s strongbox">
        <label class="prep-num">Pins in a row<select data-row="locks" data-i="${i}" data-k="difficulty">${[1, 2, 3, 4, 5].map((n) => opt(String(n), String(n), String(l.difficulty))).join('')}</select></label>
        <label class="prep-num">Retries<select data-row="locks" data-i="${i}" data-k="retries">${[0, 1, 2, 3].map((n) => opt(String(n), String(n), String(l.retries))).join('')}</select></label>
        <input data-row="locks" data-i="${i}" data-k="retryCost" maxlength="60" value="${esc(l.retryCost)}" placeholder="Each retry costs… (e.g. one lockpick)">
        <label class="prep-num">Inside<select data-lootkind="${i}">${[['', 'Nothing'], ['money', 'Money'], ['scrap', 'Scrap'], ['custom', 'An item']].map(([v, t]) => opt(v, t, l.loot?.kind || '')).join('')}</select></label>
        ${l.loot?.kind === 'money' || l.loot?.kind === 'scrap' ? `<input type="number" min="0" data-loot="${i}" data-k="amount" value="${esc(l.loot.amount || '')}" placeholder="How much">` : ''}
        ${l.loot?.kind === 'custom' ? `<input data-loot="${i}" data-k="name" maxlength="80" value="${esc(l.loot.name || '')}" placeholder="Item name">` : ''}
        <label class="prep-num">Trap damage<input type="number" min="0" max="30" data-trap="${i}" value="${esc(l.trap?.damage || 0)}"></label>
        <button type="button" class="rm-btn" data-rm="locks" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
    <button type="button" class="btn small secondary" data-add="locks">+ Add a lock</button>

    <h3 class="prep-h">${gl('die')} Rolls to call <small>you pick who rolls when you call it</small></h3>
    <div class="prep-rows">${ed.checks.map((c, i) => `<div class="prep-row">
        <select data-row="checks" data-i="${i}" data-k="skill">${SKILLS.map((s) => opt(s, s, c.skill)).join('')}</select>
        <select data-row="checks" data-i="${i}" data-k="diff">${DIFFS.map((d) => opt(d, d, c.diff)).join('')}</select>
        <input data-row="checks" data-i="${i}" data-k="note" maxlength="80" value="${esc(c.note)}" placeholder="For what? (e.g. spot the tripwire)">
        <button type="button" class="rm-btn" data-rm="checks" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
    <button type="button" class="btn small secondary" data-add="checks">+ Add a roll</button>

    <div class="btn-row prep-save"><button type="button" class="btn" data-save>${gl('scroll')} Save scene</button>${ed.id ? `<button type="button" class="btn secondary" data-tonight>${S.current === ed.id ? 'Tonight’s scene ✓' : 'Run it tonight'}</button>` : ''}<span class="muted small-text" id="dirty">${dirty ? 'Unsaved changes' : ''}</span></div>`;
}
const touch = () => { dirty = true; const d = $('#dirty'); if (d) d.textContent = 'Unsaved changes'; };

document.addEventListener('input', (e) => {
  const d = e.target.dataset;
  if (!ed) return;
  if (d.f) { ed[d.f] = e.target.value; touch(); }
  if (d.row) { ed[d.row][Number(d.i)][d.k] = d.k === 'count' ? Number(e.target.value) : e.target.value; touch(); }
  if (d.loot) { ed.locks[Number(d.loot)].loot[d.k] = e.target.value; touch(); }
  if (d.trap) { const n = Number(e.target.value) || 0; ed.locks[Number(d.trap)].trap = n ? { damage: n } : null; touch(); }
});
document.addEventListener('change', (e) => {
  const d = e.target.dataset;
  if (!ed) return;
  if (d.f) { ed[d.f] = e.target.value; touch(); }
  if (d.row) { ed[d.row][Number(d.i)][d.k] = ['count', 'difficulty', 'retries'].includes(d.k) ? Number(e.target.value) : e.target.value; touch(); }
  if (d.lootkind !== undefined) { const l = ed.locks[Number(d.lootkind)]; l.loot = e.target.value ? { kind: e.target.value, amount: '', name: '' } : null; touch(); renderEditor(); }
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  try {
    if (d.new !== undefined) { if (dirty && !await ask('Drop your unsaved changes?', { ok: 'Drop them' })) return; ed = blank(); dirty = false; renderList(); renderEditor(); return; }
    if (d.open) { if (dirty && !await ask('Drop your unsaved changes?', { ok: 'Drop them' })) return; ed = JSON.parse(JSON.stringify(S.scenes.find((s) => s.id === d.open))); ed.journal = ed.journal.map((j) => `${j.kind}:${j.id}`); dirty = false; renderList(); renderEditor(); return; }
    if (!ed) return;
    if (d.toggle) { const k = d.toggle; ed[k] = ed[k].includes(d.id) ? ed[k].filter((x) => x !== d.id) : [...ed[k], d.id]; touch(); renderEditor(); return; }
    if (d.map !== undefined) { ed.battleMap = d.map; touch(); renderEditor(); return; }
    if (d.kind !== undefined) { ed.handouts[Number(d.kind)].kind = d.v; touch(); renderEditor(); return; }
    if (d.add) {
      ed[d.add].push({ enemies: { profile: '', name: '', count: 1 }, handouts: { kind: 'note', title: '', text: '' }, locks: { what: '', difficulty: 3, retries: 1, retryCost: 'one lockpick', loot: null, trap: null }, checks: { skill: 'Intuition', diff: 'Medium', note: '' } }[d.add]);
      touch(); renderEditor(); return;
    }
    if (d.rm) { ed[d.rm].splice(Number(d.i), 1); touch(); renderEditor(); return; }
    if (d.save !== undefined) {
      const scene = { ...ed, journal: ed.journal.map((x) => { const [kind, id] = x.split(':'); return { kind, id }; }) };
      const r = await api('POST', { action: 'save', id: ed.id, scene }, '', EP);
      S = r.state; ed = { ...JSON.parse(JSON.stringify(r.result)), journal: r.result.journal.map((j) => `${j.kind}:${j.id}`) }; dirty = false;
      renderList(); renderEditor(); toast('Scene saved.'); return;
    }
    if (d.tonight !== undefined) { const r = await api('POST', { action: 'current', id: S.current === ed.id ? '' : ed.id }, '', EP); S = r.state; renderList(); renderEditor(); toast(S.current ? 'It’s ready on Run the Game → Tonight’s Scene.' : 'Cleared.'); return; }
    if (d.copy !== undefined) { const r = await api('POST', { action: 'copy', id: ed.id }, '', EP); S = r.state; ed = { ...JSON.parse(JSON.stringify(r.result)), journal: r.result.journal.map((j) => `${j.kind}:${j.id}`) }; renderList(); renderEditor(); toast('Copied.'); return; }
    if (d.del !== undefined) { if (!await ask(`Delete the scene “${ed.title}”?`)) return; const r = await api('POST', { action: 'remove', id: ed.id }, '', EP); S = r.state; ed = null; dirty = false; renderList(); renderEditor(); }
  } catch (err) { toast(err.message, true); }
});

async function open() {
  $('#gate').hidden = true; $('#prep').hidden = false;
  const get = (q, ep) => api('GET', null, q, ep).catch(() => ({}));
  const [sc, npcs, wanted, journal, combat] = await Promise.all([get('', EP), get('?view=warden', '/api/npcs'), get('?view=warden', '/api/wanted'), get('?view=warden', '/api/journal'), get('?view=warden', '/api/combat')]);
  S = sc.scenes ? sc : { scenes: [], current: '' };
  ref = { npcs: npcs.npcs || [], posters: (wanted.posters || []).filter((p) => p.status === 'wanted'), quests: journal.quests || [], clues: journal.clues || [], towns: journal.towns || wanted.towns || [], catalog: combat.catalog || [], npcCatalog: combat.npcCatalog || [] };
  const want = location.hash.slice(1);
  if (want && S.scenes.some((s) => s.id === want)) { ed = JSON.parse(JSON.stringify(S.scenes.find((s) => s.id === want))); ed.journal = ed.journal.map((j) => `${j.kind}:${j.id}`); }
  renderList(); renderEditor();
}
$('#unlock').addEventListener('click', async () => { if (await wardenModal(EP)) { mountNav('/prep'); open(); } });
(async () => {
  const pin = savedPin();
  if (pin && await tryWarden(pin, EP)) open(); else $('#gate').hidden = false;
})();
