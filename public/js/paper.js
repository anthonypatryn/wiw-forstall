// The newspaper front page: rendering, the full-screen reader (with Print), and the "Extra! Extra!" pop-up for players.
import { esc, api, startPolling, savedPin, store, paras } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const EP = '/api/papers';
// the paper's own look loads only when a paper is shown
export function paperStyles() {
  if (document.getElementById('paper-css')) return;
  document.head.insertAdjacentHTML('beforeend', `<link id="paper-fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap">
    <link id="paper-css" rel="stylesheet" href="/css/paper.css?v=1">`);
}
const face = (p) => (p.portrait ? `/api/image?ns=pc&id=${encodeURIComponent(p.id)}&size=head&v=${p.portrait}` : `/img/tokens/trade-${String(p.trade || '').toLowerCase()}.webp`);
const roman = (n) => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');

export function paperHTML(p, posse = []) {
  const faces = (p.faces || []).map((id) => posse.find((x) => x.id === id)).filter(Boolean);
  return `<article class="newspaper">
    <header class="np-mast">
      <div class="np-ears"><span>ESTABLISHED<br>IN THE WEST</span><span>PRICE<br>FIVE CENTS</span></div>
      <h1 class="np-name">${esc(p.paper || 'The Frontier Gazette')}</h1>
      <div class="np-bar"><span>VOL. ${roman(Math.ceil((p.no || 1) / 52))} — No. ${p.no || 1}</span><span>${esc((p.townName || 'The Uncivilized West').toUpperCase())}</span><span>${esc(p.date || '')}</span></div>
    </header>
    <h2 class="np-head">${esc(p.headline || 'Headline')}</h2>
    ${p.subhead ? `<p class="np-sub">${esc(p.subhead)}</p>` : ''}
    <div class="np-cols">
      <div class="np-lead">${faces.length ? `<div class="np-faces">${faces.map((x) => `<figure><img src="${esc(face(x))}" alt=""><figcaption>${esc(x.name)}</figcaption></figure>`).join('')}</div>` : ''}${paras(p.lead)}</div>
      ${(p.stories || []).map((s) => `<section class="np-story"><h3>${esc(s.head)}</h3>${paras(s.text)}</section>`).join('')}
      ${p.quote ? `<blockquote class="np-quote">${esc(p.quote)}</blockquote>` : ''}
      ${p.classifieds?.length ? `<section class="np-wanted"><h3>WANTED</h3>${p.classifieds.map((c) => `<div class="np-want"><b>${esc(c.name)}</b>${c.reward ? `<span>$${esc(c.reward)} REWARD</span>` : ''}${c.crime ? `<small>${esc(c.crime)}</small>` : ''}</div>`).join('')}<small class="np-note">Inquire with the local law.</small></section>` : ''}
      ${(p.ads || []).map((a) => `<aside class="np-ad">${esc(a)}</aside>`).join('')}
    </div>
  </article>`;
}

// read it big; Print sends just the paper to the printer (or a PDF)
export function openPaper(p, posse = [], { kicker = '' } = {}) {
  paperStyles();
  const back = document.createElement('div');
  back.className = 'modal-back paper-back';
  back.innerHTML = `<div class="paper-wrap" role="dialog" aria-modal="true" aria-label="${esc(p.paper)}">
    ${kicker ? `<div class="paper-kicker">${esc(kicker)}</div>` : ''}
    ${paperHTML(p, posse)}
    <div class="btn-row paper-btns"><button type="button" class="btn secondary" data-print>${gl('scroll')} Print or save as PDF</button><button type="button" class="btn" data-close>Close</button></div></div>`;
  document.body.append(back);
  document.body.classList.add('printing-paper');
  const close = () => { back.remove(); document.body.classList.remove('printing-paper'); };
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-print]')) window.print();
  });
  return close;
}

// a new issue pops up once per device ("Extra! Extra!")
export function watchPapers() {
  if (savedPin()) return;
  startPolling('player', (d) => {
    const seen = new Set(store.get('wiw.papersSeen', []));
    const fresh = (d.issues || []).find((p) => !seen.has(p.id));
    if (!fresh || document.querySelector('.paper-back')) return;
    // first visit ever: don't dump the whole archive on them, just the newest issue
    (d.issues || []).forEach((p) => seen.add(p.id));
    store.set('wiw.papersSeen', [...seen].slice(-100));
    if (Date.now() - (fresh.publishedAt || 0) > 3 * 86400e3) return; // old news
    play('chime');
    openPaper(fresh, d.posse, { kicker: 'EXTRA! EXTRA! READ ALL ABOUT IT!' });
  }, null, EP);
}
