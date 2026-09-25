// Handouts on the player side: the "The Warden hands you…" pop-up on every page, and the shared pieces the Backpack uses.
import { esc, api, toast, startPolling, savedPin, store } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

export const photoUrl = (h, size = 'head') => (h.img ? `/api/image?ns=handout&id=${encodeURIComponent(h.id)}&size=${size}&v=${h.img}` : null);
const paras = (t) => esc(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

// a note on old paper, or an item card
export function handoutHTML(h, { big = false } = {}) {
  if (h.kind === 'note') {
    return `<div class="note-paper${big ? ' big' : ''}">${h.title && h.title !== 'A note' ? `<div class="note-head">${esc(h.title)}</div>` : ''}<div class="note-text">${paras(h.text) || '<p>…</p>'}</div></div>`;
  }
  const img = photoUrl(h, big ? 'full' : 'head');
  return `<div class="item-card${big ? ' big' : ''}">${img ? `<img src="${esc(img)}" alt="${esc(h.title)}"${big ? ' data-full' : ''}>` : `<div class="item-noimg">${gl('satchel')}</div>`}
    <div class="item-body"><b>${esc(h.title)}</b>${h.text ? `<div class="item-text">${paras(h.text)}</div>` : ''}</div></div>`;
}

// open one handout big, with optional buttons: [{label, cls, onClick}]
export function openHandout(h, { kicker = '', buttons = [] } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back ask-back ho-back';
    back.innerHTML = `<div class="ho-modal" role="dialog" aria-modal="true" aria-label="${esc(h.title)}">
      ${kicker ? `<div class="ho-kicker">${esc(kicker)}</div>` : ''}${handoutHTML(h, { big: true })}
      <div class="ho-btns">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    document.body.append(back);
    const close = (v) => { back.remove(); resolve(v); };
    back.addEventListener('click', async (e) => {
      if (e.target === back) return close(null);
      const full = e.target.closest('[data-full]');
      if (full) { window.open(full.src, '_blank', 'noopener'); return; }
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const spec = buttons[Number(b.dataset.i)];
      const keep = await spec.onClick?.();
      if (!keep) close(spec.value ?? true);
    });
  });
}

// ---------- the pop-up: new handouts for this device's character, on any page ----------
let showing = false;
export function watchHandouts() {
  const me = store.get('wiw.me', null);
  if (!me || savedPin() || location.pathname.startsWith('/backpack')) return;
  startPolling(`player&pc=${encodeURIComponent(me)}`, async (d) => {
    if (showing) return;
    const h = (d.list || []).find((x) => !x.seenByMe);
    if (!h) return;
    showing = true;
    play('chime');
    try { navigator.vibrate?.([80, 40, 80]); } catch {}
    const mine = Array.isArray(h.to) && h.to.includes(me) && !h.shared;
    const seen = () => api('POST', { action: 'seen', id: h.id, pc: me }, '', '/api/handouts').catch(() => {});
    await openHandout(h, {
      kicker: h.sharedBy ? `${h.sharedBy} shows the posse…` : h.to === 'all' ? 'The Warden hands the posse…' : 'The Warden hands you…',
      buttons: [
        ...(mine ? [{ label: `${gl('hat')} Show the posse`, cls: 'secondary', onClick: async () => { await api('POST', { action: 'share', id: h.id, pc: me }, '', '/api/handouts').then(() => toast('Shown to the posse — it’s in the Backpack.')).catch((e) => toast(e.message, true)); } }] : []),
        { label: `${gl('satchel')} Open the Backpack`, cls: 'secondary', onClick: async () => { await seen(); location.href = '/backpack'; return true; } },
        { label: 'Keep it', onClick: () => {} },
      ],
    });
    await seen();
    showing = false;
  }, null, '/api/handouts');
}
