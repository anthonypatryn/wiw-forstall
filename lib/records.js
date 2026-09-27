// Records (Journal → Records): each character's lifetime winnings and losses at the saloon, the carnival and the
// contests. Rather than every game reporting its payouts, the route compares each wallet before and after an
// action and books the difference to that game: buying in counts as money out, cashing out as money in, so the
// net is exactly what the character is up or down.
const money = (v) => Number(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
export const GAMES = { poker: 'Poker', faro: 'Faro', liars: 'Liar’s Dice', blackjack: 'Blackjack', drinking: 'Drinking contest', carnival: 'The carnival', race: 'Horse race', trickshot: 'Trick-shot contest' };

export function snapWallets(posse) {
  return new Map(posse.map((p) => [p.id, { cash: money(p.wallet), items: (p.items || []).length }]));
}
// after the action: book each wallet's change (and any prizes won) to `game`
export function tally(combat, before, game) {
  if (!GAMES[game]) return;
  for (const p of combat.posse) {
    const b = before.get(p.id);
    if (!b) continue;
    const d = +(money(p.wallet) - b.cash).toFixed(2), prizes = game === 'carnival' ? Math.max(0, (p.items || []).length - b.items) : 0;
    if (!d && !prizes) continue;
    const r = ((combat.records ||= {})[p.id] ||= {})[game] ||= { won: 0, lost: 0, best: 0, prizes: 0 };
    if (d > 0) { r.won = +(r.won + d).toFixed(2); r.best = Math.max(r.best, d); } else r.lost = +(r.lost - d).toFixed(2);
    r.prizes += prizes;
  }
}
// the leaderboard: everyone in the posse (the dead too; their records stand), per game and overall, best net first
export function recordsView(combat) {
  const rows = combat.posse.map((p) => {
    const per = combat.records?.[p.id] || {};
    const games = Object.entries(per).map(([g, r]) => ({ game: g, name: GAMES[g] || g, ...r, net: +(r.won - r.lost).toFixed(2) }));
    const sum = (k) => +games.reduce((a, g) => a + g[k], 0).toFixed(2);
    return { id: p.id, name: p.name, dead: !!p.dead, games, won: sum('won'), lost: sum('lost'), net: sum('net'), best: Math.max(0, ...games.map((g) => g.best)), prizes: sum('prizes') };
  });
  return { games: GAMES, rows: rows.sort((a, b) => b.net - a.net) };
}
