// The posse sheet's side nav (like Run the Game's): the posse's characters at the top (tap to switch; yours starred),
// then this sheet's sections as views, one at a time, or the whole sheet. A sheet still being made always shows whole
// (the checklist points all over it), and printing always prints the whole sheet.
import { esc } from './common.js';
import { gl } from './glyphs.js';

export const SHEET_VIEWS = [
  ['fight', 'Fight', 'revolver', ['fight', 'quickref', 'health', 'statuses', 'weapons']],
  ['skills', 'Skills & Abilities', 'star', ['skills', 'abilities', 'talents']],
  ['gear', 'Gear & Inventory', 'satchel', ['gear', 'inventory', 'forstall']],
  ['rides', 'Horse & Mech', 'horseshoe', ['horse', 'mech']],
  ['story', 'Story & Reputation', 'scroll', ['disposition', 'appearance', 'reputation', 'history']],
  ['prestige', 'Prestige & Titles', 'trophy', ['prestige', 'achievements']],
];
const ALWAYS = new Set(['starter']); // the creation checklist stays in every view
const KEY = 'wiw.sheetView';
const stored = () => { try { return localStorage.getItem(KEY) || 'fight'; } catch { return 'fight'; } };
let current = null;

export const viewOf = (section) => SHEET_VIEWS.find(([, , , secs]) => secs.includes(section))?.[0] || 'all';
export const currentView = () => current;

// show one view's sections (or all), and tidy the pages around them
export function applySheetView(view, v, { remember = true } = {}) {
  if (!SHEET_VIEWS.some(([k]) => k === v) && v !== 'all') v = 'fight';
  current = v;
  if (remember) { try { localStorage.setItem(KEY, v); } catch {} }
  const secs = v === 'all' ? null : new Set(SHEET_VIEWS.find(([k]) => k === v)[3]);
  view.dataset.sv = v;
  view.querySelectorAll('[id^="sec-"]').forEach((el) => {
    const id = el.id.slice(4);
    el.classList.toggle('sv-off', !!secs && !secs.has(id) && !ALWAYS.has(id));
  });
  view.querySelectorAll('.sheet').forEach((pg) => pg.classList.toggle('sv-off', !!secs && ![...pg.children].some((c) => !c.classList.contains('sv-off'))));
  document.querySelectorAll('#sheet-nav [data-sv]').forEach((a) => { if (a.dataset.sv === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}

export function renderSheetNav(nav, p, posse, myId, { making = false } = {}) {
  const others = posse.filter((x) => !x.dead || x.id === p.id);
  const star = (x) => (x.id === myId ? `${gl('star')} ` : '');
  nav.innerHTML = `<div class="sv-h">THE POSSE</div>
    <div class="sv-posse">${others.map((x) => `<a href="#${esc(x.id)}"${x.id === p.id ? ' aria-current="page"' : ''}>${star(x)}<span>${esc(x.name)}</span><small>${esc(x.trade || '')}</small></a>`).join('')}
      <a href="#" class="sv-all-chars">All characters</a></div>
    <label class="sv-posse-sel"><select data-sv-pc aria-label="Switch character">${others.map((x) => `<option value="${esc(x.id)}"${x.id === p.id ? ' selected' : ''}>${x.id === myId ? '★ ' : ''}${esc(x.name)}</option>`).join('')}</select></label>
    <div class="sv-h">THIS SHEET</div>
    ${making ? '<p class="sv-note">Being made: the whole sheet shows until it’s saved.</p>' : `<div class="sv-views">${SHEET_VIEWS.map(([k, label, icon]) => `<a href="#${esc(p.id)}" data-sv="${k}"${current === k ? ' aria-current="page"' : ''}>${gl(icon)}<span>${esc(label)}</span></a>`).join('')}
      <a href="#${esc(p.id)}" data-sv="all" class="sv-whole"${current === 'all' ? ' aria-current="page"' : ''}><span>Whole sheet</span></a></div>`}`;
}

// posse.js calls this once: clicks in the nav, and printing the whole sheet
export function wireSheetNav(nav, view, onView) {
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('[data-sv]'); if (!a) return;
    e.preventDefault();
    applySheetView(view, a.dataset.sv);
    onView?.();
    window.scrollTo({ top: 0 });
  });
  nav.addEventListener('change', (e) => { if (e.target.matches('[data-sv-pc]')) location.hash = e.target.value; });
  let before = null;
  window.addEventListener('beforeprint', () => { before = current; applySheetView(view, 'all', { remember: false }); onView?.(); });
  window.addEventListener('afterprint', () => { if (before) applySheetView(view, before, { remember: false }); onView?.(); before = null; });
}

export const startView = (making) => (making ? 'all' : stored());
