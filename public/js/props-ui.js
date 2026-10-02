// Map objects on the Battle Map (lib/props.js): the Warden's place / edit dialog, and the card anyone gets by tapping
// one (pick a chest's lock, search a body, read a note). battle.js draws them and handles placing.
import { esc, api, toast, ask, rollPopup } from './common.js';
import { gl } from './glyphs.js';

const MARKER_ICONS = ['pin', 'fire', 'drop', 'hat', 'lock', 'star', 'horseshoe', 'target', 'skull', 'scroll']; // as in lib/props.js
export const KINDS = [['chest', 'Chest', 'chest'], ['body', 'Body', 'skull'], ['clue', 'Note or clue', 'scroll'], ['trap', 'Hidden trap', 'trap'], ['door', 'Door', 'door'], ['marker', 'Marker', 'pin']];
const STATUSES = ['', 'Afraid', 'Burned', 'Dazed', 'Electrocuted', 'Poisoned', 'Trapped', 'Unconscious']; // as in lib/lockpick.js
export const propIcon = (p) => (p.kind === 'marker' ? p.icon || 'pin' : KINDS.find(([k]) => k === p.kind)?.[2] || 'pin');
const LOOT = [['', 'Nothing'], ['money', 'Money'], ['scrap', 'Scrap'], ['item', 'A Store item'], ['custom', 'Something else']];

let catalog = null, clues = null;
const loadLists = () => Promise.all([
  catalog ? null : api('GET', null, '?view=catalog', '/api/shop').then((c) => { catalog = (c.catalog || []).filter((x) => !x.base).sort((x, y) => x.name.localeCompare(y.name)); }).catch(() => { catalog = []; }),
  clues ? null : api('GET', null, '?view=warden', '/api/journal').then((j) => { clues = j.clues || []; }).catch(() => { clues = []; }),
]);

// one loot picker (a chest's contents, or one find on a body)
const lootHTML = (l = {}, i = '') => `<div class="pp-loot" data-loot="${i}">
  <select data-l="kind" aria-label="What is it">${LOOT.map(([k, n]) => `<option value="${k}"${(l?.kind || '') === k ? ' selected' : ''}>${n}</option>`).join('')}</select>
  ${l?.kind === 'money' || l?.kind === 'scrap' ? `<input data-l="amount" type="number" min="0" step="${l.kind === 'money' ? '0.25' : '1'}" value="${esc(l.amount ?? '')}" placeholder="${l.kind === 'money' ? '$' : 'Scrap'}" aria-label="How much">` : ''}
  ${l?.kind === 'item' ? `<select data-l="itemId" aria-label="Which item"><option value="">Pick an item…</option>${(catalog || []).map((c) => `<option value="${esc(c.id)}"${l.itemId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
  ${l?.kind === 'custom' ? `<input data-l="name" maxlength="80" value="${esc(l.name || '')}" placeholder="What is it?" aria-label="Name"><input data-l="desc" maxlength="300" value="${esc(l.desc || '')}" placeholder="Describe it (optional)" aria-label="Description">` : ''}
</div>`;
const readLoot = (el) => {
  const v = (k) => el.querySelector(`[data-l="${k}"]`)?.value ?? '';
  const kind = v('kind');
  if (!kind) return null;
  if (kind === 'money' || kind === 'scrap') return { kind, amount: Number(v('amount')) || 0 };
  if (kind === 'item') return { kind, itemId: v('itemId'), name: catalog?.find((c) => c.id === v('itemId'))?.name || '' };
  return { kind, name: v('name'), desc: v('desc') };
};

// Warden: place a new object (no `p`) or change one. Resolves to the fields to send, or null.
export async function propDialog(p = null) {
  await loadLists();
  const st = p ? JSON.parse(JSON.stringify(p)) : { kind: 'chest', name: '', hidden: false, difficulty: 3, retries: 1, retryCost: 'one lockpick', loot: null, trap: null, finds: [{ kind: 'money', amount: 1, need: 1 }], text: '', clueId: '', icon: 'pin', locked: false };
  if (st.trap === undefined) st.trap = null;
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back ask-back pp-back';
    const sync = () => { // read the form back into st before redrawing
      const f = back.querySelector('form'); if (!f) return;
      const val = (n) => f.querySelector(`[name="${n}"]`);
      if (val('name')) st.name = val('name').value;
      if (val('hidden')) st.hidden = val('hidden').checked;
      if (st.kind === 'chest') { st.retries = Number(val('retries').value) || 0; st.loot = readLoot(f.querySelector('[data-loot="chest"]')); const dmg = Number(val('trap').value) || 0; st.trap = dmg ? { damage: dmg } : null; }
      if (st.kind === 'body') st.finds = [...f.querySelectorAll('[data-find]')].map((r) => ({ ...(readLoot(r.querySelector('[data-loot]')) || {}), need: Number(r.querySelector('[data-need]').value) || 1 }));
      if (st.kind === 'clue') { st.text = val('text').value; st.clueId = val('clueId').value; }
      if (st.kind === 'trap') st.trap = { damage: Number(val('tdmg').value) || 0, status: val('tstatus').value, sev: Number(val('tsev').value) || 1 };
      if (st.kind === 'door') { st.locked = val('locked').checked; if (val('retries')) st.retries = Number(val('retries').value) || 0; }
    };
    const draw = () => {
      back.innerHTML = `<div class="modal ask pp-modal" role="dialog" aria-modal="true" aria-label="${p ? 'Change it' : 'Place something'}"><form>
        <h2>${p ? `Change ${esc(p.name)}` : 'Place on the map'}</h2>
        ${p ? '' : `<div class="chip-row">${KINDS.map(([k, n, ic]) => `<button type="button" class="chip-btn${st.kind === k ? ' on' : ''}" data-kind="${k}">${gl(ic)} ${n}</button>`).join('')}</div>`}
        <label class="field-step"><span>NAME</span><input name="name" maxlength="50" value="${esc(st.name)}" placeholder="${{ chest: 'e.g. Iron strongbox', body: 'e.g. Dead prospector', clue: 'e.g. Torn letter', marker: 'e.g. Old well', trap: 'e.g. Bear trap', door: 'e.g. Cellar door' }[st.kind]}"></label>
        ${st.kind === 'chest' ? `
          <div class="field-step"><span>HOW HARD TO PICK <small>pins to set at High/Low</small></span><div class="chip-row">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip-btn${st.difficulty === n ? ' on' : ''}" data-diff="${n}">${n}</button>`).join('')}</div></div>
          <label class="field-step"><span>EXTRA TRIES <small>each costs one lockpick</small></span><input name="retries" type="number" min="0" max="5" value="${st.retries}"></label>
          <div class="field-step"><span>INSIDE</span>${lootHTML(st.loot, 'chest')}</div>
          <label class="field-step"><span>TRAP <small>Health lost when it opens, 0 = none</small></span><input name="trap" type="number" min="0" max="30" value="${st.trap?.damage || 0}"></label>` : ''}
        ${st.kind === 'body' ? `<div class="field-step"><span>ON THE BODY <small>each find needs that many Intuition Hits</small></span>
          ${(st.finds || []).map((f, i) => `<div class="pp-find" data-find="${i}">${lootHTML(f, i)}<label class="pp-need">Hits <input data-need type="number" min="1" max="6" value="${f.need || 1}"></label><button type="button" class="rm-btn" data-rmfind="${i}" aria-label="Remove">×</button></div>`).join('')}
          <button type="button" class="btn small secondary" data-addfind>+ Add a find</button></div>` : ''}
        ${st.kind === 'clue' ? `<label class="field-step"><span>WHAT IT SAYS</span><textarea name="text" rows="4" maxlength="1000" placeholder="What they read when they find it">${esc(st.text)}</textarea></label>
          <label class="field-step"><span>REVEAL A JOURNAL CLUE <small>optional</small></span><select name="clueId"><option value="">None</option>${(clues || []).map((c) => `<option value="${esc(c.id)}"${st.clueId === c.id ? ' selected' : ''}>${esc(c.title || c.text.slice(0, 40))}${c.revealed ? ' (already shown)' : ''}</option>`).join('')}</select></label>` : ''}
        ${st.kind === 'trap' ? `<p class="muted small-text">The posse can’t see it. It goes off when a character’s token steps on or through it.</p>
          <label class="field-step"><span>HEALTH LOST</span><input name="tdmg" type="number" min="0" max="30" value="${st.trap?.damage ?? 2}"></label>
          <div class="field-step"><span>AND A STATUS <small>optional</small></span><div class="pp-loot"><select name="tstatus">${STATUSES.map((x) => `<option value="${x}"${(st.trap?.status || '') === x ? ' selected' : ''}>${x || 'None'}</option>`).join('')}</select><input name="tsev" type="number" min="1" max="6" value="${st.trap?.sev || 1}" aria-label="Severity"></div></div>` : ''}
        ${st.kind === 'door' ? `<p class="muted small-text">A shut door stops the posse’s tokens. Anyone next to it can open it, unless it’s locked.</p>
          <label class="check"><input type="checkbox" name="locked"${st.locked ? ' checked' : ''} data-locked> Locked (they pick it to get through)</label>
          ${st.locked ? `<div class="field-step"><span>HOW HARD TO PICK <small>pins to set</small></span><div class="chip-row">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip-btn${st.difficulty === n ? ' on' : ''}" data-diff="${n}">${n}</button>`).join('')}</div></div>
          <label class="field-step"><span>EXTRA TRIES <small>each costs one lockpick</small></span><input name="retries" type="number" min="0" max="5" value="${st.retries ?? 1}"></label>` : ''}` : ''}
        ${st.kind === 'marker' ? `<div class="field-step"><span>ICON</span><div class="chip-row">${MARKER_ICONS.map((ic) => `<button type="button" class="chip-btn pp-ic${st.icon === ic ? ' on' : ''}" data-icon="${ic}" aria-label="${ic}">${gl(ic)}</button>`).join('')}</div></div>` : ''}
        <label class="check"><input type="checkbox" name="hidden"${st.hidden ? ' checked' : ''}> Hidden from the posse (show it when they find it)</label>
        <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="submit" class="btn">${p ? 'Save' : 'Place it: tap the map'}</button></div>
      </form></div>`;
    };
    const done = (v) => { back.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('[data-no]')) return done(null);
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.kind) { sync(); st.kind = b.dataset.kind; draw(); }
      else if (b.dataset.diff) { sync(); st.difficulty = Number(b.dataset.diff); draw(); }
      else if (b.dataset.icon) { sync(); st.icon = b.dataset.icon; draw(); }
      else if (b.dataset.addfind !== undefined) { sync(); st.finds.push({ kind: 'money', amount: 1, need: 1 }); draw(); }
      else if (b.dataset.rmfind !== undefined) { sync(); st.finds.splice(Number(b.dataset.rmfind), 1); draw(); }
    });
    back.addEventListener('change', (e) => { if (e.target.matches('[data-l="kind"], [data-locked]')) { sync(); draw(); } }); // different fields to fill in
    back.addEventListener('submit', (e) => {
      e.preventDefault(); sync();
      const out = { kind: st.kind, name: st.name, hidden: st.hidden };
      if (st.kind === 'chest') Object.assign(out, { difficulty: st.difficulty, retries: st.retries, retryCost: st.retryCost || 'one lockpick', loot: st.loot, trap: st.trap });
      if (st.kind === 'body') out.finds = st.finds.filter((f) => f.kind);
      if (st.kind === 'clue') Object.assign(out, { text: st.text, clueId: st.clueId });
      if (st.kind === 'marker') out.icon = st.icon;
      if (st.kind === 'trap') out.trap = st.trap;
      if (st.kind === 'door') Object.assign(out, { locked: st.locked, difficulty: st.difficulty || 2, retries: st.retries ?? 1, retryCost: st.retryCost || 'one lockpick' });
      done(out);
    });
    document.addEventListener('keydown', key, true);
    draw();
    document.body.append(back);
    back.querySelector('[name="name"]')?.focus();
  });
}

// the card for one object. ctx: { warden, near (bool), me, act(body, msg) → result, onMove(p), refresh() }
export function propCard(p, ctx) {
  const back = document.createElement('div');
  back.className = 'modal-back ask-back pp-back';
  const what = { chest: p.opened ? `Open and empty (${p.opened} picked it).` : p.picking ? `${p.picking} is working the lock.` : `A locked ${p.name.toLowerCase().includes('chest') ? 'chest' : 'box'}: ${p.difficulty} pin${p.difficulty === 1 ? '' : 's'} to set at High/Low to open it.`,
    body: p.left ? 'Someone might find something on them.' : p.searchedBy?.length ? 'Picked clean.' : 'Search it with Intuition.',
    clue: 'Something to read.', marker: '',
    trap: p.sprung ? `Sprung by ${p.sprung}.` : 'Hidden: the posse can’t see it until someone sets it off.',
    door: p.open ? 'It’s open.' : p.picking ? `Shut. ${p.picking} is working the lock.` : 'It’s shut.' }[p.kind];
  const wardenInfo = !ctx.warden ? '' : p.kind === 'chest' ? `<p class="pp-secret">${gl('lock')} Inside: <b>${esc(p.lootText || 'nothing')}</b>${p.trap?.damage ? ` · trap −${p.trap.damage} Health` : ''}</p>`
    : p.kind === 'body' ? `<ul class="pp-secret">${(p.finds || []).map((f) => `<li>${esc(f.text)} · ${f.need} Hit${f.need === 1 ? '' : 's'}${f.byName ? ` · <i>found by ${esc(f.byName)}</i>` : ''}</li>`).join('') || '<li>Nothing on them.</li>'}</ul>`
    : p.kind === 'clue' ? `<p class="pp-secret">${esc(p.text || '(no text)')}${p.clueId ? '<br><i>Reveals a Journal clue</i>' : ''}</p>`
    : p.kind === 'trap' ? `<p class="pp-secret">${gl('trap')} ${esc(p.trapText || 'does nothing')}</p>`
    : p.kind === 'door' ? `<p class="pp-secret">${p.locked ? `${gl('lock')} Locked: ${p.difficulty} pin${p.difficulty === 1 ? '' : 's'} to pick${p.unlocked ? ' · <i>picked</i>' : ''}` : 'Not locked'}</p>` : '';
  const verb = { chest: p.opened ? '' : `${gl('lock')} Pick the lock`, body: `${gl('target')} Search the body <small>Intuition</small>`, clue: `${gl('scroll')} Read it`, marker: '', trap: '', door: p.open ? `${gl('door')} Shut it` : `${gl('door')} Open it` }[p.kind];
  const can = !ctx.warden && verb && ctx.me && !(p.kind === 'body' && p.searchedBy?.includes(ctx.me));
  back.innerHTML = `<div class="modal ask pp-modal" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
    <h2>${gl(propIcon(p))} ${esc(p.name)}${p.hidden ? ' <span class="pill secret">hidden</span>' : ''}</h2>
    ${what ? `<p class="ask-body">${esc(what)}</p>` : ''}${wardenInfo}
    ${can ? (ctx.near ? `<button type="button" class="btn" data-use>${verb}</button>` : '<p class="muted small-text">Move your token next to it (within 1″) to use it.</p>') : ''}
    ${!ctx.warden && p.kind === 'body' && p.searchedBy?.includes(ctx.me) ? '<p class="muted small-text">You’ve searched this one.</p>' : ''}
    ${ctx.warden ? `<div class="btn-row pp-w"><button type="button" class="btn small secondary" data-edit>Change</button><button type="button" class="btn small secondary" data-move>Move</button>
      ${p.kind === 'door' ? `<button type="button" class="btn small secondary" data-door>${p.open ? 'Shut it' : 'Open it'}</button>` : ''}<button type="button" class="btn small secondary" data-hide>${p.hidden ? 'Show the posse' : 'Hide it'}</button>${p.kind !== 'marker' ? '<button type="button" class="btn small secondary" data-reset title="Locked again, everything back inside">Reset</button>' : ''}<button type="button" class="btn small secondary danger" data-rm>Remove</button></div>` : ''}
    <div class="ask-btns"><button type="button" class="btn secondary" data-no>Close</button></div></div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', key, true); };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  back.addEventListener('click', async (e) => {
    if (e.target === back || e.target.closest('[data-no]')) return close();
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.use !== undefined) {
      b.disabled = true;
      try {
        const r = await api('POST', { action: 'useProp', id: p.id, pc: ctx.me }, '', '/api/battle');
        close(); ctx.refresh?.(r.state);
        const x = r.result;
        if (x.kind === 'chest') toast(x.again ? 'Back to the lock.' : p.kind === 'door' ? 'It’s locked. Pick the lock!' : 'Pick the lock!');
        if (x.kind === 'door') toast(x.open ? 'The door swings open.' : 'You shut the door.');
        if (x.kind === 'body') { await rollPopup(x, `${x.label} · ${x.pool}`); toast(x.found.length ? `You found ${x.found.join(', ')}. It’s in your Inventory.` : 'Nothing you can find.', !x.found.length); }
        if (x.kind === 'clue') await ask(`${x.name}\n\n${x.text || 'Nothing more to it.'}${x.clue ? '\n\n(It’s in the Journal now.)' : ''}`, { ok: 'Got it', cancel: null, danger: false });
      } catch (err) { toast(err.message, true); b.disabled = false; }
      return;
    }
    if (b.dataset.edit !== undefined) { close(); const f = await propDialog(p); if (f) ctx.act({ action: 'editProp', id: p.id, ...f }, 'Saved.'); return; }
    if (b.dataset.move !== undefined) { close(); ctx.onMove(p); return; }
    if (b.dataset.door !== undefined) { close(); ctx.act({ action: 'editProp', id: p.id, open: !p.open }, p.open ? 'Shut.' : 'Opened.'); return; }
    if (b.dataset.hide !== undefined) { close(); ctx.act({ action: 'editProp', id: p.id, hidden: !p.hidden }, p.hidden ? 'The posse can see it.' : 'Hidden.'); return; }
    if (b.dataset.reset !== undefined) { close(); ctx.act({ action: 'editProp', id: p.id, reset: true }, 'Reset: locked again, everything back inside.'); return; }
    if (b.dataset.rm !== undefined) { close(); if (await ask(`Take ${p.name} off the map?`, { ok: 'Remove it' })) ctx.act({ action: 'removeProp', id: p.id }, 'Removed.'); }
  });
  document.addEventListener('keydown', key, true);
  document.body.append(back);
  back.querySelector('[data-use], [data-no]')?.focus();
}
