// Official bullet dice (Guidebook pp. 2–3). An Ace counts as two Hits.
import crypto from 'node:crypto';

export const FACES = {
  B: ['blank', 'blank', 'spur', 'hit', 'hit', 'ace'],
  G: ['blank', 'spur', 'hit', 'hit', 'hit', 'ace'],
};
export const HIT_VALUE = { blank: 0, spur: 0, hit: 1, ace: 2 };
const MAX_DICE = 12;

export const clampDice = (n) => Math.max(0, Math.min(MAX_DICE, Math.floor(Number(n) || 0)));

// Spurs are rerolled until they land on something else when the roller has the Talent.
export function rollDie(color, spurTalent) {
  const faces = [FACES[color][crypto.randomInt(6)]];
  while (spurTalent && faces[faces.length - 1] === 'spur') faces.push(FACES[color][crypto.randomInt(6)]);
  return { color, faces, face: faces[faces.length - 1] };
}

export function rollPool(black, gold, spurTalent = false) {
  const dice = [
    ...Array.from({ length: clampDice(black) }, () => rollDie('B', spurTalent)),
    ...Array.from({ length: clampDice(gold) }, () => rollDie('G', spurTalent)),
  ];
  return {
    dice,
    hits: dice.reduce((n, d) => n + HIT_VALUE[d.face], 0),
    aces: dice.filter((d) => d.face === 'ace').length,
  };
}

// "4B2G", "2g", "3B + 1G" → { black, gold }
export function parsePool(text) {
  const pool = { black: 0, gold: 0 };
  for (const [, n, c] of String(text || '').matchAll(/(\d+)\s*([bg])/gi)) {
    if (c.toUpperCase() === 'B') pool.black += Number(n); else pool.gold += Number(n);
  }
  return { black: clampDice(pool.black), gold: clampDice(pool.gold) };
}

export const poolLabel = ({ black, gold }) => `${black ? black + 'B' : ''}${gold ? gold + 'G' : ''}` || '—';
