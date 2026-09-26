// Persistence: Upstash Redis (REST) in production, a local JSON file in dev.
// Every API request runs as a transaction (see `transaction` below): reads are fingerprinted, writes are held back, and
// at the end they're all committed at once — but only if none of the documents it read-and-writes changed meanwhile.
// If another request got there first, the whole request re-runs on fresh data, so two players acting in the same
// second can't overwrite each other.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.data');
// One JSON document per key: 'state' (Forstall scanner), 'combat' (combat tracker & dice), …
const redisKey = (key) => (key === 'state' ? 'wiw-forstall:state' : `wiw-forstall:${key}`);
const localFile = (key) => path.join(LOCAL_DIR, `${key}.json`);
// a small counter per document, bumped on every save — /api/pulse reads them all at once so pages know what changed
const verKey = (key) => `wiw-forstall:ver:${key}`;
const localVers = {}; // file / memory mode (one process)

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

// ---------- raw access (one document as a string, or null) ----------
async function readRaw(key) {
  if (storeKind === 'redis') return (await redis(['GET', redisKey(key)])) ?? null;
  if (storeKind === 'file') { try { return fs.readFileSync(localFile(key), 'utf8'); } catch { return null; } }
  return memory[key] ?? null;
}
const sha = (raw) => (raw == null ? 'nil' : crypto.createHash('sha1').update(raw).digest('hex'));

// all-or-nothing write: every key whose expected fingerprint isn't '*' must still match what's stored
const CAS = `local n = #ARGV / 2
for i = 1, n do
  local exp = ARGV[i * 2 - 1]
  if exp ~= '*' then
    local cur = redis.call('GET', KEYS[i])
    local h = 'nil'
    if cur then h = redis.sha1hex(cur) end
    if h ~= exp then return 0 end
  end
end
for i = 1, n do
  redis.call('SET', KEYS[i], ARGV[i * 2])
  redis.call('INCR', KEYS[n + i])
end
return 1`;
async function commitRaw(writes) { // writes: [{ key, raw, expect }]
  if (!writes.length) return true;
  if (storeKind === 'redis') {
    let ok;
    try { ok = await redis(['EVAL', CAS, String(writes.length * 2), ...writes.map((w) => redisKey(w.key)), ...writes.map((w) => verKey(w.key)), ...writes.flatMap((w) => [w.expect, w.raw])]); }
    catch (err) { // scripting unavailable: fall back to plain writes (the old behavior) rather than failing the save
      console.error('CAS script failed, writing without the check:', err.message);
      await Promise.all(writes.flatMap((w) => [redis(['SET', redisKey(w.key), w.raw]), redis(['INCR', verKey(w.key)])]));
      return true;
    }
    return Number(ok) === 1;
  }
  // file / memory: one process, so check-then-write can't interleave
  for (const w of writes) if (w.expect !== '*' && sha(await readRaw(w.key)) !== w.expect) return false;
  for (const w of writes) {
    if (storeKind === 'file') { fs.mkdirSync(LOCAL_DIR, { recursive: true }); fs.writeFileSync(localFile(w.key), w.raw); } else memory[w.key] = w.raw;
    localVers[w.key] = (localVers[w.key] || 0) + 1;
  }
  return true;
}

// ---------- transactions (one per API request; set up by api/[area].js) ----------
const tx = new AsyncLocalStorage();
export class Conflict extends Error { constructor() { super('Someone else changed that at the same moment. Try again.'); this.conflict = true; } }

export async function transaction(fn) {
  const ctx = { seen: new Map(), writes: new Map() };
  const result = await tx.run(ctx, fn);
  const writes = [...ctx.writes].map(([key, raw]) => ({ key, raw, expect: ctx.seen.has(key) ? ctx.seen.get(key) : '*' }));
  if (!(await commitRaw(writes))) throw new Conflict();
  return result;
}

export async function load(key = 'state') {
  const t = tx.getStore();
  if (t?.writes.has(key)) return JSON.parse(t.writes.get(key)); // read your own write
  const raw = await readRaw(key);
  if (t && !t.seen.has(key)) t.seen.set(key, sha(raw));
  return raw ? JSON.parse(raw) : null;
}

export async function save(state, key = 'state') {
  const raw = JSON.stringify(state);
  const t = tx.getStore();
  if (t) { t.writes.set(key, raw); return; } // committed when the request finishes
  await commitRaw([{ key, raw, expect: '*' }]);
}

// every document's change counter in one read (for /api/pulse)
export async function versions(keys) {
  if (storeKind === 'redis') {
    const vals = await redis(['MGET', ...keys.map(verKey)]);
    return Object.fromEntries(keys.map((k, i) => [k, Number(vals?.[i]) || 0]));
  }
  return Object.fromEntries(keys.map((k) => [k, localVers[k] || 0]));
}

// ---------- small counters outside the documents (e.g. wrong-PIN attempts), with an expiry ----------
const localCounters = {};
export async function counter(name) {
  if (storeKind === 'redis') return Number(await redis(['GET', `wiw-forstall:n:${name}`])) || 0;
  const c = localCounters[name];
  return c && c.until > Date.now() ? c.n : 0;
}
export async function bump(name, ttlSec) {
  if (storeKind === 'redis') {
    const n = await redis(['INCR', `wiw-forstall:n:${name}`]);
    if (Number(n) === 1) await redis(['EXPIRE', `wiw-forstall:n:${name}`, String(ttlSec)]);
    return Number(n);
  }
  const c = localCounters[name];
  localCounters[name] = c && c.until > Date.now() ? { n: c.n + 1, until: c.until } : { n: 1, until: Date.now() + ttlSec * 1000 };
  return localCounters[name].n;
}

// ---------- who has the site open right now (a tab says so every ~20 s; it counts as here for 60 s) ----------
const localHere = {};
export async function markHere(pc) {
  if (storeKind === 'redis') return redis(['SET', `wiw-forstall:here:${pc}`, String(Date.now()), 'EX', '60']);
  localHere[pc] = Date.now();
}
export async function whoIsHere(ids) {
  if (!ids.length) return [];
  if (storeKind === 'redis') { const vals = await redis(['MGET', ...ids.map((i) => `wiw-forstall:here:${i}`)]); return ids.filter((_, i) => vals?.[i]); }
  return ids.filter((i) => Date.now() - (localHere[i] || 0) < 60_000);
}
