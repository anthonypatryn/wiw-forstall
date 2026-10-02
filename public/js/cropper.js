// Crop an image before it's uploaded (the Battle Map's own maps). cropImage(img) opens a dialog over everything:
// the picture with a box to drag (move it, or pull a corner), shape chips, and Use this / Cancel. It resolves to
// {sx, sy, sw, sh} in the image's own pixels, or null when cancelled. Pointer events, so fingers work too.
import { esc } from './common.js';

// The built-in battle maps are 36 × 25 inches (3600 × 2503), so that shape fits the table best.
const SHAPES = [['map', 'Battle map shape', 3600 / 2503], ['free', 'Free crop', 0], ['square', 'Square', 1], ['whole', 'Whole picture', -1]];
const MIN = 40; // smallest box, in screen pixels

export function cropImage(img, { title = 'CROP THE MAP' } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back crop-back';
    back.innerHTML = `<div class="modal crop-modal" role="dialog" aria-modal="true" aria-label="Crop the picture">
      <div class="crop-h"><b>${esc(title)}</b><small>Drag the box to move it, or a corner to resize it.</small></div>
      <div class="chip-row crop-shapes" role="group" aria-label="Shape">${SHAPES.map(([k, l]) => `<button type="button" class="chip-btn" data-shape="${k}">${l}${k === 'map' ? '<small>suggested · 36 × 25</small>' : ''}</button>`).join('')}</div>
      <div class="crop-stage"><img alt="" draggable="false"><div class="crop-box"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div>
      <p class="crop-size muted small-text" aria-live="polite"></p>
      <div class="btn-row"><button type="button" class="btn" data-crop-ok>Use this</button><button type="button" class="btn secondary" data-crop-x>Cancel</button></div>
    </div>`;
    document.body.append(back);
    const stage = back.querySelector('.crop-stage'), pic = stage.querySelector('img'), box = stage.querySelector('.crop-box'), size = back.querySelector('.crop-size');
    pic.src = img.src;
    let W = 0, H = 0, ratio = 0, shape = 'map', r = { x: 0, y: 0, w: 0, h: 0 };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const k = () => img.naturalWidth / W; // screen px → image px
    const draw = () => {
      Object.assign(box.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      size.textContent = `${Math.round(r.w * k())} × ${Math.round(r.h * k())} pixels`;
      back.querySelectorAll('[data-shape]').forEach((b) => b.classList.toggle('on', b.dataset.shape === shape));
      box.hidden = shape === 'whole';
    };
    // the biggest box of this shape, centred
    const fit = () => {
      if (shape === 'whole' || shape === 'free') r = { x: 0, y: 0, w: W, h: H };
      else { const w = Math.min(W, H * ratio), h = w / ratio; r = { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
      draw();
    };
    const setShape = (s) => { shape = s; ratio = SHAPES.find((x) => x[0] === s)[2]; fit(); };
    const ready = () => { W = pic.clientWidth; H = pic.clientHeight; if (W && H) setShape('map'); };
    if (pic.complete) requestAnimationFrame(ready); else pic.addEventListener('load', ready, { once: true });
    addEventListener('resize', onResize);
    function onResize() { // keep the box where it was on the picture
      const ow = W; W = pic.clientWidth; H = pic.clientHeight;
      if (!ow || !W) return;
      const f = W / ow; r = { x: r.x * f, y: r.y * f, w: r.w * f, h: r.h * f }; draw();
    }

    // dragging: the box moves; a corner resizes with the opposite corner pinned
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      box.setPointerCapture(e.pointerId);
      drag = { h: e.target.dataset.h || '', px: e.clientX, py: e.clientY, start: { ...r } };
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py, s = drag.start;
      if (!drag.h) { r = { ...s, x: clamp(s.x + dx, 0, W - s.w), y: clamp(s.y + dy, 0, H - s.h) }; draw(); return; }
      const west = drag.h.includes('w'), north = drag.h.includes('n');
      const ax = west ? s.x + s.w : s.x, ay = north ? s.y + s.h : s.y; // the pinned corner
      let w = clamp(west ? s.w - dx : s.w + dx, MIN, west ? ax : W - ax);
      let h = clamp(north ? s.h - dy : s.h + dy, MIN, north ? ay : H - ay);
      if (ratio) { // keep the shape, inside the picture
        h = w / ratio;
        const maxH = north ? ay : H - ay;
        if (h > maxH) { h = maxH; w = h * ratio; }
      }
      r = { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
      draw();
    });
    const end = () => { drag = null; };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);

    const done = (val) => { removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey, true); back.remove(); resolve(val); };
    const result = () => {
      if (shape === 'whole') return { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
      const f = k();
      return { sx: Math.round(r.x * f), sy: Math.round(r.y * f), sw: Math.max(1, Math.round(r.w * f)), sh: Math.max(1, Math.round(r.h * f)) };
    };
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter' && !e.target.closest?.('[data-shape]')) { e.stopPropagation(); e.preventDefault(); done(result()); }
    }
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.shape) setShape(b.dataset.shape);
      else if (b?.hasAttribute('data-crop-ok')) done(result());
      else if (b?.hasAttribute('data-crop-x')) done(null);
    });
    back.querySelector('[data-crop-ok]').focus({ preventScroll: true });
  });
}
