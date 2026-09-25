// Whisper to the Warden: players send a short secret message; the Warden gets a pop-up on any page and can send one line back.
import { esc, api, toast, startPolling, savedPin, store } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';

const me = () => store.get('wiw.me', null);

// a small styled box with a text area (dialog, not a browser prompt)
function writeBox({ title, sub = '', placeholder = '', max = 500, ok = 'Send', quote = '' }) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    back.innerHTML = `<div class="modal ask whisper-box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${gl('scroll')} ${esc(title)}</h2>${sub ? `<p class="ask-body">${esc(sub)}</p>` : ''}
      ${quote ? `<blockquote class="whisper-quote">${esc(quote)}</blockquote>` : ''}
      <textarea maxlength="${max}" rows="${max > 250 ? 4 : 2}" placeholder="${esc(placeholder)}"></textarea>
      <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn" data-go>${esc(ok)}</button></div></div>`;
    document.body.append(back);
    const ta = back.querySelector('textarea');
    setTimeout(() => ta.focus(), 30);
    const close = (v) => { back.remove(); resolve(v); };
    back.querySelector('[data-no]').addEventListener('click', () => close(null));
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    back.querySelector('[data-go]').addEventListener('click', () => close(ta.value.trim() || null));
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) close(ta.value.trim() || null); if (e.key === 'Escape') close(null); });
  });
}
// a pop-up card: returns which button was pressed
function card({ kicker, from, text, sub, buttons }) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back ask-back';
    back.innerHTML = `<div class="modal ask whisper-card" role="dialog" aria-modal="true" aria-label="${esc(kicker)}">
      <div class="ho-kicker">${esc(kicker)}</div>${from ? `<h2>${esc(from)}</h2>` : ''}
      <blockquote class="whisper-quote big">${esc(text)}</blockquote>${sub ? `<p class="muted small-text">${esc(sub)}</p>` : ''}
      <div class="ask-btns">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    document.body.append(back);
    back.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { back.remove(); resolve(buttons[Number(b.dataset.i)].value); } });
  });
}

// ---------- Warden: start a whisper to one, some or all of the posse (Run the Game card) ----------
export function mountWardenWhisper(el, getCombat) {
  let who = null; // null = everyone
  const draw = () => {
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
    const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
    const keep = el.querySelector('textarea')?.value || '';
    el.innerHTML = `<div class="field-step"><span>TO</span><button type="button" class="chip-btn${who ? '' : ' on'}" data-ww-all>Everyone</button>
        ${posse.map((p) => `<button type="button" class="chip-btn${who?.has(p.id) ? ' on' : ''}" data-ww="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      <textarea class="ww-text" rows="2" maxlength="300" placeholder="e.g. You smell smoke nobody else does.">${esc(keep)}</textarea>
      <div class="btn-row"><button type="button" class="btn" data-ww-send>${gl('scroll')} Whisper</button><span class="muted small-text">Pops up only on their phones; they can whisper back.</span></div>`;
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.wwAll !== undefined) { who = null; draw(); return; }
    if (b.dataset.ww) { who ||= new Set(); if (who.has(b.dataset.ww)) who.delete(b.dataset.ww); else who.add(b.dataset.ww); if (!who.size) who = null; draw(); return; }
    if (b.dataset.wwSend !== undefined) {
      const ta = el.querySelector('textarea');
      try { const r = await api('POST', { action: 'wardenSend', to: who ? [...who] : 'all', text: ta.value }, '', '/api/whispers'); ta.value = ''; toast(`Whispered to ${r.result.count === 1 ? 'them' : `${r.result.count} players`}.`); }
      catch (err) { toast(err.message, true); }
    }
  });
  return { draw };
}

// ---------- player: the Whisper button + replies ----------
export async function whisper() {
  if (!me()) { toast('Pick who you’re playing first — the “This is me” star on your sheet.', true); return; }
  const text = await writeBox({ title: 'Whisper to the Warden', sub: 'Only the Warden sees this. Keep it short.', placeholder: 'e.g. I pocket the letter before anyone notices.', ok: 'Whisper it' });
  if (!text) return;
  try { await api('POST', { action: 'send', pc: me(), text }, '', '/api/whispers'); toast('Whispered. Only the Warden sees it.'); }
  catch (e) { toast(e.message, true); }
}

let busy = false;
export function watchWhispers() {
  if (savedPin()) { // the Warden: new whispers pop up on any page
    startPolling('warden', async (d) => {
      if (busy) return;
      const w = (d.list || []).find((x) => !x.read);
      if (!w) return;
      busy = true;
      play('chime');
      const pick = await card({ kicker: 'A WHISPER', from: `${w.name} whispers…`, text: w.text, buttons: [
        { label: 'Later', cls: 'secondary', value: 'later' }, { label: 'Got it', cls: 'secondary', value: 'done' }, { label: `${gl('scroll')} Reply`, value: 'reply' }] });
      try {
        if (pick === 'reply') {
          const r = await writeBox({ title: `Reply to ${w.name}`, quote: w.text, placeholder: 'One line back…', max: 200, ok: 'Send reply' });
          await api('POST', r ? { action: 'reply', id: w.id, text: r } : { action: 'read', id: w.id }, '', '/api/whispers');
          if (r) toast(`Reply sent to ${w.name}.`);
        } else await api('POST', { action: pick === 'done' ? 'done' : 'read', id: w.id }, '', '/api/whispers');
      } catch (e) { toast(e.message, true); }
      busy = false;
    }, null, '/api/whispers');
    return;
  }
  if (!me()) return;
  startPolling(`player&pc=${encodeURIComponent(me())}`, async (d) => {
    if (busy) return;
    const w = (d.list || [])[0];
    if (!w) return;
    busy = true;
    play('chime');
    const pick = await card({ kicker: w.fromWarden ? 'THE WARDEN WHISPERS' : 'THE WARDEN REPLIES', text: w.reply,
      sub: w.fromWarden ? 'Only you can see this.' : `To your whisper: “${w.text.length > 90 ? `${w.text.slice(0, 90)}…` : w.text}”`,
      buttons: [{ label: `${gl('scroll')} Reply`, cls: 'secondary', value: 'reply' }, { label: 'Got it', value: 'ok' }] });
    await api('POST', { action: 'replySeen', id: w.id, pc: me() }, '', '/api/whispers').catch(() => {});
    if (pick === 'reply') {
      const text = await writeBox({ title: 'Whisper back', quote: w.reply, placeholder: 'Only the Warden sees this…', ok: 'Whisper it' });
      if (text) await api('POST', { action: 'send', pc: me(), text }, '', '/api/whispers').then(() => toast('Whispered.')).catch((e) => toast(e.message, true));
    }
    busy = false;
  }, null, '/api/whispers');
}
