// Boot Hill (World ▾): a headstone for each fallen character. The death (how, when, best moments) is recorded by the
// server when they fall (lib/combat.js bury); the player whose character it was, or the Warden, writes the epitaph.
import { $, esc, api, mountNav, onChange, askText, toast, me, savedPin } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';
import { faceUrl } from './portrait.js';

mountTableLog();
mountNav('/boothill');
let posse = [];
const date = (t) => (t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
function draw() {
  const dead = posse.filter((p) => p.dead).sort((a, b) => (b.death?.at || 0) - (a.death?.at || 0));
  $('#bh-yard').innerHTML = dead.length ? dead.map((p) => {
    const d = p.death || {}, mine = savedPin() || me() === p.id;
    return `<article class="bh-stone">
      <img class="bh-face" src="${esc(faceUrl(p))}" alt="">
      <div class="bh-rip">HERE LIES</div>
      <h3>${esc(p.name)}</h3>
      <div class="bh-trade">The ${esc(p.trade)}${d.at ? ` · died ${esc(date(d.at))}` : ''}</div>
      <p class="bh-how">${esc(d.how || 'Fell on the trail')}</p>
      ${d.epitaph ? `<p class="bh-epitaph">“${esc(d.epitaph)}”</p>` : mine ? '<p class="bh-epitaph muted">No epitaph yet.</p>' : ''}
      ${d.moments?.length ? `<details class="bh-moments"><summary>${gl('star')} Remembered for</summary><ul>${d.moments.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></details>` : ''}
      <div class="btn-row">${mine ? `<button type="button" class="btn small secondary" data-bh-epitaph="${esc(p.id)}">${gl('scroll')} ${d.epitaph ? 'Change' : 'Write'} the epitaph</button><button type="button" class="btn small secondary" data-bh-how="${esc(p.id)}">How they went down</button>` : ''}
        <a class="btn small secondary" href="/posse#${esc(p.id)}">Their sheet</a></div>
    </article>`;
  }).join('') : '<p class="empty-note">Nobody’s buried here yet. Long may it stay that way.</p>';
}
async function refresh() {
  try { posse = (await api('GET', null, '', '/api/combat')).posse || []; draw(); } catch (err) { $('#bh-yard').innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-bh-epitaph], [data-bh-how]'); if (!b) return;
  const p = posse.find((x) => x.id === (b.dataset.bhEpitaph || b.dataset.bhHow)); if (!p) return;
  const how = b.dataset.bhHow !== undefined;
  const v = await askText(how ? `How did ${p.name} go down?` : `${p.name}’s epitaph:`, how ? p.death?.how || '' : p.death?.epitaph || '');
  if (v === null) return;
  try {
    await api('POST', { action: 'pc', id: p.id, op: 'epitaph', ...(how ? { how: v } : { epitaph: v }) }, '', '/api/combat');
    toast('Carved in stone.'); refresh();
  } catch (err) { toast(err.message, true); }
});
refresh();
onChange(['combat'], refresh);
