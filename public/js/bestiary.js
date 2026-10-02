// Journal → Bestiary: the monsters the posse has met, filled in as they fight, Scan and trophy them (lib/bestiary.js).
// The Warden sees every entry, marks which ones the posse knows, and can show or hide an entry by hand.
import { esc, api, onChange, toast, dollars } from './common.js';
import { gl } from './glyphs.js';
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Titan'];

export function mountBestiary(el, isWarden) {
  const st = { size: '', q: '', only: 'known' };
  let data = null;
  const refresh = async () => { try { data = await api('GET', null, '?view=bestiary', '/api/combat'); draw(); } catch { /* try again on the next change */ } };
  const range = ([lo, hi] = [0, 0]) => `${dollars(lo)}–${dollars(hi)}`;
  const card = (e, warden) => {
    const tags = [e.fought && 'Fought', e.scanned && 'Scanned', e.decoded && 'Frequency decoded', e.trophied && 'Trophy taken', e.defeated && `Brought down ×${e.defeated}`].filter(Boolean);
    const locked = (what) => `<p class="bs-locked">${gl('lock')} ${what}</p>`;
    return `<article class="bs-card${!e.known ? ' unknown' : ''}">
      <div class="bs-head"><span class="bs-art"><img src="${esc(e.img)}" alt="" loading="lazy" data-bs-img><span class="bs-claw" hidden>${gl('claws')}</span></span>
        <div><h3>${esc(e.name)}</h3><small>${e.size ? `${esc(e.size)} · ` : ''}${esc(e.book)}${e.page ? ` p. ${e.page}` : ''}${e.terrain?.length ? ` · ${esc(e.terrain.join(', '))}` : ''}</small>
        <div class="bs-tags">${tags.map((t) => `<span class="pill info">${esc(t)}</span>`).join('')}${warden && !e.known ? '<span class="pill secret">the posse doesn’t know it</span>' : ''}${warden && e.shown ? '<span class="pill ok">shown to the posse</span>' : ''}${warden && e.hidden ? '<span class="pill secret">hidden</span>' : ''}</div></div></div>
      ${e.health ? `<div class="bs-stats"><span><small>HEALTH</small>${e.health}</span><span><small>DEFENSE</small>${esc(e.defense || '—')}</span><span><small>SPEED</small>${esc(e.speed || '—')}</span></div>
        <ul class="bs-attacks">${(e.attacks || []).map((a) => `<li><b>${esc(a.name)}</b> <small>${esc(a.range)}${a.grit ? ` · ${a.grit} Grit` : ''}</small> — ${esc(a.effect)}</li>`).join('')}</ul>` : locked('Fight one to learn its strength and attacks.')}
      ${e.tolerances !== undefined ? `<p class="bs-line"><b>Tolerances:</b> ${esc(e.tolerances || '—')}</p>${e.features?.length ? `<ul class="bs-feats">${e.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}${e.frenzy?.length ? `<p class="bs-line"><b>Frenzy:</b> ${e.frenzy.map((f) => `${esc(f.name)}${f.health ? ` (${f.health} Health)` : ''}: ${esc(f.text)}`).join(' ')}</p>` : ''}` : locked(e.scanned ? 'Decode its whole frequency on the Forstall Scanner to learn its Tolerances and habits.' : 'Scan it with a Forstall and decode its frequency to learn its Tolerances and habits.')}
      ${e.trophy !== undefined ? `<p class="bs-line"><b>Trophy:</b> ${esc(e.trophy || 'none listed')}${e.value ? ` <small class="muted">(${Object.entries(e.value).map(([c, v]) => `${c} ${range(v || [0, 0])}`).join(' · ')})</small>` : ''}</p>` : locked('Take its trophy to learn what it’s worth.')}
      ${warden ? `<div class="btn-row"><button type="button" class="btn small secondary" data-bs-mode="show" data-bs-name="${esc(e.name)}"${e.shown ? ' disabled' : ''}>Show the posse</button><button type="button" class="btn small secondary" data-bs-mode="hide" data-bs-name="${esc(e.name)}"${e.hidden ? ' disabled' : ''}>Hide it</button>${e.shown || e.hidden ? `<button type="button" class="btn small secondary" data-bs-mode="" data-bs-name="${esc(e.name)}">Back to what they’ve learned</button>` : ''}</div>` : ''}
    </article>`;
  };
  const draw = () => {
    if (!data) return;
    const warden = isWarden();
    if (el.contains(document.activeElement) && document.activeElement.matches('input')) { /* keep typing */ }
    const q = st.q.trim().toLowerCase();
    let list = data.entries.filter((e) => !q || e.name.toLowerCase().includes(q));
    if (warden && st.only === 'known') list = list.filter((e) => e.known);
    // size chips: only the sizes in the book right now, smallest first
    const sizes = SIZES.filter((z) => data.entries.some((e) => e.size === z));
    if (st.size) list = list.filter((e) => e.size === st.size);
    list.sort((a, b) => a.name.localeCompare(b.name));
    const head = `<div class="bs-tools"><input type="search" class="search" placeholder="Find a monster…" value="${esc(st.q)}" data-bs-q aria-label="Find a monster">
      ${sizes.length > 1 ? `<div class="chip-row" role="group" aria-label="Size"><button type="button" class="chip-btn${st.size ? '' : ' on'}" data-bs-size="">Any size</button>${sizes.map((z) => `<button type="button" class="chip-btn${st.size === z ? ' on' : ''}" data-bs-size="${z}">${z}</button>`).join('')}</div>` : ''}
      ${warden ? `<div class="chip-row"><button type="button" class="chip-btn${st.only === 'known' ? ' on' : ''}" data-bs-only="known">What the posse knows</button><button type="button" class="chip-btn${st.only === 'all' ? ' on' : ''}" data-bs-only="all">Every monster</button></div>` : ''}</div>
      ${!warden && data.unknown ? `<p class="muted small-text">${data.unknown} more out there the posse hasn’t met yet.</p>` : ''}`;
    const body = list.length ? `<div class="bs-grid">${list.map((e) => card(e, warden)).join('')}</div>`
      : `<p class="empty-note">${st.size || q ? 'No monsters match that.' : warden && st.only === 'known' ? 'The posse hasn’t met any monsters yet. Entries fill in when a fight starts, when they Scan one and when they take a trophy.' : 'Nothing yet. Fight, Scan or trophy a monster and it goes in the book.'}</p>`;
    const focus = document.activeElement?.matches?.('[data-bs-q]');
    el.innerHTML = head + body;
    el.querySelectorAll('[data-bs-img]').forEach((img) => img.addEventListener('error', () => { img.hidden = true; img.nextElementSibling.hidden = false; }, { once: true }));
    if (focus) { const i = el.querySelector('[data-bs-q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  };
  el.addEventListener('input', (e) => { if (e.target.matches('[data-bs-q]')) { st.q = e.target.value; draw(); } });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.bsSize !== undefined) { st.size = b.dataset.bsSize; draw(); return; }
    if (b.dataset.bsOnly) { st.only = b.dataset.bsOnly; draw(); return; }
    if (b.dataset.bsName) {
      try { await api('POST', { action: 'bestiary', name: b.dataset.bsName, mode: b.dataset.bsMode }, '', '/api/combat'); toast(b.dataset.bsMode === 'show' ? 'The posse can read the whole entry.' : b.dataset.bsMode === 'hide' ? 'Hidden from the posse.' : 'Back to what they’ve learned.'); refresh(); }
      catch (err) { toast(err.message, true); }
    }
  });
  onChange(['combat', 'state'], refresh);
  refresh();
  return { refresh };
}
