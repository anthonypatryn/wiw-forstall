// The Journal: the newspapers the posse has made the front page of (quests and clues join here next).
import { $, esc, api, startPolling, toast, mountNav, tryWarden, savedPin, ask } from './common.js';
import { mountTableLog } from './tablelog.js';
import { paperHTML, openPaper } from './paper.js';

mountTableLog();
mountNav('/journal');
const EP = '/api/papers';
let papers = null, warden = false;

function renderPapers() {
  if (!papers) return;
  const list = papers.issues || [];
  $('#papers').innerHTML = list.length ? list.map((p) => `<div><button type="button" class="jn-paper" data-paper="${esc(p.id)}">${p.published ? '' : '<span class="pill wait jn-draft">not printed yet</span>'}<div class="np-mini">${paperHTML(p, papers.posse)}</div></button>
      ${warden ? `<div class="jn-tools">${p.published ? `<button type="button" class="btn small secondary" data-unprint="${esc(p.id)}">Take it back</button>` : `<button type="button" class="btn small" data-print="${esc(p.id)}">Print it for the posse</button>`}<button type="button" class="btn small secondary danger" data-del="${esc(p.id)}">Delete</button></div>` : ''}</div>`).join('')
    : `<p class="empty-note">${warden ? 'No papers yet. End Session sets tonight’s front page.' : 'No papers yet. When the posse makes the news, the front page lands here.'}</p>`;
}
document.addEventListener('click', async (e) => {
  const act = (body, msg) => api('POST', body, '', EP).then((r) => { papers = r.state; renderPapers(); if (msg) toast(msg); }).catch((err) => toast(err.message, true));
  const t = e.target.closest('[data-paper]');
  if (t) { const p = papers.issues.find((x) => x.id === t.dataset.paper); if (p) openPaper(p, papers.posse); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.print) act({ action: 'publish', id: b.dataset.print }, 'Printed — it pops up for the posse.');
  if (b.dataset.unprint) act({ action: 'unpublish', id: b.dataset.unprint }, 'Taken back.');
  if (b.dataset.del && await ask('Delete this issue for everyone?')) act({ action: 'remove', id: b.dataset.del }, 'Deleted.');
});

(async () => {
  if (savedPin()) warden = await tryWarden(savedPin(), EP);
  startPolling(warden ? 'warden' : 'player', (d) => { papers = d; renderPapers(); }, null, EP);
})();
