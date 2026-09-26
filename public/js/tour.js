// A short guided tour for new players: dims the page, spotlights one thing at a time, and explains it in plain words.
// Runs once per device (wiw.tour.<key>); "Take the tour" on How to Play replays it. Never in Warden mode.
import { esc, store, savedPin } from './common.js';

const done = (key) => store.get(`wiw.tour.${key}`, false);

// steps: [{ sel, up?, title, text }] — `up` highlights the nearest ancestor matching it (e.g. the whole section)
export function runTour(steps, key, { force = false } = {}) {
  if (savedPin() || (!force && done(key)) || document.querySelector('.tour-back')) return;
  const find = (s) => { const el = document.querySelector(s.sel); const t = s.up ? el?.closest(s.up) : el; return t && t.getClientRects().length ? t : null; };
  const list = steps.filter(find);
  if (!list.length) return;
  let i = 0;
  const back = document.createElement('div');
  back.className = 'tour-back';
  back.innerHTML = '<div class="tour-spot"></div><div class="tour-tip" role="dialog" aria-modal="true" aria-live="polite"></div>';
  document.body.append(back);
  const spot = back.querySelector('.tour-spot'), tip = back.querySelector('.tour-tip');
  const finish = () => { store.set(`wiw.tour.${key}`, true); back.remove(); removeEventListener('resize', place); removeEventListener('scroll', place, true); };
  function place() {
    const el = find(list[i]);
    if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    // the tip sits below the spot if there's room, else above; phones dock it to the bottom
    const phone = innerWidth < 600;
    tip.classList.toggle('docked', phone);
    if (!phone) {
      const below = r.bottom + 14, h = tip.offsetHeight;
      tip.style.top = `${below + h < innerHeight ? below : Math.max(12, r.top - h - 14)}px`;
      tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 12, Math.max(12, r.left))}px`;
    } else { tip.style.top = ''; tip.style.left = ''; }
  }
  function show() {
    const s = list[i], el = find(s);
    if (!el) { if (i < list.length - 1) { i++; show(); } else finish(); return; }
    tip.innerHTML = `<div class="tour-step">${i + 1} of ${list.length}</div><h3>${esc(s.title)}</h3><p>${s.text}</p>
      <div class="tour-btns"><button type="button" class="btn small secondary" data-skip>Skip tour</button>${i ? '<button type="button" class="btn small secondary" data-prev>Back</button>' : ''}<button type="button" class="btn small" data-next>${i === list.length - 1 ? 'Got it' : 'Next'}</button></div>`;
    el.scrollIntoView({ block: 'center' });
    requestAnimationFrame(place);
  }
  back.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.skip !== undefined) finish();
    else if (b.dataset.prev !== undefined) { i = Math.max(0, i - 1); show(); }
    else if (b.dataset.next !== undefined) { if (i >= list.length - 1) finish(); else { i++; show(); } }
  });
  addEventListener('resize', place); addEventListener('scroll', place, true);
  show();
}

// the first time a player opens their own character sheet
export const SHEET_TOUR = [
  { sel: '[data-me-bar]', title: 'This is you', text: 'The star marks this sheet as <b>your</b> character on this device. That’s how rolls, duels, trades and card games know who’s playing. Tap it on your own sheet only.' },
  { sel: '#sec-health', title: 'Health and Grit', text: '<b>Health</b> is how much punishment you can take. <b>Grit</b> is what you spend to act in a fight: moving, shooting, dodging. It fills back up at the start of your turn.' },
  { sel: '.sk', up: '.sbox', title: 'Skills and rolling', text: 'Each Skill is a handful of dice: <b>Black</b> and <b>Gold</b> (Gold is better). Every Hit counts, an <b>Ace</b> counts as 2 Hits, and with a Talent in that Skill you reroll Spurs. Tap the die next to a Skill to roll it.' },
  { sel: '#sec-weapons', title: 'Weapons', text: 'Each weapon lists the dice it rolls at every range and the Grit it costs to use. In a fight you attack from the Battle Map, and it rolls these for you.' },
  { sel: '#sec-inventory', title: 'Money and gear', text: 'Your wallet and everything you carry. <b>Trade</b> swaps with another player, and the <b>Posse stash</b> is the money and gear the posse shares.' },
  { sel: '.fab-row', title: 'Always down here', text: '<b>Roll dice</b> for anything, <b>Whisper</b> a secret to the Warden, <b>Trade</b>, and the <b>Table Log</b>: everything that’s happened at the table.' },
  { sel: '.nav-main', title: 'Getting around', text: 'The <b>Battle Map</b> is where fights happen. <b>World</b> has the Map, the people you’ve met, Wanted posters, and the Journal of quests and clues. The <b>?</b> is How to Play.' },
];
