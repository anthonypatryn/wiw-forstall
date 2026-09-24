// Local dev server: serves /public and routes /api/<name> to the same api/<name>.js handlers Vercel uses.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT) || 5190;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  const apiMatch = pathname.match(/^\/api\/([a-z-]+)$/);
  if (apiMatch) {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'api', `${apiMatch[1]}.js`);
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    return (await import(pathToFileURL(file).href)).default(req, res);
  }
  let file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!path.extname(file)) file += '.html';
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Forstall dev server on http://localhost:${PORT}  (Warden PIN: 1234)`));
