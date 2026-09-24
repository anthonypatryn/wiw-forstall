// Monster abilities from the Guidebook's Monster Profiles that interact with Forstalls.
// effect: 'half' = Scan rolls use half the dice pool (applied automatically)
//         'jam'  = Warden can jam the Forstall (no Scanning or guessing) while it's active
//         null   = reference only (affects Sweeping, Bursting, or combat — not the Scan puzzle)
export const TRAITS = [
  {
    id: 'spinal-deflectors', name: 'Spinal Deflectors', kind: 'Scanning', effect: 'half',
    text: 'Its body deflects Forstall signals. Intuition rolls made to Scan it use half the dice pool.',
    source: 'Chupacabra',
  },
  {
    id: 'natural-emp', name: 'Natural EMP', kind: 'Scanning', effect: 'jam',
    text: 'Twice per day, disables every Forstall within Long Range. Sweeping stops, and Scanning and Bursting can’t be attempted for one round.',
    source: 'Southern Death Worm',
  },
  {
    id: 'hidden-lair', name: 'Hidden Lair', kind: 'Scanning', effect: 'jam',
    text: 'Retreats somewhere Forstall signals can’t reach — a silk-lined burrow, or deep underground into The Dark — until it comes back out.',
    source: 'Trapdoor Spider (Into the Dungeon), Hundred-Year Hydra (The Dark Lair)',
  },
  {
    id: 'sweep-immunity', name: 'Sweep Immunity', kind: 'Sweeping', effect: null,
    text: 'Shrugs off Forstall Sweeping entirely under certain conditions — when badly wounded, or while fully submerged.',
    source: 'Shasta Skullface (Ancient Tolerance), Pondweed Peril (Water Shelter)',
  },
  {
    id: 'rising-tolerance', name: 'Rising Tolerance', kind: 'Sweeping', effect: null,
    text: 'Its Sweep Tolerance rises once it’s hurt or enraged (+1, +2, or up to 4).',
    source: 'Golden Bear (Full Sovereignty), Horned Lizard (Blood Boil), Lurking Moss (Overgrowth)',
  },
  {
    id: 'technological-target', name: 'Technological Target', kind: 'Combat', effect: null,
    text: 'Hates anything that hums, beeps, or buzzes. +1B to its attacks against anyone within Arm’s Reach of a Forstall or mech.',
    source: 'Alpine Bigfoot',
  },
];

export const TRAIT_IDS = new Set(TRAITS.map((t) => t.id));
export const SWEEP_TOLERANCES = ['1', '2', '3', '4', 'Immune'];

export const hasEffect = (monster, effect) =>
  (monster?.traits || []).some((id) => TRAITS.find((t) => t.id === id)?.effect === effect);
