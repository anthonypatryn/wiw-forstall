// Smoke test: `npm run smoke`. Starts the dev server on a spare port with a throwaway data folder (never .data),
// seeds a small game, then opens every page in headless Chrome as the Warden and as a player and fails on any
// script error or a missing key element. It also clicks through an attack on the Battle Map.
// No packages: Chrome is driven over the DevTools protocol with Node's built-in fetch and WebSocket (Node 22+).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199, DEBUG = 9333, BASE = `http://localhost:${PORT}`, PIN = '1234';
// `npm run smoke -- --shots <folder>` also saves a full-page screenshot of every check (for looking the pages over)
const SHOTS = process.argv.includes('--shots') ? (process.argv[process.argv.indexOf('--shots') + 1] || path.join(os.tmpdir(), 'wiw-shots')) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const CHROMES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wiw-smoke-'));
const kids = [];
const results = [];
function done(code) {
  for (const k of kids) { try { k.kill(); } catch {} }
  setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} process.exit(code); }, 400);
}
process.on('SIGINT', () => done(130));

// ---------- the server, on its own data ----------
async function startServer() {
  const srv = spawn(process.execPath, [path.join(ROOT, 'dev-server.mjs')], { env: { ...process.env, PORT: String(PORT), WIW_DATA_DIR: path.join(tmp, 'data'), KV_REST_API_URL: '', UPSTASH_REDIS_REST_URL: '' }, stdio: 'ignore' });
  kids.push(srv);
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${BASE}/api/pulse`)).ok) return; } catch {} await sleep(100); }
  throw new Error('The dev server didn’t start.');
}
async function call(p, body, warden = true) {
  const r = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(warden ? { 'x-warden-pin': PIN } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p} ${body?.action || ''}: ${j.error || r.status}`);
  return j;
}
async function seed() {
  const pc = (await call('/api/combat', { action: 'addPc', trade: 'Hunter', name: 'Smoke Test' })).result;
  const cat = (await call('/api/shop?view=catalog')).catalog;
  const bp = cat.find((i) => i.name === 'Backpack Forstall');
  await call('/api/combat', { action: 'pc', id: pc.id, op: 'pick', kind: 'forstall', i: 0, itemId: bp.id });
  await call('/api/combat', { action: 'addEnemy', profile: 'Chupacabra' });
  await call('/api/combat', { action: 'start' });
  await call('/api/battle', { action: 'syncCombat' });
  let st = await call('/api/combat?view=warden');
  if (st.combat.current !== pc.id) { await call('/api/combat', { action: 'next' }); st = await call('/api/combat?view=warden'); }
  const bv = await call('/api/battle?view=warden');
  const tok = bv.tokens.find((t) => t.kind === 'pc');
  await call('/api/battle', { action: 'addForstall', kind: 'town', name: 'Town Forstall', col: tok.col + 1, row: tok.row });
  await call('/api/session', { action: 'add', title: 'Session 1' });
  return { pcId: pc.id, current: st.combat.current };
}

// ---------- Chrome over the DevTools protocol ----------
async function startChrome() {
  const exe = CHROMES.find((c) => fs.existsSync(c));
  if (!exe) throw new Error('No Chrome or Edge found. Set CHROME to its path.');
  const ch = spawn(exe, ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${path.join(tmp, 'chrome')}`, '--no-first-run', '--no-default-browser-check', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
  kids.push(ch);
  for (let i = 0; i < 80; i++) { try { const r = await fetch(`http://127.0.0.1:${DEBUG}/json/list`); const list = await r.json(); const page = list.find((t) => t.type === 'page'); if (page) return page.webSocketDebuggerUrl; } catch {} await sleep(150); }
  throw new Error('Chrome didn’t start.');
}
function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0; const waiting = new Map(); const listeners = [];
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } else listeners.forEach((f) => f(msg)); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  return { ready: new Promise((r) => { ws.onopen = r; }), send, on: (f) => listeners.push(f), close: () => ws.close() };
}

async function main() {
  await startServer();
  const s = await seed();
  const c = cdp(await startChrome());
  await c.ready;
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Log.enable');
  let errors = [];
  c.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const js = async (expr) => { const r = await c.send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  const goto = async (p, wait = 2500) => { await c.send('Page.navigate', { url: BASE + p }); await sleep(wait); await js("document.querySelectorAll('.tour-back, .prev-modal').forEach((m) => m.closest('.modal-back, .tour-back')?.remove())"); };
  const as = async (who) => {
    await goto('/howto', 800);
    await js(who === 'warden'
      ? `sessionStorage.setItem('wiw.pin', '${PIN}'); localStorage.setItem('wiw.me', 'null'); localStorage.setItem('wiw.prevSeen', '"x"'); return 1;`
      : `sessionStorage.removeItem('wiw.pin'); localStorage.setItem('wiw.me', JSON.stringify('${s.pcId}')); localStorage.setItem('wiw.prevSeen', '"x"'); localStorage.setItem('wiw.tour.sheet', '1'); return 1;`);
  };
  async function check(name, p, expr, wait) {
    errors = [];
    await goto(p, wait);
    let ok = false, why = '';
    try { ok = await js(expr); } catch (e) { why = e.message; }
    const stuck = await js("return [...document.querySelectorAll('.loading')].filter((e) => e.offsetParent).map((e) => e.parentElement.id || 'a list').join(', ')");
    if (stuck) errors.push(`Still loading: ${stuck}`);
    const errs = errors.filter((e) => !/Failed to load resource/.test(e));
    if (SHOTS) {
      const m = await c.send('Page.getLayoutMetrics');
      const h = Math.min(4000, Math.ceil(m.result.cssContentSize?.height || 900));
      await c.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: h, deviceScaleFactor: 1, mobile: false });
      await sleep(300);
      const shot = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
      fs.writeFileSync(path.join(SHOTS, `${String(results.length + 1).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)}.jpg`), Buffer.from(shot.result.data, 'base64'));
      await c.send('Emulation.clearDeviceMetricsOverride');
    }
    const pass = ok === true && !errs.length;
    results.push({ name, pass, why: pass ? '' : (errs[0] || why || (typeof ok === 'string' ? ok : 'check failed')) });
    process.stdout.write(`${pass ? '  ok  ' : '  FAIL'} ${name}${pass ? '' : `  — ${results.at(-1).why}`}\n`);
  }
  const has = (sel) => `!!document.querySelector(${JSON.stringify(sel)})`;

  console.log('\nWarden');
  await as('warden');
  await check('Run the Game: nav and Now view', '/run', `return ${has('#run-nav')} && !document.querySelector('#grp-now').hidden && ${has('#fight .btn, #fight')};`, 3000);
  await check('Run the Game: Start Session opens', '/run', `document.querySelector('#start-session').click(); await new Promise(r=>setTimeout(r,1200)); return ${has('.start-modal')};`, 3000);
  await check('Run the Game: Downtime card', '/run#grp-rewards', `return ${has('#downtime [data-dt-act]')} && ${has('#downtime [data-dt-go]')};`, 3000);
  await check('Run the Game: Book Tables rolls a row', '/run#grp-start', `document.querySelector('#book-tables [data-bt-roll]').click(); await new Promise(r=>setTimeout(r,1200)); return ${has('#book-tables .bt-on')} && ${has('#book-tables [data-bt-say]')};`, 3000);
  await check('Battle Map: fight bar and the current fighter’s card', '/battle', `return ${has('.fightbar .fb-next')} && !document.querySelector('#fcard').hidden && ${has('#fcard [data-open=attack]')};`, 3500);
  await check('Battle Map: attack by clicking a lit-up target', '/battle', `
    document.querySelector('#fcard [data-open=attack]').click(); await new Promise(r=>setTimeout(r,300));
    const t = document.querySelector('.btoken.tgt'); if (!t) return 'no target lit up';
    t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r=>setTimeout(r,300));
    const go = document.querySelector('[data-map-attack]'); if (!go || go.disabled) return 'no Roll button';
    go.click(); await new Promise(r=>setTimeout(r,1500)); return true;`, 3500);
  await check('Battle Map: Map setup gear', '/battle', `document.querySelector('#setup-btn').click(); return !document.querySelector('#setup').hidden;`, 3000);
  for (const [n, p, sel] of [['Posse sheets', '/posse', '.pc-list, #sheet-view'], ['A character sheet', `/posse#${s.pcId}`, '.sheet-head'], ['Store', '/store', '.card'], ['Journal', '/journal', '.card'],
    ['Map', '/map', '#places .place, #stage'], ['NPCs', '/names', '.card'], ['Wanted', '/wanted', '.card'], ['Prep', '/prep', '.card'], ['Forstall Scanner (Warden)', '/warden', '.card'], ['How to Play', '/howto', '.card'], ['Backpack', '/backpack', '.card'], ['Posse Stash', '/stash', '.card']]) {
    await check(n, p, `return ${has(sel)};`, 2500);
  }

  console.log('\nPlayer');
  await as('player');
  await check('Battle Map: my card on my turn, no Warden tools', '/battle', `return !document.querySelector('#fcard').hidden && document.querySelector('#setup-btn').hidden && ${has('[data-endmine]')};`, 3500);
  await check('Battle Map: my attack lights targets', '/battle', `document.querySelector('#fcard [data-open=attack]').click(); await new Promise(r=>setTimeout(r,300)); return ${has('.btoken.tgt')};`, 3500);
  await check('My sheet', `/posse#${s.pcId}`, `return ${has('.sheet-head')};`, 3000);
  await check('Forstall Scanner', '/', `return ${has('#roll-btn')};`, 2500);
  await check('Journal', '/journal', `return ${has('.card')};`, 2500);
  await check('Rules lookup (/ key)', '/journal', `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })); await new Promise(r=>setTimeout(r,600)); return ${has('.rules-modal')};`, 2500);

  c.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — ${failed.length} failed` : ''}.`);
  done(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(`\nSmoke test couldn’t run: ${e.message}`); done(2); });
