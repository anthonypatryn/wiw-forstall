// Journal → Records: lifetime winnings and losses at the saloon tables, the carnival and the contests (lib/records.js).
import { esc, api, onChange, dollars } from './common.js';
import { gl } from './glyphs.js';

const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${dollars(Math.abs(n))}`;
const cls = (n) => (n > 0 ? 'rec-up' : n < 0 ? 'rec-down' : '');

export function mountRecords(el) {
  const draw = async () => {
    let r;
    try { r = await api('GET', null, '?view=records', '/api/combat'); } catch { return; }
    const rows = r.rows.filter((x) => x.games.length);
    if (!rows.length) { el.innerHTML = '<p class="muted">Nobody has played for money yet. Poker, faro, Liar’s Dice, blackjack, the drinking contest, the carnival and the contests all count.</p>'; return; }
    // the champion of each game: best net winnings
    const champs = Object.entries(r.games).map(([g, name]) => {
      const best = rows.map((x) => ({ who: x.name, g: x.games.find((y) => y.game === g) })).filter((x) => x.g).sort((a, b) => b.g.net - a.g.net)[0];
      return best && best.g.net > 0 ? `<div class="rec-champ"><small>${esc(name)}</small><b>${esc(best.who)}</b><span class="rec-up">${signed(best.g.net)}</span></div>` : '';
    }).join('');
    el.innerHTML = `${champs ? `<div class="rec-champs">${champs}</div>` : ''}
      <ol class="rec-board">${rows.map((x, i) => `<li class="${x.dead ? 'rec-dead' : ''}"><details>
        <summary><span class="rec-rank">${i + 1}</span><span class="rec-name">${esc(x.name)}${x.dead ? ' <small>(rest easy)</small>' : ''}</span>
          <span class="rec-net ${cls(x.net)}">${signed(x.net)}</span></summary>
        <div class="rec-sum">Won ${dollars(x.won)} · Lost ${dollars(x.lost)} · Biggest haul ${dollars(x.best)}${x.prizes ? ` · ${gl('trophy')} ${x.prizes} carnival prize${x.prizes === 1 ? '' : 's'}` : ''}</div>
        <table class="rec-games"><tbody>${x.games.sort((a, b) => b.net - a.net).map((g) => `<tr><th>${esc(g.name)}</th><td>won ${dollars(g.won)}</td><td>lost ${dollars(g.lost)}</td><td class="${cls(g.net)}">${signed(g.net)}</td></tr>`).join('')}</tbody></table>
      </details></li>`).join('')}</ol>
      <p class="muted small-text">Buying in counts as money out and cashing out as money in, so the net is what each of them is really up or down.</p>`;
  };
  onChange(['combat'], draw);
  draw();
}
