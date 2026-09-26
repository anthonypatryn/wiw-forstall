// Character portraits: upload, crop a round headshot, view the full picture. Stored by api/image.js.
import { api, toast, esc } from './common.js';

export const portraitUrl = (p, size = 'head') => (p?.portrait ? `/api/image?ns=pc&id=${encodeURIComponent(p.id)}&size=${size}&v=${p.portrait.v}` : null);
// the headshot if they uploaded one, otherwise the trade art
export const faceUrl = (p) => portraitUrl(p) || `/img/tokens/trade-${String(p?.trade || '').toLowerCase()}.webp`;

// tap-to-view: the full picture in a lightbox
export function showImage(src, caption = '') {
  const back = document.createElement('div');
  back.className = 'modal-back lightbox';
  back.innerHTML = `<figure><img src="${esc(src)}" alt="${esc(caption)}">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure><button type="button" class="lb-close" aria-label="Close">✕</button>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', close);
  document.addEventListener('keydown', key);
  document.body.append(back);
}

const readFile = () => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
  input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
  document.body.append(input); input.click();
});
export const loadImg = (file) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
// shrink a whole picture so it fits the store (longest side ≤ max)
export function shrink(img, max = 1200, q = 0.82) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let out = c.toDataURL('image/jpeg', q);
  for (let qq = q - 0.1; out.length > 1_900_000 && qq > 0.35; qq -= 0.1) out = c.toDataURL('image/jpeg', qq);
  return out;
}

// Pick a photo, crop a round headshot (drag to move, slider to zoom), save. Resolves true when saved.
export async function pickPortrait(pc) {
  const file = await readFile();
  if (!file) return false;
  let img;
  try { img = await loadImg(file); } catch { toast('Couldn’t read that picture.', true); return false; }
  const V = 280;
  const base = Math.max(V / img.naturalWidth, V / img.naturalHeight);
  const st = { z: 1, x: 0, y: 0 };
  const size = () => ({ w: img.naturalWidth * base * st.z, h: img.naturalHeight * base * st.z });
  const clamp = () => { const { w, h } = size(); st.x = Math.min(0, Math.max(V - w, st.x)); st.y = Math.min(0, Math.max(V - h, st.y)); };
  { const { w, h } = size(); st.x = (V - w) / 2; st.y = (V - h) / 2; }
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    back.innerHTML = `<div class="modal ask crop-modal" role="dialog" aria-modal="true" aria-label="Crop the headshot">
      <h2>Frame the headshot</h2>
      <p class="ask-body">Drag to move · slide to zoom. The circle is what shows on tokens and sheets; tapping it opens the whole picture.</p>
      <div class="crop-stage"><canvas width="${V}" height="${V}"></canvas><div class="crop-ring"></div></div>
      <label class="crop-zoom"><span>ZOOM</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label>
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>Save portrait</button></div></div>`;
    document.body.append(back);
    const cv = back.querySelector('canvas'), cx = cv.getContext('2d');
    const draw = () => { const { w, h } = size(); cx.clearRect(0, 0, V, V); cx.drawImage(img, st.x, st.y, w, h); };
    draw();
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { px: e.clientX, py: e.clientY, x: st.x, y: st.y }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; st.x = drag.x + e.clientX - drag.px; st.y = drag.y + e.clientY - drag.py; clamp(); draw(); });
    cv.addEventListener('pointerup', () => { drag = null; });
    back.querySelector('input[type=range]').addEventListener('input', (e) => {
      const { w: w0, h: h0 } = size(); const cxp = (V / 2 - st.x) / w0, cyp = (V / 2 - st.y) / h0; // zoom around the middle
      st.z = Number(e.target.value); const { w, h } = size(); st.x = V / 2 - cxp * w; st.y = V / 2 - cyp * h; clamp(); draw();
    });
    const close = (v) => { back.remove(); resolve(v); };
    back.querySelector('[data-no]').addEventListener('click', () => close(false));
    back.querySelector('[data-go]').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Saving…';
      const out = document.createElement('canvas'); out.width = out.height = 256;
      const k = 256 / V, { w, h } = size();
      out.getContext('2d').drawImage(img, st.x * k, st.y * k, w * k, h * k);
      try {
        await api('POST', { action: 'upload', ns: 'pc', id: pc.id, head: out.toDataURL('image/jpeg', 0.86), full: shrink(img) }, '', '/api/image');
        toast('Portrait saved.');
        close(true);
      } catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = 'Save portrait'; }
    });
  });
}
export async function clearPortrait(pc) {
  try { await api('POST', { action: 'clear', ns: 'pc', id: pc.id }, '', '/api/image'); toast('Back to the trade picture.'); return true; }
  catch (e) { toast(e.message, true); return false; }
}
