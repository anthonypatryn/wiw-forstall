// The Posse Stash page (World ▾): what's in the stash, kept fresh; the button opens the put-in / take-out dialog (stash.js).
import { $, esc, api, mountNav, onChange, dollars as $$ } from './common.js';
import { mountTableLog } from './tablelog.js';

mountTableLog(); // also wires every [data-stash] button to the stash dialog
mountNav('/stash');
async function refresh() {
  try {
    const s = (await api('GET', null, '', '/api/combat')).stash || { money: 0, items: [] };
    $('#st-list').innerHTML = `<div class="item-row"><span class="item-who"><b>Money</b></span><b>${$$(s.money)}</b></div>`
      + (s.items.length ? s.items.map((i) => `<div class="item-row"><span class="item-who"><b>${esc(i.name)}</b>${i.where ? `<small class="muted">${esc(i.where)}</small>` : ''}</span><span>${i.qty > 1 ? `${i.qty}×` : ''}</span></div>`).join('')
        : '<p class="empty-note">No gear in here yet. Tap “Put in or take out” to stash something from your sheet.</p>');
  } catch (err) { $('#st-list').innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
}
refresh();
onChange(['combat'], refresh); // the stash lives in the combat document
