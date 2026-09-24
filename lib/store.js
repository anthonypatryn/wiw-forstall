// Persistence: Upstash Redis (REST) in production, a local JSON file in dev.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.data');
// One JSON document per key: 'state' (Forstall scanner), 'combat' (combat tracker & dice).
const redisKey = (key) => (key === 'state' ? 'wiw-forstall:state' : `wiw-forstall:${key}`);
const localFile = (key) => path.join(LOCAL_DIR, `${key}.json`);

const memory = {}; // last-resort fallback (serverless without a DB configured)

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

export async function load(key = 'state') {
  if (storeKind === 'redis') {
    const raw = await redis(['GET', redisKey(key)]);
    return raw ? JSON.parse(raw) : null;
  }
  if (storeKind === 'file') {
    try { return JSON.parse(fs.readFileSync(localFile(key), 'utf8')); } catch { return null; }
  }
  return memory[key] || null;
}

export async function save(state, key = 'state') {
  if (storeKind === 'redis') return redis(['SET', redisKey(key), JSON.stringify(state)]);
  if (storeKind === 'file') {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.writeFileSync(localFile(key), JSON.stringify(state, null, 1));
    return;
  }
  memory[key] = state;
}
