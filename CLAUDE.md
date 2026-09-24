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
