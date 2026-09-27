// The Traveling Carnival (Judgment on the Iron Road pp. 62–67). Players: an invite when the Warden opens it, then a
// scene of booths played with their own sheet (every roll is public, in the Table Log) and a prize booth.
// The Warden: a card on Run the Game (Start Something) to open or pack up the carnival and see who's won what.
import { esc, api, toast, store, me, savedPin, startPolling, ask, onChange, dollars as $$ } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';
import { runShow, hasShow } from './carnival-shows.js';

const EP = '/api/carnival';
const FACE = { blank: 'Blank', spur: 'Spur', hit: 'Hit', ace: 'Ace' };
let view = null, scene = null, busy = false, lastRolls = [];

export function carnivalStyles() {
  if (document.getElementById('carnival-css')) return;
  document.head.insertAdjacentHTML('beforeend', '<link id="carnival-css" rel="stylesheet" href="/css/carnival.css?v=4">');
}

const BOOTHS = [
  { id: 'horseshoe', name: 'Horseshoe Toss', icon: 'horseshoe', rules: 'Three tosses at a railroad spike: roll Finesse three times, needing 2, then 3, then 4 Hits. Ring all three for a small prize voucher.', go: 'Toss the horseshoes' },
  { id: 'wheel', name: 'Wheel of Fortune', icon: 'die', rules: 'Pay $0.05 to $1.00 and spin (2B). Most of the wheel loses your money; the rest doubles, triples or even quadruples it.', go: 'Spin the wheel', stake: true },
  { id: 'archery', name: 'Archery Competition', icon: 'target', rules: 'Five shots at moving targets with the carnie’s bow, 3B a shot (reroll Spurs with the Bows Talent). Beat Big Hal’s total for a medium prize voucher.', go: 'Take your five shots' },
  { id: 'striker', name: 'High Striker', icon: 'flash', rules: 'Swing the mallet: roll Nerve. 5 Hits or more rings the bell for a large prize. The first swing comes with your ticket; after that it’s $0.25 a swing.', go: 'Swing the mallet' },
  { id: 'fortune', name: 'Fortune Teller', icon: 'scroll', rules: 'The mystic reads your palm: roll 1B for a good fortune (Hit or Ace) or a bad one (Blank or Spur), then 1B for which.', go: 'Have your palm read' },
  { id: 'pie', name: 'Pie Eating Contest', icon: 'fire', rules: 'Memaw’s strawberry rhubarb pie against two carnies: roll Nerve each round, needing 2 Hits, then 3, then 4… Last one eating wins a medium prize voucher.', go: 'Dig in' },
  { id: 'pig', name: 'Greased Pig Chase', icon: 'lasso', rules: 'Three grabs at a small pig covered in grease: roll Finesse, and 3 Hits holds on. Catch it for a small prize voucher. (House rule; the book leaves it to the Warden.)', go: 'Chase the pig' },
];

const diceText = (r) => r.dice.map((d) => FACE[d.face]).join(', ');
function sceneHTML() {
  const d = view, m = d?.me;
  if (!d?.open) return `<div class="cv-closed"><h2>The carnival has packed up.</h2><button type="button" class="btn" data-cv-x>Close</button></div>`;
  const v = m?.vouchers || { small: 0, medium: 0, large: 0 };
  const last = m?.last;
  return `<header class="cv-head"><div><div class="cv-kicker">${gl('star')} THE TRAVELING CARNIVAL · ${esc(d.where.toUpperCase())}</div>
      <h2>Wild Oddities &amp; Western Curiosities</h2></div>
      <div class="cv-me"><span>${$$(m?.wallet || 0)}</span><span class="cv-v">Vouchers: ${v.small} small · ${v.medium} medium · ${v.large} large</span></div>
      <button type="button" class="cv-x" data-cv-x aria-label="Leave the carnival">×</button></header>
    ${!m?.ticket ? `<div class="cv-ticket"><p>Tickets are sold at a long covered booth by friendly cashiers.</p><button type="button" class="btn" data-cv="ticket">${gl('star')} Buy a ticket (${$$(d.ticket)})</button></div>` : ''}
    ${last ? `<div class="cv-last"><b>${esc(last.text)}</b>${lastRolls.length ? `<small>${lastRolls.map((r) => `${esc(r.who)}: ${esc(r.label)} ${esc(r.pool)} → ${esc(diceText(r))} (${r.hits} Hit${r.hits === 1 ? '' : 's'})`).join('<br>')}</small>` : ''}</div>` : ''}
    <div class="cv-booths">${BOOTHS.map((b) => `<section class="cv-booth">
      <h3>${gl(b.icon)} ${esc(b.name)}</h3><p>${esc(b.rules)}</p>
      ${b.stake ? '<label class="cv-stake">Stake $<input type="number" min="0.05" max="1" step="0.05" value="0.25" data-num="0.05" data-cv-stake></label>' : ''}
      <button type="button" class="btn small" data-cv="${b.id}"${m?.ticket && !busy ? '' : ' disabled'}>${esc(b.id === 'striker' && m?.swung ? `Swing again (${$$(d.retry)})` : b.go)}</button></section>`).join('')}
    </div>
    <section class="cv-prizes"><h3>${gl('trophy')} The Prize Booth</h3>
      <p class="muted">Trade two small vouchers for a medium, two medium for a large, or back down.</p>
      <div class="chip-row">${[['small', 'medium'], ['medium', 'large'], ['medium', 'small'], ['large', 'medium']].map(([f, t]) => `<button type="button" class="chip-btn" data-cv-swap="${f}:${t}"${(f === 'small' || (f === 'medium' && t === 'large')) ? (v[f] >= 2 ? '' : ' disabled') : (v[f] ? '' : ' disabled')}>${f === 'small' || (f === 'medium' && t === 'large') ? `2 ${f} → 1 ${t}` : `1 ${f} → 2 ${t}`}</button>`).join('')}</div>
      <div class="cv-prize-grid">${['small', 'medium', 'large'].map((size) => d.prizes[size].map(([n, note]) => `<div class="cv-prize"><b>${esc(n)}</b><small>${esc(size.toUpperCase())} · ${esc(note)}</small>
        <button type="button" class="btn small secondary" data-cv-prize="${esc(n)}"${v[size] ? '' : ' disabled'}>Claim</button></div>`).join('')).join('')}</div>
    </section>`;
}

async function act(body) {
  const r = await api('POST', { pc: me(), ...body }, '', EP);
  view = r.state;
  lastRolls = r.rolls || [];
  return r;
}
function render() { if (scene) scene.querySelector('.cv-scene').innerHTML = sceneHTML(); }
export function openCarnival() {
  carnivalStyles();
  if (scene) return;
  scene = document.createElement('div');
  scene.className = 'cv-back';
  scene.innerHTML = '<div class="cv-scene" role="dialog" aria-modal="true" aria-label="The Traveling Carnival"></div><div class="cv-showbox" hidden></div>';
  document.body.append(scene);
  render();
  scene.addEventListener('click', async (e) => {
    if (e.target.closest('.cv-showbox')) return; // the booth's show has its own button
    if (e.target.closest('[data-cv-x]') || e.target === scene) { scene.remove(); scene = null; showChip(); return; }
    const b = e.target.closest('button'); if (!b || busy) return;
    const d = b.dataset;
    let body = null;
    if (d.cv === 'wheel') body = { action: 'wheel', stake: Number(scene.querySelector('[data-cv-stake]')?.value) || 0.25 };
    else if (d.cv === 'striker' && view?.me?.swung) { if (!await ask(`Another swing costs ${$$(view.retry)}. Swing again?`, { ok: 'Swing', danger: false })) return; body = { action: 'striker' }; }
    else if (d.cv) body = { action: d.cv };
    else if (d.cvSwap) { const [from, to] = d.cvSwap.split(':'); body = { action: 'swap', from, to }; }
    else if (d.cvPrize) body = { action: 'prize', prize: d.cvPrize };
    if (!body) return;
    busy = true; render();
    try {
      const r = await act(body);
      if (hasShow(body.action) && r.result) await runShow(scene.querySelector('.cv-showbox'), body.action, r.result, r.rolls || []); // the booth plays out
      else { play('chips'); if (/Inventory/.test(r.result?.text || '')) play('success'); }
    } catch (err) { toast(err.message, true); }
    busy = false; render();
  });
}

// the corner chip to get back in while the carnival's in town
function showChip() {
  let chip = document.querySelector('.cv-chip');
  if (!view?.open || scene) { chip?.remove(); return; }
  carnivalStyles();
  if (!chip) {
    chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'cv-chip';
    chip.addEventListener('click', openCarnival);
    document.body.append(chip);
  }
  chip.innerHTML = `${gl('star')} The carnival`;
}

export function watchCarnival() {
  if (savedPin() || !me()) return;
  startPolling(`player&pc=${encodeURIComponent(me())}`, async (d) => {
    view = d;
    if (!d.open) { if (scene) { scene.remove(); scene = null; toast('The carnival has packed up its tents.'); } showChip(); return; }
    if (store.get('wiw.carnivalAsked', 0) !== d.at && !scene && !document.querySelector('.ask-back')) {
      store.set('wiw.carnivalAsked', d.at);
      play('chime');
      if (await ask(`The carnival’s in ${d.where}!\n\nThe Traveling Carnival of Wild Oddities and Western Curiosities: horseshoes, the Wheel of Fortune, archery, the High Striker, a fortune teller and a pie eating contest. Tickets are ${$$(d.ticket)}.`, { ok: 'Go to the carnival', cancel: 'Maybe later', danger: false })) openCarnival();
    }
    render(); showChip();
  }, null, EP);
}

// ---------- the Warden's card (Run the Game → Start Something) ----------
export function mountCarnivalDesk(el, getCombat) {
  const st = { where: 'Omaha' };
  let data = null;
  const refresh = () => api('GET', null, '?view=warden', EP).then((d) => { data = d; draw(); }).catch(() => {});
  onChange(['carnival', 'combat'], refresh); refresh();
  function draw() {
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const names = Object.fromEntries((getCombat()?.posse || []).map((p) => [p.id, p.name]));
    const rows = Object.entries(data?.all || {});
    el.innerHTML = data?.open
      ? `<p><b>Open in ${esc(data.where)}.</b> Players got an invite; the booths are on their screens.</p>
        ${rows.length ? `<ul class="cv-desk">${rows.map(([id, m]) => `<li><b>${esc(names[id] || id)}</b> ${m.ticket ? 'has a ticket' : 'no ticket yet'} · vouchers ${m.vouchers.small}/${m.vouchers.medium}/${m.vouchers.large}${m.last ? ` · <i>${esc(m.last.text)}</i>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nobody’s bought a ticket yet.</p>'}
            <button type="button" class="btn small secondary danger" data-cv-close>Pack up the carnival</button>`
      : `<p class="muted">Judgment on the Iron Road’s traveling carnival (Omaha, pp. 62–67). Everyone gets an invite; they buy a $0.25 ticket and play the booths with their own dice.</p>
        <label class="field-step"><span>WHERE</span><input maxlength="40" value="${esc(st.where)}" data-cv-where></label>
        <button type="button" class="btn small" data-cv-open>${gl('star')} Open the carnival</button>`;
  }
  el.addEventListener('input', (e) => { if (e.target.dataset.cvWhere !== undefined) st.where = e.target.value; });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.cvOpen !== undefined) { await api('POST', { action: 'open', where: st.where }, '', EP); toast('The carnival is open. Everyone gets an invite.'); }
      if (b.dataset.cvClose !== undefined) { if (!await ask('Pack up the carnival? Unused vouchers are lost.')) return; await api('POST', { action: 'close' }, '', EP); }
      refresh();
    } catch (err) { toast(err.message, true); }
  });
  return { draw };
}
