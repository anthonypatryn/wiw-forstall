# Wild Imaginary West — Table Kit

A shared table companion for the *Wild Imaginary West* RPG. It started as the **Forstall Scanner** (Official Guidebook pp. 83–84): roll Intuition with bullet dice to recover digits of a monster's Kurtz Frequency, then guess it Mastermind-style. It grew into a full kit that the whole posse opens at one URL.

Live: https://wiw-forstall.vercel.app

| Page | What it does |
|---|---|
| `/` | Forstall Scanner: dice pool, animated bullet dice, Forstall lights, and a posse notebook. |
| `/warden` | Warden's Station (needs the PIN): pick the target from 59 Guidebook monsters, live feed, digits, house rules, homebrew monsters. |
| `/combat` | Combat Control (Warden only): enemies from monsters and book NPCs, turn order, High Noon Duel, loot. Players fight from the Battle Map. |
| `/posse` | Two-page character sheets styled like the PDFs. Includes the new-character checklist (pp. 6–8), store pickers for weapons, gear, Forstall, horse and mech, spur boxes linked to Talents, and a pop-up dice tray on every roll. |
| `/names` | The shared NPC ledger (all players see is the ledger). Warden only: the NPC deck (p. 204), write-your-own NPCs, Factions (book plus custom, secret or known), and Book NPCs (pp. 120–133, 191). The page is built from accordions. |
| `/map` | The Uncivilized West: town write-ups, Warden notes and pins, tokens. |
| `/battle` | Hex battle map (1" hexes, ranges from p. 85) and where players take their turns: Grit-costed moves, attack/dodge/ability/item/relieve/improvise/prepare, undo, range from token distance. Art tokens and 5 preset maps. |
| `/store` | The full price list (307 items) plus Warden-made items. Buying and selling are requests that the Warden approves. |
| `/howto` | How to Play Online: a short guide for players. |
| `/session` | Warden only (shows in the nav in Warden mode): session notes per game night, a recap button that posts to the Table Log, and a live at-a-glance panel (posse Health/Grit/Statuses/Prestige/$, enemies, duel, recent rolls). |

Every page has the shared **Table Log** (every roll from any page), a **Roll dice** button, the turn-order strip, a "your turn" bar, and pop-ups for the Warden's roll requests. The first visit asks "Who are you playing?" so a phone knows its character.

## Data

The data lives in Upstash Redis, one JSON document per area:

- `state`: the scanner
- `combat`: posse sheets, combat and the table log
- `map`
- `battle`
- `npcs`: the ledger and custom factions
- `shop`: custom items and buy/sell requests
- `session`: the Warden's session notes

It persists between sessions and all clients poll for changes. Editing works on trust: anyone can edit any sheet. The Warden PIN protects Warden tools.

## Run locally

```bash
npm run dev   # http://localhost:5190  (Warden PIN 1234, data saved to .data/)
```

## Deploy (Vercel)

Push to `main` and Vercel auto-deploys. Environment variables:

- `WARDEN_PIN`: the Warden PIN. Required in production.
- Upstash Redis (`KV_REST_API_URL` + `KV_REST_API_TOKEN`). The Vercel Upstash integration adds these automatically.

Fan-made; *Wild Imaginary West* is © Rune Foundry and Boylei Hobby Time.
