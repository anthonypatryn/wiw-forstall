import crypto from 'node:crypto';

// Locally (no env var) the Warden PIN defaults to 1234. On Vercel it must be set.
const PIN = process.env.WARDEN_PIN || (process.env.VERCEL ? null : '1234');

export function pinOk(given) {
  if (!PIN || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(PIN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

// ?since=v lets polling clients skip unchanged state.
export function sinceParam(url) {
  return url.searchParams.has('since') ? Number(url.searchParams.get('since')) : null;
}
