# Codebase audit: WIW Table Kit

Audited 2026-09-26 at commit `31812fc`. **No code was changed**; this file is the only edit.
Method: a script scanned every JS, CSS and HTML file, then each finding was checked by hand. False positives were removed, for example the `sec-*` IDs, which are built at runtime, and `$`, which is used everywhere.

Within each section, items are ranked by impact: **H** high, **M** medium, **L** low. Paths are relative to the repo root.

---

## Status after the fix pass (2026-09-26, commits 5aa0085 → 6bf3061)

**Fixed:**
- **Top 10 #1, lost updates:** every API request is now a transaction. Writes commit atomically only if nothing they read changed in the meantime; otherwise the request re-runs. Tested: 20 simultaneous rolls all land. Falls back to plain writes if Redis scripting is ever unavailable.
- **Top 10 #2, polling:** one `/api/pulse` request per tab, with per-document change counters; pages fetch only what changed.
- **Top 10 #3, combat document:** undo snapshots skip the sheet parts a fight never changes, and undo merges instead of replacing, which also fixes mid-fight purchases being undone. The archive is capped at 1,000 entries. About 515 KB → 250 KB in the test.
- **Top 10 #4, PIN guessing:** 30 wrong PINs in 15 minutes and that connection is treated as a player.
- **Backup:** it was missing 9 of the 16 documents; it now includes all of them.
- **§1 dead code:** removed `mountHud`, `getPin`, `resetTour`, `tierFor`, `gearNotes`, `programmable` and `inField`, plus 4 unused imports. Internal-only helpers are no longer exported.
- **§2 dead CSS:** `combat.css` deleted; its one live rule, `.cards`, moved to posse.css. Also removed the dead rules in posse, battle, style, fighter, run and desk, and the unused variables. `--sp-6` is kept to complete the spacing scale.
- **§3 duplication:**
  - Server: `lib/util.js` and `lib/saloon-common.js`, and one `hexDist`.
  - Client: `me`, `dollars`, `isPool`, `paras`, `tabFlag` and `loadImg` are shared.
  - `clean` is now one trimming version plus `cleanKeepSpaces` for autosaved notes.
- **§4 magic numbers:** poll timings, dice averages in the drinking contest, and the crooked-box chance are named.
- **§5 design consistency:**
  - Every z-index is a named `--z-*` token; the tour moved above the lightbox.
  - Five `--shade-*` tokens replace the black-alpha variants.
  - `--gold` is a token, and literal copies of `--surface-2` and `--line` were replaced with the tokens.
  - 560/860 px breakpoints merged into 600/900.
  - `!important` went from 26 to 10; the rest are justified and listed in STYLEGUIDE.md.
- **§8 bugs and risks:**
  - The dropdown's 400 ms timer only runs while a list is open.
  - The flagged `.then()` chains turned out to be handled already; the scan was a false positive.
- **§9 security:** request bodies are capped (413).
- **§10 accessibility:**
  - `aria-label` added to about 30 controls and 8 icon buttons.
  - `--ink-faint` now meets 4.5:1 (5.2:1 on paper, 4.9:1 on the Warden's cards).
  - Focus moves into the saloon, lock and duel scenes.
  - Heading levels fixed on the Battle Map and Map pages.
- **§11 performance:**
  - Battle maps and the world map converted to WebP (25–35% smaller).
  - The Warden header is a 173 KB crop instead of the 985 KB map.
  - `deal.mp3` trimmed from 502 to 254 KB.
  - Lists lazy-load their images.
- **§12 SEO and basics:** favicon on How to Play, descriptions on every page, `noindex` everywhere plus a `robots.txt`.
- **Found along the way:** a wording slip on Run the Game left over from the Combat Control retirement.

**Deliberately left (reason):**
- **§3, a shared `openDialog` helper and one stepper component:** the dialogs share only their outer shell, and merging four steppers risks visual changes across the games for little gain.
- **§4, splitting `pcOp` / `wardenCombat` / `combat.js`, `posse.js` and `saloon.js`:** a large refactor of working rules code. Better done piece by piece alongside future features, with tests added first.
- **§5, snapping one-off font sizes and off-scale spacing (6/10/14 px), and the content-tuned breakpoints (700/760/980/1000/1020/1100):** visible layout changes that would each need a design review.
- **§9, per-player authentication:** a design choice for a friendly table. Adding it means sign-ins for every player.
- **§10, moving Battle Map tokens by keyboard:** a feature in its own right.
- **§11, self-hosting the Google Fonts:** fine as is; revisit if the site is used offline.

---

## Top 10 overall (do these first)

| # | Impact | Finding | Where |
|---|---|---|---|
| 1 | H | **Lost updates:** every write reads a whole JSON document, changes it and writes it back, with no version check. Two players acting at the same moment, like trading, rolling or betting, can silently overwrite each other. | `lib/store.js:30-45`, every `lib/routes/*.js` handler (e.g. `lib/routes/combat.js:74-86`, `lib/routes/saloon.js:65-68`) |
| 2 | H | **Polling load:** each open tab runs about 8 pollers every 2 s (6 s when hidden), and each poll reads Redis at least once. Some routes read 2–4 documents *before* the `since` check. Six players at the table means about 25–50 Redis commands per second, which could exceed an Upstash quota during a long session. | `public/js/common.js:25-45`; pollers listed in §8 |
| 3 | H | **Combat document size:** the `combat` document holds up to 12 undo snapshots, each copying the whole posse, all sheets included, plus a 2,000-entry archive. It's downloaded from Redis on every `/api/combat` poll. The live size needs measuring; it could approach Upstash request/value limits. | `lib/combat.js:188-192` (`pushUndo`), `:55` (`ARCHIVE_MAX`) |
| 4 | M | **Guessable PIN:** the Warden PIN is 4 digits with no rate limit or lockout on `auth`. It could be guessed in about 10,000 requests. | `lib/http.js:4-10`, every route's `action: 'auth'` |
| 5 | M | **Dead stylesheet:** `public/css/combat.css` is about 90% dead since Combat Control was retired, yet it's still loaded by `public/posse.html:13`. | §2 |
| 6 | M | **Copy-pasted money helpers:** the same `walletOf`, `add`, `say`, `seatOf`, `cents` and `money` code is repeated in 4–6 saloon engines. | §3 |
| 7 | M | **Heavy images:** `public/img/map.jpg` (985 KB) is now the Warden header on every Warden page, and the battle maps are 0.75–1.5 MB JPEGs. | §11 |
| 8 | M | **Unlabelled form controls:** about 30 inputs and selects have no accessible label, and 8 icon-only buttons have no `aria-label`. | §10 |
| 9 | M | **Low contrast:** the faint gray text (`--ink-faint`) is 3.2:1 on paper and 2.6:1 on the Warden's gray cards; WCAG AA needs 4.5:1. | §10 |
| 10 | L | **Dead code:** a dead export block (`mountHud`), 7 unused functions/exports and 4 unused imports. | §1 |

---

## 1. Dead code

**Unused functions and exports, never referenced anywhere:**
- **M** `public/js/tablelog.js:219` `mountHud()`. Only the deleted Combat Control page called it. It also starts a second `/api/combat` poller, at `tablelog.js:221`, that is now unreachable. Delete the function.
- **L** `public/js/common.js:13` `getPin`
- **L** `public/js/tour.js:6` `resetTour`. It was meant for "Take the tour", but the replay uses `?tour=1` instead.
- **L** `lib/sheets.js:76` `tierFor`
- **L** `lib/shop.js:195` `gearNotes`
- **L** `lib/forstall.js:139` `programmable`
- **L** `public/js/battle.js:686` `inField` (unused local)

**Unused imports:**
- **L** `lib/combat.js:8` `upgradeType` from `./sheets.js`
- **L** `public/js/battle.js:1` `askText`
- **L** `public/js/tablelog.js:2` `askText`
- **L** `public/js/warden.js:3` `askText`

**Exported but only used inside their own file.** The `export` keyword can go; low impact, but it signals the public API:
- `lib/battle.js:24` `PRESETS`, `:50` `gridSize`
- `lib/blackjack.js:16` `dealerOf`, `:33` `isBlackjack`
- `lib/combat.js:23` `CAPTURE`, `:83` `inFight`, `:143` `DIFFICULTY`, `:694` `DUEL_TOUGH`
- `lib/dice.js:9` `MAX_DICE`
- `lib/drinking.js:14` `SHOT`, `:15` `PASS_OUT`
- `lib/faro.js:12` `RANK_NAMES`
- `lib/forstall.js:8` `WHOLE_MAP`
- `lib/game.js:12` `formatKz`, `:18` `allMonsters`, `:23` `findMonster`
- `lib/handouts.js:10` `canSee`
- `lib/lockpick.js:10` `SUITS`, `:44` `lootText`, `:45` `trapText`
- `lib/npcs.js:8` `allFactions`
- `lib/saloon.js:18` `STYLES`
- `lib/sheets.js:245` `weaponSubOf`
- `lib/shop.js:13` `fmt`, `:17` `allItems`
- `lib/trophies.js:65` `TROPHY_VALUE`
- `lib/wanted.js:11` `BOOK_TOWNS`
- `public/js/common.js:80` `FACE_LABEL`, `:334` `markWarden`, `:337` `parsePoolStr`, `:342` `composePool`, `:457` `miniBullet`
- `public/js/handouts.js:6` `photoUrl`
- `public/js/tablelog.js:7` `logHTML`

**Other:**
- **Unused files:** none. Every JS, CSS and HTML file is referenced.
- **Commented-out code:** none. The `//` lines flagged by the scan are usage notes, e.g. `common.js:412` ``// await ask('Delete this?')``.
- **Unreachable branches:** none found beyond `mountHud` above.

## 2. Dead CSS

**Unused classes and IDs:**
- **M** `public/css/combat.css` (90 lines): its only page (`combat.html`) was deleted.
  - Unused classes: `.combat-grid` (:2), `.turn-card` (:8), `.turn-top` (:11), `.turn-actions` (:15), `.turn-help` (:29), `.add-enemy` (:31), `.custom-enemy` (:35), `.ce-pool` (:36), `.pool-quick` (:43), `.mini-step` (:44), `.die-ico` (:45), `.small-tray` (:50), `.duel-pick` (:54), `.add-npc` (:74). IDs: `#add-npc` (:72), `#npc-as` (:74), `#add-mon-name`/`#add-npc-name` (:87).
  - The `.duel-table` / `.duel-result` rules here are also dead in practice, because the duel pop-up is styled by `.duel-scene …` in `style.css:926-940`.
  - Before deleting the file, check whether `posse.html` still uses `.cards`, `.field` or `.roller`; everything else in it can go.
- **L** `public/css/posse.css:392-397` `.turn-banner`, `.tb-btns`; `:403` `.fp-note`; `:404` `.turn-tag` (with `!important`); `:405` the matching reduced-motion rule; `:428-430` `.fp-log`; `:185-186` `.prestige-ref`; `:388` `.cond.totaled`
- **L** `public/css/battle.css:150-155` `.tp-note`, `.tp-row`, `.tp-h`, left over from the old turn panel
- **L** `public/css/style.css:117-118` `.flourish`; `:144` `.opts.tight-top`; `:260` `.chip.dim`; `:488` `.log-card` (the Combat Control log card)
- **L** `public/css/fighter.css:25` `.icon-btn`; `:88` `.ea` (the enemy-attack box that wasn't carried over)
- **L** `public/css/run.css:4` `.need-btns`
- **L** `public/css/desk.css:41` `.gl-duel`
- **Not dead:** `public/css/wanted.css:47` `.is-captured`, `.is-dead`, `.is-claimed` are built as `is-${status}`.

**Unused CSS variables** (defined in `public/css/style.css`, never read):
- `--success-tint` (:27), `--warning`, `--warning-tint` (:28), `--info-tint` (:30), `--screen-ink` (:35), `--sp-6` (:45)

**Keyframes and @font-face:** all keyframes are used, and there are no `@font-face` rules (fonts come from Google Fonts).

## 3. Duplication

**Copy-pasted logic that should be shared:**
- **M** Saloon money and seat helpers, identical in several engines. They belong in one `lib/saloon-common.js`:
  - `walletOf`: `lib/blackjack.js:18`, `lib/faro.js:16`, `lib/liars.js:16`, `lib/drinking.js:19`
  - `add(seat, amount, ctx)`: `lib/blackjack.js:19`, `lib/faro.js:17`, `lib/liars.js:17`, and a variant in `lib/drinking.js`
  - `say`: `lib/blackjack.js:14`, `lib/drinking.js:12`, `lib/faro.js:23`, `lib/liars.js:12`, `lib/saloon.js:65`
  - `seatOf`: `lib/blackjack.js:15`, `lib/drinking.js:13`, `lib/liars.js:23`, `lib/saloon.js:63`
  - `cents` and `money`: `lib/blackjack.js:12-13`, `lib/drinking.js:10-11`, `lib/faro.js:10-11`, `lib/liars.js:9-10`, `lib/saloon.js:15-16`, `lib/trade.js:12-13`
- **M** Server string and number helpers, repeated with **drifting behavior**. They belong in one `lib/util.js`:
  - `clean` exists in 16 files in two versions: one trims (`lib/battle.js:33`, `handouts.js:5`, `journal.js:5`, `lockpick.js:12`, `papers.js:4`, `saloon.js:13`, `scenes.js:5`, `trade.js:11`, `wanted.js:7`, `whispers.js:5`) and one doesn't (`lib/map.js:5`, `npcs.js:10`, `session.js:4`). So the same input is stored differently depending on the page.
  - `id = () => crypto.randomUUID().slice(0, 8)` appears 8 times (`combat.js:28`, `handouts.js:6`, `journal.js:6`, `scenes.js:7`, `session.js:5`, `shop.js:9`, `trade.js:14`, `wanted.js:8`).
  - `int` appears 5 times (`battle.js:34`, `saloon.js:14`, `scenes.js:6`, `combat.js:31`, `lockpick.js:13`).
  - `money` appears in 3 variants (`shop.js:8`, `wanted.js:13`, and the saloon version).
- **M** Client helpers repeated across pages; they should be exported once, from `common.js` or `portrait.js`:
  - `me = () => store.get('wiw.me', null)` appears 9 times (`backpack.js:10`, `duel-hud.js:9`, `lockpick.js:42`, `saloon.js:7`, `stash.js:7`, `tablelog.js:106`, `trade.js:7`, `wanted.js:10`, `whisper.js:6`).
  - `$$` (money format) appears 4 times (`saloon.js:11`, `stash-page.js:7`, `stash.js:8`, `trade.js:8`).
  - `loadImg` appears 3 times (`journal.js:99`, `portrait.js:26`, `wanted.js:105`).
  - `tabSeen`/`setTabSeen`: `duel-hud.js:10-11` and `trade.js:11-12`.
  - `isPool` appears 3 times (`battle.js:33`, `fighter-card.js:9`, `posse.js:102`).
  - `paras` appears 3 times **with different escaping** (`handouts.js:7` escapes the whole text first; `journal.js:20` and `paper.js:14` escape each paragraph).
  - `esc` is copied in `controls.js:8`, probably to avoid a circular import with `common.js`. A comment should say so.
  - The hex-grid `cube()` is in `lib/battle.js:71` **and** `:114`, and again in `lib/forstall.js:18`.
- **M** Dialog markup is rebuilt by hand in each module, with the same modal shell, kicker, title and buttons:
  - `trade.js` (open and answer), `stash.js`, `enemy-add.js`, `duel-hud.js` (answer), `saloon.js` (`betDialog`, `callDialog`, `openRules`), `fighter-card.js` (`openSpoils`)
  - One `openDialog({kicker, title, body, buttons, onClick})` helper would remove about 150 lines.
- **L** The ± number stepper is implemented four ways, in markup and CSS: `.fr-amt` (faro), `.bj-amt` (blackjack), `.trade-money` (trade and stash), `.dk-grit` (drinking). They should be one stepper component with one CSS rule.
- **L** Warden-mode overrides are split between `style.css` (end of file) and `posse.css` (the sheet-bar block); they could live together.

## 4. Tightening

**Long functions** (lines):
- `lib/combat.js:776` `pcOp`: 501 lines
- `lib/combat.js:1297` `wardenCombat`: 283
- `public/js/posse.js:337` `wireSheet`: 207
- `lib/saloon.js:214` `saloonAction`: 206
- `public/js/posse.js:885` `hydrate`: 165
- `public/js/battle.js:287` `renderTurnBar`: 135
- `public/js/posse.js:193` `buildSheet`: 129
- `public/js/saloon.js:471` `onClick`: 122
- `lib/shop.js:70` `shopAction`: 121

**Suggested fixes:**
- Split `pcOp` and `wardenCombat` into a handler map, `{ attack: …, dodge: … }`, with one function per op.
- The saloon `onClick` could route by data-attribute prefix to per-game handlers.

**Large files:**
- `lib/combat.js`: 1,796 lines. It could split by domain: turn order, attacks, duel, Forstalls, checks, loot.
- `public/js/posse.js`: 1,106
- `public/css/style.css`: 1,018. It could split into `tokens.css`, `components.css` and `scenes.css`.
- `public/js/battle.js`: 903
- `public/js/saloon.js`: 735. Better as one file per game UI: `saloon-poker.js`, `saloon-faro.js`, `saloon-liars.js`, `saloon-blackjack.js`, `saloon-drinking.js`.

**Deep nesting:** template literals with 3–4 levels of nested ternaries, e.g. the Warden desk markup in `public/js/saloon.js` (`mountSaloonDesk`) and `renderTurnBar` in `battle.js`. Some lines run over 400 characters (`saloon.js` ×5, `posse.js` ×4, `battle.js` ×3).

**Magic numbers:**
- Poll timing `2000` / `6000` ms (`common.js:37`).
- Refresh timers `3000` / `4000` / `5000` ms (`duel-start.js:33`, `saloon.js:667`, `lockpick.js:133`, `stash-page.js:17`).
- Expected hits per die `0.67` / `0.83` (`lib/drinking.js`, `drinkShot`).
- Crooked-box chance `0.3` (`lib/faro.js`, `faroTurn`).
- Log and archive caps `80` and `2000` (`lib/combat.js:26,55`).
- These should be named constants.

**Inconsistent naming:**
- Each module has its own `act()` with different return rules: some return the result, some `true`/`null`, and some also toast.
- Click dispatch attributes use a different short prefix per game (`data-sl`, `data-bj`, `data-dk`, `data-ld`, `data-fr`).
- The server allows `clean` both with and without trimming.

## 5. Design consistency

**Colors: 336 distinct values** in CSS and inline styles, plus 21 tokens already defined in `:root`.

- **Most repeated literals:**
  - `#fff` ×89
  - `rgba(34,31,31,.3)` ×28, the ink at 30%, which is already `--line`
  - `#f0c46a` ×17, a gold with no token
  - `#f4ead6` ×17, which is literally `--surface-2`
  - `rgba(0,0,0,.5)` ×14, and black at 9 other alphas (.05–.8)
- **Scattered warm darks for game scenes:** `#2a1d12`, `#6e4f14`, `#3a1210`, `#3a1509`, `#10292a`.
- **Suggested tokens:**
  - `--white: #fff`
  - `--gold: #f0c46a`
  - Use `var(--surface-2)` and `var(--line)` where their literals appear.
  - Replace the black-alpha zoo with `--scrim-1: rgba(0,0,0,.15)`, `--scrim-2: rgba(0,0,0,.35)`, `--scrim-3: rgba(0,0,0,.55)`, `--scrim-4: rgba(0,0,0,.8)`.
  - Add `--wood-dark: #2a1d12` and `--wood: #6e4f14` for the saloon and duel scenes.

**Font sizes:** tokens `--fs-xs` through `--fs-3xl` exist, but 28 one-off px sizes remain. Most are big display numbers: 58, 72, 76, 52, 46, 44 px (e.g. dice counters, the newspaper masthead), plus 13 px ×6 and 11 px ×4. Suggest adding `--fs-4xl: 56px` and `--fs-5xl: 72px`, and snapping 13 → 12 or 14, and 11 → 12.

**Spacing:** 36 distinct px values in padding, margin and gap.
- The scale has `--sp-1…6` (4, 8, 12, 16, 24, 32), but the most used off-scale values are 6 px (×267), 10 px (×224), 14 px (×91), 2 px (×88) and 3 px (×70).
- Suggest either adding `--sp-half: 2px`, `6px` and `10px` steps, or snapping 6→8, 10→12, 14→16 in a visual pass.
- `--sp-6` itself is never used.

**Border radius:** almost all use tokens. The one-offs are 8, 18, 22, 24, 26, 30 and 40 px; the 18 and 22 px are the new two-line pills. Suggest `--r-chip: 20px`.

**z-index:** 33 distinct values. Suggested named scale:
- **1–5:** content inside a component (`--z-raised`)
- **18 / 20 / 25 / 30:** sticky bars; contents bar, sheet bar, nav, "your turn" (`--z-sticky`, `--z-nav`)
- **40–95:** floating buttons, HUD, drawers, menus (`--z-float`, `--z-drawer`)
- **210–250:** full-screen game scenes (handout, duel, lock, saloon, End Session) (`--z-scene`)
- **300:** roll pop-up (`--z-popup`)
- **450 / 460:** dialogs (`--z-dialog`)
- **500:** lightbox and tour (`--z-overlay`)
- **600:** toast (`--z-toast`)
- **700 / 710:** dropdown lists and tooltips (`--z-dropdown`)

Specific oddities:
- `style.css:528` sets `.roll-pop { z-index: 300 !important }` while `:530` declares `z-index: 60` for the same selector; keep one.
- `.lightbox` (`:798`) and `.tour-back` (`:969`) both use 500.

**Breakpoints:** 14 distinct values: 560 ×12, 480 ×11, 600 ×10, 900 ×7, 860 ×4, 380 ×3, 760, 700, 640, 980, 1000, 1020, 1080, 1100. Suggest 4 documented values: **480** (phone), **600** (small tablet), **900** (two-column → one column), **1080** (wide). CSS variables can't be used inside media queries, so list them in STYLEGUIDE.md.

**`!important`: 26 uses.**
- **Justified:** `[hidden]` (`style.css:72`); the select arrow overrides (`:757-759`, fighting inline or UA styles); `.lp-num input` (`:908`, `:963`).
- **Removable** by fixing specificity:
  - `battle.css:90`, `:120` ×2
  - `combat.css:76` (dead file)
  - `names.css:147`, `:190`
  - `paper.css:55`
  - `posse.css:294`, `:404` (dead rule)
  - `saloon.css:50`, `:158` ×3
  - `store.css:67`
  - `style.css:431` (`.nav-help`), `:528` (`.roll-pop`)
  - `warden.css:78` ×2

## 6. Dependencies

- `package.json` has **no dependencies at all**: no runtime packages, no dev packages. Tests use Node's built-in `node:test`. Nothing to prune.
- **External resources:** Google Fonts loads 5 families on every page (Alegreya, Bebas Neue, Rye, Special Elite, Reenie Beanie), and `paper.js:10` adds 2 more on demand. See §11.

## 7. Leftovers

- `console.log`: only `dev-server.mjs:23`, the intentional "dev server on localhost" line. No `debugger` statements, and no `TODO`/`FIXME`/`HACK` comments.
- **Hardcoded localhost:** only `dev-server.mjs`, which is fine. The local-only default PIN `1234` in `lib/http.js:4` is gated to non-Vercel, which is fine.
- **Test data:** the local `.data/` folder is correctly ignored in `.gitignore`. The test fixtures in `tests/rules.test.js` are synthetic.

## 8. Bugs and risks

- **H Lost updates:** see Top 10 #1.
  - `load()` → modify → `save()` of whole documents (`combat`, `saloon`, `shop`, `journal`…) with no compare-and-set.
  - Especially exposed: the `combat` document, which gets rolls, sheets, trades, the stash, the saloon's wallet changes and lock-pick loot.
  - **Fix:** store `v` with the document and save only if it's unchanged (a small Redis Lua script or `WATCH`/`MULTI`), retrying on conflict.
- **H Polling volume:** see Top 10 #2. On a typical player page, these start (each every 2 s):
  - `tablelog.js:91` (log)
  - `handouts.js:47`, `whisper.js:99`, `journal-watch.js:9`, `paper.js:59`, `lockpick.js:118`, `saloon.js:638`
  - the page's own poll (e.g. `posse.js:1093`, `battle.js:879-880` ×2)
  - `pollNeeds` every 6 s for the Warden (`common.js:331`)

  Also, `lib/routes/wanted.js` loads 4 documents on every GET *before* its `since` short-circuit.

  **Fix:** one `/api/pulse` endpoint returning every document's version (a single Redis `MGET`), so pages fetch a document only when its version changed. Also slow the poll to 3–4 s and pause hidden tabs completely.
- **H Combat document growth:** see Top 10 #3. **Fix:** snapshot only the fields combat changes, not the whole sheets, and move `archive` to its own key, since only the Warden's write-up reads it.
- **M Unhandled promise rejections**, a `.then()` with no `.catch()`. On a network blip each throws an unhandled rejection, and the UI simply doesn't update:
  - `backpack.js:33`, `:49`
  - `journal.js:200` (`paperAct`)
  - `lockpick.js:130`, `:132` (the Warden's refresh every 5 s)
  - `map.js:18` (`loadWanted`)
  - `saloon.js:666` (the desk refresh every 4 s)
  - `posse.js:388`, `:556`, `:566`, `:582`, `:1069`
- **M Timers never cleared:**
  - `saloon.js:667`, `lockpick.js:133`, `duel-start.js:33`, `stash-page.js:17`
  - Harmless today because each mounts once per page load. But if a mount function is ever called twice, e.g. on a re-render, the timers stack.
  - `controls.js:128` runs a 400 ms interval forever on every page.
- **M Swallowed errors:** 52 empty `catch {}` / `.catch(() => {})` blocks in `public/js`. Most are intentional for storage access; network ones should at least set the connection indicator.
- **L Document-level listeners:** those added inside functions are guarded or run once. `common.js:140` only adds its listener when the pop-up box is first created, and `portrait.js:16` removes its own. No leak found.
- **L Duel viewer re-render:** it redraws on a signature check (`duel-hud.js`). The other HUD pop-ups rely on "seen" flags in localStorage and sessionStorage. That's fine, but it depends on storage working; private browsing throws, and the reads and writes are already wrapped.

## 9. Security

- **M Guessable Warden PIN:** 4 digits (`lib/http.js:4`), with no rate limit or lockout on any route's `auth`. **Fix:** a simple per-IP attempt counter in Redis (e.g. 10 per hour), or a longer PIN.
- **M No per-player authentication** (a design trade-off, noted for awareness): any device can act as any character by sending its `pc` id. That covers trades (`lib/trade.js:tradeAction`), the stash, sell requests, saloon moves and whispers. This is acceptable for a friendly table, but a player could, for example, accept a trade meant for someone else, or empty the stash as another character.
- **L Request body size:** `readBody` (`lib/http.js:19-24`) has no size cap. Vercel caps it at about 4.5 MB in production; the local dev server has no cap.
- **OK: no secrets in client code.** Upstash credentials are read only on the server (`lib/store.js:6-7`).
- **OK: unsafe `innerHTML`:** all 32 flagged interpolations were checked by hand. Player-typed text is always wrapped in `esc()` (or `paras()`, which escapes), and toasts use `textContent`. The unescaped values are static game data: tier names, trade names, Rules & Key text, tour captions.
- **OK: input validation.** The server `clean()`s strings, bounds numbers with `int`/`money`, and whitelists sheet fields (`RULES` in `lib/sheets.js`). Image uploads check size and data-URL type (`lib/routes/image.js:31-34`).

## 10. Accessibility

- **M Form controls without an accessible label.** Each sits under a visual `.field-step` label but isn't programmatically tied to it:
  - Battle Map turn panel: `battle.js:347`, `:351`, `:355`, `:360`, `:361`, `:365`, `:366`
  - End Session: `endsession.js:93`, `:100`
  - Journal: `journal.js:115` ×2, `:118`, `:148`, `:150`
  - Lock Pick: `lockpick.js:148`, `:152`
  - Prep: `prep.js:36`, `:48`, `:80`, `:81`
  - Stash: `stash.js:40`
  - Store: `store.js:122`
  - Wanted: `wanted.js:118`, `:119` ×2, `:121`
  - Whisper: `whisper.js:16`
  - Sheet: `posse.js:183`

  **Fix:** wrap each in the `<label>`, or add `aria-label`. A one-line change in the `.field-step` markup pattern would cover most of them.
- **M Icon-only buttons without `aria-label`:**
  - `battle.js:241` (✕ remove token), `:804` (✕ remove Forstall)
  - `store.js:73` (✕)
  - `endsession.js:56` (− / +)
  - `saloon.js:231` (− / +, the Liar's Dice bid), `:428` (− / +, the faro bet)
- **M Low contrast:** `--ink-faint` (`#8a7f76`) on `--paper` is **3.21:1**, on `--surface` 3.84:1, and on the Warden's gray cards **2.62:1**. It's used for `.muted` hints, sub-labels and dates everywhere; body text needs 4.5:1. The other checked pairs pass: ink-soft on paper 7.9, brass on ink 7.0, rust on paper 5.2, teal on slate 7.0, white on teal chips 5.9.
- **L Heading order:** `battle.html` and `map.html` jump from `h1` straight to `h3` (their side-panel sections). `session.html` has no headings; it's a redirect stub.
- **L Keyboard:**
  - Battle Map tokens can only be moved by pointer drag.
  - The full-screen game scenes (saloon, lock, duel) don't move focus into the scene or trap it; the `ask()` dialogs do restore focus (`common.js:404`).
  - A "move token with arrow keys" option, plus focusing the first control when a scene opens, would help.
- **OK: images.** Every `<img>` in HTML and templates has `alt`; decorative ones have `alt=""`.

## 11. Performance

- **H Polling:** see §8. This is the biggest runtime cost, in network traffic, Redis commands and battery on phones.
- **M Images:**
  - `public/img/map.jpg`: 985 KB. It's now the **Warden header on every Warden page**; a cropped 1,600 px WebP would be about 150 KB.
  - The battle maps are **5.3 MB in total** and full-quality JPEG:
    - `public/img/battle/mountain-pass.jpg` 1,551 KB
    - `great-plains.jpg` 1,050 KB
    - `imaginary-town.jpg` 1,006 KB
    - `red-rock-canyon.jpg` 904 KB
    - `monster-burrow.jpg` 758 KB

    WebP at quality 80 would roughly halve them, and they only load on the Battle Map.
- **M Sound files:**
  - `public/sfx/deal.mp3` is 502 KB, but only twelve 0.3 s snaps are used. A trimmed file would be about 40 KB.
  - `shuffle.mp3` is 319 KB.
  - All sound files download after the first tap on every page, about 1.3 MB per device.
- **M Fonts:** Google Fonts, 5 families on every page, is a render-blocking stylesheet. Suggest `<link rel="preconnect">` (already there) plus loading Reenie Beanie (handwritten notes) and Special Elite only where they're used, or self-hosting the WOFF2 files.
- **L Lazy loading:** only `store.js` and `wanted.js` use `loading="lazy"`. `names.js` (NPC portraits) and `journal.js` (clue photos) render lists of images without it.
- **L Scripts:** all pages load as `type="module"` (deferred), and heavy features are imported on demand (saloon, lock picking, paper, stash). No bundle or build step, and none is needed.
- **L Re-renders:** Battle Map `renderPanel()` rebuilds the whole side panel, fighter card included, on every combat poll (about every 2 s) when anything changed. Posse `hydrate()` does the same for the whole sheet. Fine at this size; watch it if panels grow.

## 12. SEO and basics

- **Titles:** every page has a `<title>`, and every page sets `lang="en"`.
- **Missing meta description:** `run.html`, `warden.html`, `session.html`. These are Warden or redirect pages, so this is low priority.
- **Missing favicon:** `howto.html` has no `<link rel="icon">`; every other page has the ★ data-URL icon.
- **Broken internal links:** none found. Every `href="/…"` resolves to a page, and `/combat` and `/session` redirect via `vercel.json`.
- **Suggestion:** this is a private table kit on a public URL. Consider `<meta name="robots" content="noindex">` on all pages, or a `robots.txt`, to keep it out of search results.

---

## Suggested order of work

1. Compare-and-set saves (§8, H), then one `/api/pulse` for polling (§8 and §11, H), then shrinking the combat document (§8, H). These protect game night.
2. PIN rate limiting (§9, M).
3. Delete the dead code and CSS: `combat.css`, `mountHud`, the unused exports and imports (§1 and §2). Quick, and low risk with the test suite.
4. `lib/util.js` and `lib/saloon-common.js`, plus the shared client helpers and `openDialog` (§3).
5. The accessibility labels and contrast fix: one token change for `--ink-faint` (§10).
6. Image and sound compression, and self-hosting or trimming fonts (§11).
7. Design-token pass: the z-index scale, the scrim colors, the 4 breakpoints, and removing `!important` (§5).
8. Splitting the big functions and files (§4), done gradually alongside feature work.
