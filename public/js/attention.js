// "It's your turn" you can't miss, even from another tab: the tab title flashes, the tab icon gets a red dot, and phones
// buzz once. Nothing native pops up. Any part of the site can raise or clear a reason:
//   attention('turn', 'Your turn, Lila!')   attention('turn', null)
const reasons = new Map();
let flashTimer = null, baseTitle = null, baseIcon = null, flip = false;

function iconEl() {
  let el = document.querySelector('link[rel="icon"]');
  if (!el) { el = document.createElement('link'); el.rel = 'icon'; document.head.append(el); }
  return el;
}
// the page's own icon with a red dot in the corner (the icons are SVG data URLs)
const dotted = (href) => (href.includes('</svg>') ? href.replace('</svg>', "<circle cx='80' cy='20' r='19' fill='%23d62d20' stroke='white' stroke-width='5'/></svg>") : href);

function update() {
  const label = [...reasons.values()].pop();
  if (baseTitle === null) baseTitle = document.title;
  if (baseIcon === null) baseIcon = iconEl().getAttribute('href') || '';
  clearInterval(flashTimer); flashTimer = null;
  if (!label) {
    document.title = baseTitle;
    iconEl().setAttribute('href', baseIcon);
    return;
  }
  iconEl().setAttribute('href', dotted(baseIcon));
  if (document.hidden) { // flash while they're looking elsewhere
    flip = false;
    flashTimer = setInterval(() => { flip = !flip; document.title = flip ? `▶ ${label}` : baseTitle; }, 1000);
    document.title = `▶ ${label}`;
  } else document.title = `▶ ${baseTitle}`;
}
document.addEventListener('visibilitychange', () => { if (reasons.size) update(); });

export function attention(key, label) {
  const had = reasons.has(key), was = reasons.get(key);
  if (label) reasons.set(key, label); else reasons.delete(key);
  if (label && !had) { try { navigator.vibrate?.([120, 60, 120]); } catch {} }
  if (had !== !!label || was !== label) update();
}
