// Encounter builder (Run the Game → Start Something): monsters and people from the books, filtered by terrain and book,
// rated for this posse by its Prestige tier, and added to the fight with their tokens on the Battle Map.
// The rating mirrors lib/encounters.js (rate, TIER_FAIR, personSize); terrain tags come from the server's catalog.
import { esc, api, toast } from './common.js';
import { gl } from './glyphs.js';

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Titan'];
const TIER_FAIR = { Tenderfoot: ['Tiny', 'Small'], Cowpoke: ['Small', 'Medium'], Trailblazer: ['Medium', 'Large'], Roughrider: ['Large', 'Huge'], Wrangler: ['Huge'], Legend: ['Huge', 'Titan'] };
const RATINGS = ['Easy', 'Fair', 'Hard', 'Deadly'];
const PILL = { Easy: 'ok', Fair: 'info', Hard: 'wait', Deadly: 'hot' };
const TERRAINS = ['Desert', 'Forest', 'Glaciers', 'Bayou', 'Lakeside', 'Pacific Coast', 'Mountains', 'Plains', 'Subterranean', 'Volcanoes', 'Towns'];
const personSize = (h) => (h <= 7 ? 'Small' : h <= 11 ? 'Medium' : 'Large');
function rate(size, tier, count, posse) {
  const fair = TIER_FAIR[tier].map((s) => SIZES.indexOf(s)), i = SIZES.indexOf(size);
  let step = i < fair[0] ? -1 : i > fair[fair.length - 1] ? i - fair[fair.length - 1] : 0;
  if (count > Math.max(1, Math.ceil(posse / 2))) step += 1;
  if (count > posse + 1) step += 1;
  return RATINGS[Math.max(0, Math.min(3, step + 1))];
}

export function mountEncounters(el, getCombat) {
  const st = { kind: 'monsters', terrain: '', book: '', count: 1, show: 'fair', busy: false };
  let tiers = [];
  api('GET', null, '?view=meta', '/api/combat').then((m) => { tiers = m.tiers || []; draw(); }).catch(() => {});
  const posseTier = (c) => {
    const pcs = (c?.posse || []).filter((p) => !p.dead);
    const avg = pcs.length ? pcs.reduce((s, p) => s + (Number(p.prestige?.total) || 0), 0) / pcs.length : 0;
    const t = [...tiers].reverse().find((x) => avg >= x.prestige) || { name: 'Tenderfoot' };
    return { name: TIER_FAIR[t.name] ? t.name : 'Tenderfoot', avg: Math.round(avg), n: pcs.length || 1 };
  };
  const draw = () => {
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    const c = getCombat();
    if (!c?.catalog) { el.innerHTML = '<p class="muted">Loading…</p>'; return; }
    const tier = posseTier(c);
    const people = st.kind === 'people';
    let list = people
      ? c.npcCatalog.map((n) => ({ key: n.key, name: n.name, size: personSize(n.health), health: n.health, book: n.book, page: n.page, note: n.faction || 'no faction', terrain: TERRAINS }))
      : c.catalog.map((m) => ({ key: m.name, name: m.name, size: m.size, health: m.health, book: m.book, page: m.page, note: (m.terrain || []).join(', '), terrain: m.terrain || [] }));
    list = list.filter((x) => (!st.terrain || x.terrain.includes(st.terrain)) && (!st.book || x.book === st.book))
      .map((x) => ({ ...x, rating: rate(x.size, tier.name, st.count, tier.n) }));
    if (st.show !== 'all') list = list.filter((x) => (st.show === 'fair' ? ['Easy', 'Fair'].includes(x.rating) : ['Hard', 'Deadly'].includes(x.rating)));
    list.sort((a, b) => RATINGS.indexOf(a.rating) - RATINGS.indexOf(b.rating) || SIZES.indexOf(a.size) - SIZES.indexOf(b.size) || a.name.localeCompare(b.name));
    const chips = (key, opts) => `<div class="chip-row">${opts.map(([v, l]) => `<button type="button" class="chip-btn${st[key] === v ? ' on' : ''}" data-en-${key}="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
    el.innerHTML = `<p class="muted sess-note">This posse fights like <b>${esc(tier.name)}s</b> (${tier.n} character${tier.n === 1 ? '' : 's'}, about ${tier.avg} Prestige each). Ratings go by size for that tier; a crowd is a step tougher. Terrain is the kit’s own tagging from the book descriptions.</p>
      <div class="field-step"><span>WHAT</span>${chips('kind', [['monsters', 'Monsters'], ['people', 'People']])}</div>
      ${people ? '' : `<div class="field-step"><span>WHERE</span>${chips('terrain', [['', 'Anywhere'], ...TERRAINS.map((t) => [t, t])])}</div>`}
      <div class="field-step"><span>BOOK</span>${chips('book', [['', 'All'], ['Guidebook', 'Guidebook'], ['East Portal', 'East Portal'], ['Iron Road', 'Iron Road']])}</div>
      <div class="field-step"><span>HOW MANY</span>${chips('count', [1, 2, 3, 4, 6].map((n) => [n, String(n)]))}</div>
      <div class="field-step"><span>SHOW</span>${chips('show', [['fair', 'Easy & Fair'], ['hard', 'Hard & Deadly'], ['all', 'Everything']])}</div>
      <div class="en-list">${list.map((x) => `<div class="item-row"><div class="item-who"><b>${esc(x.name)}</b> <span class="pill ${PILL[x.rating]}">${x.rating}</span>
          <small class="muted">${esc(x.size)} · ${x.health} Health · ${esc(x.book)}${x.page ? ` p. ${x.page}` : ''}${x.note ? ` · ${esc(x.note)}` : ''}</small></div>
          <div class="item-nums"><button type="button" class="btn small" data-en-add="${esc(x.key)}"${st.busy ? ' disabled' : ''}>${gl('skull')} Add ${st.count > 1 ? st.count : ''}</button></div></div>`).join('') || '<p class="muted">Nothing matches. Try another place, book or rating.</p>'}</div>
      ${list.length ? `<button type="button" class="btn small secondary" data-en-random>${gl('die')} Surprise me (one of these)</button>` : ''}`;
  };
  const add = async (key) => {
    const c = getCombat(), people = st.kind === 'people';
    const profile = people ? key : key, name = people ? c.npcCatalog.find((n) => n.key === key)?.name : key;
    st.busy = true; draw();
    try {
      const before = new Set((c.enemies || []).map((e) => e.id));
      const r = await api('POST', { action: 'addEnemy', profile, count: st.count }, '', '/api/combat');
      const added = (r.state?.enemies || []).filter((e) => !before.has(e.id));
      for (const e of added) await api('POST', { action: 'addToken', kind: 'enemy', ref: e.id, name: e.name }, '', '/api/battle'); // on the Battle Map too
      toast(`${added.length > 1 ? `${added.length} × ${name}` : name} added to the fight and the Battle Map.`);
    } catch (err) { toast(err.message, true); }
    st.busy = false; draw();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.enKind !== undefined) { st.kind = d.enKind; if (st.kind === 'people') st.terrain = ''; draw(); return; }
    if (d.enTerrain !== undefined) { st.terrain = d.enTerrain; draw(); return; }
    if (d.enBook !== undefined) { st.book = d.enBook; draw(); return; }
    if (d.enCount !== undefined) { st.count = Number(d.enCount); draw(); return; }
    if (d.enShow !== undefined) { st.show = d.enShow; draw(); return; }
    if (d.enAdd) { add(d.enAdd); return; }
    if (d.enRandom !== undefined) { const all = [...el.querySelectorAll('[data-en-add]')]; if (all.length) add(all[Math.floor(Math.random() * all.length)].dataset.enAdd); }
  });
  draw();
  return { draw };
}
