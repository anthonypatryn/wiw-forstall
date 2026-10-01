// Vercel Routing Middleware: every page and API call needs the site password cookie (lib/gate.js); without it, pages
// go to the splash page and the API answers 401. The Warden PIN is checked separately by the API routes.
import { gateDecision, enterUrl } from './lib/gate.js';

export const config = { matcher: '/:path*' };

export default async function middleware(request) {
  const d = await gateDecision(request.url, request.headers.get('cookie'));
  if (d === 'ok') return new Response(null, { headers: { 'x-middleware-next': '1' } }); // carry on to the page or API
  if (d === 'api') return new Response(JSON.stringify({ error: 'Password needed.', gate: true }), { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  return Response.redirect(new URL(enterUrl(request.url), request.url), 302);
}
