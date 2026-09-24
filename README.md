# Forstall Scanner — Wild Imaginary West

A table companion for the **Scanning** rules of the *Wild Imaginary West* RPG (Official Guidebook pp. 83–84):
roll Intuition with bullet dice to recover digits of a monster's Kurtz Frequency, then guess it Mastermind-style.

- `/` — player page: dice pool, animated bullet dice, Forstall display with green/yellow/red lights, posse notebook.
- `/warden` — Warden's Station (PIN): pick the target from all 59 Guidebook monsters, live feed, hand out digits, house rules, homebrew monsters with Forstall traits.
- `/combat` — Combat & Dice: Finesse turn order, Grit, Statuses, Ace-in-the-Hole, Bleeding Out; Warden adds monsters (full profiles, attack rolls, Frenzy triggers).
- `/posse` — shared, editable two-page character sheets for all seven Trades.
- `/names` — NPC name generator: deal from the p. 204 card table.
- `/map` — the Uncivilized West: town write-ups, Warden notes & pins, draggable character tokens.
- Every page has the shared Table Log (all rolls, from any page).

Data lives in three Redis documents: `wiw-forstall:state` (scanner), `wiw-forstall:combat` (posse sheets, combat, table log), `wiw-forstall:map`.

## Run locally

```bash
npm run dev   # http://localhost:5190  (Warden PIN: 1234, data saved to .data/)
```

## Deploy (Vercel)

Push to `main`. Environment variables:

- `WARDEN_PIN` — PIN for `/warden` (required in production)
- Upstash Redis (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) — added automatically by the Vercel Upstash integration. Without it, state lives in memory and resets.

Fan-made; *Wild Imaginary West* is © Rune Foundry and Boylei Hobby Time.
