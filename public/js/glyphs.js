// Small line-art icons in the Guidebook's ink style (24×24, drawn in currentColor) — used instead of emoji.
const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';
const G = {
  // a single-action revolver
  revolver: `<path ${F} d="M2 8.2h13.6l.9-1.7h3.9v3.4h-2.5l-1 2H11.3l-1.4 5H5.6l1.4-5H2z"/><path ${S} d="M11.4 11.9c.3 1.6 1.6 2.7 3.1 2.2"/><path ${F} d="M3.6 7.2h1.8v1H3.6z"/>`,
  // a cowboy boot with a spur
  boot: `<path ${F} d="M8 2.5h6.4l-.4 8.3 5.3 3c1.3.7 2 1.7 2 2.9v1.5H7.3l-.7-2.4-1.8.2V14l2.2-.8z"/><circle ${S} cx="3.4" cy="16.4" r="1.7"/><path ${S} d="M5 16.4h1.4"/><path ${S} d="M7 21h14"/>`,
  // a quick swerve out of the way
  dodge: `<path ${S} d="M3 19c5.5 0 5-13 11.5-13H21"/><path ${S} d="M18 3l3 3-3 3"/><path ${S} stroke-dasharray="1.5 2.2" d="M3 9h5"/><path ${S} stroke-dasharray="1.5 2.2" d="M3 13h3"/>`,
  // a six-point sheriff's star
  star: `<path ${F} d="M12.00 2.40 L14.20 8.19 L20.31 7.20 L16.40 12.00 L20.31 16.80 L14.20 15.81 L12.00 21.60 L9.80 15.81 L3.69 16.80 L7.60 12.00 L3.69 7.20 L9.80 8.19Z"/>`
    + ['12,1.8', '20.8,6.9', '20.8,17.1', '12,22.2', '3.2,17.1', '3.2,6.9'].map((p) => { const [x, y] = p.split(','); return `<circle ${F} cx="${x}" cy="${y}" r="1.3"/>`; }).join('')
    + '<circle fill="var(--paper, #f4ead6)" cx="12" cy="12" r="2.1"/>',
  // a leather saddlebag
  satchel: `<path ${S} d="M4.5 9.5h15v9.3c0 .9-.7 1.7-1.6 1.7H6.1c-.9 0-1.6-.8-1.6-1.7z"/><path ${S} d="M4.5 9.5l1.8-4.2h11.4l1.8 4.2"/><path ${S} d="M9 5.3c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5"/><rect ${S} x="10.2" y="11.6" width="3.6" height="3.4" rx=".6"/><path ${S} d="M12 9.5v2.1"/>`,
  // a rolled bandage strip
  bandage: `<g transform="rotate(-38 12 12)"><rect ${S} x="2.5" y="8.6" width="19" height="6.8" rx="3.4"/><rect ${S} x="9" y="8.6" width="6" height="6.8"/><circle ${F} cx="11" cy="11" r=".6"/><circle ${F} cx="13" cy="13" r=".6"/><circle ${F} cx="13" cy="11" r=".6"/><circle ${F} cx="11" cy="13" r=".6"/></g>`,
  // a thrown lasso
  lasso: `<ellipse ${S} cx="13.5" cy="8.5" rx="7.3" ry="4.6"/><path ${S} d="M9 11.8c-.6 2.6-2.3 5.1-5.5 8.2"/><path ${S} d="M9 11.8c1.4.4 2.4 1.5 2.1 2.8"/>`,
  // a pocket watch (prepared / held)
  watch: `<circle ${S} cx="12" cy="13.8" r="7"/><path ${S} d="M12 13.8V9.8M12 13.8l2.6 1.6"/><path ${S} d="M12 6.8V4.6"/><circle ${S} cx="12" cy="3.1" r="1.4"/><path ${S} d="M5.6 9.3 4.2 8M18.4 9.3 19.8 8"/>`,
  // grit from the gut: a heart
  heart: `<path ${F} d="M12 20.5 4.2 12.9C1.6 10.4 2.2 6 5.6 4.9c2.2-.7 4.4.2 5.6 2 .3.4.5.4.8 0 1.2-1.8 3.4-2.7 5.6-2 3.4 1.1 4 5.5 1.4 8z"/>`,
  // a skull for the fallen
  skull: `<path ${F} fill-rule="evenodd" d="M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.6 1.1 4.6 2.9 5.9v3.1c0 .8.6 1.5 1.4 1.5h8.4c.8 0 1.4-.7 1.4-1.5v-3.1c1.8-1.3 2.9-3.3 2.9-5.9 0-4.6-3.5-8-8.5-8zM8.4 9.3a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zm7.2 0a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM12 13.8l-1.2 2.2h2.4z"/><path fill="none" stroke="var(--paper, #f4ead6)" stroke-width="1" d="M9.6 18.2v3.1M12 18.2v3.1M14.4 18.2v3.1"/>`,
  // a drop of blood
  drop: `<path ${F} d="M12 2.8c-2.8 4.6-6.2 7.9-6.2 11.9a6.2 6.2 0 0 0 12.4 0c0-4-3.4-7.3-6.2-11.9z"/><path fill="none" stroke="var(--paper, #f4ead6)" stroke-width="1.4" stroke-linecap="round" d="M9.2 14.6c0 1.6 1 2.8 2.3 3.2"/>`,
  // a muzzle flash
  flash: `<path ${F} d="M12 1.8l1.9 5.4 5.3-2.4-2.4 5.3 5.4 1.9-5.4 1.9 2.4 5.3-5.3-2.4-1.9 5.4-1.9-5.4-5.3 2.4 2.4-5.3L1.8 12l5.4-1.9-2.4-5.3 5.3 2.4z"/><circle fill="var(--paper, #f4ead6)" cx="12" cy="12" r="2.6"/>`,
  // claw marks (a monster's attack)
  claws: `<path ${S} stroke-width="2.1" d="M6.2 3.5c3.4 4.4 4.7 10 3.2 17"/><path ${S} stroke-width="2.1" d="M11.4 3c3 4.8 3.7 10.4 2 17.2"/><path ${S} stroke-width="2.1" d="M16.6 3.5c2.6 4.6 2.9 9.6 1.3 15.6"/>`,
  // a horseshoe
  horseshoe: `<path ${S} stroke-width="3" d="M6 20.5V11a6 6 0 0 1 12 0v9.5"/><circle ${F} cx="6" cy="12" r=".75" style="fill:var(--paper,#f4ead6)"/><circle cx="18" cy="12" r=".75" style="fill:var(--paper,#f4ead6)"/><circle cx="7.4" cy="7.4" r=".75" style="fill:var(--paper,#f4ead6)"/><circle cx="16.6" cy="7.4" r=".75" style="fill:var(--paper,#f4ead6)"/>`,
  // a bullet (dice)
  bullet: `<path ${F} d="M9 9.5h6v10.5H9z"/><path ${F} d="M9 9c0-3.6 1.3-5.9 3-6.5 1.7.6 3 2.9 3 6.5z"/><rect ${F} x="8.2" y="19.4" width="7.6" height="2.1" rx=".5"/>`,
  // a six-sided die (rolls)
  die: `<rect ${S} x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle ${F} cx="8.3" cy="8.3" r="1.35"/><circle ${F} cx="15.7" cy="8.3" r="1.35"/><circle ${F} cx="12" cy="12" r="1.35"/><circle ${F} cx="8.3" cy="15.7" r="1.35"/><circle ${F} cx="15.7" cy="15.7" r="1.35"/>`,
  // a trophy cup (wins, Achievements, Prestige)
  trophy: `<path ${S} d="M7.5 3.5h9v5.2a4.5 4.5 0 0 1-9 0z"/><path ${S} d="M7.5 5.2H4.3v1.3a3.2 3.2 0 0 0 3.4 3.2M16.5 5.2h3.2v1.3a3.2 3.2 0 0 1-3.4 3.2"/><path ${S} d="M12 13.2v3.6"/><path ${S} d="M8.3 20.5h7.4l-.8-3.7H9.1z"/>`,
  // a campfire
  fire: `<path ${F} d="M12 2.6c.6 3-1.8 4.4-3.1 6.4-1.6 2.5-1 6 1.8 7-.9-1.9-.3-3.7 1.3-5 .3 1.8 1.6 2.6 2.5 3.9.9-1.2 1.1-2.5.8-4 2 1.7 2.6 4.6.6 6.4 3.3-.9 4.6-4.5 3.3-7.6-1.2-3-4.6-4.2-7.2-7.1z"/><path ${S} d="M4 20.8l16-3.2M4 17.6l16 3.2"/>`,
  // crosshairs (a called-for roll, a scan)
  target: `<circle ${S} cx="12" cy="12" r="7.5"/><circle ${S} cx="12" cy="12" r="3.2"/><path ${S} d="M12 1.8v4.4M12 17.8v4.4M1.8 12h4.4M17.8 12h4.4"/>`,
  // a padlock
  lock: `<rect ${S} x="5" y="10.5" width="14" height="10" rx="2"/><path ${S} d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><path ${S} d="M12 14.4v2.3"/>`,
  // a wrench (upgrades, repairs)
  wrench: `<path ${S} d="M14.7 3.4a5 5 0 0 0-5.3 6.5L3.6 15.7a2 2 0 0 0 2.8 2.8l5.8-5.8a5 5 0 0 0 6.5-5.3l-3 3-2.7-.6-.6-2.7z"/>`,
  // a cowboy hat (the posse)
  hat: `<path ${F} d="M8.6 5.5c1.1-.9 2.2.3 3.4.3s2.3-1.2 3.4-.3c1 .9 1.4 4.3 1.5 7.3H7.1c.1-3 .5-6.4 1.5-7.3z"/><path ${F} d="M2 12.4c1.5 2.4 5 3.9 10 3.9s8.5-1.5 10-3.9c-.4 3.2-4.3 5.8-10 5.8S2.4 15.6 2 12.4z"/>`,
  // a map pin
  pin: `<path ${S} d="M12 21s-6.5-6.3-6.5-11.3a6.5 6.5 0 0 1 13 0C18.5 14.7 12 21 12 21z"/><circle ${S} cx="12" cy="9.7" r="2.4"/>`,
  // a scroll (the Table Log)
  scroll: `<path ${S} d="M6 4.5h11.5a2 2 0 0 1 2 2v12"/><path ${S} d="M6 4.5a2 2 0 0 0-2 2v1.5h3.8V6.5A2 2 0 0 0 6 4.5z"/><path ${S} d="M7.8 8v11a1.6 1.6 0 0 0 1.6 1.6h10.1a1.6 1.6 0 0 0 1.6-1.6v-.6H11v.6a1.6 1.6 0 0 1-3.2 0"/><path ${S} d="M10.6 9.5h5.8M10.6 12.5h5.8M10.6 15.5h3.8"/>`,
};
export const gl = (name, cls = '') => (G[name] ? `<svg class="gl${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${G[name]}</svg>` : '');
