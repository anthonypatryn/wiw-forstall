// The TV table screen (/tv): for playing in person. The Battle Map fills the screen (an embedded /battle?tv, which hides
// every control and always shows the player view), with three overlays: whose turn it is, each roll shown big for a
// few seconds, and whatever the Warden puts up (a scene's read-aloud, a handout) via /api/tv.
import { $, esc, startPolling, staticDice, injectDefs, paras } from './common.js';

injectDefs();
const seen = new Set();
let primed = false, rollTimer = null;

// whose turn, who's next
function drawTurn(h) {
  const box = $('#tv-turn');
  if (!h?.active) { box.hidden = true; return; }
  const order = h.order || [], i = order.findIndex((o) => o.key === h.current);
  const now = order[i], next = [1, 2].map((k) => order[(i + k) % order.length]).filter((o) => o && o.key !== h.current);
  box.hidden = !now;
  if (now) box.innerHTML = `<small>ROUND ${h.round}</small><b>${esc(now.name)}’s turn</b>${next.length ? `<span>then ${next.map((o) => esc(o.name)).join(', ')}</span>` : ''}`;
}
// every new roll, big, for a few seconds (not the backlog when the page opens)
function drawRolls(log) {
  const rolls = (log || []).filter((l) => l.type === 'roll' && l.dice?.length);
  const fresh = rolls.filter((l) => !seen.has(l.id));
  rolls.forEach((l) => seen.add(l.id));
  if (!primed) { primed = true; return; }
  const r = fresh[0]; // the newest
  if (!r) return;
  const box = $('#tv-roll');
  box.innerHTML = `<div class="tv-roll-card"><small>${esc(r.who)}</small><b>${esc(r.label || 'Roll')}</b><div class="tray tv-tray"></div>
    <div class="tv-hits">${r.hits} HIT${r.hits === 1 ? '' : 'S'}${r.aces ? `<span>${r.aces} Ace${r.aces > 1 ? 's' : ''}</span>` : ''}</div></div>`;
  staticDice(box.querySelector('.tv-tray'), r.dice);
  box.hidden = false; box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  clearTimeout(rollTimer); rollTimer = setTimeout(() => { box.hidden = true; }, 6000);
}
startPolling('log', (d) => { drawTurn(d.hud); drawRolls(d.log); }, null, '/api/combat');
// what the Warden puts up for the table
startPolling('', (d) => {
  const s = d.show, box = $('#tv-show');
  box.hidden = !s;
  if (s) box.innerHTML = `<article class="tv-show-card">${s.img ? `<img src="${esc(s.img)}" alt="">` : ''}${s.title ? `<h1>${esc(s.title)}</h1>` : ''}${s.text ? `<div class="tv-text">${paras(s.text)}</div>` : ''}</article>`;
}, null, '/api/tv');
$('#tv-full').addEventListener('click', () => { document.documentElement.requestFullscreen?.().catch(() => {}); });
document.addEventListener('fullscreenchange', () => { $('#tv-full').hidden = !!document.fullscreenElement; });
