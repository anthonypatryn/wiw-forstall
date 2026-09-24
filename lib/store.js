// Persistence: Upstash Redis (REST) in production, a local JSON file in dev.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = 'wiw-forstall:state';
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.data', 'state.json');

let memory = null; // last-resort fallback (serverless without a DB configured)

export const storeKind = URL && TOKEN ? 'redis' : process.env.VERCEL ? 'memory' : 'file';

async function redis(cmd) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}: ${await r.text()}`);
  return (await r.json()).result;
}

export async function load() {
  if (storeKind === 'redis') {
    const raw = await redis(['GET', KEY]);
    return raw ? JSON.parse(raw) : null;
  }
  if (storeKind === 'file') {
    try { return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')); } catch { return null; }
  }
  return memory;
}

export async function save(state) {
  if (storeKind === 'redis') return redis(['SET', KEY, JSON.stringify(state)]);
  if (storeKind === 'file') {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(state, null, 1));
    return;
  }
  memory = state;
}
