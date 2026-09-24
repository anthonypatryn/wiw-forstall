// The shared Table Log: every roll from any page (combat, sheets, Forstall scans) in one place.
import { esc, api, startPolling, staticDice, timeAgo, injectDefs } from './common.js';

export function logHTML(log) {
  if (!log.length) return '<p class="empty-note">Rolls and big moments show up here for everyone.</p>';
  return log.map((l) => {
    if (l.type === 'round') return `<div class="ent round">— ${esc(l.text)} —</div>`;
    if (l.type === 'roll') {
      return `<div class="ent roll${l.hidden ? ' secret-roll' : ''}"><div class="top"><b>${esc(l.who)}${l.hidden ? ' (secret)' : ''}</b><span class="when" data-at="${l.at}">${timeAgo(l.at)}</span></div>
        ${l.label ? `<div>${esc(l.label)}</div>` : ''}
        <div class="dice-mini" data-dice='${esc(JSON.stringify(l.dice))}'></div>
        <span class="res">${l.hits} hit${l.hits === 1 ? '' : 's'}</span> <span class="muted">· ${esc(l.pool)}${l.spur ? ' ↻' : ''}${l.aces ? ` · ${l.aces} Ace${l.aces > 1 ? 's' : ''}` : ''}</span></div>`;
    }
    return `<div class="ent ${l.type}"><div class="top"><span>${esc(l.text)}</span><span class="when" data-at="${l.at}">${timeAgo(l.at)}</span></div>${l.secret ? `<div class="secret">${esc(l.secret)}</div>` : ''}</div>`;
  }).join('');
}

export function renderLogInto(box, log) {
  box.innerHTML = logHTML(log);
  box.querySelectorAll('[data-dice]').forEach((el) => staticDice(el, JSON.parse(el.dataset.dice)));
}

// Floating drawer for pages without a built-in log.
export function mountTableLog() {
  injectDefs();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'log-fab';
  btn.innerHTML = '📜 Table Log <span class="log-badge" hidden></span>';
  btn.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('aside');
  panel.className = 'log-drawer';
  panel.setAttribute('aria-label', 'Table Log');
  panel.hidden = true;
  panel.innerHTML = `<div class="log-drawer-head"><b>TABLE LOG</b><a href="/combat">Combat &amp; Dice ›</a><button type="button" class="log-close" aria-label="Close">✕</button></div><div class="log"></div>`;
  document.body.append(btn, panel);

  let seenTop = null, unread = 0, latest = [];
  const badge = btn.querySelector('.log-badge');
  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { unread = 0; badge.hidden = true; renderLogInto(panel.querySelector('.log'), latest); }
  };
  btn.addEventListener('click', () => setOpen(panel.hidden));
  panel.querySelector('.log-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

  startPolling('log', (d) => {
    latest = d.log;
    const topId = latest[0]?.id ?? null;
    if (seenTop !== null && topId !== seenTop) {
      const idx = latest.findIndex((l) => l.id === seenTop);
      unread += idx === -1 ? latest.length : idx;
      if (panel.hidden && unread) { badge.textContent = unread > 9 ? '9+' : unread; badge.hidden = false; btn.classList.remove('ping'); void btn.offsetWidth; btn.classList.add('ping'); }
    }
    seenTop = topId;
    if (!panel.hidden) renderLogInto(panel.querySelector('.log'), latest);
  }, null, '/api/combat');
}
