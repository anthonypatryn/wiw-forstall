// Local dev server: serves /public and sends /api/<name> to the same router Vercel uses (api/[area].js → lib/routes/<name>.js).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gateDecision, enterUrl } from './lib/gate.js';

const PORT = Number(process.env.PORT) || 5190;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  // the site password, exactly as Vercel's middleware.js does it (WIW_NO_GATE=1 turns it off)
  if (process.env.WIW_NO_GATE !== '1') {
    const full = `http://${req.headers.host || 'localhost'}${req.url}`, d = await gateDecision(full, req.headers.cookie);
    if (d === 'api') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Password needed.', gate: true })); }
    if (d === 'page') { res.writeHead(302, { location: enterUrl(full) }); return res.end(); }
  }
  const apiMatch = pathname.match(/^\/api\/([a-z-]+)$/);
  if (apiMatch) {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'api', '[area].js'); // the same single router Vercel runs
    return (await import(pathToFileURL(file).href)).default(req, res);
  }
  let file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!path.extname(file)) file += '.html';
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Forstall dev server on http://localhost:${PORT}  (Warden PIN: 1234)`));
