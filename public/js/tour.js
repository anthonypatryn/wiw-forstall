// A short guided tour for new players: dims the page, spotlights one thing at a time, and explains it in plain words.
// Runs once per device (wiw.tour.<key>); "Take the tour" on How to Play replays it. Never in Warden mode.
import { esc, store, savedPin } from './common.js';

const done = (key) => store.get(`wiw.tour.${key}`, false);

// steps: [{ sel, up?, title, text }] — `up` highlights the nearest ancestor matching it (e.g. the whole section)
// scene: the tour is of a game scene (saloon, carnival, contest), so an open scene isn't something to wait for
export function runTour(steps, key, { force = false, scene = false, tries = 0 } = {}) {
  if (savedPin() || (!force && done(key)) || document.querySelector('.tour-back')) return;
  // something else is asking for attention (the turn-order pop-up, a confirm, the paper, a game): wait for it, then start
  const busy = `.hud-pop-back, .hud-check, .ask-back, .roll-pop, .paper-back, .ho-back, .lock-back, .duel-back${scene ? '' : ', .saloon-back, .cv-back'}`;
  if ([...document.querySelectorAll(busy)].some((x) => !x.hidden && x.getClientRects().length)) {
    if (tries < 40) setTimeout(() => runTour(steps, key, { force, scene, tries: tries + 1 }), 1500);
    return;
  }
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
      tip.style.left = `${Math.min(document.documentElement.clientWidth - tip.offsetWidth - 16, Math.max(12, r.left))}px`; // clientWidth leaves out a scrollbar
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
    // a tap on the lit-up thing itself (BUG-7: "Clues" under the Journal's tour did nothing): end the tour and let the tap through
    if (!tip.contains(e.target)) {
      const el = find(list[i]), r = el?.getBoundingClientRect(), pad = 6;
      if (r && e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) {
        finish();
        const under = document.elementFromPoint(e.clientX, e.clientY);
        (under?.closest('button, a, input, select, textarea, label, [data-tab]') || under)?.click();
      }
      return;
    }
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

// the first time a player opens the Battle Map (steps that aren't on screen, e.g. no fight yet, are skipped)
export const BATTLE_TOUR = [
  { sel: '.btoken.movable', title: 'Your token', text: 'That’s you. <b>Drag it</b> to move: each hex is 1 inch, and moving costs Grit (double on rough ground). <b>Tap any token</b> to see its card and how far away it is.' },
  { sel: '#fcard', title: 'Your fighter card', text: 'It opens beside your token. <b>Attack</b>, <b>Dodge</b>, <b>Improvise</b> and <b>Prepare</b> are here, each with its Grit cost. Tap one and the dice roll for you, out in the open.' },
  { sel: '#fight-bar', title: 'Whose turn it is', text: 'The round, who’s up and who’s next. When you’ve done what you want, tap <b>End my turn</b>.' },
  { sel: '#acc-turn', title: 'Your turn so far', text: 'What you’ve done this turn and the Grit it cost. <b>Quick moves</b> are one-tap attacks on whoever’s in range.' },
  { sel: '[data-acc="board"]', title: 'On the board', text: 'Everyone on the map. Tap a name to jump to them.' },
  { sel: '.map-ctrls', title: 'Getting around the map', text: 'Zoom in and out, or fit the whole map. Drag empty ground to pan. <b>Press and hold</b> an empty spot to ping it for the whole table.' },
  { sel: '.fab-row', title: 'Always down here', text: '<b>Roll dice</b> for anything, <b>Whisper</b> to the Warden, and the <b>Table Log</b> with every roll that’s been made.' },
];

// the first time a player sits down at the saloon (every card and dice game shares it)
export const SALOON_TOUR = [
  { sel: '.saloon-back .sl-top', title: 'The table', text: 'The game, where you are and the stakes. It’s your character’s <b>real money</b>: what you win or lose goes straight to your wallet.' },
  { sel: '.saloon-back .sl-seats', title: 'Who’s playing', text: 'Everyone at the table. The NPCs show their bank; you show how far up or down you are.' },
  { sel: '.saloon-back .sl-mine', title: 'Yours alone', text: 'Your cards (or the dice under your cup). Only you can see them.' },
  { sel: '.saloon-back .sl-controls', title: 'Your moves', text: 'Your buttons light up when it’s your move, and the table opens by itself when it’s your turn. Skill moves like <b>Bluff</b> roll your character’s real Skills.' },
  { sel: '.saloon-back .sl-rulesbtn', title: 'Rules & key', text: 'How the game works and what every Skill move does, any time you need it.' },
  { sel: '.saloon-back .sl-top .sl-x', title: 'Step away', text: '<b>×</b> hides the table without leaving it; a chip in the corner brings you back. <b>Cash out &amp; leave</b> when you’re done.' },
];

// the first time a player visits the carnival
export const CARNIVAL_TOUR = [
  { sel: '.cv-back .cv-me', title: 'Your money and vouchers', text: 'Your wallet, and the prize vouchers you’ve won: small, medium and large.' },
  { sel: '.cv-back .cv-ticket', title: 'Buy a ticket first', text: 'One ticket gets you into every booth.' },
  { sel: '.cv-back .cv-booths', title: 'The booths', text: 'Each booth says how it works. They roll your character’s <b>real dice</b>, and wins pay out in vouchers.' },
  { sel: '.cv-back .cv-prizes', title: 'The Prize Booth', text: 'Trade vouchers for prizes. They go straight into your Inventory.' },
  { sel: '.cv-back .cv-x', title: 'Leave any time', text: '<b>×</b> closes the carnival; a chip in the corner brings you back while it’s in town.' },
];

// the first time a player opens a horse race or trick-shot contest
export const CONTEST_TOUR = [
  { sel: '.ct-scene .ct-field', title: 'The field', text: 'Everyone who’s entered, with the dice they bring.' },
  { sel: '.ct-scene .ct-me', title: 'Enter, or bet', text: 'Pay the entry fee to compete, and the winner takes the pot. Or put a <b>side bet</b> on whoever you think will win. Pull out any time before it starts and you get your fee back.' },
  { sel: '.ct-scene .ct-rules', title: 'How it works', text: 'The rules for this contest. When the Warden starts it, everyone watches it play out.' },
  { sel: '.ct-scene .cv-me', title: 'The pot', text: 'The pot so far, and your wallet.' },
];

// World pages: a short tour the first time a player opens each one (started from mountTableLog)
const WORLD_TOURS = {
  '/map': ['map', [
    { sel: '.map-switch', title: 'Two maps', text: '<b>The West</b> is the whole territory; <b>East Portal</b> is the town map. Switch between them here.' },
    { sel: '#viewport', title: 'Getting around', text: 'Drag to pan and use <b>+ / −</b> to zoom. <b>Tap a pin</b> to read about that place.' },
    { sel: '#place-q', title: 'Find a place', text: 'Type a town or landmark (or an East Portal letter) to jump straight to it.' },
    { sel: '#posse-list', title: 'Where the posse is', text: 'Everyone’s marker. <b>Find</b> jumps to them, <b>Place</b> puts a marker on the map, and you can drag your marker as you travel.' },
  ]],
  '/names': ['npcs', [
    { sel: '#ledger', title: 'People you’ve met', text: 'Everyone the posse knows. Tap a name for what you’ve learned, and write <b>Posse notes</b> so nobody forgets who’s who. You can <b>Challenge</b> a known NPC <b>to a Duel</b> from here too.' },
    { sel: '#npc-search', title: 'Search', text: 'Find someone by name, where they were, or anything in your notes.' },
    { sel: '#standing-card', title: 'Posse Standing', text: 'How each faction feels about the posse as a whole. The Warden moves it when you help or cross them.' },
  ]],
  '/wanted': ['wanted', [
    { sel: '#wt-towns', title: 'Pick a town', text: 'Every town has its own posting board. Tap one to see what’s up on its wall.' },
    { sel: '#wt-board', title: 'The posters', text: 'Who’s wanted and what they’re worth. <b>Take the bounty</b> and it goes into the Journal as a quest for the posse.' },
  ]],
  '/journal': ['journal', [
    { sel: '.jn-tabs', title: 'The posse’s Journal', text: '<b>Quests</b> you’re on, <b>Clues</b> pinned to a corkboard, the <b>Newspapers</b>, your <b>Records</b> at the tables, and the <b>Bestiary</b> of monsters you’ve fought.' },
    { sel: '#quests', title: 'Quests', text: 'Each quest has its steps and the reward. Write <b>posse notes</b> on it; they save as you type.' },
  ]],
};
export function pageTour() {
  const t = WORLD_TOURS[location.pathname.replace(/\.html$/, '').replace(/\/$/, '')];
  if (t) setTimeout(() => runTour(t[1], t[0], { force: new URLSearchParams(location.search).has('tour') }), 1500);
}
