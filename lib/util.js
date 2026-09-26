// Small helpers every server module shares.
import crypto from 'node:crypto';

// text from a player: no angle brackets, trimmed, at most n characters
export const clean = (s, n) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
// the same, but keeps leading/trailing spaces — for text that autosaves while it's being typed (notes), so a space you just
// typed isn't eaten
export const cleanKeepSpaces = (s, n) => String(s ?? '').replace(/[<>]/g, '').slice(0, n);
export const id = () => crypto.randomUUID().slice(0, 8);
export const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
export const cents = (n) => Math.round(n * 100) / 100;
// "$12.50", "12.5", 12.5 → 12.5 (never negative)
export const money = (v) => Math.max(0, cents(Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0));
