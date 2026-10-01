// The site password (the splash page, /enter): nobody sees a page or any game data without it. Checked on the server
// for every request: Vercel runs middleware.js (edge), the dev server runs the same check. The Warden PIN is separate
// and still guards the Warden's tools. Uses Web Crypto so it runs both on the edge and in Node 18+.
const PASSWORD = 'bussy'; // compared trimmed and case-insensitive ("Bussy")
export const COOKIE = 'wiw_gate';
export const MAX_AGE = 60 * 60 * 24 * 365; // a year on that device
// what the splash page needs, and the nightly backup (Vercel Cron; the route checks its own secret)
const OPEN = new Set(['/enter', '/enter.html', '/api/gate', '/css/style.css', '/css/enter.css', '/js/enter.js', '/img/logo-light.svg', '/img/map-header.webp',
  '/img/icon-180.png', '/img/icon-192.png', '/img/icon-512.png', '/img/icon-maskable-512.png', '/manifest.webmanifest', '/favicon.ico', '/robots.txt']);

let tokenP = null;
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const token = () => (tokenP ||= sha256(`wiw-gate-v1:${PASSWORD}`));
export const passwordOk = (p) => String(p || '').trim().toLowerCase() === PASSWORD;
export const isOpen = (pathname, search = '') => OPEN.has(pathname) || (pathname === '/api/backup' && /[?&]nightly=/.test(search));
export function cookieValue(header, name = COOKIE) {
  const m = String(header || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}
// 'ok' (let it through), 'api' (answer 401 JSON) or 'page' (send to the splash page)
export async function gateDecision(url, cookieHeader) {
  const u = new URL(url);
  if (isOpen(u.pathname, u.search)) return 'ok';
  if (cookieValue(cookieHeader) === await token()) return 'ok';
  return u.pathname.startsWith('/api/') ? 'api' : 'page';
}
export const cookieHeader = async (secure = true) => `${COOKIE}=${await token()}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
export const enterUrl = (url) => { const u = new URL(url); const next = u.pathname + u.search; return `/enter${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`; };
