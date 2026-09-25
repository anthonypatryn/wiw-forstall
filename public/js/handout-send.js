// Warden: hand an item (photo + description) or a note (handwritten on old paper) to one, some or all of the posse.
import { esc, api, toast } from './common.js';
import { gl } from './glyphs.js';
import { shrink } from './portrait.js';

export function mountHandout(el, getCombat) {
  const st = { kind: 'item', who: null, title: '', text: '', photo: null }; // who: null = everyone
  const loadImg = (file) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  function draw() {
    if (el.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    el.innerHTML = `
      <div class="field-step"><span>WHAT</span>
        <button type="button" class="chip-btn${st.kind === 'item' ? ' on' : ''}" data-ho-kind="item">${gl('satchel')} Item<small>photo + description</small></button>
        <button type="button" class="chip-btn${st.kind === 'note' ? ' on' : ''}" data-ho-kind="note">${gl('scroll')} Note<small>handwritten</small></button></div>
      <div class="field-step"><span>TO</span><button type="button" class="chip-btn${st.who ? '' : ' on'}" data-ho-all>Everyone</button>
        ${posse.map((p) => `<button type="button" class="chip-btn${st.who?.has(p.id) ? ' on' : ''}" data-ho-who="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      <div class="field-step"><span>${st.kind === 'note' ? 'HEADING (optional)' : 'NAME'}</span><input data-ho="title" maxlength="80" value="${esc(st.title)}" placeholder="${st.kind === 'note' ? 'e.g. A letter from Pa' : 'e.g. Rusted skeleton key'}"></div>
      <div class="field-step"><span>${st.kind === 'note' ? 'THE NOTE' : 'DESCRIPTION'}</span><textarea data-ho="text" rows="${st.kind === 'note' ? 5 : 3}" maxlength="4000" placeholder="${st.kind === 'note' ? 'Write it the way it’s written…' : 'What it looks like, what it does, where it was found'}">${esc(st.text)}</textarea></div>
      ${st.kind === 'item' ? `<div class="ho-photo">${st.photo ? `<img src="${st.photo.head}" alt="">` : ''}<button type="button" class="btn small secondary" data-ho-photo>${gl('camera')} ${st.photo ? 'Change photo' : 'Add a photo'}</button>${st.photo ? '<button type="button" class="btn small secondary" data-ho-nophoto>Remove</button>' : ''}</div>` : ''}
      <div class="btn-row"><button type="button" class="btn" data-ho-send>${gl('hat')} Hand it over</button><a class="btn small secondary" href="/backpack">Open the Backpack</a></div>`;
  }
  el.addEventListener('input', (e) => { const k = e.target.dataset.ho; if (k) st[k] = e.target.value; });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.hoKind) { st.kind = b.dataset.hoKind; draw(); return; }
    if (b.dataset.hoAll !== undefined) { st.who = null; draw(); return; }
    if (b.dataset.hoWho) { st.who ||= new Set(); if (st.who.has(b.dataset.hoWho)) st.who.delete(b.dataset.hoWho); else st.who.add(b.dataset.hoWho); if (!st.who.size) st.who = null; draw(); return; }
    if (b.dataset.hoNophoto !== undefined) { st.photo = null; draw(); return; }
    if (b.dataset.hoPhoto !== undefined) {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
      input.addEventListener('change', async () => {
        const f = input.files[0]; input.remove(); if (!f) return;
        try { const img = await loadImg(f); st.photo = { head: shrink(img, 480, 0.84), full: shrink(img) }; draw(); } catch { toast('Couldn’t read that picture.', true); }
      });
      document.body.append(input); input.click();
      return;
    }
    if (b.dataset.hoSend !== undefined) {
      b.disabled = true;
      try {
        const res = await api('POST', { action: 'send', kind: st.kind, title: st.title, text: st.text, to: st.who ? [...st.who] : 'all' }, '', '/api/handouts');
        if (st.photo && st.kind === 'item') await api('POST', { action: 'upload', ns: 'handout', id: res.result.id, head: st.photo.head, full: st.photo.full }, '', '/api/image');
        toast(`Handed over${st.who ? '' : ' to the whole posse'} — it pops up on their phones.`);
        Object.assign(st, { title: '', text: '', photo: null });
      } catch (err) { toast(err.message, true); }
      b.disabled = false; draw();
    }
  });
  return { draw };
}
