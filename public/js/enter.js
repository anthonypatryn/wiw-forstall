// The splash page (/enter): the site password. The server sets the cookie (lib/routes/gate.js); then back to where you
// were headed. Standalone on purpose: common.js polls the API, which answers 401 until you're in.
const form = document.getElementById('enter-form'), pw = document.getElementById('enter-pw'), msg = document.getElementById('enter-msg');
const next = (() => { const n = new URLSearchParams(location.search).get('next') || '/'; return n.startsWith('/') && !n.startsWith('//') ? n : '/'; })();
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('button');
  btn.disabled = true; msg.textContent = ''; form.classList.remove('wrong');
  try {
    const r = await fetch('/api/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw.value }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { msg.textContent = 'Come on in.'; location.replace(next + location.hash); return; } // the #tab never reaches the server, so it rode along here
    msg.textContent = d.error || 'That ain’t it, partner.';
    void form.offsetWidth; form.classList.add('wrong');
    pw.select();
  } catch { msg.textContent = 'Can’t reach the game right now. Check your connection, then try again.'; }
  btn.disabled = false;
});
