// How to Play Online — a static guide for the posse.
import { injectDefs, mountNav, store } from './common.js';
import { mountTableLog } from './tablelog.js';

injectDefs();
mountTableLog();
mountNav('/howto');

// the game tours run inside the game itself, so this just lets them show again
document.querySelector('[data-game-tours]')?.addEventListener('click', () => {
  for (const k of ['saloon', 'carnival', 'contest']) store.set(`wiw.tour.${k}`, false);
  document.querySelector('[data-game-tours-note]').hidden = false;
});
