// Contests (lib/contests.js): the horse race and the trick-shot contest. Players get an invite when the Warden opens
// one, enter with their own sheet (and horse), and can put a side bet on anyone. When the Warden runs it, everyone
// watches it play out: horses down the track leg by leg, or the tricks round by round. Every roll is in the Table Log.
// The Warden: a card on Run the Game (Start Something) to open, run and close it.
import { esc, api, toast, store, me, savedPin, startPolling, ask, onChange, placeChip, dollars as $$ } from './common.js';
import { gl } from './glyphs.js';
import { play, preload, ambience } from './sound.js';
import { carnivalStyles } from './carnival.js';
import { runTour, CONTEST_TOUR } from './tour.js';

const EP = '/api/contest';
let view = null, scene = null, busy = false, shown = '';
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const SKILL = { finesse: 'Finesse', nerve: 'Nerve' };
const poolText = (p) => [p.black > 0 && `+${p.black}B`, p.black < 0 && `−${-p.black}B`, p.gold > 0 && `+${p.gold}G`].filter(Boolean).join(' ') || 'no extra dice';

export function contestStyles() {
  carnivalStyles();
  if (!document.getElementById('contest-css')) document.head.insertAdjacentHTML('beforeend', '<link id="contest-css" rel="stylesheet" href="/css/contests.css?v=2">');
}

function rulesHTML(d) {
  if (d.kind === 'race') return `<details class="ct-rules" open><summary>${gl('scroll')} How the race works</summary>
    <ol><li><b>Three legs.</b> The start is Finesse, the straight is Nerve, and the finish is Finesse or Nerve: your pick. Each Hit is a length of ground covered.</li>
    <li><b>Your horse adds dice</b> by breed, and by your Bond: Revered +1G, Helpful +1B, Neutral nothing, Suspicious −1 die, Hostile −2.</li>
    <li><b>No horse?</b> Rent one at the race for ${$$(d.rent)} on top of the entry. A rented nag adds nothing.</li>
    <li><b>Most ground wins</b> the pot of entry fees. A dead heat is a photo finish: 1B each until it’s broken.</li>
    <li><b>Side bets:</b> put up to $5 on anyone. Everyone who backed the winner splits all the side bets by stake; if nobody did, the bookie keeps them.</li></ol>
    <p class="muted">House rules. Breeds: ${Object.entries(d.breeds).filter(([n]) => !/Firemane|Mysthorn|Pinto/.test(n)).map(([n, b]) => `${esc(n)} (${esc(b.why)})`).join('; ')}; legendary steeds +2G.</p></details>`;
  return `<details class="ct-rules" open><summary>${gl('scroll')} How the contest works (Iron Road p. 109)</summary>
    <ol><li><b>Step one:</b> roll Finesse against the trick’s target. Meet it and you earn an <b>Aim</b>: your worst pistol die is rerolled.</li>
    <li><b>Step two:</b> fire Adda’s Finncaster Green: everyone rolls the same 3G.</li>
    <li><b>Step three:</b> most Hits wins the round; a tie rerolls the pistol until it isn’t. ${d.rounds} rounds, easiest trick first. Most rounds wins the pot; a tie goes to another Blindfold Shot.</li>
    <li><b>Side bets:</b> put up to $5 on anyone. Everyone who backed the winner splits all the side bets by stake.</li></ol>
    <p class="muted">Tonight’s tricks: ${d.trickSet.map((i) => `${esc(d.tricks[i][0])} (${d.tricks[i][1]})`).join(', ')}.</p></details>`;
}

function sceneHTML() {
  const d = view;
  if (!d?.open) return `<div class="cv-closed"><h2>The contest is over.</h2><button type="button" class="btn" data-ct-x>Close</button></div>`;
  const mine = d.entrants.find((e) => e.pc && e.pc === me()), myBet = d.bets.find((b) => b.mine), ran = !!d.result;
  const who = (e) => `<li class="ct-entrant${d.result?.winners?.includes(e.key) ? ' ct-won' : ''}"><b>${esc(e.name)}</b>${e.kind === 'npc' ? ` <small>${esc(e.tough)}</small>` : ''}
      ${e.horse ? `<small>${e.horse.rented ? 'a rented nag' : `${esc(e.horse.name ? `${e.horse.name}, ` : '')}${esc(e.horse.breed)} · Bond ${esc(e.horse.bond)}`} · ${esc([0, 1, 2].map((i) => poolText(e.horseDice[i])).join(' / '))}${e.finish ? ` · finishes on ${SKILL[e.finish]}` : ''}</small>` : ''}
      ${d.bets.filter((b) => b.on === e.key).length ? `<small>backed with ${$$(d.bets.filter((b) => b.on === e.key).reduce((s, b) => s + b.amount, 0))}</small>` : ''}</li>`;
  return `<header class="cv-head ct-head"><div><div class="cv-kicker">${gl(d.kind === 'race' ? 'horseshoe' : 'revolver')} ${esc(d.name.toUpperCase())} · ${esc(d.where.toUpperCase())}</div>
      <h2>${d.kind === 'race' ? 'Off to the Races' : 'The Trick-Shot Contest'}</h2></div>
      <div class="cv-me"><span>Pot ${$$(d.pot)}</span>${me() && !savedPin() ? `<span class="cv-v">Wallet ${$$(d.wallet || 0)}</span>` : ''}</div>
      <button type="button" class="cv-x" data-ct-x aria-label="Close">×</button></header>
    <div class="ct-body">
      ${ran ? `<div class="cv-last"><b>${esc(d.result.text)}</b><small>${d.result.pot ? `The pot of ${$$(d.result.pot)} is paid out.` : ''}${d.result.betPool ? ` Side bets: ${d.result.bets.some((b) => b.won) ? d.result.bets.filter((b) => b.won).map((b) => `${esc(b.name)} collects ${$$(b.won)}`).join(', ') : 'nobody backed the winner.'}` : ''}</small>
        <button type="button" class="btn small secondary" data-ct-replay>${gl('flash')} Watch it again</button></div>` : ''}
      <div class="ct-cols">
        <section><h3>${gl('star')} The field</h3><ol class="ct-field">${d.entrants.map(who).join('') || '<li class="muted">Nobody has entered yet.</li>'}</ol></section>
        ${me() && !savedPin() && !ran ? `<section class="ct-me"><h3>${gl('hat')} You</h3>
          ${mine ? `<p>You’re entered.${d.kind === 'race' ? ' Finish on:' : ''}</p>
              ${d.kind === 'race' ? `<div class="chip-row">${['finesse', 'nerve'].map((s) => `<button type="button" class="chip-btn${mine.finish === s ? ' on' : ''}" data-ct-finish="${s}">${SKILL[s]}</button>`).join('')}</div>` : ''}
              <button type="button" class="btn small secondary" data-ct="leave">Pull out (fee back)</button>`
            : `<p>Entry ${$$(d.fee)}${d.kind === 'race' ? `; no horse on your sheet means a rented one for ${$$(d.rent)} more` : ''}.</p>
              ${d.kind === 'race' ? `<div class="field-step"><span>FINISH ON</span><div class="chip-row">${['finesse', 'nerve'].map((s, i) => `<button type="button" class="chip-btn${i ? '' : ' on'}" data-ct-pick="${s}">${SKILL[s]}</button>`).join('')}</div></div>` : ''}
              <button type="button" class="btn small" data-ct="enter"${busy ? ' disabled' : ''}>${gl('star')} Enter</button>`}
          <div class="field-step"><span>A SIDE BET${myBet ? ` · yours: ${$$(myBet.amount)} on ${esc(d.entrants.find((e) => e.key === myBet.on)?.name || '?')}` : ''}</span>
            <label class="cv-stake">Stake $<input type="number" min="0.05" max="5" step="0.05" value="${myBet?.amount || 0.5}" data-num="0.05" data-ct-stake></label>
            <small class="muted">then tap who you’re backing:</small>
            <div class="chip-row">${d.entrants.map((e) => `<button type="button" class="chip-btn${myBet?.on === e.key ? ' on' : ''}" data-ct-on="${esc(e.key)}">${esc(e.name)}</button>`).join('')}</div>
            ${myBet ? '<button type="button" class="btn small secondary" data-ct="unbet">Take the bet back</button>' : ''}</div>
        </section>` : ''}
      </div>
      ${rulesHTML(d)}
    </div>`;
}
function render() { if (scene) scene.querySelector('.cv-scene').innerHTML = sceneHTML(); }

async function act(body) {
  const r = await api('POST', { pc: me(), ...body }, '', EP);
  view = r.state;
  return r;
}

export function openContest() {
  contestStyles();
  preload('horseWalk', 'gun', 'successBig', 'success', 'fail');
  if (view?.kind === 'trickshot') ambience('game', 'saloon');
  if (scene) return;
  scene = document.createElement('div');
  scene.className = 'cv-back';
  scene.innerHTML = '<div class="cv-scene ct-scene" role="dialog" aria-modal="true" aria-label="Contest"></div><div class="cv-showbox" hidden></div>';
  document.body.append(scene);
  render();
  if (!view?.result) setTimeout(() => scene && runTour(CONTEST_TOUR, 'contest', { scene: true }), 700); // a player's first contest: the tour (not over a replay)
  let pick = 'finesse';
  scene.addEventListener('click', async (e) => {
    if (e.target.closest('.cv-showbox')) return;
    if (e.target.closest('[data-ct-x]') || e.target === scene) { closeScene(); showChip(); return; }
    const b = e.target.closest('button'); if (!b || busy) return;
    const d = b.dataset;
    if (d.ctPick) { pick = d.ctPick; scene.querySelectorAll('[data-ct-pick]').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (d.ctReplay !== undefined) { await playShow(view.result); return; }
    let body = null;
    if (d.ct === 'enter') body = { action: 'enter', finish: pick };
    else if (d.ct === 'leave') { if (!await ask('Pull out of the contest? Your entry fee comes back (a horse rental doesn’t).', { ok: 'Pull out', danger: false })) return; body = { action: 'leave' }; }
    else if (d.ct === 'unbet') body = { action: 'unbet' };
    else if (d.ctFinish) body = { action: 'finish', skill: d.ctFinish };
    else if (d.ctOn) body = { action: 'bet', on: d.ctOn, amount: Number(scene.querySelector('[data-ct-stake]')?.value) || 0.5 };
    if (!body) return;
    busy = true;
    try { await act(body); play('chips'); if (body.action === 'bet') toast('Your bet is down.'); } catch (err) { toast(err.message, true); }
    busy = false; render();
  });
}
function closeScene() { ambience('game', null); scene?.remove(); scene = null; }

// ---------- the show: the race down the track, or the tricks round by round ----------
async function playShow(r) {
  if (!scene || !r) return;
  const box = scene.querySelector('.cv-showbox'), d = view;
  const name = (k) => d.entrants.find((e) => e.key === k)?.name || '?';
  box.hidden = false;
  if (r.kind === 'race') {
    const keys = d.entrants.map((e) => e.key), most = Math.max(1, ...Object.values(r.total));
    box.innerHTML = `<div class="ct-stage"><div class="ct-leg">And they’re off!</div>
      <div class="ct-track">${keys.map((k, i) => `<div class="ct-lane"><span class="ct-lname">${esc(name(k))}</span><span class="ct-horse" data-k="${esc(k)}" style="--c:${i}">${gl('horseshoe')}</span><span class="ct-gone" data-g="${esc(k)}">0</span></div>`).join('')}<i class="ct-post"></i></div>
      <button type="button" class="btn small" data-ct-done hidden>Back to the fairground</button></div>`;
    const sum = Object.fromEntries(keys.map((k) => [k, 0]));
    play('gun'); await wait(500); play('horseWalk');
    for (const leg of r.legs) {
      box.querySelector('.ct-leg').textContent = `${leg.name}`;
      for (const k of keys) {
        sum[k] += leg.rolls[k]?.hits || 0;
        box.querySelector(`[data-k="${CSS.escape(k)}"]`).style.left = `calc(${(sum[k] / most) * 88}% )`;
        box.querySelector(`[data-g="${CSS.escape(k)}"]`).textContent = `${sum[k]} (+${leg.rolls[k]?.hits || 0} on ${SKILL[leg.rolls[k]?.skill] || ''})`;
      }
      await wait(1700);
    }
    if (r.photo.length) { box.querySelector('.ct-leg').textContent = 'A photo finish!'; await wait(1200); }
    box.querySelector('.ct-leg').textContent = r.text;
    r.winners.forEach((k) => box.querySelector(`[data-k="${CSS.escape(k)}"]`)?.classList.add('ct-first'));
  } else {
    box.innerHTML = `<div class="ct-stage ct-shots"><div class="ct-leg">Adda hands out the Finncaster Greens…</div><div class="ct-round"></div>
      <div class="ct-tally"></div><button type="button" class="btn small" data-ct-done hidden>Back to the saloon</button></div>`;
    const wins = {};
    await wait(900);
    for (const [i, rd] of r.rounds.entries()) {
      box.querySelector('.ct-leg').textContent = `${rd.extra ? 'Tie-breaker' : `Round ${i + 1}`}: ${rd.trick} (target ${rd.target})`;
      const lines = Object.entries(rd.shots);
      box.querySelector('.ct-round').innerHTML = `<p class="muted">${esc(rd.desc)}</p>${lines.map(([k]) => `<div class="ct-shot" data-s="${esc(k)}"><b>${esc(name(k))}</b><span></span></div>`).join('')}`;
      for (const [k, s] of lines) {
        await wait(650);
        const row = box.querySelector(`[data-s="${CSS.escape(k)}"] span`);
        row.textContent = `Finesse ${s.skill} Hit${s.skill === 1 ? '' : 's'}: ${s.aim ? 'pulls it off, Aim!' : 'fumbles the trick'}`;
        await wait(550); play('gun');
        row.textContent += ` · the shot: ${s.hits} Hit${s.hits === 1 ? '' : 's'}`;
      }
      if (rd.rerolls.length) { await wait(500); box.querySelector('.ct-round').insertAdjacentHTML('beforeend', `<p class="muted">A tie: they fire again (${rd.rerolls.map((x) => Object.entries(x).map(([k, h]) => `${esc(name(k))} ${h}`).join(' vs ')).join('; ')}).</p>`); }
      if (rd.winner) { wins[rd.winner] = (wins[rd.winner] || 0) + 1; box.querySelector(`[data-s="${CSS.escape(rd.winner)}"]`)?.classList.add('ct-first'); }
      box.querySelector('.ct-tally').textContent = d.entrants.map((e) => `${e.name} ${wins[e.key] || 0}`).join(' · ');
      await wait(1500);
    }
    box.querySelector('.ct-leg').textContent = r.text;
  }
  play(r.winners.some((k) => k === `pc:${me()}`) ? 'successBig' : 'success');
  const done = box.querySelector('[data-ct-done]');
  done.hidden = false;
  await new Promise((res) => done.addEventListener('click', res, { once: true }));
  box.hidden = true; box.innerHTML = '';
}

function showChip() {
  let chip = document.querySelector('.ct-chip');
  if (!view?.open || scene) { chip?.remove(); return; }
  contestStyles();
  if (!chip) {
    chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'cv-chip ct-chip';
    chip.addEventListener('click', openContest);
    placeChip(chip);
  }
  chip.innerHTML = `${gl(view.kind === 'race' ? 'horseshoe' : 'revolver')} The ${view.kind === 'race' ? 'race' : 'trick shots'}`;
}

// every player's screen: the invite, the corner chip, and the show when the Warden runs it
export function watchContest() {
  if (savedPin() || !me()) return;
  startPolling(`player&pc=${encodeURIComponent(me())}`, async (d) => {
    view = d;
    if (!d.open) { if (scene) { closeScene(); toast('The contest is over.'); } showChip(); return; }
    const runKey = d.result ? `${d.at}` : '';
    if (runKey && store.get('wiw.contestSeen', '') !== runKey) { // it just ran: everyone watches (not an old one on a new device)
      store.set('wiw.contestSeen', runKey);
      if (Date.now() - (d.result.at || 0) > 600000) { render(); showChip(); return; }
      if (!scene) openContest();
      render(); await playShow(d.result);
    } else if (store.get('wiw.contestAsked', 0) !== (d.reinvite ? `${d.at}.${d.reinvite}` : d.at) && !d.result && !scene && !document.querySelector('.ask-back')
      && !(d.reinvite && d.entrants.some((e) => e.pc === me()))) { // a Re-invite skips anyone already entered
      store.set('wiw.contestAsked', d.reinvite ? `${d.at}.${d.reinvite}` : d.at);
      play('chime');
      const pitch = d.kind === 'race' ? `A horse race at ${d.where}\n\nThree legs, entry ${$$(d.fee)}, winner takes the pot. Bring your horse, or rent one there. Side bets welcome.`
        : `A trick-shot contest in ${d.where}\n\n${d.rounds} rounds with Adda’s pistols. Entry ${$$(d.fee)}, winner takes the pot. Side bets welcome.`;
      if (await ask(pitch, { ok: 'Go and see', cancel: 'Maybe later', danger: false })) openContest();
    }
    render(); showChip();
  }, null, EP);
}

// ---------- the Warden's card (Run the Game → Start Something) ----------
export function mountContestDesk(el) {
  const st = { kind: 'race', where: '', fee: 1, rent: 0.5, rounds: 3, npcs: [] };
  let data = null;
  const refresh = () => api('GET', null, '?view=warden', EP).then((d) => { data = d; view = d; draw(); }).catch(() => {});
  onChange(['contest', 'combat'], refresh); refresh();
  function draw() {
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    if (data?.open) {
      el.innerHTML = `<p><b>${esc(data.name)} at ${esc(data.where)}</b> · pot ${$$(data.pot)}${data.bets.length ? ` · side bets ${$$(data.bets.reduce((s, b) => s + b.amount, 0))}` : ''}</p>
        <ul class="cv-desk">${data.entrants.map((e) => `<li><b>${esc(e.name)}</b>${e.kind === 'npc' ? ` (${esc(e.tough)})` : ''}${e.horse ? ` on ${e.horse.rented ? 'a rented nag' : esc(e.horse.breed)}` : ''}${data.bets.filter((b) => b.on === e.key).map((b) => ` · ${esc(b.name)} bet ${$$(b.amount)}`).join('')}</li>`).join('')}</ul>
        ${data.result ? `<p><i>${esc(data.result.text)}</i></p>` : ''}
        <div class="btn-row">${data.result ? '' : `<button type="button" class="btn small" data-ct-run${data.entrants.length < 2 ? ' disabled' : ''}>${gl('flash')} ${data.kind === 'race' ? 'Start the race' : 'Start the contest'}</button>`}
          ${data.result ? '' : `<button type="button" class="btn small secondary" data-ct-reinvite title="The invite pops up again for anyone not in yet">${gl('sound')} Re-invite</button>`}
          <button type="button" class="btn small secondary" data-ct-watch>Watch${data.result ? ' it again' : ''}</button>
          <button type="button" class="btn small secondary danger" data-ct-close>${data.result ? 'Close it' : 'Call it off (refunds)'}</button></div>`;
      return;
    }
    el.innerHTML = `<div class="field-step"><span>WHICH CONTEST</span><div class="chip-row">${[['race', 'Horse race'], ['trickshot', 'Trick-shot contest']].map(([k, l]) => `<button type="button" class="chip-btn${st.kind === k ? ' on' : ''}" data-ct-kind="${k}">${l}</button>`).join('')}</div></div>
      <p class="muted sess-note">${st.kind === 'race' ? 'House rules: three legs (Finesse, Nerve, then Finesse or Nerve); horses add dice by breed and Bond; a rented horse adds none.' : 'Dobytown, Iron Road p. 109: Finesse for an Aim, then Adda’s 3G pistol; most Hits wins the round.'} Everyone gets an invite.</p>
      <label class="field-step"><span>WHERE</span><input maxlength="40" value="${esc(st.where)}" data-ct-f="where" placeholder="${st.kind === 'race' ? 'the fairground' : 'Dobytown'}"></label>
      <div class="ct-desk-row"><label class="field-step"><span>ENTRY $</span><input type="number" min="0" max="20" step="0.25" value="${st.fee}" data-ct-f="fee"></label>
      ${st.kind === 'race' ? `<label class="field-step"><span>HORSE RENTAL $</span><input type="number" min="0" max="5" step="0.25" value="${st.rent}" data-ct-f="rent"></label>`
        : `<div class="field-step"><span>ROUNDS</span><div class="chip-row">${[3, 4, 5].map((n) => `<button type="button" class="chip-btn${st.rounds === n ? ' on' : ''}" data-ct-rounds="${n}">${n}</button>`).join('')}</div></div>`}</div>
      <div class="field-step"><span>NPC ${st.kind === 'race' ? 'RIDERS' : 'SHOOTERS'} (up to 5)</span>
        ${st.npcs.map((n, i) => `<div class="ct-npc"><input maxlength="40" value="${esc(n.name)}" data-ct-npc="${i}" aria-label="Name"><div class="chip-row">${['Weak', 'Moderate', 'Strong'].map((t) => `<button type="button" class="chip-btn${n.tough === t ? ' on' : ''}" data-ct-tough="${i}:${t}">${t}</button>`).join('')}</div><button type="button" class="linkish" data-ct-drop="${i}">remove</button></div>`).join('')}
        ${st.npcs.length < 5 ? '<button type="button" class="btn small secondary" data-ct-add>+ Add one</button>' : ''}</div>
      <button type="button" class="btn small" data-ct-open>${gl('star')} Open it</button>`;
  }
  const NAMES = ['Slim Dawson', 'Lucky Pete', 'Calamity Rae', 'Dutch Harlan', 'Mae Whitlock', 'Two-Bit Tom', 'Ruby Kincaid'];
  el.addEventListener('input', (e) => {
    const d = e.target.dataset;
    if (d.ctF) st[d.ctF] = d.ctF === 'where' ? e.target.value : Number(e.target.value) || 0;
    if (d.ctNpc) st.npcs[Number(d.ctNpc)].name = e.target.value;
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.ctKind) { st.kind = d.ctKind; draw(); return; }
    if (d.ctRounds) { st.rounds = Number(d.ctRounds); draw(); return; }
    if (d.ctAdd !== undefined) { st.npcs.push({ name: NAMES.find((n) => !st.npcs.some((x) => x.name === n)) || 'A stranger', tough: 'Moderate' }); draw(); return; }
    if (d.ctDrop) { st.npcs.splice(Number(d.ctDrop), 1); draw(); return; }
    if (d.ctTough) { const [i, t] = d.ctTough.split(':'); st.npcs[Number(i)].tough = t; draw(); return; }
    try {
      if (d.ctOpen !== undefined) { await api('POST', { action: 'open', ...st }, '', EP); toast('It’s open. Everyone gets an invite.'); }
      if (d.ctRun !== undefined) { const r = await api('POST', { action: 'run' }, '', EP); view = r.state; openContest(); await playShow(r.result); }
      if (d.ctWatch !== undefined) { view = data; openContest(); if (data.result) await playShow(data.result); }
      if (d.ctReinvite !== undefined) { await api('POST', { action: 'reinvite' }, '', EP); toast('Invite sent again to anyone not entered.'); }
      if (d.ctClose !== undefined) { if (!await ask(data.result ? 'Close the contest?' : 'Call it off? Entry fees and bets go back.')) return; await api('POST', { action: 'close' }, '', EP); closeScene(); }
      refresh();
    } catch (err) { toast(err.message, true); }
  });
  return { draw };
}
