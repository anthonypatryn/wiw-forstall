// Pan (drag), zoom (wheel / pinch / buttons) for a big image-sized "stage" inside a viewport.
export function panZoom(vp, stage, { maxScale = 2, onChange, onTap, ignore = '' } = {}) {
  const view = { s: 1, x: 0, y: 0, w: 1, h: 1 };
  const apply = () => { stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`; onChange?.(view); };
  const rect = () => vp.getBoundingClientRect();
  const fitScale = () => { const r = rect(); return Math.min(r.width / view.w, r.height / view.h); };
  function clamp() {
    const r = rect(), w = view.w * view.s, h = view.h * view.s;
    view.x = w < r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, view.x));
    view.y = h < r.height ? (r.height - h) / 2 : Math.min(0, Math.max(r.height - h, view.y));
  }
  function zoomAt(f, cx, cy) {
    const r = rect();
    const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
    const s = Math.max(fitScale() * 0.9, Math.min(maxScale, view.s * f));
    view.x = px - ((px - view.x) / view.s) * s;
    view.y = py - ((py - view.y) / view.s) * s;
    view.s = s; clamp(); apply();
  }
  const api = {
    view,
    setSize(w, h) { view.w = w; view.h = h; },
    fit() { view.s = fitScale(); view.x = 0; view.y = 0; clamp(); apply(); },
    zoom: (f) => zoomAt(f),
    centerOn(x, y, s = view.s) { const r = rect(); view.s = s; view.x = r.width / 2 - x * s; view.y = r.height / 2 - y * s; clamp(); apply(); },
    toStage(cx, cy) { const r = rect(); return { x: (cx - r.left - view.x) / view.s, y: (cy - r.top - view.y) / view.s }; },
  };

  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = rect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const pts = new Map();
  let start = null, pinch = null, moved = false, downTarget = null;
  vp.addEventListener('pointerdown', (e) => {
    if (ignore && e.target.closest(ignore)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { downTarget = e.target; start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = false; }
    try { vp.setPointerCapture(e.pointerId); } catch {}
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; }
  });
  vp.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], r = rect();
      zoomAt((pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d) / view.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      moved = true;
    } else if (start) {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; vp.classList.add('dragging'); }
      view.x = start.vx + dx; view.y = start.vy + dy; clamp(); apply();
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) {
      vp.classList.remove('dragging');
      start = null;
      if (!moved) onTap?.(downTarget, api.toStage(e.clientX, e.clientY));
    }
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => { clamp(); apply(); });
  return api;
}
