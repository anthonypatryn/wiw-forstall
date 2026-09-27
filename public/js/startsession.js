// Start Session (Run the Game): one window to open a game night — who's here, last time's recap on every screen,
// tonight's scene — then go. The partner of End Session (endsession.js).
import { esc, api, toast, paras } from './common.js';
import { gl } from './glyphs.js';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function openStartSession({ getCombat, onDone = () => {} }) {
  let sess = { sessions: [] }, recap = { id: null }, scenes = { scenes: [], current: '' };
  try {
    [sess, recap, scenes] = await Promise.all([
      api('GET', null, '?view=warden', '/api/session').catch(() => sess),
      api('GET', null, '?view=recap', '/api/session').catch(() => recap),
      api('GET', null, '', '/api/scenes').catch(() => scenes),
    ]);
  } catch {}
  const posse = (getCombat()?.posse || []).filter((p) => !p.dead);
  const open = (scenes.scenes || []).filter((s) => !s.done);
  const st = { title: `Session ${(sess.sessions || []).length + 1}`, date: today(), push: !!recap.recap, scene: scenes.current || '', here: new Set() };

  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  back.innerHTML = `<div class="modal ask start-modal" role="dialog" aria-modal="true" aria-label="Start the session">
    <div class="ho-kicker">${gl('revolver')} START THE SESSION</div>
    <div class="start-grid">
      <label class="field-step"><span>TONIGHT’S TITLE</span><input class="ask-input" data-f="title" maxlength="80" value="${esc(st.title)}"></label>
      <label class="field-step"><span>DATE</span><input class="ask-input" data-f="date" maxlength="20" value="${esc(st.date)}"></label>
    </div>
    <h3 class="start-h">WHO’S HERE <small data-here-count></small></h3>
    <div class="start-here" data-here>${posse.length ? posse.map((p) => `<span class="start-pc"><i class="here-dot" data-dot="${esc(p.id)}"></i>${esc(p.name)}${p.player ? ` <small>${esc(p.player)}</small>` : ''}</span>`).join('') : '<span class="muted">No characters yet.</span>'}</div>
    <h3 class="start-h">PREVIOUSLY ON…</h3>
    ${recap.recap ? `<div class="start-recap"><b>${esc(recap.title || 'Last time')}</b>${paras(recap.recap)}</div>
      <label class="check"><input type="checkbox" data-f="push"${st.push ? ' checked' : ''}> Show it on everyone’s screen when we start</label>`
      : '<p class="muted">No recap from last time. You can write one at the end of tonight (End Session → Write-up).</p>'}
    <h3 class="start-h">TONIGHT’S SCENE</h3>
    <div class="chip-row" data-scenes>${open.map((s) => `<button type="button" class="chip-btn${st.scene === s.id ? ' on' : ''}" data-scene="${esc(s.id)}">${esc(s.title)}</button>`).join('')}
      <button type="button" class="chip-btn${st.scene ? '' : ' on'}" data-scene="">No scene</button></div>
    ${open.length ? '' : '<p class="muted">No scenes prepped. Make one on the Prep page, or play it by ear.</p>'}
    <div class="ask-btns"><button type="button" class="btn secondary" data-x>Not yet</button><button type="button" class="btn" data-go>${gl('revolver')} Start the session</button></div>
  </div>`;
  document.body.append(back);
  back.querySelector('[data-f="title"]').focus();

  // the dots: who has the site open right now (same as Run the Game's posse list)
  const dots = async () => {
    if (!posse.length || !document.body.contains(back)) return;
    try { st.here = new Set((await api('GET', null, `?who=${posse.map((p) => encodeURIComponent(p.id)).join(',')}`, '/api/pulse')).here || []); } catch { return; }
    back.querySelectorAll('[data-dot]').forEach((d) => { const on = st.here.has(d.dataset.dot); d.classList.toggle('on', on); d.title = on ? 'Has the site open' : 'Not connected'; });
    back.querySelector('[data-here-count]').textContent = `${st.here.size} of ${posse.length} have the site open`;
  };
  dots();
  const timer = setInterval(dots, 5000);
  const close = () => { clearInterval(timer); back.remove(); };

  back.addEventListener('input', (e) => { const f = e.target.dataset.f; if (f === 'title' || f === 'date') st[f] = e.target.value; });
  back.addEventListener('change', (e) => { if (e.target.dataset.f === 'push') st.push = e.target.checked; });
  back.addEventListener('click', async (e) => {
    if (e.target === back || e.target.closest('[data-x]')) { close(); return; }
    const sc = e.target.closest('[data-scene]');
    if (sc) { st.scene = sc.dataset.scene; back.querySelectorAll('[data-scene]').forEach((b) => b.classList.toggle('on', b === sc)); return; }
    const go = e.target.closest('[data-go]');
    if (!go) return;
    go.disabled = true;
    try {
      await api('POST', { action: 'begin', title: st.title, date: st.date, pushRecap: st.push }, '', '/api/session');
      if (st.scene !== (scenes.current || '')) await api('POST', { action: 'current', id: st.scene }, '', '/api/scenes');
      toast(`${st.title || 'The session'} has begun.${st.push ? ' The recap is on everyone’s screen.' : ''}`);
      close();
      onDone({ scene: st.scene });
    } catch (err) { toast(err.message, true); go.disabled = false; }
  });
}
