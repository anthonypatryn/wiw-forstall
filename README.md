# Forstall Scanner — Wild Imaginary West

A table companion for the **Scanning** rules of the *Wild Imaginary West* RPG (Official Guidebook pp. 83–84):
roll Intuition with bullet dice to recover digits of a monster's Kurtz Frequency, then guess it Mastermind-style.

- `/` — player page: dice pool, animated bullet dice, Forstall display with green/yellow/red lights, posse notebook.
- `/warden` — Warden's Station (PIN): pick the target from all 59 Guidebook monsters, live feed, hand out digits, house rules, homebrew monsters.

## Run locally

```bash
npm run dev   # http://localhost:5190  (Warden PIN: 1234, data saved to .data/)
```

## Deploy (Vercel)

Push to `main`. Environment variables:

- `WARDEN_PIN` — PIN for `/warden` (required in production)
- Upstash Redis (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) — added automatically by the Vercel Upstash integration. Without it, state lives in memory and resets.

Fan-made; *Wild Imaginary West* is © Rune Foundry and Boylei Hobby Time.
