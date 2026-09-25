// End Session — a step-by-step wrap-up for the Warden: tidy loose ends, Prestige, Jackpot (p. 54), Titles (p. 34),
// where the posse sleeps (Town Rest, p. 54), the write-up (AI summary + the Warden's own notes + a recap) and a backup.
import { esc, api, toast } from './common.js';
import { gl } from './glyphs.js';
import { play } from './sound.js';
import { paperHTML, paperStyles, openPaper } from './paper.js';

const START = '=== SUMMARY ===', END = '=== MY NOTES ===';
const STEPS = [['loose', 'Loose ends'], ['prestige', 'Prestige'], ['jackpot', 'Jackpot'], ['titles', 'Titles'], ['rest', 'Rest'], ['writeup', 'Write-up'], ['paper', 'Front page'], ['wrap', 'Wrap']];

export function openEndSession({ getCombat, refresh = () => {} }) {
  const w = { step: 0, prestige: {}, reason: '', jp: '', jpWhy: '', done: {}, session: null, locks: [], mine: '', recap: '', postRecap: true, writing: false, meta: null };
  const back = document.createElement('div');
  back.className = 'modal-back endsess-back';
  document.body.append(back);
  document.body.classList.add('nav-open');
  const combat = () => getCombat() || { posse: [], checks: [], combat: {} };
  const alive = () => combat().posse.filter((p) => !p.dead);
  const combatAct = async (body) => { const r = await api('POST', body, '', '/api/combat'); refresh(); return r.result; };
  const sessAct = async (body) => { const r = await api('POST', body, '', '/api/session'); w.sessions = r.state?.sessions || w.sessions; return r.result; };
  const close = () => { back.remove(); document.body.classList.remove('nav-open'); refresh(); };

  // tonight's session: the newest one still open from the last day, or a new one that reaches back over tonight's log
  async function ensureSession() {
    if (w.session) return w.session;
    const all = (await api('GET', null, '', '/api/session')).sessions || [];
    const recent = all.find((s) => !s.ended && Date.now() - (s.created || s.at) < 20 * 3600e3);
    if (recent) { w.session = recent; return recent; }
    const lastEnd = Math.max(0, ...all.map((s) => s.ended || 0));
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    w.session = await sessAct({ action: 'add', date, created: Math.max(lastEnd, Date.now() - 14 * 3600e3) });
    return w.session;
  }
  const split = (notes) => {
    const n = String(notes || '');
    if (!n.includes(END)) return { summary: '', mine: n };
    const [top, ...rest] = n.split(END);
    return { summary: top.replace(START, '').replace(/^[^\n]*\n/, '').trim(), label: (top.match(/=== SUMMARY === \(([^)]*)\)/) || [])[1] || '', mine: rest.join(END).replace(/^\n+/, '') };
  };

  const bodies = {
    loose() {
      const c = combat(), open = (c.checks || []), fight = c.combat?.active, locks = w.locks.filter((a) => !['picked', 'failed'].includes(a.status));
      const items = [
        fight && `<div class="notice urgent"><span>${gl('revolver')} A fight is still going (round ${c.combat.round}).</span><button type="button" class="btn small" data-es="endFight">End the fight</button></div>`,
        open.length && `<div class="notice urgent"><span>${gl('die')} ${open.length} roll${open.length === 1 ? ' is' : 's are'} still open.</span><button type="button" class="btn small" data-es="closeRolls">Close ${open.length === 1 ? 'it' : 'them'}</button></div>`,
        locks.length && `<div class="notice urgent"><span>${gl('lock')} ${locks.length} lock pick${locks.length === 1 ? ' is' : 's are'} unfinished (${locks.map((a) => esc(a.name)).join(', ')}).</span><button type="button" class="btn small" data-es="closeLocks">Call ${locks.length === 1 ? 'it' : 'them'} off</button></div>`,
      ].filter(Boolean);
      return `<p class="es-lead">Tie off anything still running before you wrap up.</p>${items.join('') || `<p class="es-ok">${gl('trophy')} Nothing left running — no fight, no open rolls, no locks.</p>`}`;
    },
    prestige() {
      return `<p class="es-lead">How much Prestige did each rider earn tonight? It goes to their unclaimed Prestige to spend on their sheet. Leave 0 to skip someone.</p>
        <div class="es-quick"><span>EVERYONE GETS</span>${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip-btn" data-es-all="${n}">${n}</button>`).join('')}</div>
        <div class="es-list">${alive().map((p) => `<div class="item-row"><span class="item-who"><b>${esc(p.name)}</b><small class="muted">${p.prestige?.total || 0} total · ${p.prestige?.unclaimed || 0} unclaimed</small></span>
          <span class="es-step"><button type="button" class="pm-btn" data-es-pm="${esc(p.id)}" data-d="-1">−</button><b>${w.prestige[p.id] || 0}</b><button type="button" class="pm-btn" data-es-pm="${esc(p.id)}" data-d="1">+</button></span></div>`).join('') || '<p class="muted">No characters yet.</p>'}</div>
        <label class="es-field"><span>WHAT FOR</span><input data-es-f="reason" maxlength="120" value="${esc(w.reason)}" placeholder="e.g. Ran the Cutler gang out of Eureka Ridge"></label>
        ${w.done.prestige ? `<p class="es-ok">${gl('trophy')} ${esc(w.done.prestige)}</p>` : ''}`;
    },
    jackpot() {
      return `<p class="es-lead">The posse votes for the play of the night. The winner gets +1 Prestige (p. 54).</p>
        <div class="field-step"><span>THE POSSE VOTES FOR</span>${alive().map((p) => `<button type="button" class="chip-btn${w.jp === p.id ? ' on' : ''}" data-es-jp="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
        <label class="es-field"><span>WHAT DID THEY DO?</span><input data-es-f="jpWhy" maxlength="120" value="${esc(w.jpWhy)}" placeholder="e.g. roped the bear off the cliff"></label>
        ${w.done.jackpot ? `<p class="es-ok">${gl('star')} ${esc(w.done.jackpot)}</p>` : ''}`;
    },
    titles() {
      const list = w.meta?.achievements || [];
      return `<p class="es-lead">Did anyone earn an Achievement tonight? Tap to grant it — it’s announced in the Table Log. Prestige titles (Cowpoke, Trailblazer…) update on their own.</p>
        ${alive().map((p) => { const got = new Set(p.achievements || []);
          return `<div class="es-ach"><b>${esc(p.name)}</b><div class="es-chips">${list.map((a) => `<button type="button" class="chip-btn${got.has(a.name) ? ' on' : ''}" data-es-ach="${esc(p.id)}" data-name="${esc(a.name)}" title="${esc(a.req)}">${esc(a.name)}</button>`).join('')}</div></div>`; }).join('') || '<p class="muted">No characters yet.</p>'}`;
    },
    rest() {
      return `<p class="es-lead">Where does the posse bed down tonight?</p>
        <div class="es-choice">
          <button type="button" class="es-pick${w.rest === 'town' ? ' on' : ''}" data-es-rest="town"><b>${gl('fire')} In town</b><small>Town Rest for everyone: full Health, Statuses relieved, Supplies and Forstall charges back (p. 54).</small></button>
          <button type="button" class="es-pick${w.rest === 'trail' ? ' on' : ''}" data-es-rest="trail"><b>${gl('horseshoe')} Out on the trail</b><small>No Town Rest. Players can Camp Rest from their sheets next time (p. 52).</small></button>
        </div>
        ${w.done.rest ? `<p class="es-ok">${gl('trophy')} ${esc(w.done.rest)}</p>` : ''}`;
    },
    writeup() {
      const s = w.session, parts = split(s?.notes);
      return `<p class="es-lead">${esc(s?.title || 'Tonight')}${s?.date ? ` · ${esc(s.date)}` : ''}. Write it up from tonight’s Table Log, then add anything else.</p>
        <div class="btn-row"><button type="button" class="btn" data-es="summarize"${w.writing ? ' disabled' : ''}>${gl('star')} ${w.writing ? 'Reading the Table Log…' : parts.summary ? 'Write it up again' : 'Write it up'}</button></div>
        ${parts.summary ? `<div class="es-summary"><small>${esc(parts.label || 'SUMMARY')}</small>${esc(parts.summary)}</div>` : ''}
        <label class="es-field"><span>ANYTHING ELSE? <small>just for you — secrets, plans, loose ends</small></span><textarea data-es-f="mine" rows="4" maxlength="8000" placeholder="What the posse doesn’t know yet, what’s coming next…">${esc(w.mine)}</textarea></label>
        <label class="es-field"><span>RECAP FOR THE PLAYERS <small>short and spoiler-free</small></span><textarea data-es-f="recap" rows="3" maxlength="2000" placeholder="Last time, the posse…">${esc(w.recap)}</textarea></label>
        <div class="field-step"><button type="button" class="chip-btn${w.postRecap ? ' on' : ''}" data-es="toggleRecap">Post the recap to the Table Log</button></div>`;
    },
    paper() {
      paperStyles();
      const p = w.paper, towns = w.towns || [];
      return `<p class="es-lead">Tonight’s news, set in type for the posse. It’s written from the Table Log (nothing Warden-only), and you can fix anything before it’s printed.</p>
        <div class="field-step"><span>WHICH TOWN’S PAPER?</span><select data-np-town>${[{ id: '', name: 'Out on the frontier' }, ...towns].map((t) => `<option value="${esc(t.id)}"${t.id === w.town ? ' selected' : ''}>${esc(t.name)}${t.id && t.id === w.here ? ' (the posse is here)' : ''}</option>`).join('')}</select></div>
        <div class="btn-row"><button type="button" class="btn" data-es="setType"${w.setting ? ' disabled' : ''}>${gl('scroll')} ${w.setting ? 'Setting the type…' : p ? 'Write it again' : 'Set the type'}</button>${p ? '<button type="button" class="btn secondary" data-es="bigPaper">See it full size</button>' : ''}</div>
        ${p ? `<div class="es-np-edit">
          <label class="es-field"><span>PAPER</span><input data-np="paper" maxlength="60" value="${esc(p.paper)}"></label>
          <label class="es-field"><span>HEADLINE</span><input data-np="headline" maxlength="90" value="${esc(p.headline)}"></label>
          <label class="es-field"><span>BELOW THE HEADLINE</span><input data-np="subhead" maxlength="200" value="${esc(p.subhead)}"></label>
          <label class="es-field"><span>THE MAIN STORY</span><textarea data-np="lead" rows="5" maxlength="2400">${esc(p.lead)}</textarea></label>
          ${(p.stories || []).map((st, i) => `<label class="es-field"><span>STORY ${i + 2}</span><input data-np-story="${i}" data-k="head" maxlength="80" value="${esc(st.head)}"><textarea data-np-story="${i}" data-k="text" rows="3" maxlength="900">${esc(st.text)}</textarea></label>`).join('')}
          <label class="es-field"><span>QUOTE OF THE NIGHT</span><input data-np="quote" maxlength="240" value="${esc(p.quote)}"></label>
        </div>
        <div class="es-preview np-mini">${paperHTML(p, w.faces || [])}</div>` : ''}
        ${w.done.paper ? `<p class="es-ok">${gl('trophy')} ${esc(w.done.paper)}</p>` : ''}`;
    },
    wrap() {
      return `<p class="es-lead">Last thing: save a backup of everything to this device, then end the session.</p>
        <div class="btn-row"><button type="button" class="btn secondary" data-es="backup">${gl('satchel')} Download backup</button>${w.done.backup ? `<span class="es-ok">${gl('trophy')} Saved</span>` : ''}</div>
        <ul class="es-recap">${[
          w.done.prestige && `Prestige: ${esc(w.done.prestige)}`, w.done.jackpot && `Jackpot: ${esc(w.done.jackpot)}`, w.done.titles && `Titles: ${esc(w.done.titles)}`,
          w.done.rest && esc(w.done.rest), w.done.writeup && 'Write-up saved to your session notes', w.done.paper && esc(w.done.paper), w.postRecap && w.recap.trim() && 'Recap goes to the Table Log',
        ].filter(Boolean).map((t) => `<li>${t}</li>`).join('') || '<li class="muted">Nothing handed out tonight.</li>'}</ul>`;
    },
  };

  function draw() {
    const [key, title] = STEPS[w.step];
    const last = w.step === STEPS.length - 1;
    back.innerHTML = `<div class="modal endsess" role="dialog" aria-modal="true" aria-label="End the session">
      <div class="es-top"><h2>${gl('scroll')} End the Session</h2><button type="button" class="linkish" data-es="close">Not yet</button></div>
      <ol class="es-steps">${STEPS.map(([, t], i) => `<li class="${i < w.step ? 'done' : i === w.step ? 'on' : ''}"><button type="button" data-es-go="${i}"><i>${i + 1}</i>${t}</button></li>`).join('')}</ol>
      <h3 class="es-h">${w.step + 1}. ${title}</h3>
      <div class="es-body">${bodies[key]()}</div>
      <div class="es-nav">${w.step ? '<button type="button" class="btn secondary" data-es="back">Back</button>' : '<span></span>'}
        <span class="btn-row">${['prestige', 'jackpot', 'rest', 'paper'].includes(key) && !w.done[key] ? '<button type="button" class="btn secondary" data-es="skip">Skip</button>' : ''}
        <button type="button" class="btn" data-es="next">${last ? `${gl('trophy')} End the session` : NEXT[key]?.() || 'Next'}</button></span></div>
    </div>`;
  }
  const NEXT = {
    prestige: () => (w.done.prestige || !Object.values(w.prestige).some(Boolean) ? 'Next' : 'Award & next'),
    jackpot: () => (w.done.jackpot || !w.jp ? 'Next' : 'Give Jackpot & next'),
    rest: () => (w.rest === 'town' && !w.done.rest ? 'Rest & next' : 'Next'),
    writeup: () => 'Save & next',
    paper: () => (w.paper && !w.done.paper ? 'Print it & next' : 'Next'),
  };

  // what "Next" does on each step
  async function commit(key) {
    if (key === 'prestige' && !w.done.prestige) {
      const groups = {};
      for (const [id, n] of Object.entries(w.prestige)) if (n > 0) (groups[n] ||= []).push(id);
      const reason = w.reason.trim() || `${w.session?.title || 'Tonight’s session'}`;
      for (const [n, ids] of Object.entries(groups)) await combatAct({ action: 'award', ids, prestige: Number(n), reason });
      const names = alive().filter((p) => w.prestige[p.id] > 0).map((p) => `${p.name} +${w.prestige[p.id]}`);
      if (names.length) w.done.prestige = names.join(', ');
    }
    if (key === 'jackpot' && w.jp && !w.done.jackpot) {
      const r = await combatAct({ action: 'jackpot', id: w.jp, reason: w.jpWhy });
      w.done.jackpot = `${r?.name || 'Jackpot'} +1 Prestige`; play('success');
    }
    if (key === 'rest' && w.rest === 'town' && !w.done.rest) {
      const r = await combatAct({ action: 'townRestAll' });
      w.done.rest = `Town Rest for ${r?.count || 0} character${r?.count === 1 ? '' : 's'}`;
    }
    if (key === 'rest' && w.rest === 'trail') w.done.rest = 'Camped out on the trail';
    if (key === 'writeup') {
      const s = await ensureSession(), parts = split(s.notes);
      const notes = parts.summary || String(s.notes || '').includes(END) ? `${String(s.notes).split(END)[0]}${END}\n${w.mine}` : w.mine;
      w.session = await sessAct({ action: 'edit', id: s.id, notes, recap: w.recap });
      w.done.writeup = !!(parts.summary || w.mine.trim());
    }
    if (key === 'paper' && w.paper && !w.done.paper) {
      const { id, paper, headline, subhead, lead, stories, quote } = w.paper;
      await api('POST', { action: 'save', id, paper, headline, subhead, lead, stories, quote }, '', '/api/papers');
      await api('POST', { action: 'publish', id }, '', '/api/papers');
      w.done.paper = `${paper} printed: “${headline}”`; play('success');
    }
    if (key === 'wrap') {
      const s = await ensureSession();
      if (w.postRecap && w.recap.trim()) await api('POST', { action: 'postRecap', id: s.id }, '', '/api/session');
      await sessAct({ action: 'end', id: s.id });
      play('success');
      toast(`${s.title} is in the books. Good game!`);
      close();
      return false;
    }
    return true;
  }

  back.addEventListener('input', (e) => {
    const d = e.target.dataset;
    if (d.esF) w[d.esF] = e.target.value;
    if (d.np && w.paper) w.paper[d.np] = e.target.value;
    if (d.npStory !== undefined && w.paper) w.paper.stories[Number(d.npStory)][d.k] = e.target.value;
    if ((d.np || d.npStory !== undefined) && w.paper) { const pv = back.querySelector('.es-preview'); if (pv) pv.innerHTML = paperHTML(w.paper, w.faces || []); }
  });
  back.addEventListener('change', (e) => { if (e.target.dataset.npTown !== undefined) w.town = e.target.value; });
  back.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    try {
      if (d.esGo !== undefined) { const i = Number(d.esGo); if (i <= w.step) { w.step = i; draw(); } return; }
      if (d.esPm) { w.prestige[d.esPm] = Math.max(0, Math.min(20, (w.prestige[d.esPm] || 0) + Number(d.d))); draw(); return; }
      if (d.esAll) { alive().forEach((p) => { w.prestige[p.id] = Number(d.esAll); }); draw(); return; }
      if (d.esJp) { w.jp = w.jp === d.esJp ? '' : d.esJp; draw(); return; }
      if (d.esRest) { w.rest = d.esRest; draw(); return; }
      if (d.esAch) {
        const p = combat().posse.find((x) => x.id === d.esAch), on = !(p.achievements || []).includes(d.name);
        await combatAct({ action: 'achieve', id: p.id, name: d.name, on });
        p.achievements = on ? [...(p.achievements || []), d.name] : (p.achievements || []).filter((n) => n !== d.name);
        const granted = alive().flatMap((x) => (x.achievements || []).filter((n) => !(w.startAch[x.id] || []).includes(n)).map((n) => `${x.name}: ${n}`));
        w.done.titles = granted.join(', ');
        draw(); return;
      }
      switch (d.es) {
        case 'close': close(); return;
        case 'back': w.step -= 1; draw(); return;
        case 'skip': w.step += 1; draw(); return;
        case 'next': b.disabled = true; if (await commit(STEPS[w.step][0])) { w.step += 1; draw(); } return;
        case 'endFight': await combatAct({ action: 'end' }); draw(); return;
        case 'closeRolls': for (const ck of combat().checks || []) await combatAct({ action: 'checkClose', id: ck.id }); draw(); return;
        case 'closeLocks':
          for (const a of w.locks.filter((x) => !['picked', 'failed'].includes(x.status))) await api('POST', { action: 'clear', id: a.id }, '', '/api/lockpick');
          w.locks = (await api('GET', null, '?view=warden', '/api/lockpick')).list || []; draw(); return;
        case 'toggleRecap': w.postRecap = !w.postRecap; draw(); return;
        case 'summarize': {
          w.writing = true; draw();
          const s = await ensureSession();
          if (w.mine.trim()) await sessAct({ action: 'edit', id: s.id, notes: `${split(s.notes).summary ? String(s.notes).split(END)[0] : ''}${END}\n${w.mine}` });
          try {
            const r = await api('POST', { action: 'summarize', id: s.id }, '', '/api/session');
            w.session = r.state.sessions.find((x) => x.id === s.id);
            if (!w.recap.trim()) w.recap = w.session.recap || '';
            toast(r.result.ai ? `Written up from ${r.result.entries} log entries.` : `Listed ${r.result.entries} log entries — add an Anthropic API key on Vercel for a written summary.`);
          } finally { w.writing = false; draw(); }
          return;
        }
        case 'setType': {
          w.setting = true; draw();
          try {
            const s = await ensureSession();
            const r = await api('POST', { action: 'draft', sessionId: s.id, town: w.town }, '', '/api/papers');
            w.paper = r.result; w.faces = r.state.posse;
            toast(r.result.ai ? 'Hot off the press.' : 'Set from the Table Log — add an Anthropic API key on Vercel for a written front page.');
          } finally { w.setting = false; draw(); }
          return;
        }
        case 'bigPaper': openPaper(w.paper, w.faces || []); return;
        case 'backup': {
          const bk = await api('GET', null, '', '/api/backup');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(bk, null, 1)], { type: 'application/json' }));
          a.download = `wiw-backup-${bk.savedAt.slice(0, 16).replace(/[:T]/g, '-')}.json`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          w.done.backup = true; draw(); return;
        }
        default:
      }
    } catch (err) { toast(err.message, true); draw(); }
  });

  // load what the steps need, then show step 1
  w.startAch = Object.fromEntries(alive().map((p) => [p.id, [...(p.achievements || [])]]));
  draw();
  Promise.all([
    api('GET', null, '?view=warden', '/api/lockpick').then((d) => { w.locks = d.list || []; }).catch(() => {}),
    api('GET', null, '?view=meta', '/api/combat').then((m) => { w.meta = m; }).catch(() => {}),
    api('GET', null, '?view=warden', '/api/wanted').then((d) => { w.towns = d.towns || []; w.here = d.here; w.town = d.here || ''; }).catch(() => {}),
    ensureSession().then((s) => { const p = split(s.notes); w.mine = p.mine; w.recap = s.recap || ''; }).catch(() => {}),
  ]).then(() => { if (back.isConnected && !back.contains(document.activeElement)) draw(); });
}
