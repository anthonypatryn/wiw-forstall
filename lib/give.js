// Handing a find to a character, and springing a trap on them. Shared by the Lock Pick game and the Battle Map's
// chests, bodies and traps, so loot and traps work the same everywhere.
import { publicAction } from './combat.js';
import { equipItem } from './sheets.js';
import { findItem } from './shop.js';

const money = (v) => Number(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;

// loot: {kind: money|scrap|item|custom, amount | itemId | name+desc} → Money/Scrap on the sheet, an item in the Inventory
export function giveLoot(pc, l, shop, tag = '') {
  if (!pc || !l) return;
  if (l.kind === 'money') pc.wallet = (money(pc.wallet) + l.amount).toFixed(2);
  else if (l.kind === 'scrap') pc.scrap = String(money(pc.scrap) + l.amount);
  else {
    const it = l.kind === 'item' && shop ? findItem(shop, l.itemId) : null;
    if (it) l.name = it.name;
    pc.items ||= [];
    pc.items.push({ uid: Math.random().toString(36).slice(2, 10), itemId: it?.id || `found-${tag || Math.random().toString(36).slice(2, 8)}`, name: it?.name || l.name, cat: it?.cat || 'Goods & Services', sub: it?.sub || 'Found', qty: 1, ...(l.desc ? { note: l.desc } : {}) });
    if (it) equipItem(pc, it, 1);
  }
  pc.updated = Date.now();
}

// trap: {damage, status, sev} → Health lost and/or a Status, through the combat rules
export function springTrap(combat, pc, trap) {
  if (!pc || !trap) return;
  if (trap.damage) publicAction(combat, { action: 'pc', id: pc.id, op: 'health', delta: -trap.damage }, { warden: true });
  if (trap.status) publicAction(combat, { action: 'pc', id: pc.id, op: 'status', status: trap.status, value: Math.min(6, (pc.statuses?.[trap.status] || 0) + trap.sev) }, { warden: true });
}
