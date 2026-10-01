// Run the Game → Tonight's Scene: the prepped scene's read-aloud box and one button per beat.
// Each beat calls the same endpoints the Warden's own cards use, then is ticked off on the scene.
import { esc, api, toast, ask } from './common.js';
import { gl } from './glyphs.js';

const EP = '/api/scenes';

// who gets it: tap names (or everyone) — a small styled picker, never a browser prompt
function pickWho(posse, title, go = 'Send') {
  return new Promise((resolve) => {
    let who = null;
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    const draw = () => {
      back.innerHTML = `<div class="modal ask" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>
        <div class="field-step"><span>WHO</span><button type="button" class="chip-btn${who ? '' : ' on'}" data-all>Everyone</button>${posse.map((p) => `<button type="button" class="chip-btn${who?.has(p.id) ? ' on' : ''}" data-who="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
        <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>${esc(go)}</button></div></div>`;
    };
    draw();
    document.body.append(back);
    back.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) { if (e.target === back) { back.remove(); resolve(null); } return; }
      if (b.dataset.all !== undefined) { who = null; draw(); return; }
      if (b.dataset.who) { who ||= new Set(); if (who.has(b.dataset.who)) who.delete(b.dataset.who); else who.add(b.dataset.who); if (!who.size) who = null; draw(); return; }
      if (b.dataset.no !== undefined) { back.remove(); resolve(null); return; }
      if (b.dataset.go !== undefined) { back.remove(); resolve(who ? [...who] : 'all'); }
    });
  });
}

export function mountSceneRun(el, getCombat, after = () => {}) {
  let S = null, busy = false, names = { npc: {}, wanted: {}, quest: {}, clue: {} };
  const alive = () => (getCombat()?.posse || []).filter((p) => !p.dead);
  // names for the one-per-thing stage beats (the scene only keeps ids)
  const loadNames = () => Promise.all([api('GET', null, '?view=warden', '/api/npcs'), api('GET', null, '?view=warden', '/api/wanted'), api('GET', null, '?view=warden', '/api/journal')]).then(([n, w, j]) => {
    names = { npc: {}, wanted: {}, quest: {}, clue: {} };
    for (const x of n.npcs || []) names.npc[x.id] = x.name;
    for (const x of w.posters || []) names.wanted[x.id] = x.name;
    for (const x of j.quests || []) names.quest[x.id] = x.title;
    for (const x of j.clues || []) names.clue[x.id] = x.title || (x.text || '').slice(0, 30);
  }).catch(() => {});
  const load = () => Promise.all([api('GET', null, '', EP), loadNames()]).then(([d]) => { S = d; draw(); }).catch(() => { el.innerHTML = '<p class="muted">Couldn’t load your scenes.</p>'; });
  const mark = async (s, key) => { const r = await api('POST', { action: 'used', id: s.id, key }, '', EP); S = r.state; };

  function draw() {
    if (!S) return;
    const open = S.scenes.filter((s) => !s.done);
    const s = S.scenes.find((x) => x.id === S.current);
    if (!S.scenes.length) { el.innerHTML = `<p class="muted">No scenes prepped. <a href="/prep">Build one on Prep</a> — read-aloud text, NPCs, the fight, handouts and locks, all ready for one tap each.</p>`; return; }
    const pick = `<div class="sr-pick"><select data-sr-pick aria-label="Tonight’s scene"><option value="">${s ? 'Switch scene…' : 'Pick tonight’s scene…'}</option>${open.map((x) => `<option value="${esc(x.id)}"${x.id === S.current ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select><a class="btn small secondary" href="/prep${s ? `#${esc(s.id)}` : ''}">${s ? 'Edit on Prep' : 'Prep'}</a></div>`;
    if (!s) { el.innerHTML = pick; return; }
    const used = (k) => !!s.used?.[k];
    const beat = (k, label, sub = '') => `<button type="button" class="sr-beat${used(k) ? ' used' : ''}" data-beat="${esc(k)}"><span class="sr-tick">${used(k) ? '✓' : ''}</span><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
    const stage = s.npcs.length + s.wanted.length + s.journal.length;
    const fight = s.enemies.length || s.battleMap;
    el.innerHTML = `${pick}
      <h3 class="sr-title">${esc(s.title)}</h3>
      ${s.readAloud ? `<blockquote class="sr-read"><small>READ ALOUD</small>${esc(s.readAloud).replace(/\n/g, '<br>')}<button type="button" class="btn small secondary sr-tv" data-sr-tv>${gl('scroll')} Show on the TV</button></blockquote>` : ''}
      ${s.notes ? `<p class="sr-notes"><b>Your notes:</b> ${esc(s.notes).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="sr-beats">
        ${stage > 1 ? beat('stage', `${gl('hat')} Set the whole stage`, `all ${stage} below at once`) : ''}
        ${s.npcs.map((id) => beat(`npc:${id}`, `${gl('hat')} Reveal: ${esc(names.npc[id] || 'an NPC')}`, 'the posse meets them')).join('')}
        ${s.wanted.map((id) => beat(`wanted:${id}`, `${gl('scroll')} Put up: ${esc(names.wanted[id] || 'a poster')}`, 'Wanted poster')).join('')}
        ${s.journal.map((x) => beat(`journal:${x.kind}:${x.id}`, `${gl('scroll')} Reveal: ${esc(names[x.kind]?.[x.id] || `a ${x.kind}`)}`, `${x.kind} in the Journal`)).join('')}
        ${fight ? beat('fight', `${gl('revolver')} Set up the fight`, [s.battleMap && 'load the battle map', s.enemies.length && s.enemies.map((e) => `${e.count > 1 ? `${e.count}× ` : ''}${e.name || e.profile.replace(/^npc:(Human - )?/, '')}`).join(', ')].filter(Boolean).join(' · ')) : ''}
        ${s.handouts.map((h) => beat(`handout:${h.id}`, `${gl(h.kind === 'note' ? 'scroll' : 'satchel')} Hand out: ${esc(h.title || 'a note')}`, 'to the whole posse')).join('')}
        ${s.locks.map((l) => beat(`lock:${l.id}`, `${gl('lock')} Lock: ${esc(l.what)}`, `${l.difficulty} in a row${l.loot ? ' · something inside' : ''}${l.trap ? ' · trapped' : ''}`)).join('')}
        ${s.checks.map((c) => beat(`check:${c.id}`, `${gl('die')} Call for ${esc(c.skill)} (${esc(c.diff)})`, esc(c.note))).join('')}
      </div>
      <div class="btn-row sr-end"><button type="button" class="btn secondary" data-sr-done>${gl('trophy')} Scene’s over</button></div>`;
  }

  async function fire(s, key) {
    const [kind, ref, ref2] = key.split(':');
    const npc = (id) => api('POST', { action: 'known', id, value: true }, '', '/api/npcs');
    const poster = (id) => api('POST', { action: 'edit', id, hidden: false }, '', '/api/wanted');
    const clue = (k, id) => api('POST', { action: 'reveal', kind: k, id, value: true }, '', '/api/journal');
    if (kind === 'stage') { // everything at once; each one is ticked off too
      for (const id of s.npcs) { await npc(id).catch(() => {}); await mark(s, `npc:${id}`); }
      for (const id of s.wanted) { await poster(id).catch(() => {}); await mark(s, `wanted:${id}`); }
      for (const j of s.journal) { await clue(j.kind, j.id).catch(() => {}); await mark(s, `journal:${j.kind}:${j.id}`); }
      toast('The stage is set — the posse can see who and what they’ve found.');
    } else if (kind === 'npc') {
      await npc(ref); toast(`${names.npc[ref] || 'They'} — now on the posse’s NPC ledger.`);
    } else if (kind === 'wanted') {
      await poster(ref); toast(`${names.wanted[ref] || 'The poster'} is up on the Wanted board.`);
    } else if (kind === 'journal') {
      await clue(ref, ref2); toast(`${names[ref]?.[ref2] || 'It'} is in the posse’s Journal.`);
    } else if (kind === 'fight') {
      if (s.battleMap) await api('POST', { action: 'preset', id: s.battleMap }, '', '/api/battle');
      for (const e of s.enemies) await api('POST', { action: 'addEnemy', profile: e.profile || undefined, name: e.name || undefined, count: e.count }, '', '/api/combat');
      toast('Enemies are in. Start combat when they draw.');
    } else if (kind === 'handout') {
      const h = s.handouts.find((x) => x.id === ref);
      await api('POST', { action: 'send', kind: h.kind, title: h.title, text: h.text, to: 'all' }, '', '/api/handouts');
      toast('Handed out — it pops up on their phones.');
    } else if (kind === 'lock') {
      const l = s.locks.find((x) => x.id === ref);
      const to = await pickWho(alive(), `Who picks ${l.what}?`, 'Send the lock');
      if (!to) return false;
      await api('POST', { action: 'start', to, difficulty: l.difficulty, retries: l.retries, retryCost: l.retryCost, what: l.what, loot: l.loot, trap: l.trap }, '', '/api/lockpick');
      toast('Lock sent — it opens on their phones.');
    } else if (kind === 'check') {
      const c = s.checks.find((x) => x.id === ref);
      const to = await pickWho(alive(), `Who rolls ${c.skill}?`, 'Call the roll');
      if (!to) return false;
      await api('POST', { action: 'checkStart', who: to === 'all' ? alive().map((p) => p.id) : to, skill: c.skill, diff: c.diff, note: c.note }, '', '/api/combat');
      toast(`${c.skill} roll called.`);
    }
    return true;
  }

  el.addEventListener('change', async (e) => {
    if (e.target.dataset.srPick === undefined || !e.target.value) return;
    const r = await api('POST', { action: 'current', id: e.target.value }, '', EP).catch((err) => toast(err.message, true));
    if (r) { S = r.state; draw(); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || busy) return;
    const s = S?.scenes.find((x) => x.id === S.current); if (!s) return;
    if (b.dataset.srTv !== undefined) { // the read-aloud, big, on the table's TV (/tv)
      try { await api('POST', { action: 'show', title: s.title, text: s.readAloud }, '', '/api/tv'); toast('It’s on the TV.'); } catch (err) { toast(err.message, true); }
      return;
    }
    busy = true;
    try {
      if (b.dataset.beat) {
        const k = b.dataset.beat;
        if (s.used?.[k] && !await ask('You already did this one. Do it again?', { ok: 'Again', danger: false })) return;
        if (await fire(s, k)) { await mark(s, k); draw(); after(); }
      } else if (b.dataset.srDone !== undefined) {
        const r = await api('POST', { action: 'done', id: s.id }, '', EP); S = r.state; draw(); toast(`${s.title} is done. Pick the next scene when you’re ready.`);
      }
    } catch (err) { toast(err.message, true); } finally { busy = false; }
  });
  load();
  return { reload: load };
}
