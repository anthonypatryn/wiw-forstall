// Book Tables (Run the Game → Start Something): roll on the expansion books' encounter, event, weather and
// scene tables. The dice are rolled by the server into the Warden's hidden log; "Read it out" puts the result
// in the Table Log for everyone.
import { esc, api, toast, store, askText } from './common.js';
import { gl } from './glyphs.js';
import { TABLE_GROUPS, FACE_ORDER, pairKey, tableById } from './booktables.js';

const FACE = { blank: 'Blank', spur: 'Spur', hit: 'Hit', ace: 'Ace' };
const POOL = { '1B': '1B', '1G': '1G', cols: '1B', '2B': '2B' };
const poolOf = (t) => t.die || POOL[t.kind];
// a small town has these, a large town these, plus Faction buildings rolled on the Town Building table (Guidebook p. 201)
const SMALL = 'an inn, a saloon, a general store and a church', LARGE = 'an inn, a saloon, a general store, a church, a weapon smith, a mech engineer, a veterinarian, a doctor, a bank, a schoolhouse and a restaurant';

export function mountBookTables(el) {
  const st = { id: store.get('wiw.bookTable', 'ep-sheriff'), col: 0, pick: null, faces: null, busy: false };
  if (!tableById(st.id)) st.id = 'ep-sheriff';

  const resultText = (t) => {
    if (st.pick == null) return '';
    if (t.kind === 'cols') return `${t.cols[st.col]}: ${t.rows[st.pick][st.col]}`;
    if (t.kind === 'list') { const [name, size, qty] = t.rows[st.pick]; return `${name} (${size}), ${qty}`; }
    if (t.kind === 'hits') return t.rows[st.pick][1];
    if (t.kind === '2B') return t.rows[st.pick] || 'Spur & Ace isn’t on the book’s table: roll again.';
    if (t.kind === 'town') return st.town?.text || '';
    return t.rows[st.pick];
  };

  const rowsHTML = (t) => {
    if (t.kind === 'town') return '';
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
        ${poolOf(t) ? `<button type="button" class="btn small" data-bt-roll${st.busy ? ' disabled' : ''}>${gl('die')} Roll ${poolOf(t)}</button>` : ''}
        ${t.kind === 'town' ? `<button type="button" class="btn small" data-bt-town${st.busy ? ' disabled' : ''}>${gl('die')} Roll a place</button>` : ''}
        ${t.kind === 'list' ? `<button type="button" class="btn small" data-bt-any>${gl('die')} Pick one at random</button>` : ''}
        ${t.kind === 'hits' ? `<span class="muted">Tap the row for the Hits they rolled.</span>` : ''}
      </div>
      ${out ? `<div class="bt-result">${st.faces ? `<small>${esc(st.faces)}</small>` : ''}<p>${esc(out)}</p>
        <button type="button" class="btn small secondary" data-bt-say>${gl('scroll')} Read it out to the table</button>${t.kind === 'town' ? ` <button type="button" class="btn small secondary" data-bt-pin>${gl('pin')} Pin it on the Map</button>` : ''}</div>` : ''}
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
        const r = await api('POST', { action: 'roll', who: 'warden', pool: poolOf(t), label: `Book table · ${t.name}`, hidden: true }, '', '/api/combat');
        const faces = (r.result?.dice || []).map((d) => d.face);
        st.faces = `Rolled ${faces.map((f) => FACE[f]).join(', ')}`;
        st.pick = t.kind === '2B' ? pairKey(faces[0], faces[1]) : FACE_ORDER.indexOf(faces[0]);
      } catch (err) { toast(err.message, true); }
      st.busy = false; draw(); return;
    }
    if (b.dataset.btTown !== undefined) { // Towns & Outposts: size, then what's there
      st.busy = true; draw();
      try {
        const roll = async (pool, label) => (await api('POST', { action: 'roll', who: 'warden', pool, label: `Book table · ${label}`, hidden: true }, '', '/api/combat')).result.dice.map((d) => d.face);
        const tb = (id) => tableById(id);
        const two = async (id, label) => { for (let i = 0; i < 5; i += 1) { const f = await roll('2B', label); const v = tb(id).rows[pairKey(f[0], f[1])]; if (v) return v; } return tb(id).rows['blank,blank']; };
        const size = tb('gb-size').rows[FACE_ORDER.indexOf((await roll('1B', 'Establishment size'))[0])];
        let text;
        if (size === 'Homestead') text = `A homestead. ${tb('gb-homestead').rows[FACE_ORDER.indexOf((await roll('1B', 'Homestead situation'))[0])]}`;
        else if (size === 'Outpost') text = `An outpost: ${await two('gb-outpost', 'Outpost situation')}.`;
        else {
          const n = size === 'Large Town' ? 3 : 1, list = [];
          for (let i = 0; i < n; i += 1) list.push(await two('gb-building', 'Town building'));
          text = `A ${size.toLowerCase()} with ${size === 'Large Town' ? LARGE : SMALL}, and ${n > 1 ? `three Faction buildings: ${list.join(', ')}` : `one Faction building: ${list[0]}`}.`;
        }
        st.town = { size, text }; st.pick = 'town'; st.faces = null;
      } catch (err) { toast(err.message, true); }
      st.busy = false; draw(); return;
    }
    if (b.dataset.btPin !== undefined && st.town) { // drop it on the Map, near the posse
      const name = await askText('Name this place for the Map:', st.town.size);
      if (!name) return;
      try {
        const map = await api('GET', null, '?view=warden', '/api/map');
        const tok = Object.values(map.tokens || {});
        const x = tok.length ? tok.reduce((a, t) => a + t.x, 0) / tok.length + 40 : 1228, y = tok.length ? tok.reduce((a, t) => a + t.y, 0) / tok.length - 40 : 700;
        const pin = (await api('POST', { action: 'pin', name, x, y, shared: false }, '', '/api/map')).result;
        await api('POST', { action: 'note', place: pin.id, text: st.town.text, shared: false }, '', '/api/map');
        toast(`${name} is pinned on the Map (hidden from the posse until you show it).`);
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (b.dataset.btSay !== undefined) {
      try { await api('POST', { action: 'announce', text: `${t.name}: ${resultText(t)}` }, '', '/api/combat'); toast('It’s in the Table Log.'); }
      catch (err) { toast(err.message, true); }
    }
  });
  draw();
}
