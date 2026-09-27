// Book Tables (Run the Game → Start Something): roll on the expansion books' encounter, event, weather and
// scene tables. The dice are rolled by the server into the Warden's hidden log; "Read it out" puts the result
// in the Table Log for everyone.
import { esc, api, toast, store } from './common.js';
import { gl } from './glyphs.js';
import { TABLE_GROUPS, FACE_ORDER, pairKey, tableById } from './booktables.js';

const FACE = { blank: 'Blank', spur: 'Spur', hit: 'Hit', ace: 'Ace' };
const POOL = { '1B': '1B', '1G': '1G', cols: '1B', '2B': '2B' };

export function mountBookTables(el) {
  const st = { id: store.get('wiw.bookTable', 'ep-sheriff'), col: 0, pick: null, faces: null, busy: false };
  if (!tableById(st.id)) st.id = 'ep-sheriff';

  const resultText = (t) => {
    if (st.pick == null) return '';
    if (t.kind === 'cols') return `${t.cols[st.col]}: ${t.rows[st.pick][st.col]}`;
    if (t.kind === 'list') { const [name, size, qty] = t.rows[st.pick]; return `${name} (${size}), ${qty}`; }
    if (t.kind === 'hits') return t.rows[st.pick][1];
    if (t.kind === '2B') return t.rows[st.pick];
    return t.rows[st.pick];
  };

  const rowsHTML = (t) => {
    const row = (i, label, text) => `<tr class="${st.pick === i ? 'bt-on' : ''}"><th>${label}</th><td>${text}</td></tr>`;
    if (t.kind === 'list') return t.rows.map(([n, size, qty], i) => row(i, esc(size), `${esc(n)} <span class="muted">× ${esc(qty)}</span>`)).join('');
    if (t.kind === 'hits') return t.rows.map(([h, text], i) => row(i, `${h}${i === t.rows.length - 1 ? '+' : t.rows[i + 1] && t.rows[i + 1][0] - h > 1 ? `–${t.rows[i + 1][0] - 1}` : ''} Hits`, esc(text))).join('');
    if (t.kind === '2B') return Object.entries(t.rows).map(([k, text]) => row(k, k.split(',').map((f) => FACE[f]).join(', '), esc(text))).join('');
    if (t.kind === 'cols') return t.rows.map((r, i) => row(i, FACE[FACE_ORDER[i]], esc(r[st.col]))).join('');
    return t.rows.map((text, i) => row(i, FACE[FACE_ORDER[i]], esc(text))).join('');
  };

  const draw = () => {
    const t = tableById(st.id);
    const out = resultText(t);
    el.innerHTML = `<div class="bt">
      <label class="field-step"><span>TABLE</span><select data-bt-pick aria-label="Pick a table">${TABLE_GROUPS.map((g) => `<optgroup label="${esc(g.group)}">${g.tables.map((x) => `<option value="${x.id}"${x.id === st.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <p class="bt-intro">${esc(t.intro || '')} <span class="muted">(${esc(t.book)} p. ${t.page})</span></p>
      ${t.kind === 'cols' ? `<div class="chip-row">${t.cols.map((c, i) => `<button type="button" class="chip-btn${i === st.col ? ' on' : ''}" data-bt-col="${i}">${esc(c)}</button>`).join('')}</div>` : ''}
      <table class="bt-table"><tbody>${rowsHTML(t)}</tbody></table>
      <div class="btn-row">
        ${POOL[t.kind] ? `<button type="button" class="btn small" data-bt-roll${st.busy ? ' disabled' : ''}>${gl('die')} Roll ${POOL[t.kind]}</button>` : ''}
        ${t.kind === 'list' ? `<button type="button" class="btn small" data-bt-any>${gl('die')} Pick one at random</button>` : ''}
        ${t.kind === 'hits' ? `<span class="muted">Tap the row for the Hits they rolled.</span>` : ''}
      </div>
      ${out ? `<div class="bt-result">${st.faces ? `<small>${esc(st.faces)}</small>` : ''}<p>${esc(out)}</p>
        <button type="button" class="btn small secondary" data-bt-say>${gl('scroll')} Read it out to the table</button></div>` : ''}
    </div>`;
  };

  el.addEventListener('change', (e) => {
    if (!e.target.matches('[data-bt-pick]')) return;
    st.id = e.target.value; st.pick = null; st.faces = null; st.col = 0;
    store.set('wiw.bookTable', st.id);
    draw();
  });
  el.addEventListener('click', async (e) => {
    const t = tableById(st.id);
    const b = e.target.closest('button, tr');
    if (!b) return;
    if (b.dataset.btCol) { st.col = Number(b.dataset.btCol); draw(); return; }
    if (b.matches('tr') && (t.kind === 'hits' || t.kind === 'list')) { st.pick = [...b.parentNode.children].indexOf(b); st.faces = null; draw(); return; }
    if (b.dataset.btAny !== undefined) { st.pick = Math.floor(Math.random() * t.rows.length); st.faces = null; draw(); return; }
    if (b.dataset.btRoll !== undefined) {
      st.busy = true; draw();
      try {
        const r = await api('POST', { action: 'roll', who: 'warden', pool: POOL[t.kind], label: `Book table · ${t.name}`, hidden: true }, '', '/api/combat');
        const faces = (r.result?.dice || []).map((d) => d.face);
        st.faces = `Rolled ${faces.map((f) => FACE[f]).join(', ')}`;
        st.pick = t.kind === '2B' ? pairKey(faces[0], faces[1]) : FACE_ORDER.indexOf(faces[0]);
      } catch (err) { toast(err.message, true); }
      st.busy = false; draw(); return;
    }
    if (b.dataset.btSay !== undefined) {
      try { await api('POST', { action: 'announce', text: `${t.name}: ${resultText(t)}` }, '', '/api/combat'); toast('It’s in the Table Log.'); }
      catch (err) { toast(err.message, true); }
    }
  });
  draw();
}
