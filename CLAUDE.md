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
  - pp. 41–43, 49: combat helpers — pcOps `attack` (weapon Grit, Aim reroll, Special Ammo fx, auto target Defense), `dodge` (banked `pc.dodge`, cleared in startTurn), `relieve` (1 Grit/die, once per Status per turn), `endTurn`; Warden `enemyAttack` (damage vs Defense+Cover+Dodge, Piercing, statuses). Sheet `renderFight` panel + turn alert.
  - pp. 12–13: Skill checks — Warden `checkStart`/`checkClose` (Session page card), pcOp `checkRoll` (Helping = half dice, best helper added), `state.checks` in the player view, prompt on the sheet's fight panel. Health never exceeds Max (changeHealth + setSheetField); rests refill Grit.
  - p. 13 Challenge rolls (check `kind:'challenge'`, NPC side via duelist refs, ties reroll). p. 34: `autoAchievements` (The Scrapper at 100 Scrap) runs after every /api/combat POST. Backup: `api/backup.js` (Warden) dumps all Redis docs; Session page download button.
  - Grit engine (pp. 40–43): every Action spends Grit via `spendGrit` and is noted in `actor.turnLog` (reset in startTurn). Map moves: api/battle.js calls `chargeMove` (speed: Fast/Normal/Slow/Very Slow, rough ×2, mounted horse = Fast, mech = its speed, Compromised ×2 max 6) and saves the combat doc; `undoMove` refunds. `autoSync` in lib/battle.js keeps tokens in step with the fight. Turn panel = `renderTurnBar` in public/js/battle.js.
  - Trade powers in play: `abilityInfo` parses "Spend N Grit" / "roll XG" / "(2/day)" from each ability; pcOp `useAbility` spends, rolls, ticks `abilityUses` (Town rest resets). Grit changers: Fired Up (+3 now, `gritNext`=3, can't use while `gritLimited`), Fired Up 2 (separate; 2 allies `gritNext`=8, Marshal 2, 2/day +2 Health), Crippling Precision (`crippledNext` → moves ×2), Biological Amplification (free Aim/Dodge next turn), Arabian Revered +1 Grit 2/day (`horseGrit`), Digging Deep heals over Max. Picker = `abilityOptions` in common.js (map turn panel + sheet Fight panel).
  - Undo in combat: api/combat.js snapshots the fight (`pushUndo`, `state.undoStack`, max 12, cleared on start/end) before each `isUndoable` action; `{action:'undo', mode:'last'|'turn'}` → `undoCombat` restores it, trims the log and puts map tokens back (move snapshots carry `token`). Players can only undo within the current turn; the Warden can go further. Views expose `undo: {last, lastIsThisTurn, thisTurn}`.
  - HUD on every page (`renderHud` in tablelog.js, fed by `logView().hud`): turn-order strip (collapsible, `wiw.hudClosed`), start-of-combat roll pop-up (`combat.startInfo`, seen once per tab), Skill-check pop-up for the device's "This is me" character (skipped on their own sheet). Combat page mounts it via `mountHud()`.
  - Prepare (p. 42): pcOp `prepare {hold:{kind attack|dodge|item|ability, …, trigger{type within|moves|attacks|allyAttacked|custom}}}` pays now → `pc.hold`; `fireHold` runs it with `prepaid` (no Grit); `dropHold`; fizzles in startTurn. `checkHoldTriggers` runs on enemy map moves (api/battle.js, hex distance) and enemy attacks; HUD pop-up for your triggered hold; ⏳ token badge.
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
  - Helpers in `public/js/common.js`: `tryWarden`, `forgetWarden`, `wardenModal`.
  - A red strip shows while the page is in Warden mode.
- Dice:
  - `lib/dice.js`: B = [blank, blank, spur, hit, hit, ace]; G = [blank, spur, hit, hit, hit, ace]. An Ace counts as 2 Hits.
  - Spurs are rerolled when the roller has the matching Talent.
  - Animation: `animateRoll(tray, dice)` in common.js. `rollPopup(r, title)` shows it for rolls on pages that have no tray of their own.
- Dice inputs are always **Black/Gold number boxes** (`poolHTML` / `readPool` / `fillPool`). Never ask the user to type "3B1G".
- Character sheets:
  - `lib/sheets.js` defines `newSheet`, `PACKS`, `KEEPSAKES`, `giveStartingWeapons`, `weaponFields`, and a whitelisted `RULES` validator.
  - Every new sheet field needs a RULES entry.
  - Multi-field saves send `{action:'sheet', id, fields:{path:value}}`.
  - View/edit modes: `done:false` = being created (checklist + Save character → pcOp `finish`). Finished sheets (`done` true or missing) open locked; `applyMode` in posse.js disables fields except `PLAY_PATHS` (wallet/scrap/supplies, horse/mech health, ammo) and the Health/Grit/Status/uses buttons. `#id/edit` opens in edit mode.
- Catalog:
  - `lib/catalog.js` holds 307 items, generated from the price list. Item ids look like `pistols-used-pistol`.
  - `img` names a file in `/img/store/<img>.webp`.
- Factions:
  - `lib/npcs.js` `allFactions(state)` returns the book's 7 plus `state.factions` (custom, with a `known` flag).
  - Players only see known factions. `GET /api/npcs?view=factions` returns them.
- Tokens: `/img/tokens/{trade-*, monster-*, npc-*}.webp`, chosen by `artFor()` in `lib/battle.js`.

- Session page: `/session` + `api/session.js` + `lib/session.js` (Redis key `session`), every request needs the PIN; `mountNav` adds the ⭐ Session link only when a PIN is saved.

## Conventions
- **Cache busting:** bump `?v=N` on the page's css/js tags after edits. Pages import `common.js` unversioned, so bump the page scripts when common.js changes.
- **Edits with Python:** write the script to a file in the scratchpad, then run it. Bash heredocs with quotes and backticks break.
- **Local preview:** config "wiw-forstall" on port 5190, in `mat-headz/.claude/launch.json`. Restart it after any `lib/` change, because the dev server caches modules.
- **Verify live** by polling `curl https://wiw-forstall.vercel.app/<page>` until the new `?v=` shows up.
- **After each chunk:** commit and push to `main`. Vercel auto-deploys.

## User preferences
- Work in small chunks and push live after each one.
- Keep things simple. The dice animation reuses the existing tray; don't build new 3D.
- NPC names toggle is Male / Female / Random.
- Warden approves store purchases.
- Spur boxes link to Talents.
