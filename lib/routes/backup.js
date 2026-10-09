import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';

// Warden-only backups: the Download file, nightly snapshots (a Vercel cron hits ?nightly=1), and restoring either.
// Keep KEYS in step with every document the app saves (grep lib/ for load('…') / KEY = '…'). Photos (img-* keys) aren't included.
const KEYS = ['state', 'combat', 'map', 'battle', 'battle-img', 'npcs', 'shop', 'session', 'handouts', 'whispers', 'locks', 'saloon', 'carnival', 'contest', 'wanted', 'papers', 'journal', 'scenes', 'campaign', 'problems'];
const SNAP_KEYS = KEYS.filter((k) => k !== 'battle-img'); // an uploaded map image is big and rarely changes
const INDEX = 'snaps', KEEP = 7, MIN_GAP = 12 * 3600 * 1000;

async function gather(keys) { const data = {}; for (const k of keys) data[k] = await load(k); return data; }
// the Warden's saved battle maps: each picture has its own key (in downloads, not the nightly snapshots: they're big)
const mapKeys = (battle) => (battle?.maps || []).flatMap((m) => [`battle-img-${m.id}`, `battle-img-${m.id}-t`]);
const isMapKey = (k) => /^battle-img-[a-z0-9]{1,12}(-t)?$/.test(k);
const sizeOf = (o) => JSON.stringify(o).length;

// take a snapshot and remember it (the oldest beyond KEEP drops off). kind: nightly | manual | before-restore
async function snapshot(kind) {
  const idx = (await load(INDEX)) || { list: [] };
  const at = Date.now();
  const data = await gather(SNAP_KEYS);
  // nightly/manual snapshots rotate through slots 0–6 (after the most recent one); the pre-restore one has its own slot
  const lastRegular = idx.list.filter((x) => x.kind !== 'before-restore').sort((x, y) => y.at - x.at)[0];
  const slot = kind === 'before-restore' ? 'snap:pre' : `snap:${lastRegular ? (lastRegular.slot + 1) % KEEP : 0}`;
  await save({ app: 'wiw-forstall', savedAt: new Date(at).toISOString(), data }, slot);
  const entry = { key: slot, slot: kind === 'before-restore' ? -1 : Number(slot.split(':')[1]), at, kind, size: sizeOf(data) };
  idx.list = [entry, ...idx.list.filter((x) => x.key !== slot)].sort((a, b) => b.at - a.at).slice(0, KEEP + 1);
  await save(idx, INDEX);
  return entry;
}

async function restore(data) {
  if (!data || typeof data !== 'object') throw new Error('That file isn’t a Wild Imaginary West backup.');
  const keys = [...KEYS, ...Object.keys(data).filter(isMapKey)].filter((k) => Object.hasOwn(data, k) && data[k] !== undefined);
  if (!keys.includes('combat') && !keys.includes('state')) throw new Error('That file isn’t a Wild Imaginary West backup.');
  await snapshot('before-restore'); // so a restore can be undone
  for (const k of keys) if (data[k] !== null) await save(data[k], k);
  return { restored: keys.length };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    // the nightly job: Vercel Cron (with CRON_SECRET set, it must match); at most one nightly snapshot per 12 hours
    if (url.searchParams.get('nightly')) {
      const secret = process.env.CRON_SECRET;
      if (secret && req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'Not allowed.' });
      const idx = (await load(INDEX)) || { list: [] };
      const last = idx.list.find((x) => x.kind === 'nightly');
      if (last && Date.now() - last.at < MIN_GAP) return send(res, 200, { skipped: true, last: last.at });
      return send(res, 200, { ok: true, snap: await snapshot('nightly') });
    }
    if (!pinOk(req.headers['x-warden-pin'])) return send(res, 401, { error: 'Wrong PIN.' });
    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'snaps') return send(res, 200, { list: ((await load(INDEX)) || { list: [] }).list });
      return send(res, 200, { app: 'wiw-forstall', savedAt: new Date().toISOString(), data: await gather([...KEYS, ...mapKeys(await load('battle'))]) });
    }
    const body = await readBody(req);
    switch (body.action) {
      case 'snapshot': return send(res, 200, { result: await snapshot('manual') });
      case 'restoreSnap': {
        const idx = (await load(INDEX)) || { list: [] };
        const e = idx.list.find((x) => x.key === String(body.key || ''));
        if (!e) throw new Error('That backup isn’t there any more.');
        const snap = await load(e.key);
        return send(res, 200, { result: await restore(snap?.data) });
      }
      case 'restoreFile': return send(res, 200, { result: await restore(body.data?.data || body.data) });
      default: throw new Error('Unknown action.');
    }
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
