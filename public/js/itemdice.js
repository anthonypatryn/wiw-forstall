// Extra dice from an item (a lucky charm, a tool, a trophy): the Warden adds them when calling for a roll (BUG-11: players
// don't add their own); the Warden's own rolls on a sheet can ask too.
// itemDiceHTML() is a small row of + Black / + Gold steppers with a "from what?" box; readItemDice(root) reads it.
// askItemDice(title) is the same row in a quick dialog, for rolls that otherwise fire on one tap (the sheet's Skills).
import { esc } from './common.js';

const MAX = 4;
export const itemDiceHTML = (v = {}, hint = 'from something they carry') => `<div class="item-dice" data-item-dice>
  <span class="id-h">ITEM DICE <small>${esc(hint)}</small></span>
  <span class="id-step" data-k="b"><button type="button" data-id-step="-1" aria-label="One less Black die">−</button><b data-id-n>${Number(v.itemB) || 0}</b><span>B</span><button type="button" data-id-step="1" aria-label="One more Black die">+</button></span>
  <span class="id-step gold" data-k="g"><button type="button" data-id-step="-1" aria-label="One less Gold die">−</button><b data-id-n>${Number(v.itemG) || 0}</b><span>G</span><button type="button" data-id-step="1" aria-label="One more Gold die">+</button></span>
  <input data-id-from maxlength="40" placeholder="from what? (e.g. lucky horseshoe)" aria-label="Which item" value="${esc(v.itemFrom || '')}">
</div>`;

// steppers work wherever the row is on the page
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id-step]'); if (!b) return;
  const n = b.closest('.id-step').querySelector('[data-id-n]');
  n.textContent = String(Math.max(0, Math.min(MAX, Number(n.textContent) + Number(b.dataset.idStep))));
});

export function readItemDice(root) {
  const box = root?.querySelector('[data-item-dice]');
  if (!box) return { itemB: 0, itemG: 0, itemFrom: '' };
  const n = (k) => Number(box.querySelector(`.id-step[data-k="${k}"] [data-id-n]`).textContent) || 0;
  return { itemB: n('b'), itemG: n('g'), itemFrom: box.querySelector('[data-id-from]').value.trim().slice(0, 40) };
}
// "+1B2G (lucky horseshoe)" for a label, or ''
export const itemDiceLabel = ({ itemB, itemG, itemFrom }) => (itemB || itemG ? `+${itemB ? `${itemB}B` : ''}${itemG ? `${itemG}G` : ''}${itemFrom ? ` (${itemFrom})` : ''}` : '');

// → {itemB, itemG, itemFrom}, or null if they backed out
export function askItemDice(title) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    back.innerHTML = `<div class="modal ask" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>
      <p class="ask-body">Any item adding dice to this roll? Add them, or just roll.</p>${itemDiceHTML()}
      <div class="btn-row ask-btns"><button type="button" class="btn" data-go>Roll</button><button type="button" class="btn secondary" data-x>Cancel</button></div></div>`;
    const done = (v) => { back.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(readItemDice(back)); }
    };
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('[data-x]')) done(null);
      else if (e.target.closest('[data-go]')) done(readItemDice(back));
    });
    document.addEventListener('keydown', key, true);
    document.body.append(back);
    back.querySelector('[data-go]').focus();
  });
}
