# Wild Imaginary West — Table Kit

A shared table companion for the *Wild Imaginary West* RPG. It started as the **Forstall Scanner** (Official Guidebook pp. 83–84): roll Intuition with bullet dice to recover digits of a monster's Kurtz Frequency, then guess it Mastermind-style. It grew into a full kit that the whole posse opens at one URL.

Live: https://wiw-forstall.vercel.app

| Page | What it does |
|---|---|
| `/` | Forstall Scanner: dice pool, animated bullet dice, Forstall lights, and a posse notebook. |
| `/warden` | Warden's Station (needs the PIN): pick the target from 59 Guidebook monsters, live feed, digits, house rules, homebrew monsters. |
| `/combat` | Combat & Dice: turn order, Grit, Statuses, Ace-in-the-Hole, Bleeding Out. Monsters and book NPCs with full profiles. |
| `/posse` | Two-page character sheets styled like the PDFs. Includes the new-character checklist (pp. 6–8), store pickers for weapons, gear, Forstall, horse and mech, spur boxes linked to Talents, and a pop-up dice tray on every roll. |
| `/names` | NPC deck (p. 204) and the shared NPC ledger. Warden only: write-your-own NPCs, Factions (book plus custom, secret or known), and Book NPCs (pp. 120–133, 191). The page is built from accordions. |
| `/map` | The Uncivilized West: town write-ups, Warden notes and pins, tokens. |
| `/battle` | Hex battle map (1" hexes, ranges from p. 85). Art tokens, HP, a status card, and 5 preset maps. |
| `/store` | The full price list (307 items) plus Warden-made items. Buying and selling are requests that the Warden approves. |

Every page has the shared **Table Log**, which records all rolls from any page.

## Data

The data lives in Upstash Redis, one JSON document per area:

- `state`: the scanner
- `combat`: posse sheets, combat and the table log
- `map`
- `battle`
- `npcs`: the ledger and custom factions
- `shop`: custom items and buy/sell requests

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
