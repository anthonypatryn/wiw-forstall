// Fighter cards for the Warden: a character's or an enemy's Health, Grit, Statuses and (enemies) the full stat block with
// tap-to-roll dice, frenzy, features and loot. Every roll is public (it goes in the Table Log and pops up).
// Used by the Battle Map's side panel; styles in css/fighter.css.
// ctx = { data: the Warden combat view (posse, enemies, combat, profiles, loot), meta: ?view=meta, act(body) → result }
import { esc, bleedPanel, rollPopup, ask, askText, toast } from './common.js';
import { gl } from './glyphs.js';

const poolText = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
const isPool = (s) => /^(\d+[BG])+$/.test(poolText(s));
const damagePool = (effect) => { const m = effect.match(/((?:\d+[BG])+)\s+damage/i); return m ? m[1].toUpperCase() : null; };
const statusPools = (effect) => [...effect.matchAll(/(\w+)\s*\[((?:\d+[BG])+)\]/gi)].map((m) => ({ status: m[1], pool: m[2].toUpperCase() }));

function hpHTML(f, editable) {
  const pct = Math.max(0, Math.min(100, (f.health / Math.max(1, f.maxHealth)) * 100));
  return `<div class="hp"><span class="lbl">HEALTH</span><span class="bar"><i style="width:${pct}%"></i></span>
    <span class="num">${f.health}/${f.maxHealth}</span>
    ${editable ? `<span class="pm"><button type="button" data-hp="-1" aria-label="Lose 1 Health">−</button><button type="button" data-hp="1" aria-label="Gain 1 Health">+</button></span>
    <input type="number" data-hpn placeholder="±" title="Type damage (−5) or healing (3), then Enter" aria-label="Change Health by">` : ''}</div>`;
}
function gritHTML(f) {
  const max = Math.max(6, f.grit);
  return `<div class="row2"><span class="lbl">GRIT</span><span class="pips">${Array.from({ length: max }, (_, i) =>
    `<button type="button" class="pip${i < f.grit ? ' on' : ''}" data-grit="${i + 1}" aria-label="${i + 1} Grit"></button>`).join('')}</span>
    <span class="muted small-text">${f.grit} left</span></div>`;
}
function statusesHTML(f, meta) {
  const list = Object.entries(f.statuses || {});
  const tip = (s) => esc(`${s} (relieve with ${meta.statuses[s]?.skill}): ${meta.statuses[s]?.text}`);
  const chips = list.map(([s, v]) => `<span class="st" title="${tip(s)}">${s} <b>${v}</b><button type="button" data-st="${s}" data-v="${v - 1}" aria-label="Lower ${s}">−</button><button type="button" data-st="${s}" data-v="${v + 1}" aria-label="Raise ${s}">+</button></span>`).join('');
  const add = `<select class="st-add" data-st-add aria-label="Add a Status"><option value="">+ Status…</option>${Object.keys(meta.statuses).filter((s) => !f.statuses?.[s]).map((s) => `<option>${s}</option>`).join('')}</select>`;
  return `<div class="statuses">${chips}${add}</div>`;
}

// ---------- a character ----------
export function pcCardHTML(p, { data, meta }) {
  const now = data.combat.current === p.id;
  const t = meta.trades[p.trade];
  const aces = (t?.aces || []).filter((_, i) => i === 0 || p.aceTwo);
  return `<article class="fighter${now ? ' now' : ''}${p.dead ? ' down' : ''}" data-fc-pc="${p.id}">
    <div class="f-head"><div><div class="f-name"><a href="/posse#${p.id}">${esc(p.name)}</a></div><div class="f-sub">The ${esc(p.trade)}</div></div>
      ${now ? '<span class="f-tag now">THEIR TURN</span>' : p.dead ? '<span class="f-tag red">FALLEN</span>' : p.bleeding ? '<span class="f-tag red">BLEEDING OUT</span>' : ''}</div>
    ${hpHTML(p, !p.dead)}
    ${p.dead ? '' : gritHTML(p)}
    ${p.dead ? '' : `<div class="row2"><span class="lbl">ACES</span><span class="pips">${Array.from({ length: 6 }, (_, i) => `<button type="button" class="pip ace${i < p.aces ? ' on' : ''}" data-aces="${i + 1}" aria-label="${i + 1} Aces"></button>`).join('')}</span></div>`}
    ${p.aces >= 6 && !p.dead ? `<div class="ace-ready"><b>ACE-IN-THE-HOLE READY</b> — ${aces.map((a) => `<b>${esc(a.name)}</b>: ${esc(a.text)}`).join('<br>')}
      <div class="mt-2"><button class="btn small" data-ace-use type="button">Play it (reset meter)</button></div></div>` : ''}
    ${p.dead ? '' : statusesHTML(p, meta)}
    ${bleedPanel(p, meta.skills)}
    ${p.dead ? '<div class="f-actions"><button class="btn small secondary" data-op="revive" type="button">Revive</button></div>' : ''}
  </article>`;
}

// ---------- an enemy ----------
const lootSel = {}; // keep dropdown picks across redraws
function lootHTML(e, p, data) {
  const sel = lootSel[e.id] ||= { pc: '', cond: 'Good' };
  const alive = data.posse.filter((x) => !x.dead);
  const who = (attr) => `<select ${attr} aria-label="Who"><option value="">— who? —</option>${alive.map((x) => `<option value="${x.id}"${x.id === sel.pc ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
  const t = p?.trophy;
  return `<div class="loot"><b class="loot-h">${gl('trophy')} LOOT</b>${e.looted ? ` <span class="muted">Trophy taken by ${esc(e.looted)}.</span>` : ''}
    ${t ? `<p class="loot-tro"><b>${esc(t.split(/\.\s/)[0])}.</b> ${esc(t.slice(t.split(/\.\s/)[0].length + 1).trim())}</p>
      <div class="loot-row">${who('data-loot-pc')}<select data-loot-cond aria-label="Condition">${data.loot.conditions.map((c) => `<option${c === sel.cond ? ' selected' : ''}>${c}</option>`).join('')}</select>
        <button class="btn small" type="button" data-loot>Give trophy</button></div>
      <p class="loot-guide">${data.loot.guide.map((g) => `<span><b>${g.range}</b>: ${g.with}</span>`).join('')}</p>` : ''}
    <div class="loot-row">${t ? '' : who('data-loot-pc')}<button class="btn small secondary" type="button" data-search>${gl('die')} Search the body (Intuition)</button><span class="muted">you decide what they find</span></div></div>`;
}
export function enemyCardHTML(e, { data, meta }) {
  const now = data.combat.current === e.id;
  const frenzied = e.frenzied?.length > 0;
  const p = e.profile ? data.profiles[e.profile] : null;
  const skills = Object.entries(e.skills || {}).filter(([, v]) => isPool(v));
  const roll = (pool, label, text = pool) => `<button type="button" data-rollpool="${esc(poolText(pool))}" data-label="${esc(label)}" title="Roll ${esc(poolText(pool))} for everyone to see">${esc(text)}</button>`;
  return `<article class="fighter${now ? ' now' : ''}${e.defeated ? ' down lootable' : ''}${frenzied ? ' frenzied' : ''}" data-fc-enemy="${e.id}">
    ${e.defeated ? `<div class="loot-flag">${gl('skull')} ${e.fled ? 'Fled' : 'Down'} — ${e.looted ? 'looted' : 'ready to loot'}</div>` : ''}
    <div class="f-head"><div><div class="f-name">${esc(e.name)} <button type="button" class="rename" data-rename title="Rename" aria-label="Rename ${esc(e.name)}">✎</button></div>
      <div class="f-sub">${esc(e.size)}${p ? ` · p. ${p.page}${p.name !== e.name ? ` · ${esc(p.name.replace('Human - ', ''))}` : ''}` : ' · custom'}</div></div>
      <div>${now ? '<span class="f-tag now">ITS TURN</span>' : ''}${frenzied ? '<span class="f-tag red">FRENZIED</span>' : ''}</div></div>
    ${e.defeated ? lootHTML(e, p, data) : ''}
    <div class="f-body">
    ${hpHTML(e, true)}
    ${gritHTML(e)}
    <div class="e-stats">
      <div>DEFENSE<b>${isPool(e.defense) ? roll(e.defense, 'Defense', e.defense) : esc(e.defense || '—')}</b></div>
      <div>SPEED<b>${esc(e.speed || '—')}</b></div>
      <div>SIZE<b>${esc(e.size)}</b></div>
      ${skills.map(([k, v]) => `<div>${k.toUpperCase()}<b>${roll(v, k[0].toUpperCase() + k.slice(1), v)}</b></div>`).join('')}
    </div>
    ${statusesHTML(e, meta)}
    ${p ? `<div class="attacks">${p.attacks.map((a) => {
      const dmg = damagePool(a.effect);
      return `<div class="atk"><span class="an">${esc(a.name)}<small>${a.range.toUpperCase()}${a.aoe ? ' · AOE' : ''} · ${a.grit} GRIT</small></span>
        <span class="rolls">${dmg ? roll(dmg, `${a.name} — damage`) : ''}${statusPools(a.effect).map((s) => `<button type="button" class="st-roll" data-rollpool="${s.pool}" data-label="${esc(a.name)} — ${esc(s.status)}">${esc(s.status)} ${s.pool}</button>`).join('')}</span>
        <span class="ae">${esc(a.effect)}</span></div>`;
    }).join('')}</div>
    <div>${p.frenzy.map((f) => `<div class="frenzy-row${e.frenzied.includes(f.name) ? ' hit' : ''}"><b>${esc(f.name)}</b> ${f.event ? '(Event) ' : ''}at ${f.health} Health${e.frenzied.includes(f.name) ? ' — <b>ACTIVE</b>' : ''}<br>${esc(f.text)}</div>`).join('')}</div>
    <details class="more"><summary>Features &amp; tolerances</summary>${p.features.map((f) => `<p>${esc(f)}</p>`).join('')}<p><b>Tolerances:</b> ${esc(p.tolerances)}</p></details>` : ''}
    </div>
    <div class="f-actions"><button class="btn small secondary danger" data-remove type="button">Remove from the fight</button></div>
  </article>`;
}

// ---------- wiring (one card or several inside `box`) ----------
export function wireFighters(box, ctx) {
  const { act } = ctx;
  const common = (card, send) => {
    card.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', () => send({ op: 'health', delta: Number(b.dataset.hp) })));
    const hpn = card.querySelector('[data-hpn]');
    const applyHp = () => { const v = Number(hpn.value); hpn.value = ''; if (v) send({ op: 'health', delta: v }); };
    hpn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyHp(); });
    hpn?.addEventListener('change', applyHp);
    card.querySelectorAll('[data-grit]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.grit);
      send({ op: 'grit', value: b.classList.contains('on') && !b.nextElementSibling?.classList.contains('on') ? n - 1 : n });
    }));
    card.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => send({ op: 'status', status: b.dataset.st, value: Number(b.dataset.v) })));
    card.querySelector('[data-st-add]')?.addEventListener('change', (e) => { if (e.target.value) send({ op: 'status', status: e.target.value, value: 1 }); });
  };
  box.querySelectorAll('[data-fc-pc]').forEach((card) => {
    const pid = card.dataset.fcPc;
    const send = (o) => act({ action: 'pc', id: pid, ...o });
    common(card, send);
    card.querySelectorAll('[data-aces]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.aces);
      send({ op: 'aces', value: b.classList.contains('on') && !b.nextElementSibling?.classList.contains('on') ? n - 1 : n });
    }));
    card.querySelector('[data-ace-use]')?.addEventListener('click', () => send({ op: 'aces', value: 0, used: true }));
    card.querySelectorAll('[data-bleed-roll]').forEach((b) => b.addEventListener('click', async () => {
      const r = await send({ op: 'bleedRoll', skill: b.dataset.bleedRoll });
      if (r?.dice) rollPopup(r, `${r.who} · Bleeding Out · ${b.dataset.bleedRoll} · ${r.pool}${r.outcome === 'dead' ? ' · DIED' : ''}`);
    }));
    card.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => send({ op: b.dataset.op })));
  });
  box.querySelectorAll('[data-fc-enemy]').forEach((card) => {
    const eid = card.dataset.fcEnemy;
    const send = (o) => act({ action: 'enemy', id: eid, ...o });
    common(card, send);
    // every roll is public: it goes in the Table Log, and pops up here
    card.querySelectorAll('[data-rollpool]').forEach((b) => b.addEventListener('click', async () => {
      const r = await act({ action: 'roll', pool: b.dataset.rollpool, who: eid, label: b.dataset.label });
      if (r?.dice) rollPopup(r, `${r.who} · ${b.dataset.label} · ${r.pool}`);
    }));
    card.querySelector('[data-remove]')?.addEventListener('click', async () => { if (await ask('Remove this enemy from the fight?', { ok: 'Remove it' })) send({ op: 'remove' }); });
    card.querySelector('[data-rename]')?.addEventListener('click', async () => {
      const cur = card.querySelector('.f-name').firstChild.textContent.trim();
      const n = await askText('New name:', cur);
      if (n && n.trim() && n.trim() !== cur) send({ op: 'rename', name: n.trim() });
    });
    const ls = lootSel[eid] ||= { pc: '', cond: 'Good' };
    card.querySelector('[data-loot-pc]')?.addEventListener('change', (ev) => { ls.pc = ev.target.value; });
    card.querySelector('[data-loot-cond]')?.addEventListener('change', (ev) => { ls.cond = ev.target.value; });
    card.querySelector('[data-loot]')?.addEventListener('click', async () => {
      if (!ls.pc) return toast('Pick who takes the trophy.', true);
      const r = await act({ action: 'loot', enemy: eid, pc: ls.pc, condition: ls.cond });
      if (r) toast(`${r.name} is in their Inventory.`);
    });
    card.querySelector('[data-search]')?.addEventListener('click', async () => {
      if (!ls.pc) return toast('Pick who searches.', true);
      const r = await act({ action: 'search', enemy: eid, pc: ls.pc });
      if (r?.dice) rollPopup(r, `${r.who} searches ${card.querySelector('.f-name').firstChild.textContent.trim()} · ${r.pool}`);
    });
  });
}

// ---------- spoils: when a fight ends, loot the fallen (p. 79) ----------
// getData() → the latest Warden combat view; act(body) → result (and refreshes that view)
export function openSpoils({ getData, meta, act }) {
  const fallen = () => (getData()?.enemies || []).filter((e) => e.defeated);
  if (!fallen().length) return;
  const back = document.createElement('div');
  back.className = 'modal-back ask-back';
  const draw = () => {
    const data = getData();
    back.innerHTML = `<div class="modal ask trade-modal spoils" role="dialog" aria-modal="true" aria-label="Spoils">
      <div class="ho-kicker">${gl('trophy')} THE FIGHT IS OVER</div><h2>Spoils</h2>
      <p class="ask-body">Pick who takes a trophy or searches each body. Trophies go straight into their Inventory; for a search, you decide what they find.</p>
      ${fallen().map((e) => `<article class="fighter down lootable" data-fc-enemy="${e.id}"><div class="f-head"><div class="f-name">${esc(e.name)}</div><span class="f-tag">${e.fled ? 'FLED' : 'DOWN'}</span></div>
        ${lootHTML(e, e.profile ? data.profiles[e.profile] : null, data)}</article>`).join('')}
      <div class="ask-btns"><button type="button" class="btn" data-close>Done</button></div></div>`;
    wireFighters(back, { data, meta, act: async (body) => { const r = await act(body); draw(); return r; } });
  };
  draw();
  document.body.append(back);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) back.remove(); });
}
