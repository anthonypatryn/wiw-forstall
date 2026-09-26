// Wanted posters, town by town. Everyone reads the board; the Warden puts posters up, edits, hides and pays them out.
import { $, esc, api, startPolling, toast, mountNav, tryWarden, savedPin, ask, askText, store, me } from './common.js';
import { mountTableLog } from './tablelog.js';
import { gl } from './glyphs.js';
import { shrink, showImage, loadImg } from './portrait.js';

mountTableLog();
mountNav('/wanted');
const EP = '/api/wanted';
const takers = (p) => (p.takenBy || []).map((id) => data?.names?.[id]).filter(Boolean);
const STAMP = { captured: 'CAPTURED', dead: 'DEAD', claimed: 'BOUNTY PAID' };
let data = null, warden = false, town = decodeURIComponent(location.hash.slice(1)) || null;

const townName = (id) => data?.towns.find((t) => t.id === id)?.name || 'Parts unknown';
const reward = (n) => (n ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0 })}` : '');
const NO_LIKENESS = `<span class="ps-nophoto">${gl('hat')}<small>NO LIKENESS ON FILE</small></span>`;
const tilt = (id) => ((parseInt(id, 16) % 7) - 3) * 0.6; // each poster hangs a little crooked, always the same way

function posterHTML(p, { big = false } = {}) {
  return `<div class="poster${big ? ' big' : ''}${p.status !== 'wanted' ? ` is-${p.status}` : ''}${p.hidden ? ' is-hidden' : ''}">
    <span class="nail" aria-hidden="true"></span>
    <div class="ps-wanted">WANTED</div>
    <div class="ps-terms">${esc((p.terms || 'Dead or Alive').toUpperCase())}</div>
    <div class="ps-photo">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : NO_LIKENESS}</div>
    <div class="ps-name">${esc(p.name)}</div>
    ${p.alias ? `<div class="ps-alias">alias “${esc(p.alias)}”</div>` : ''}
    ${p.crime ? `<div class="ps-crime">${esc(p.crime)}</div>` : ''}
    ${p.reward ? `<div class="ps-reward"><small>REWARD</small>${reward(p.reward)}</div>` : ''}
    ${STAMP[p.status] ? `<div class="ps-stamp">${STAMP[p.status]}</div>` : ''}
  </div>`;
}

function render() {
  if (!data) return;
  const posters = data.posters;
  const with_ = new Set(posters.map((p) => p.town));
  const tabs = data.towns.filter((t) => with_.has(t.id) || t.id === data.here || t.id === town || (warden && t.id.startsWith('wt-')));
  if (!town || !data.towns.some((t) => t.id === town)) town = data.here || tabs[0]?.id || data.towns[0]?.id;
  if (!tabs.some((t) => t.id === town) && town) tabs.unshift(data.towns.find((t) => t.id === town));
  tabs.sort((a, b) => (b.id === data.here) - (a.id === data.here));
  const count = (id) => posters.filter((p) => p.town === id && p.status === 'wanted' && (warden || !p.hidden)).length;
  $('#wt-towns').innerHTML = tabs.filter(Boolean).map((t) => `<button type="button" class="chip-btn${t.id === town ? ' on' : ''}" data-town="${esc(t.id)}">${esc(t.name)}${t.id === data.here ? '<small>the posse is here</small>' : count(t.id) ? `<small>${count(t.id)} wanted</small>` : ''}</button>`).join('')
    + `<label class="wt-other"><select data-other aria-label="Another town"><option value="">Another town…</option>${data.towns.filter((t) => !tabs.includes(t)).map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>`;
  $('#wt-here').textContent = data.here ? (town === data.here ? `The posse is in ${townName(town)}.` : `The posse is in ${townName(data.here)}.`) : '';
  const list = posters.filter((p) => p.town === town).sort((a, b) => (a.status === 'wanted' ? 0 : 1) - (b.status === 'wanted' ? 0 : 1) || b.at - a.at);
  $('#wt-board').innerHTML = list.length
    ? list.map((p) => `<button type="button" class="ps-tile" data-p="${esc(p.id)}" style="--tilt:${tilt(p.id)}deg">${posterHTML(p)}${warden && p.hidden ? '<span class="pill ps-flag">hidden</span>' : ''}${p.status === 'wanted' && p.takenBy?.length ? `<span class="pill info ps-taken">taken by ${esc(takers(p).join(', '))}</span>` : ''}</button>`).join('')
    : `<p class="empty-note">${warden ? `No posters in ${esc(townName(town))} yet. Put one up with “New poster”.` : `Nobody’s wanted in ${esc(townName(town))} right now. Must be a quiet town.`}</p>`;
  $('#wt-tools').innerHTML = warden ? `<button type="button" class="btn small secondary" data-newtown>+ New town</button> <button type="button" class="btn small" data-new>${gl('pin')} New poster</button>` : '';
}

async function act(body, msg) {
  const r = await api('POST', body, '', EP);
  data = r.state; render();
  if (msg) toast(msg);
  return r.result;
}

// ---------- look at one poster (and, for the Warden, run it) ----------
function openPoster(p) {
  const back = document.createElement('div');
  back.className = 'modal-back wt-back';
  const draw = () => {
    back.innerHTML = `<div class="wt-view" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
      ${posterHTML(p, { big: true })}
      ${p.takenBy?.length ? `<p class="wt-taken">${gl('pin')} On the trail: <b>${esc(takers(p).join(', '))}</b> · <a href="/journal#quests">see the Journal</a></p>` : ''}
      ${!warden && p.status === 'wanted' && !(p.takenBy || []).includes(me()) ? `<div class="btn-row wt-take"><button type="button" class="btn" data-take>${gl('revolver')} Take the bounty</button><small class="muted">It goes in the Journal as a quest for the posse.</small></div>` : ''}
      ${warden ? `<div class="wt-admin">
        ${p.wardenNote ? `<p class="secret-note small-text"><b>Warden note:</b> ${esc(p.wardenNote)}</p>` : ''}
        <div class="field-step"><span>STATUS</span>${['wanted', 'captured', 'dead'].map((s) => `<button type="button" class="chip-btn${p.status === s ? ' on' : ''}" data-status="${s}"${p.status === 'claimed' ? ' disabled' : ''}>${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}${p.status === 'claimed' ? `<span class="pill ok">Paid to ${esc(p.claimedBy)}</span>` : ''}</div>
        <div class="btn-row">
          ${p.status !== 'claimed' && p.reward ? `<button type="button" class="btn" data-pay>${gl('trophy')} Pay out the bounty</button>` : ''}
          <button type="button" class="btn secondary" data-edit>Edit</button>
          <button type="button" class="btn secondary" data-hide>${p.hidden ? 'Put it up for the posse' : 'Take it down (hide)'}</button>
          <button type="button" class="btn secondary danger" data-del>Delete</button>
        </div></div>` : ''}
      <div class="btn-row wt-close">${p.photo ? `<button type="button" class="btn small secondary" data-photo>See the likeness</button>` : ''}<button type="button" class="btn small secondary" data-close>Close</button></div></div>`;
  };
  draw();
  document.body.append(back);
  const close = () => back.remove();
  back.addEventListener('click', async (e) => {
    if (e.target === back) return close();
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.close !== undefined) close();
      else if (b.dataset.take !== undefined) {
        if (!me()) { toast('Tap “This is me” on your character sheet first.', true); return; }
        if (!await ask(`Take the bounty on ${p.name}?\n\nIt goes in the Journal as a quest for the posse${p.reward ? `, worth ${reward(p.reward)}` : ''}. The Warden pays out when you bring them in.`, { ok: 'Take it', danger: false })) return;
        await act({ action: 'take', id: p.id, pc: me() }, 'It’s in the Journal. Happy hunting.');
        p = data.posters.find((x) => x.id === p.id); draw();
      }
      else if (b.dataset.photo !== undefined) showImage(p.photo, p.name);
      else if (b.dataset.status) { await act({ action: 'edit', id: p.id, status: b.dataset.status }); p = data.posters.find((x) => x.id === p.id); draw(); }
      else if (b.dataset.hide !== undefined) { await act({ action: 'edit', id: p.id, hidden: !p.hidden }, p.hidden ? 'Posted for the posse.' : 'Taken down.'); p = data.posters.find((x) => x.id === p.id); draw(); }
      else if (b.dataset.edit !== undefined) { close(); editPoster(p); }
      else if (b.dataset.pay !== undefined) { close(); payout(p); }
      else if (b.dataset.del !== undefined) { if (await ask(`Delete the poster for ${p.name}?`)) { await act({ action: 'remove', id: p.id }, 'Poster torn down.'); close(); } }
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- the Warden: new / edit poster ----------
function editPoster(p = null) {
  const st = p ? { ...p, photoNew: null } : { name: '', alias: '', crime: '', reward: '', terms: 'Dead or Alive', town, npcId: '', pcId: '', wardenNote: '', hidden: false, photoNew: null };
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const opt = (list, cur, none) => `<option value="">${none}</option>${list.map((x) => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}`;
  back.innerHTML = `<div class="modal ask wt-form" role="dialog" aria-modal="true" aria-label="${p ? 'Edit poster' : 'New poster'}">
    <h2>${p ? 'Edit the poster' : 'Put up a poster'}</h2>
    <div class="field-step"><span>WHO’S WANTED</span><input data-f="name" maxlength="60" value="${esc(st.name)}" placeholder="e.g. Black Bart"></div>
    <div class="field-step"><span>ALIAS (optional)</span><input data-f="alias" maxlength="60" value="${esc(st.alias)}" placeholder="e.g. The Gentleman Bandit"></div>
    <div class="field-step"><span>WANTED FOR</span><textarea data-f="crime" rows="2" maxlength="300" placeholder="e.g. Robbing the Wells Fargo stage and 28 other crimes">${esc(st.crime)}</textarea></div>
    <div class="field-step"><span>REWARD ($)</span><input data-f="reward" type="number" min="0" step="1" value="${esc(st.reward)}" placeholder="e.g. 250"></div>
    <div class="field-step"><span>TERMS</span>${data.terms.map((t) => `<button type="button" class="chip-btn${st.terms === t ? ' on' : ''}" data-terms="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="field-step"><span>TOWN</span><select data-f="town">${data.towns.map((t) => `<option value="${esc(t.id)}"${t.id === st.town ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
    <div class="field-step"><span>WHOSE FACE — or upload a picture below</span><select data-f="npcId">${opt(data.npcs || [], st.npcId, 'An NPC from the ledger…')}</select><select data-f="pcId">${opt(data.posse || [], st.pcId, 'Or one of the posse…')}</select></div>
    <div class="ho-photo" data-photo-row></div>
    <div class="field-step"><span>WARDEN NOTE — only you see this</span><textarea data-f="wardenNote" rows="2" maxlength="1000">${esc(st.wardenNote)}</textarea></div>
    <label class="check"><input type="checkbox" data-hidden${st.hidden ? ' checked' : ''}> Keep it hidden from the posse for now</label>
    <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>${p ? 'Save' : 'Nail it up'}</button></div></div>`;
  document.body.append(back);
  const photoRow = () => {
    const src = st.photoNew?.head || (p?.img ? p.photo : '');
    back.querySelector('[data-photo-row]').innerHTML = `${src ? `<img src="${esc(src)}" alt="">` : ''}<button type="button" class="btn small secondary" data-pick>${gl('camera')} ${src ? 'Change picture' : 'Upload a picture'}</button>`;
  };
  photoRow();
  back.addEventListener('input', (e) => { const k = e.target.dataset.f; if (k) st[k] = e.target.value; });
  back.addEventListener('change', (e) => { const k = e.target.dataset.f; if (k) st[k] = e.target.value; if (e.target.dataset.hidden !== undefined) st.hidden = e.target.checked; });
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.terms) { st.terms = b.dataset.terms; back.querySelectorAll('[data-terms]').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (b.dataset.no !== undefined) return back.remove();
    if (b.dataset.pick !== undefined) {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
      input.addEventListener('change', async () => {
        const f = input.files[0]; input.remove(); if (!f) return;
        try { const img = await loadImg(f); st.photoNew = { head: shrink(img, 480, 0.84), full: shrink(img, 900) }; photoRow(); } catch { toast('Couldn’t read that picture.', true); }
      });
      document.body.append(input); input.click();
      return;
    }
    if (b.dataset.go !== undefined) {
      b.disabled = true;
      try {
        const body = { name: st.name, alias: st.alias, crime: st.crime, reward: st.reward, terms: st.terms, town: st.town, npcId: st.npcId, pcId: st.pcId, wardenNote: st.wardenNote, hidden: st.hidden };
        const r = await act(p ? { action: 'edit', id: p.id, ...body } : { action: 'add', ...body });
        if (st.photoNew) { await api('POST', { action: 'upload', ns: 'wanted', id: r.id, head: st.photoNew.head, full: st.photoNew.full }, '', '/api/image'); data = await api('GET', null, '?view=warden', EP); }
        town = st.town; render();
        toast(p ? 'Poster updated.' : st.hidden ? 'Poster ready — hidden until you put it up.' : `Nailed up in ${townName(st.town)}.`);
        back.remove();
      } catch (err) { toast(err.message, true); b.disabled = false; }
    }
  });
}

// ---------- the Warden: pay the bounty ----------
function payout(p) {
  const who = new Set(), bonus = new Set((data.posse || []).filter((c) => c.cut).map((c) => c.id));
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const draw = () => {
    const n = who.size, share = n ? Math.floor((p.reward / n) * 100) / 100 : 0;
    back.innerHTML = `<div class="modal ask" role="dialog" aria-modal="true" aria-label="Pay out the bounty">
      <h2>Pay the bounty on ${esc(p.name)}</h2>
      <p class="ask-body">${reward(p.reward)} split evenly between whoever brings them in. It goes straight into their wallets.</p>
      <div class="field-step"><span>WHO COLLECTS</span>${(data.posse || []).map((c) => `<button type="button" class="chip-btn${who.has(c.id) ? ' on' : ''}" data-who="${esc(c.id)}">${esc(c.name)}${who.has(c.id) ? `<small>$${(share * (bonus.has(c.id) ? 1.2 : 1)).toFixed(2)}${bonus.has(c.id) ? ' +20%' : ''}</small>` : ''}</button>`).join('')}</div>
      ${(data.posse || []).some((c) => c.cut) ? `<p class="muted small-text">Cut of the Profit (Gunslinger ability, p. 20): +20% for a Gunslinger with Neutral or better Reputation with their employer. ${(data.posse || []).filter((c) => c.cut).map((c) => `<label class="check"><input type="checkbox" data-bonus="${esc(c.id)}"${bonus.has(c.id) ? ' checked' : ''}> ${esc(c.name)}</label>`).join(' ')}</p>` : ''}
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go${n ? '' : ' disabled'}>${gl('trophy')} Pay out</button></div></div>`;
  };
  draw();
  document.body.append(back);
  back.addEventListener('change', (e) => { const id = e.target.dataset.bonus; if (id) { if (e.target.checked) bonus.add(id); else bonus.delete(id); draw(); } });
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.who) { if (who.has(b.dataset.who)) who.delete(b.dataset.who); else who.add(b.dataset.who); draw(); return; }
    if (b.dataset.no !== undefined) return back.remove();
    if (b.dataset.go !== undefined) {
      try { const paid = await act({ action: 'payout', id: p.id, to: [...who], bonus: [...bonus].filter((x) => who.has(x)) }); toast(`Paid: ${paid.map((x) => `${x.name} $${x.amount.toFixed(2)}`).join(', ')}.`); back.remove(); }
      catch (err) { toast(err.message, true); }
    }
  });
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-town]');
  if (t) { town = t.dataset.town; history.replaceState(null, '', `#${encodeURIComponent(town)}`); render(); return; }
  const tile = e.target.closest('[data-p]');
  if (tile) { const p = data.posters.find((x) => x.id === tile.dataset.p); if (p) openPoster(p); return; }
  if (e.target.closest('[data-new]')) return editPoster();
  if (e.target.closest('[data-newtown]')) {
    const name = await askText('Name the new town:', '', { ok: 'Add town' });
    if (!name) return;
    try { const r = await act({ action: 'addTown', name }); town = r.id; render(); toast(`${name} is on the board.`); } catch (err) { toast(err.message, true); }
  }
});
// a likeness that won't load shows the blank frame instead of a broken picture
document.addEventListener('error', (e) => { if (e.target.matches?.('.ps-photo img')) e.target.outerHTML = NO_LIKENESS; }, true);
document.addEventListener('change', (e) => { if (e.target.dataset.other !== undefined && e.target.value) { town = e.target.value; history.replaceState(null, '', `#${encodeURIComponent(town)}`); render(); } });

(async () => {
  if (savedPin()) warden = await tryWarden(savedPin(), EP);
  startPolling(warden ? 'warden' : 'player', (d) => { data = d; if (!document.querySelector('.wt-back, .wt-form')) render(); }, null, EP);
})();
