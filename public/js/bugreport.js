// Menu → Report a bug: anyone files one (lib/routes/problems.js `bug`), numbered BUG-1, BUG-2…; it lands on the
// Warden's Run the Game → Tools → Bug reports, where "Copy for Claude" copies it to paste in, and a fix marks it done.
import { esc, api, toast, me, savedPin } from './common.js';

const AREAS = ['Battle Map', 'Character sheet', 'Rolls & dice', 'Saloon games', 'Carnival & contests', 'Lock Pick', 'Store', 'Journal & Wanted', 'Map of the West', 'NPCs', 'Run the Game', 'Something else'];
const KINDS = [['Broken', 'something doesn’t work'], ['Looks wrong', 'layout, text, colors'], ['Confusing', 'couldn’t figure it out'], ['Idea', 'a wish or a change']];
// a sensible guess at the area from the page you're on
const GUESS = { '/battle': 'Battle Map', '/posse': 'Character sheet', '/store': 'Store', '/journal': 'Journal & Wanted', '/wanted': 'Journal & Wanted', '/map': 'Map of the West', '/names': 'NPCs', '/run': 'Run the Game' };

export function openBugReport() {
  const st = { area: GUESS[location.pathname] || 'Something else', kind: 'Broken' };
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  back.innerHTML = `<div class="modal ask bug-modal" role="dialog" aria-modal="true" aria-label="Report a bug"><form>
    <h2>Report a bug</h2>
    <p class="ask-body">It goes to the Warden, who passes it on to get fixed. You’ll see its number.</p>
    <div class="field-step"><span>WHAT KIND</span><div class="chip-row">${KINDS.map(([k, d]) => `<button type="button" class="chip-btn${st.kind === k ? ' on' : ''}" data-kind="${k}">${k}<small>${d}</small></button>`).join('')}</div></div>
    <label class="field-step"><span>WHERE</span><select name="area">${AREAS.map((a) => `<option${a === st.area ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
    <label class="field-step"><span>WHAT HAPPENED</span><textarea name="what" rows="3" maxlength="1500" required placeholder="e.g. I tapped Pick the lock and nothing came up"></textarea></label>
    <label class="field-step"><span>WHAT SHOULD HAVE HAPPENED <small>optional</small></span><textarea name="expected" rows="2" maxlength="800"></textarea></label>
    <label class="field-step"><span>HOW TO MAKE IT HAPPEN AGAIN <small>optional: what you tapped, in order</small></span><textarea name="steps" rows="2" maxlength="800"></textarea></label>
    <label class="check"><input type="checkbox" name="always"> It happens every time</label>
    <label class="check"><input type="checkbox" name="blocking"> It’s stopping me from playing</label>
    <p class="muted small-text">Sent along with it: this page (${esc(location.pathname)}), who you’re playing, and your device and screen size.</p>
    <div class="ask-btns"><button type="button" class="btn secondary" data-no>Cancel</button><button type="submit" class="btn">Send it</button></div>
  </form></div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', key, true); };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-no]')) return close();
    const k = e.target.closest('[data-kind]');
    if (k) { st.kind = k.dataset.kind; back.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('on', b === k)); }
  });
  back.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('[type=submit]');
    const val = (n) => f.querySelector(`[name="${n}"]`);
    if (!val('what').value.trim()) { val('what').focus(); return; }
    btn.disabled = true;
    try {
      const r = await api('POST', { action: 'bug', kind: st.kind, area: val('area').value, what: val('what').value, expected: val('expected').value, steps: val('steps').value,
        always: val('always').checked, blocking: val('blocking').checked, page: location.pathname + location.hash, who: me() || '', role: savedPin() ? 'warden' : 'player',
        ua: navigator.userAgent, screen: `${innerWidth}×${innerHeight}` }, '', '/api/problems');
      close();
      toast(`Thanks! Sent as BUG-${r.no}.`);
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  document.addEventListener('keydown', key, true);
  document.body.append(back);
  back.querySelector('[name="what"]').focus();
}

// one report as plain text, to paste to whoever fixes things
export function bugText(b, names = {}) {
  const who = names[b.who] || b.who || 'someone';
  return [`BUG-${b.no} · ${b.kind} · ${b.area}${b.blocking ? ' · BLOCKING' : ''}${b.always ? ' · every time' : ''}`,
    `What happened: ${b.what}`,
    b.expected && `Expected: ${b.expected}`,
    b.steps && `Steps: ${b.steps}`,
    `Page: ${b.page} · from ${who} (${b.role}) · ${new Date(b.at).toLocaleString()}`,
    `Device: ${b.screen} · ${b.ua}`].filter(Boolean).join('\n');
}
