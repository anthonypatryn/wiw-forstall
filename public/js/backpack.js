// The Backpack: items and notes the posse has been handed and shown around — plus "just you" for this device's character.
import { $, esc, api, startPolling, toast, mountNav, tryWarden, savedPin, store, ask, me } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';
import { handoutHTML, openHandout } from './handouts.js';

mountTableLog();
mountNav('/backpack');
let data = null, warden = false, names = {};

function tile(h) {
  const to = h.to === 'all' ? 'the posse' : (h.to || []).map((id) => names[id] || '?').join(' & ');
  return `<button type="button" class="bp-tile ${h.kind}" data-h="${esc(h.id)}">${handoutHTML(h)}
    <span class="bp-meta">${h.kind === 'note' ? 'Note' : 'Item'}${warden ? ` · to ${esc(to)}` : ''}${h.sharedBy ? ` · shown by ${esc(h.sharedBy)}` : ''}${warden && !h.shared ? ' · <b class="pill">private</b>' : ''}</span></button>`;
}
function render() {
  if (!data) return;
  const list = data.list || [];
  const shared = list.filter((h) => h.shared || h.to === 'all');
  const mine = list.filter((h) => !h.shared && h.to !== 'all');
  $('#bp-shared').innerHTML = shared.length ? `<div class="bp-grid">${shared.map(tile).join('')}</div>` : '<p class="muted">Nothing in the Backpack yet. When the Warden hands the posse something — or someone shows what they were given — it lands here.</p>';
  $('#bp-mine-card').hidden = !mine.length;
  $('#bp-mine-h').textContent = warden ? 'Handed out privately' : 'Just you';
  $('#bp-mine').innerHTML = `<div class="bp-grid">${mine.map(tile).join('')}</div>`;
}
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-h]');
  if (!t) return;
  const h = data.list.find((x) => x.id === t.dataset.h);
  if (!h) return;
  const privateMine = !h.shared && Array.isArray(h.to) && h.to.includes(me());
  const act = (body, msg) => api('POST', body, '', '/api/handouts').then((r) => { data = r.state; render(); toast(msg); }).catch((err) => toast(err.message, true));
  await openHandout(h, {
    buttons: [
      ...(privateMine && !warden ? [{ label: `${gl('hat')} Show the posse`, cls: 'secondary', onClick: () => act({ action: 'share', id: h.id, pc: me() }, 'Shown to the posse.') }] : []),
      ...(warden ? [
        { label: h.shared ? 'Make private again' : 'Show the posse', cls: 'secondary', onClick: () => act({ action: 'edit', id: h.id, shared: !h.shared }, h.shared ? 'Private again.' : 'Shown to the posse.') },
        { label: 'Delete', cls: 'secondary danger', onClick: async () => { if (await ask(`Delete “${h.title}” for everyone?`)) await act({ action: 'remove', id: h.id }, 'Deleted.'); } },
      ] : []),
      { label: 'Close' },
    ],
  });
});

function connect() {
  const view = warden ? 'warden' : `player&pc=${encodeURIComponent(me() || '')}`;
  startPolling(view, (d) => { data = d; render(); }, null, '/api/handouts');
  api('GET', null, '?view=player', '/api/combat').then((c) => { names = Object.fromEntries((c.posse || []).map((p) => [p.id, p.name])); render(); }).catch(() => {});
}
(async () => {
  if (savedPin()) warden = await tryWarden(savedPin(), '/api/handouts');
  $('#bp-who').textContent = warden ? 'Everything handed out — shared and private.' : me() ? '' : 'Tip: pick who you’re playing (the “This is me” star on your sheet) to see things handed just to you.';
  connect();
})();
