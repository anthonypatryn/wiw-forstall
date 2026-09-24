import { esc, readoutHTML, chipsHTML, diamondsHTML, timeAgo } from './common.js';

const openEntries = new Set();

// Render the shared posse notebook. Skips while someone is typing a note so we don't clobber it.
export function renderNotebook(root, entries, { active, filter = '', onNote, wardenTools } = {}) {
  if (root.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return false;
  const q = filter.trim().toLowerCase();
  const list = entries.filter((e) => !q || e.name.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q));
  const decoded = list.filter((e) => e.solved).sort((a, b) => a.name.localeCompare(b.name));
  const working = list.filter((e) => !e.solved);

  const entry = (e) => {
    const open = openEntries.has(e.name) || (e.name === active && !e.solved && !openEntries.has('!' + e.name));
    const lastGuesses = e.guesses.slice(-3);
    return `<details class="entry${e.name === active ? ' active-entry' : ''}" data-name="${esc(e.name)}"${open ? ' open' : ''}>
      <summary>
        <span class="ename">${esc(e.name)}<small>${esc(e.size || '')}${e.page ? ` · p. ${e.page}` : ' · custom'}${e.solved ? '' : ` · ${e.known.length}/6 digits · ${e.guesses.length} guess${e.guesses.length === 1 ? '' : 'es'}`}</small></span>
        ${e.solved ? `<span class="kz">${esc(e.kz)}</span>` : readoutHTML(e.positional, 'small light')}
      </summary>
      <div class="body">
        ${e.solved
          ? `<div class="muted">Decoded ${e.solvedAt ? timeAgo(e.solvedAt) : ''}${e.guesses.length ? ` in ${e.guesses.length} guess${e.guesses.length === 1 ? '' : 'es'}` : ''}. Good for Sweeping (+1) and Bursting.</div>`
          : `<div>Recovered digits: ${e.known.length ? chipsHTML(e.known) : '<span class="muted">none yet</span>'}</div>
             ${lastGuesses.length ? `<div class="mini-rows">${lastGuesses.map((g) => diamondsHTML(g.digits, g.result)).join('')}</div>` : ''}`}
        <textarea data-note="${esc(e.name)}" placeholder="Notes — where you found it, what it did…">${esc(e.notes || '')}</textarea>
        ${wardenTools ? wardenTools(e) : ''}
      </div>
    </details>`;
  };

  root.innerHTML = `
    <h3>DECODED (${decoded.length})</h3>
    ${decoded.length ? decoded.map(entry).join('') : '<p class="empty-note">No full frequencies yet. Scan a monster to start.</p>'}
    <h3>IN PROGRESS (${working.length})</h3>
    ${working.length ? working.map(entry).join('') : '<p class="empty-note">Nothing mid-scan.</p>'}`;

  root.querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => {
    const n = d.dataset.name;
    if (d.open) { openEntries.add(n); openEntries.delete('!' + n); } else { openEntries.delete(n); openEntries.add('!' + n); }
  }));
  root.querySelectorAll('textarea[data-note]').forEach((t) => {
    t.addEventListener('change', () => onNote?.(t.dataset.note, t.value));
  });
  return true;
}
