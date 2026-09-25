# WIW Table Kit: working notes

## Source material
- Guidebook PDF: `C:\Users\ampat\Downloads\WIW-Guidebook-Digital-Page.pdf`.
  - It is 276 pages and over 100 MB, so read it with PyMuPDF text extraction. The Read tool can't open it.
  - **printed page = PDF page − 14**.
- Trade sheet PDFs and the 5 battle maps came from `Downloads`.
- Book pages used so far:
  - pp. 6–8: character creation
  - p. 32: spend Prestige (pcOp `spend`); p. 54: Jackpot + Bleeding Out (pcOp `bleedRoll`); p. 58: High Noon Duel (`state.duel`, duelAction, sides `pc:<id>`/`en:<id>`)
  - p. 34: Achievements (`ACHIEVEMENTS` in sheets.js; Warden action `achieve`); pp. 52/54: campfire vs town rest (pcOps `campRest`/`townRest`, Warden `townRestAll`)
  - p. 79: trophies & loot (`lib/trophies.js`, all 59 bestiary trophies; Warden actions `loot`/`search`); pp. 93–100: upgrades (`upgradeFits`/`upgradeType`, pcOps `installUpgrade`/`removeUpgrade`), p. 76: Special Ammo (pcOp `ammo`); pp. 104–108: horse Bond/breaking (pcOp `breakHorse`); p. 92/94: mech Condition from Health (`mechState`), repairs (pcOp `mechRepair`)
  - pp. 41–43, 49: combat helpers — pcOps `attack` (weapon Grit, Aim reroll, Special Ammo fx, auto target Defense), `dodge` (banked `pc.dodge`, cleared in startTurn), `relieve` (1 Grit/die, once per Status per turn), `endTurn`; Warden `enemyAttack` (damage vs Defense+Cover+Dodge, Piercing, statuses). Players act only on the Battle Map turn panel; the sheet's `renderFight` panel now shows just Warden roll requests + out-of-combat Status relief.
  - pp. 12–13: Skill checks — Warden `checkStart`/`checkClose`, called with the tap-to-call panel `mountRollCaller` (public/js/rollcall.js + css/rollcall.css: who chips → difficulty chips → tap a Skill to send; on Run the Game), pcOp `checkRoll` (Helping = half dice, best helper added), `state.checks` in the player view, prompt on the sheet's fight panel + HUD pop-up on every page; players not called get a "Want to help?" HUD pop-up (hud check `helped` list, `wiw.help.<id>` = dismissed). Health never exceeds Max (changeHealth + setSheetField); rests refill Grit.
  - p. 13 Challenge rolls (check `kind:'challenge'`, NPC side via duelist refs, ties reroll). p. 34: `autoAchievements` (The Scrapper at 100 Scrap) runs after every /api/combat POST. Backup: `api/backup.js` (Warden) dumps all Redis docs; Run the Game download button.
  - Grit engine (pp. 40–43): every Action spends Grit via `spendGrit` and is noted in `actor.turnLog` (reset in startTurn). Map moves: api/battle.js calls `chargeMove` (speed: Fast/Normal/Slow/Very Slow, rough ×2, mounted horse = Fast, mech = its speed, Compromised ×2 max 6) and saves the combat doc; `undoMove` refunds. `autoSync` in lib/battle.js keeps tokens in step with the fight. Turn panel = `renderTurnBar` in public/js/battle.js.
  - Trade powers in play: `abilityInfo` parses "Spend N Grit" / "roll XG" / "(2/day)" from each ability; pcOp `useAbility` spends, rolls, ticks `abilityUses` (Town rest resets). Grit changers: Fired Up (+3 now, `gritNext`=3, can't use while `gritLimited`), Fired Up 2 (separate; 2 allies `gritNext`=8, Marshal 2, 2/day +2 Health), Crippling Precision (`crippledNext` → moves ×2), Biological Amplification (free Aim/Dodge next turn), Arabian Revered +1 Grit 2/day (`horseGrit`), Digging Deep heals over Max. Picker = `abilityOptions` in common.js (map turn panel; battle.js redraws the panel once `?view=meta` loads).
  - Who's in the fight: `start {posse:[ids], enemies:[ids]}` (from `pickFighters` in common.js — tap chips, dark = in; Battle Map, Combat Control, Run the Game) sets `combat.party` and `e.out`; `inFight()` gates turn order, initiative and Battle Map auto-tokens. Mid-fight: `join {id}` (rolls Finesse if needed, re-orders) and `leave {id}`; `end` clears both. Run the Game has Join / out buttons.
  - Undo in combat: api/combat.js snapshots the fight (`pushUndo`, `state.undoStack`, max 12, cleared on start/end) before each `isUndoable` action; `{action:'undo', mode:'last'|'turn'}` → `undoCombat` restores it, trims the log and puts map tokens back (move snapshots carry `token`). Players can only undo within the current turn; the Warden can go further. Views expose `undo: {last, lastIsThisTurn, thisTurn}`.
  - HUD on every page (`renderHud` in tablelog.js, fed by `logView().hud`): turn-order strip (collapsible, `wiw.hudClosed`), start-of-combat roll pop-up (`combat.startInfo`, seen once per tab), Skill-check pop-up for the device's "This is me" character (skipped on their own sheet), and the sticky "your turn" bar (`myTurn`, every page but /battle: Go to Battle Map / End my turn / × hides till next turn; sets `--turnbar-h` so `.sitenav`, `.warden-strip` and `.sheet-bar` stick below it). Combat Control mounts it via `mountHud()`.
  - Prepare (p. 42): pcOp `prepare {hold:{kind attack|dodge|item|ability|improvise, …, trigger{type within|moves|attacks|allyAttacked|custom}}}` pays now → `pc.hold`; `fireHold` runs it with `prepaid` (no Grit); `dropHold`; fizzles in startTurn. `checkHoldTriggers` runs on enemy map moves (api/battle.js, hex distance) and enemy attacks; HUD pop-up for your triggered hold; watch-icon token badge.
  - Range from the map: api/combat.js loads the battle doc for attacks/fireHold/enemyAttack and `applyMapRange` sets `body.range` to the real band (hex distance) or throws; enemy attacks throw `OUT_OF_RANGE:` which the Warden can `force` after a confirm. Without both tokens on the board, the chosen range stands.
  - Forstalls on the map (pp. 81–87): `lib/forstall.js` (KINDS Backpack/Saddlebag Short 6″, Mech Long 18″, Town = whole map; `fields(battle, combat)` lists every Forstall in play; `sweepTolerance` parses "Sweep [N]" + Frenzy text; `bestSweep`, `edisonConflicts`). A character's Forstall comes from their sheet and rides on their pc token (key `pc:<id>`); the Warden's free-standing ones are `battle.forstalls` (actions addForstall/moveForstall/editForstall/removeForstall, `battle.cave` = Rule 2, auto-on for Monster Burrow). Active Sweeps live in `combat.sweeps[key]` (in undo snapshots). Combat action `{action:'forstall', op: sweep|off|burst|edison, key}` → `forstallAction` (Grit on own turn, 1 charge, `EDISON:` error unless `force` → Rule 1). `sweepHit` runs in api/combat.js when a monster's turn starts and in api/battle.js when an enemy moves into Range (cries out). Known = only the Forstall's 4 memory slots ("Name · kz"; sheet `forstall.kz.N` is a drop-down of Scanner-decoded monsters, editable in view mode; the Warden's slots can hold any monster). Enemy op `submerged`. Scan rolls (`whoId`) are refused out of the roller's Forstall Range when both are on the map.
  - Forstall extras: Natural EMP (forstall op `emp`, Warden; worm's `empUses` ≤2/day, reset by a Town Rest, `state.emp` blocks Scan/Burst for those Forstalls until the worm's next turn, cleared in api/combat.js), Heartbeat Sensor (any `heartbeat` upgrade → battle view `pulse {count, nearest}` within Range + 6″ while Sweeping), Mechanic Forstall Efficiency (sweep `efficiency:true`, 2/day, one Hit → Ace), one Scan per round (`combat.scanRound`, api/scan.js).
  - p. 33: Prestige tiers + Starting at Higher Prestige loadouts (`TIERS` in lib/sheets.js, pcOp `tierKit`)
  - p. 85: ranges
  - pp. 83–84: scanning
  - pp. 120–133: factions
  - pp. 141–188: monsters
  - p. 191: human enemies
  - p. 204: NPC names

## Architecture
- Static pages live in `public/` (plain ES modules, no build step). Each Vercel function is `api/<area>.js`, with its logic in `lib/<area>.js`.
- `lib/store.js`:
  - `load(key)` / `save(state, key)` go to Upstash Redis.
  - Locally they use `.data/<key>.json` instead. Delete `.data` before committing; it is test data.
- `lib/http.js`:
  - The PIN comes from the `x-warden-pin` header.
  - Locally the PIN defaults to `1234`. In production it is the `WARDEN_PIN` env var, currently **1327**.
- Clients poll with `startPolling(view, onState, onConn, endpoint)` and `?since=v`. Composite versions look like `${a.v}.${b.v}`.
- Warden mode:
  - The PIN is kept in `sessionStorage` key `wiw.pin`, per tab.
  - Helpers in `public/js/common.js`: `tryWarden`, `forgetWarden`, `wardenModal`, `markWarden`.
  - Warden mode shows in the nav (red rule, star items, **Needs you (n)**, **Warden ▾** with Switch to player view); `markWarden()` just redraws the nav. The masthead `#warden-btn` is hidden but kept: the nav's **Warden** button clicks it so each page runs its own unlock + reconnect (pages without one use `wardenModal` + reload).
  - It sticks across pages: with a PIN, `/` (player.js) redirects to `/run`. The nav is grouped (`NAV_PLAYER` / `NAV_WARDEN` in common.js; see STYLEGUIDE.md → Navigation); phones get a Menu sheet.
  - **Run the Game** `/run` (public/run.html, js/run.js, css/run.css) is the Warden's home: first in the Warden nav, and `/` (player.js) redirects a Warden there. One page with Needs you (store requests get inline Approve/Deny via /api/shop `decide`), the fight (turn, order, Next turn, Start/End combat), enemies + posse rows with Health ± and Grit, and a Jump To grid. Reuses the combat warden view + `?view=needs`.
  - **Needs you** (nav badge, every page): `GET /api/combat?view=needs` → `wardenNeeds` (pending store requests, open Skill checks, triggered holds, Bleeding Out, Edison clashes, whose turn), polled every 6 s by `pollNeeds` in common.js; the dropdown also links Run the Game / Combat Control / Battle Map / Store / NPCs.
  - `/combat` = **Combat Control**, Warden-only (gate card for players; not in the player nav). Players fight from the Battle Map + sheets.
  - NPC ledger: players see only the ledger (deal/table-felt hidden) and the server allows only `posseNote`/`where` without the PIN (`add` is Warden-only).
- Dice:
  - `lib/dice.js`: B = [blank, blank, spur, hit, hit, ace]; G = [blank, spur, hit, hit, hit, ace]. An Ace counts as 2 Hits.
  - Spurs are rerolled when the roller has the matching Talent.
  - Animation: `animateRoll(tray, dice)` in common.js. `rollPopup(r, title)` shows it for rolls on pages that have no tray of their own.
- Dice inputs are always **Black/Gold number boxes** (`poolHTML` / `readPool` / `fillPool`). Never ask the user to type "3B1G".
- Character sheets:
  - `lib/sheets.js` defines `newSheet`, `PACKS`, `KEEPSAKES`, `giveStartingWeapons`, `weaponFields`, and a whitelisted `RULES` validator.
  - Every new sheet field needs a RULES entry.
  - Multi-field saves send `{action:'sheet', id, fields:{path:value}}`.
  - **Table view** (sheet bar button, `wiw.tableView`, default on phones ≤700px, only while viewing a finished sheet): `.table-view` on #sheet-view hides story/prestige/inventory sections and pickers, and reorders Health → Statuses → Weapons → Gear → Forstall/Horse/Mech → Skills → Abilities with CSS `order` (`.sheet` becomes `display: contents`).
  - View/edit modes: `done:false` = being created (checklist + Save character → pcOp `finish`). Finished sheets (`done` true or missing) open locked; `applyMode` in posse.js disables fields except `PLAY_PATHS` (wallet/scrap/supplies, horse/mech health, ammo) and the Health/Grit/Status/uses buttons. `#id/edit` opens in edit mode.
- Store → sheet: `equipItem(pc, item, qty)` in lib/sheets.js places every bought/given item (lib/shop.js `decide`/`give`): weapons → a free weapon slot, Forstall models → `pc.forstall`, mechs, horses, Special Ammo → a matching weapon's ammo slot (arrowheads = bows), upgrades → `attachUpgrade` (shared with pcOp installUpgrade), gear/traps/crystals → gear slots; goods & services stay in `pc.items` only. No room → `{warning}` shown with `tell()` (OK-only dialog) and logged; the item stays in inventory. The sheet's store-list pickers send pcOp `pick {kind, i, itemId}` (api/combat.js looks the item up, custom ones included) and the server fills the section with the same `weaponFields`/`gearFields`/`forstallFields`/`mechFields`/`horseFields`. Sheet inventory rows show **Put on sheet** (shop action `equip`, players allowed) for anything not placed yet. The sheet sections are the record and `pc.items` mirrors them: `placedIn(pc, entry)` (sheets.js) says where each row sits ('Weapons', 'Forstall'…; '' = no section; null = not placed), added as `items[].placed` in the player/Warden combat views and the shop view; pcOp `pick` also adds the picked item to the inventory and drops the one it replaced. Removal is linked both ways: the section ✕ (pcOp `removeThing`) also drops the inventory entry, and the inventory ✕ (pcOp `dropItem`) also takes it off the sheet (`unequipItem`). Horse/mech pictures only show while the breed/class is filled in.
- Catalog:
  - `lib/catalog.js` holds 307 items, generated from the price list. Item ids look like `pistols-used-pistol`.
  - `img` names a file in `/img/store/<img>.webp`.
- Factions:
  - `lib/npcs.js` `allFactions(state)` returns the book's 7 plus `state.factions` (custom, with a `known` flag).
  - Players only see known factions. `GET /api/npcs?view=factions` returns them.
- Tokens: `/img/tokens/{trade-*, monster-*, npc-*}.webp`, chosen by `artFor()` in `lib/battle.js`.
- Shared client UI (use these, don't reinvent):
  - **Icons:** no emoji anywhere (user dislikes them). `gl(name)` from `public/js/glyphs.js` returns an inline SVG line icon (revolver, boot, dodge, star, forstall, satchel, bandage, lasso, watch, heart, skull, drop, flash, claws, horseshoe, bullet, scroll, die, trophy, fire, target, lock, wrench, hat, pin). Static HTML uses `<span data-gl="name"></span>`, drawn by `mountNav`. Plain-text spots (toasts, `<option>`, titles) get no icon; ✓ ✗ → ← are fine. Old log entries have emoji stripped at render (`noEmoji` in tablelog.js).
  - **Dialogs:** never `confirm`/`prompt`/`alert`. `await ask(msg)` → true/false and `await askText(msg, default)` → string|null (common.js). A short leading question becomes the heading; destructive wording gets a red button.
  - **Every page** (`mountTableLog`): Table Log + Roll dice buttons share `.fab-row` (bottom-right; stacked on phones); `mountDice` rolls any B/G pool as anyone; first visit asks "Who are you playing?" (`askWhoIAm`, sets `wiw.me`, `wiw.meAsked`), skipped in Warden mode.
  - `/howto` = How to Play Online (static guide for players, in the nav). Update it when player-facing flows change.

- The old Session page is merged into Run the Game: `/session` redirects to `/run` (vercel.json + a tiny session.html). Session notes, open rolls, homebrew, backup and the recent log live in `public/js/desk.js` (+ css/desk.css), mounted by run.js via `mountDesk`. Keep Warden pages in Run the Game's style (shared `.stack-grid`, `.item-row`, `.notice`, `.link-grid`). The page is grouped into bands (`.band`: Right Now, Rolls, At the Table, Rewards — award / Jackpot / Town Rest, moved from the Posse page —, Notes & Log, Tools — Jump To + Backup | Homebrew) with a sticky contents bar `.toc-bar#run-toc` (top = `--toc-top`, set by `tocTop()` in run.js).
- Session write-up: every log() also appends to `combat.archive` (Warden-only, 2000 entries, undo trims it; never in views) because the Table Log keeps only 80. Session notes' **Write up this session** → `{action:'summarize', id}` in api/session.js: `sessionEntries` (from the session's `created` to the next session), then Claude (`ANTHROPIC_API_KEY` env on Vercel; model `SUMMARY_MODEL` or claude-haiku-4-5) writes STORY SO FAR / FIGHTS / LOOT / PEOPLE / LOOSE ENDS + a player RECAP (fills an empty recap); without a key `plainSummary` lists the events. `withSummary` puts it between `=== SUMMARY ===` and `=== MY NOTES ===`, keeping the Warden's notes below; re-running replaces only the summary. vercel.json gives api/session.js 30 s.
- Session notes: `api/session.js` + `lib/session.js` (Redis key `session`), every request needs the PIN; shown on Run the Game.

## Pictures
- `api/image.js` stores uploaded pictures as base64 under `img-<ns>-<id>-<head|full>` (ns `pc` = portraits, anyone; `handout` = Warden only) and serves `GET /api/image?ns&id&size&v` with immutable caching. Uploading/clearing a pc portrait sets/removes `pc.portrait = {v}` in the combat doc.
- `public/js/portrait.js`: `faceUrl(p)` (headshot or trade art), `portraitUrl(p, size)`, `pickPortrait(pc)` (file → in-page cropper, 256px round headshot + ≤1200px full), `clearPortrait`, `showImage(src, caption)` lightbox, `shrink(img)`. Used on the Posse list, sheet header (`faceHTML`, refreshed in `hydrate` when `portrait.v` changes), Battle Map tokens (`photo` in the battle view) and Run the Game rows.

## Handouts & Backpack
- `lib/handouts.js` + `api/handouts.js` (doc `handouts`): `{id, kind item|note, title, text, img(v), to 'all'|[pcIds], shared, sharedBy, seen[]}`. Only the Warden sends/edits/removes; a recipient can `share` ("Show the posse"); `seen` per character. Players GET `?view=player&pc=<id>` (only what they may see); Warden `?view=warden`. Handout items are story props — never on sheets. Photos via `api/image.js` ns `handout` (Warden), which sets `h.img`.
- Warden: **Hand Out** card on Run the Game (Rewards & Handouts band; `public/js/handout-send.js`). Players: `watchHandouts()` (public/js/handouts.js, started by `mountTableLog`) pops up unseen handouts on any page ("The Warden hands you…", Show the posse / Open the Backpack / Keep it). `/backpack` (World ▾) lists shared handouts + "Just you"; the Warden sees all with Make private / Delete. Notes use `--hand` (Reenie Beanie) on torn paper (`.note-paper`).

## Whispers
- `lib/whispers.js` + `api/whispers.js` (doc `whispers`): player `send {pc, text}` → Warden pop-up on any page (`watchWhispers` in public/js/whisper.js, started by `mountTableLog`; also a Needs-you item) with Later / Got it / Reply (`reply` one line). Warden `wardenSend {to: [pcIds]|'all', text}` (Run the Game **Whisper** card, `mountWardenWhisper`) → the player's pop-up "The Warden whispers…" with Reply. Players only ever receive their own unseen replies (`replySeen`). No chat history. The **Whisper** button sits in the fab row for players.

## Lock picking
- `lib/lockpick.js` + `api/lockpick.js` (doc `locks`): High/Low with a server-side 52-card deck (A = 14). Warden `start {to, difficulty 1–5 = wins in a row, retries, retryCost, what}` → per player status `finesse` → pcOp-like `finesse` (rolls the sheet's Finesse; Poisoned −2, Finesse Talent spurs; each Hit = one `peek` at the next card's color) → deal (`ace` status if the starter is an Ace: player calls high/low) → `guess {dir}` (strictly higher/lower wins, **ties lose**; an Ace drawn next is always high) → `picked` after `need` wins, `failed` on a miss → `retry` (pays the Warden's cost, fresh deck, `retriesLeft`) / `giveUp`. Players only ever see their own attempt, never the deck (`lockView`). Results go to the Table Log. UI (`public/js/lockpick.js`): Warden **Lock Pick** card on Run the Game (Rolls band: who, what lock, difficulty chips, retries + cost, recent attempts); players get the full-screen brass-padlock scene on any page (`watchLocks`, started by `mountTableLog`) — Finesse roll, Ace call, Higher/Lower, Peek, pins rise per win, shackle opens / pick snaps, Try again (confirm the cost) / Walk away. Card classes are `.lk-card`/`.lk-back` (the NPC page owns `.pcard`/`.back`).

## Sound
- `public/js/sound.js`: `play(name, arg)` synthesizes effects with WebAudio (dice, card, gun, bow, swing, explosion, forstall, zap, lockClick, lockSnap, lockOpen, success, fail, chime); `weaponSound(weapon)` picks gun/bow/swing. Real recordings: put `public/sfx/<name>.mp3` and add the name to `public/sfx/manifest.json`. Mute/volume per device (`wiw.muted`, `wiw.volume`) via the nav speaker / phone Menu. Hooks: `animateRoll` (dice), NPC `flipUp` (card), Battle Map attacks/items/Forstalls, HUD pop-ups (chime), Skill results (success/fail).

## Style
- **Read `STYLEGUIDE.md` before any UI change.** Tokens (colors, type scale, spacing, corners, shadows) and shared components (`.head-row`, `.stack-grid`, `.band`, `.toc-bar`, `.chip-btn`, `.field-step`, `.pill`, `.item-row`, `.notice`, `.link-grid`, buttons) live in `public/css/style.css`; page CSS holds only page-specific rules. No raw hex colors in page CSS.

## Conventions
- **Cache busting:** bump `?v=N` on the page's css/js tags after edits. Pages import `common.js` unversioned, so bump the page scripts when common.js changes.
- **Edits with Python:** write the script to a file in the scratchpad, then run it. Bash heredocs with quotes and backticks break.
- **Local preview:** config "wiw-forstall" on port 5190, in `mat-headz/.claude/launch.json`. Restart it after any `lib/` change, because the dev server caches modules.
- **Verify live** by polling `curl https://wiw-forstall.vercel.app/<page>` until the new `?v=` shows up.
- **Rule checks:** `npm test` (node:test, `tests/rules.test.js`: Scanner scoring, ranges, Sweep/Tolerance/Edison, move cost, Store→sheet, upgrades, a combat Sweep). Run it before every push and add a check when you add a rule.
- **After each chunk:** commit and push to `main`. Vercel auto-deploys.

## User preferences
- Work in small chunks and push live after each one.
- Keep things simple. The dice animation reuses the existing tray; don't build new 3D.
- NPC names toggle is Male / Female / Random.
- Warden approves store purchases.
- Spur boxes link to Talents.
- No emoji: use the line icons. No browser pop-ups: use the styled dialogs.
- Player-facing copy should make sense to a player (no pointers to Warden-only pages).
- The live data is real (the group's characters and NPCs). Test only locally; never write to or clean up live data.
