// Searching (house loot table, lib/loot.js): a player picks what they search (a downed enemy, a wagon or mech,
// rubble, a lair) and rolls Intuition. What they find goes to the Warden to OK before it reaches the sheet;
// searchHud() tells the player once it's settled.
import { esc, api, toast, savedPin, store, me, rollPopup } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const KINDS = [['wagon', 'A wagon or mech'], ['rubble', 'Rubble or a building'], ['lair', 'A monster’s lair']];

export async function openSearch() {
  if (!me()) { toast('Tap “This is me” on your character sheet first.', true); return; }
  let combat;
  try { combat = await api('GET', null, '', '/api/combat'); } catch (err) { toast(err.message, true); return; }
  const downed = (combat.enemies || []).filter((e) => e.defeated);
  const st = { pick: downed[0] ? `e:${downed[0].id}` : 'wagon', what: '' };
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const draw = () => {
    back.innerHTML = `<div class="modal ask" role="dialog" aria-modal="true" aria-label="Search">
      <div class="ho-kicker">${gl('lasso')} SEARCH</div><h2>What are you searching?</h2>
      ${downed.length ? `<div class="field-step"><span>A DOWNED ENEMY</span>${downed.map((e) => `<button type="button" class="chip-btn${st.pick === `e:${e.id}` ? ' on' : ''}" data-pick="e:${esc(e.id)}">${esc(e.name)}</button>`).join('')}</div>` : ''}
      <div class="field-step"><span>SOMEWHERE ELSE</span>${KINDS.map(([k, label]) => `<button type="button" class="chip-btn${st.pick === k ? ' on' : ''}" data-pick="${k}">${label}</button>`).join('')}</div>
      ${st.pick.startsWith('e:') ? '' : `<div class="field-step"><span>WHAT IS IT? (optional)</span><input data-what maxlength="60" value="${esc(st.what)}" placeholder="e.g. the overturned stagecoach"></div>`}
      <p class="ask-body">You roll Intuition. The more Hits, the better the find; the Warden OKs it before it goes in your Inventory.</p>
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>${gl('die')} Roll Intuition</button></div></div>`;
  };
  draw();
  document.body.append(back);
  back.addEventListener('input', (e) => { if (e.target.dataset.what !== undefined) st.what = e.target.value; });
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) { if (e.target === back) back.remove(); return; }
    if (b.dataset.pick) { st.pick = b.dataset.pick; draw(); return; }
    if (b.dataset.no !== undefined) { back.remove(); return; }
    if (b.dataset.go === undefined) return;
    b.disabled = true;
    const body = st.pick.startsWith('e:') ? { enemy: st.pick.slice(2) } : { kind: st.pick, what: st.what };
    try {
      const r = (await api('POST', { action: 'pc', id: me(), op: 'search', ...body }, '', '/api/combat')).result;
      back.remove();
      rollPopup({ dice: r.dice, hits: r.hits }, 'Search · Intuition');
      toast(r.hits ? 'Sent to the Warden: you’ll hear what you found.' : 'Nothing worth taking.', !r.hits);
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });
}

// the player hears once how each of their searches turned out
export function searchHud(h) {
  if (savedPin() || !me()) return;
  const seen = new Set(store.get('wiw.searchSeen', []));
  for (const s of (h.searches || []).filter((x) => x.pc === me() && (x.status === 'given' || x.status === 'denied') && !seen.has(x.id))) {
    seen.add(s.id);
    store.set('wiw.searchSeen', [...seen].slice(-40));
    if (s.status === 'given') { play('success'); toast(`You found ${s.found}. It’s in your Inventory.`); }
    else toast(`The Warden says the search of ${s.what} turned up nothing${s.note ? `: ${s.note}` : '.'}`, true);
  }
}

// ---------- Salvage (Run the Game → Rewards, the Warden's only): Guidebook p. 93 ----------
const SIZES = [['Small or simple', [1, 2]], ['Medium or complex', [3, 4]], ['Large or complex', [5, 6]]];
const DIFF = [['Very Easy', 1], ['Easy', 2], ['Medium', 3], ['Difficult', 4], ['Very Difficult', 5]];
export function mountSalvage(el, getCombat) {
  const st = { pc: '', dice: 1, target: 2, what: '' };
  const draw = () => {
    if (el.contains(document.activeElement) && ['SELECT', 'INPUT'].includes(document.activeElement.tagName)) return;
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    if (!posse.some((p) => p.id === st.pc)) st.pc = posse[0]?.id || '';
    const pc = posse.find((p) => p.id === st.pc), perp = (pc?.abilities || []).includes('Perpetual Salvager');
    el.innerHTML = posse.length ? `
      <label class="field-step"><span>WHO</span><select data-sv-pc aria-label="Who salvages">${posse.map((p) => `<option value="${esc(p.id)}"${p.id === st.pc ? ' selected' : ''}>${esc(p.name)}${(p.abilities || []).includes('Perpetual Salvager') ? ' (Perpetual Salvager)' : ''}</option>`).join('')}</select></label>
      <label class="field-step"><span>WHAT</span><input data-sv-what maxlength="60" value="${esc(st.what)}" placeholder="e.g. the wrecked mech"></label>
      ${SIZES.map(([label, ns]) => `<div class="field-step"><span>${label.toUpperCase()}</span><div class="chip-row">${ns.map((n) => `<button type="button" class="chip-btn${st.dice === n ? ' on' : ''}" data-sv-dice="${n}">${n}B</button>`).join('')}</div></div>`).join('')}
      <div class="field-step"><span>INTUITION DIFFICULTY</span><div class="chip-row">${DIFF.map(([label, n]) => `<button type="button" class="chip-btn${st.target === n ? ' on' : ''}" data-sv-target="${n}">${label} (${n})</button>`).join('')}</div></div>
      <p class="muted sess-note">${esc(pc?.name || '')} rolls Intuition; if it makes it, you roll ${st.dice}B and each Hit is 1 Scrap${perp ? ', plus 1G for Perpetual Salvager' : ''}. Whatever’s salvaged is ruined.</p>
      <button type="button" class="btn small" data-sv-go>${gl('die')} Salvage it</button>`
      : '<p class="muted">No characters yet.</p>';
  };
  el.addEventListener('change', (e) => { if (e.target.dataset.svPc !== undefined) { st.pc = e.target.value; e.target.blur(); draw(); } });
  el.addEventListener('input', (e) => { if (e.target.dataset.svWhat !== undefined) st.what = e.target.value; });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.svDice) { st.dice = Number(b.dataset.svDice); draw(); return; }
    if (b.dataset.svTarget) { st.target = Number(b.dataset.svTarget); draw(); return; }
    if (b.dataset.svGo === undefined) return;
    b.disabled = true;
    try {
      const r = (await api('POST', { action: 'salvage', pc: st.pc, dice: st.dice, target: st.target, what: st.what }, '', '/api/combat')).result;
      if (r.ok) { play('success'); toast(`${r.scrap} Scrap salvaged. It’s on their sheet and in the Table Log.`); st.what = ''; }
      else toast(`Missed the Intuition roll (${r.hits} Hits): nothing salvaged.`, true);
    } catch (err) { toast(err.message, true); }
    draw();
  });
  draw();
  return { draw };
}
