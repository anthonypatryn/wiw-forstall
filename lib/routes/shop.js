import { load, save } from '../store.js';
import { pinOk, send, readBody } from '../http.js';
import { freshShop, shopAction, shopView, CATEGORIES } from '../shop.js';
import { freshCombat } from '../combat.js';
import { CATALOG } from '../catalog.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const warden = pinOk(req.headers['x-warden-pin']);
    if (req.method === 'GET' && url.searchParams.get('view') === 'catalog') {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return send(res, 200, { catalog: CATALOG, categories: CATEGORIES });
    }
    const [stored, storedCombat] = await Promise.all([load('shop'), load('combat')]);
    const shop = stored || freshShop();
    const combat = storedCombat || freshCombat();
    const view = () => shopView(shop, { warden, combat });

    if (req.method === 'GET') {
      if (url.searchParams.get('view') === 'warden' && !warden) return send(res, 401, { error: 'Wrong PIN.' });
      const v = view();
      if (url.searchParams.get('since') === v.v) return send(res, 200, { v: v.v, unchanged: true });
      return send(res, 200, v);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    if (body.action === 'auth') return send(res, warden ? 200 : 401, warden ? { ok: true } : { error: 'Wrong PIN.' });
    const result = shopAction(shop, combat, body, { warden }) ?? null;
    shop.v = (shop.v || 0) + 1;
    combat.v = (combat.v || 0) + 1; // sheets, wallets and the table log live in the combat document
    await Promise.all([save(shop, 'shop'), save(combat, 'combat')]);
    return send(res, 200, { result, state: view() });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}
