// Styled replacements for the browser's own pop-up UI (STYLEGUIDE.md → Controls).
// • <select>: stays a real select (so page code, layout and `change` handlers keep working) but its list opens as a styled pop-up.
// • <input list="…"> (datalist suggestions): the same styled pop-up, filtered as you type.
// • title="" tooltips: one styled tooltip instead of the browser's.
// Loaded once by common.js; everything is event delegation, so content drawn later just works.

let pop = null, popFor = null, active = -1, items = [];
// its own copy of esc(): common.js imports this file, so importing back from common.js would be a circular import
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let watchdog = null; // while a list is open: drop it if its field is redrawn away
function close() {
  pop?.remove(); pop = null; popFor = null; items = []; active = -1;
  clearInterval(watchdog); watchdog = null;
}
function place(el) {
  const r = el.getBoundingClientRect(), vh = window.innerHeight;
  const below = vh - r.bottom, up = below < 220 && r.top > below;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8))}px`;
  pop.style.minWidth = `${Math.max(r.width, 180)}px`;
  pop.style.maxHeight = `${Math.max(160, Math.min(340, (up ? r.top : below) - 12))}px`;
  if (up) { pop.style.top = ''; pop.style.bottom = `${vh - r.top + 4}px`; } else { pop.style.bottom = ''; pop.style.top = `${r.bottom + 4}px`; }
}
function highlight(i) {
  active = Math.max(0, Math.min(items.length - 1, i));
  items.forEach((b, k) => b.classList.toggle('hi', k === active));
  items[active]?.scrollIntoView({ block: 'nearest' });
}
// entries: [{ value, label, group?, disabled?, selected? }]
function openList(el, entries, pick, { search = false } = {}) {
  close();
  popFor = el;
  watchdog =   pop = document.createElement('div');
  pop.className = 'sel-pop';
  pop.setAttribute('role', 'listbox');
  const draw = (q = '') => {
    const t = q.trim().toLowerCase();
    let group = null;
    const html = [];
    for (const e of entries) {
      if (t && !e.label.toLowerCase().includes(t)) continue;
      if (e.group && e.group !== group) { group = e.group; html.push(`<div class="sel-group">${esc(group)}</div>`); }
      html.push(`<button type="button" role="option" class="sel-opt${e.selected ? ' on' : ''}" data-v="${esc(e.value)}"${e.disabled ? ' disabled' : ''}>${esc(e.label) || '&nbsp;'}</button>`);
    }
    pop.querySelector('.sel-items').innerHTML = html.join('') || '<div class="sel-none">No matches</div>';
    items = [...pop.querySelectorAll('.sel-opt:not([disabled])')];
    const sel = items.findIndex((b) => b.classList.contains('on'));
    highlight(sel >= 0 ? sel : 0);
  };
  pop.innerHTML = `${search ? '<input class="sel-search" placeholder="Search…" aria-label="Search">' : ''}<div class="sel-items"></div>`;
  document.body.append(pop);
  place(el);
  draw();
  pop.addEventListener('mousedown', (e) => { if (!e.target.closest('.sel-search')) e.preventDefault(); }); // keep focus on the field
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('.sel-opt');
    if (!b || b.disabled) return;
    pick(b.dataset.v); close();
  });
  const s = pop.querySelector('.sel-search');
  if (s) { s.addEventListener('input', () => draw(s.value)); s.addEventListener('keydown', keys); setTimeout(() => s.focus(), 0); }
  return { draw };
}
function keys(e) {
  if (!pop) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
  else if (e.key === 'Enter' && items[active]) { e.preventDefault(); items[active].click(); }
  else if (e.key === 'Escape' || e.key === 'Tab') { const f = popFor; close(); if (e.key === 'Escape') f?.focus?.(); }
}

// ---------- <select> ----------
function openSelect(sel) {
  if (sel.disabled || sel.multiple) return;
  const entries = [...sel.options].map((o) => ({ value: String(o.index), label: o.textContent, group: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : null, disabled: o.disabled, selected: o.selected }));
  openList(sel, entries, (i) => {
    const before = sel.selectedIndex;
    sel.selectedIndex = Number(i);
    sel.focus({ preventScroll: true });
    if (sel.selectedIndex !== before) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }, { search: sel.options.length > 12 });
}
document.addEventListener('mousedown', (e) => {
  const sel = e.target.closest?.('select');
  if (sel && !sel.multiple && !sel.hasAttribute('data-native') && e.button === 0) {
    e.preventDefault();
    if (popFor === sel) { close(); return; }
    sel.focus({ preventScroll: true }); // pages skip redraws while a select has focus
    openSelect(sel);
    return;
  }
  if (pop && !pop.contains(e.target) && e.target !== popFor) close();
}, true);
// phones: the browser's picker opens on touch/click, so stop it there too
const isOurs = (sel) => sel && !sel.multiple && !sel.hasAttribute('data-native');
document.addEventListener('touchstart', (e) => {
  const sel = e.target.closest?.('select');
  if (!isOurs(sel)) return;
  e.preventDefault();
  if (popFor === sel) { close(); return; }
  sel.focus({ preventScroll: true }); openSelect(sel);
}, { capture: true, passive: false });
document.addEventListener('click', (e) => { if (isOurs(e.target.closest?.('select'))) e.preventDefault(); }, true);
document.addEventListener('keydown', (e) => {
  if (pop) { keys(e); return; }
  const sel = e.target;
  if (sel?.tagName === 'SELECT' && !sel.multiple && (e.key === 'Enter' || e.key === ' ' || (e.altKey && e.key === 'ArrowDown'))) { e.preventDefault(); openSelect(sel); }
}, true);

// ---------- datalist suggestions (<input list>) ----------
function suggest(input) {
  const dl = document.getElementById(input.dataset.list || input.getAttribute('list'));
  if (!dl) return;
  if (input.getAttribute('list')) { input.dataset.list = input.getAttribute('list'); input.removeAttribute('list'); } // no native drop-down
  const q = input.value.trim().toLowerCase();
  const entries = [...dl.options].map((o) => ({ value: o.value, label: o.label && o.label !== o.value ? `${o.value} — ${o.label}` : o.value }))
    .filter((e) => !q || e.label.toLowerCase().includes(q)).slice(0, 60);
  if (!entries.length) { if (popFor === input) close(); return; }
  openList(input, entries, (v) => {
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
document.addEventListener('focusin', (e) => { const i = e.target; if (i.tagName === 'INPUT' && (i.getAttribute('list') || i.dataset.list)) suggest(i); });
document.addEventListener('input', (e) => { const i = e.target; if (i.tagName === 'INPUT' && (i.getAttribute('list') || i.dataset.list) && document.activeElement === i) suggest(i); });
document.addEventListener('focusout', (e) => { if (popFor === e.target && e.target.tagName === 'INPUT') setTimeout(() => { if (popFor === e.target && document.activeElement !== e.target && !pop?.contains(document.activeElement)) close(); }, 150); });

// keep the pop-up with its field; drop it if the field is redrawn away
window.addEventListener('resize', () => { if (pop && popFor) place(popFor); });
document.addEventListener('scroll', (e) => { if (pop && popFor && !pop.contains(e.target)) { if (!popFor.isConnected) close(); else place(popFor); } }, true);
setInterval(() => { if (pop && popFor && !popFor.isConnected) close(); }, 400);

// ---------- tooltips (title="") ----------
let tip = null, tipFor = null;
function hideTip() { tip?.remove(); tip = null; if (tipFor?.dataset.tip && !tipFor.title) tipFor.title = tipFor.dataset.tip; tipFor = null; }
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest?.('[title]');
  if (!el || el === tipFor || !el.title.trim()) return;
  hideTip();
  tipFor = el; el.dataset.tip = el.title; el.title = ''; // stop the browser's own tooltip
  tip = document.createElement('div');
  tip.className = 'tip-pop'; tip.textContent = el.dataset.tip;
  document.body.append(tip);
  const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(6, Math.min(window.innerWidth - t.width - 6, r.left + r.width / 2 - t.width / 2))}px`;
  tip.style.top = `${r.top - t.height - 6 < 4 ? r.bottom + 6 : r.top - t.height - 6}px`;
});
document.addEventListener('mouseout', (e) => { if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('mousedown', hideTip, true);
window.addEventListener('scroll', hideTip, true);
