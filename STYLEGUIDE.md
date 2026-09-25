# Wild Imaginary West Table Kit — Style Guide

The look: **aged paper, black ink, rust accent, brass highlights** — a printed Western guidebook you can tap. Clean and consistent first; flavor comes from the fonts, the paper, the icons and a few themed screens.

Everything below lives in `public/css/style.css`. Page stylesheets (`posse.css`, `battle.css`, …) hold **only** what is unique to that page.

## Rules
- **Art is the exception:** gradient stops that *draw* something (keypad keys, lamps, the dice tray's wood, bullet dice, felt) may keep literal colors. Everything else uses tokens.
- **Use tokens, never raw values.** Colors, font sizes, spacing, corners and shadows come from the `:root` variables. No new hex colors in page CSS; add a token if something is truly new.
- **Use the shared components** (below) before writing new CSS. If two pages need the same thing, it belongs in `style.css`.
- **No emoji** — use the line icons: `gl('name')` in JS, `<span data-gl="name"></span>` in HTML (`public/js/glyphs.js`).
- **No browser pop-ups** — `ask()`, `askText()`, `tell()` from `common.js`.
- **No inline `style=""`** except positions/sizes computed at runtime (map tokens, bars).
- **Mobile first-class:** every screen works at 375px wide with no sideways scroll. Two-column layouts collapse to one under 900px.
- **Copy** speaks to the reader: players never see pointers to Warden-only pages.

## Color tokens
| Token | Value | Use |
|---|---|---|
| `--paper` / `--paper-2` | #efe8dc / #e4dac9 | page background (with the paper texture) |
| `--surface` | #fffdf7 | inputs, chips, list cards — **the only cream** |
| `--surface-2` | #f4ead6 | bars, raised panels; light text on dark backgrounds |
| `--ink` / `--ink-soft` / `--ink-faint` | #221f1f / #4a4340 / #8a7f76 | text: main / secondary / hints |
| `--line` / `--line-soft` / `--wash` | ink at 30% / 15% / black 5% | borders, dividers, quiet row fills |
| `--accent` (`--rust`) / `--accent-dark` / `--accent-tint` | #a4401f | the one accent: hovers, active states, urgent notices, labels |
| `--brass` | #c9a45c | highlights: kicker text, selected token glow, badges |
| `--success` / `--success-tint` | #3d6b3a | passed rolls, done |
| `--warning` / `--warning-tint` | #b88c14 | caution |
| `--danger` / `--danger-tint` (bright: `--red`) | #8f1d17 (#c8372d) | delete, harm, failures, errors |
| `--info` (`--teal`) / `--info-tint` | #2f6d73 | neutral information, posse turn |
| `--now` | pale gold | "it's their turn" row highlight |
| `--on-dark` / `--on-dark-dim` / `--on-dark-bright` / `--on-dark-warn` | creams / pink | text on ink or iron backgrounds (nav, masthead, dark panels) |
| `--secret` / `--secret-tint` / `--secret-line` | purple | Warden-only and hidden-from-players things (hidden tokens, secret NPC notes) |

**Themed screens** keep their own look, but only through these tokens:
| Screen | Tokens |
|---|---|
| Forstall Scanner display (green-on-black instrument) | `--screen-bg`, `--screen-ink` (`--phosphor`), `--iron`, `--iron-2` |
| Forstalls on the Battle Map | `--forstall-bg`, `--forstall-ink`, `--forstall-glow` |
| NPC card table | `--felt`, `--felt-rail`, `--felt-ink` |
| Battle Map viewport | `--night` |

## Type
| Font | Token | Use |
|---|---|---|
| Bebas Neue | `--display` | headings, labels, buttons, chips, numbers. Always UPPERCASE look, letter-spaced |
| Alegreya | `--body` | reading text, descriptions, form input text |
| Special Elite | `--type` | "machine" text: Kurtz frequencies, PINs, dice counts, timestamps |
| Rye | `--western` | rare flourishes only (Scanner target name, notebook title) |

**Scale** — use these sizes only: `--fs-xs` 12 · `--fs-sm` 14 · `--fs-md` 16 · `--fs-lg` 18 · `--fs-xl` 22 · `--fs-2xl` 28 (card titles) · `--fs-3xl` 40 (hero numbers). Page titles use the masthead clamp.
**Letter-spacing** for display text: `--track-tight` .04em (names, numbers) · `--track` .08em (buttons, chips) · `--track-wide` .14em (small caps labels, kickers).
Body text is 17px (16px on phones), line-height 1.5.

## Spacing, shape, depth
- **Spacing:** `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32. Gap between cards in a grid: **14px**. Card padding: 18px 20px (14px on phones).
- **Corners — mostly square:** `--r-sm` 3px (fields, tags, small boxes) · `--radius` 5px (cards, buttons, panels) · `--r-pill` (chips, pills, the contents bar links) · 50% (tokens, ± buttons, avatars).
- **Shadows:** `--shadow-stamp` (cards, buttons — a printed offset) · `--shadow-pop` (dialogs, drawers) · `--shadow-soft` (floating menus). Nothing else.

## Shared components (`style.css`)
| Component | Class | Notes |
|---|---|---|
| Card | `.card.corner` | paper card with ◆ corners. Title: `h2.section-title` |
| Card header | `.head-row` | title left, one action button (or a short `.muted` note) right |
| Two-column body | `.stack-grid` > `.stack-col` | 14px gaps; cards inside drop their bottom margin; one column under 900px |
| Band of related cards | `section.band` + `h2.band-h` | rust small-caps label with a rule; used to group a long page |
| Contents bar | `nav.toc-bar` | sticky under the nav; pill links to each band; `.on` = current band |
| Button | `.btn` | solid ink → rust on hover. `.secondary` = outline. `.small`. `.danger` = solid red (do the dangerous thing). `.secondary.danger` = red outline (delete/clear). Icon first: `${gl('x')} Label` |
| Tap chip | `.chip-btn` (`.on`) | pick one or many (who rolls, how hard, who's in the fight). Optional `<small>` second line |
| Labelled step | `.field-step` > `span` + chips/field | small-caps label above a row of chips or an input |
| Status pill | `.pill` (`.hot` `.ok` `.no` `.info` `.fs` `.wait`) | Statuses, flags, roll results |
| List row | `.item-row` > `.item-who` + `.item-nums` | name + small facts left; `.hp-bar`, `.hp-num`, `.stat`, `.pm-btn` right. `.now` = their turn, `.sitting` = out |
| Notice row | `.notice` (`.urgent`) | something waiting on you; link text + inline buttons |
| Icon link grid | `.link-grid` | big "jump to" tiles: icon, bold name, small hint |
| Checkbox | `label.check` > `input` | only for true on/off settings; prefer chips for choosing people/things |
| Dice pool input | `poolHTML()` (`.dp`) | always Black/Gold number boxes — never ask for "3B1G" text |
| Dialogs | `ask()` / `askText()` / `tell()` / `pickFighters()` | centered, styled; short first line/paragraph becomes the heading |
| Toast | `toast(msg, isError)` | one line of feedback after an action |
| Empty state | `.muted` / `.empty-note` | one friendly line: what's missing and where to add it |

Small helpers: `.btn-row` (a row of buttons), `.fine` (12px note), `.small-text` (14px), `.mt-0`, `.mt-2`.

## Controls — never ship a raw native control
`public/js/controls.js` (loaded by `common.js` on every page) and the CONTROLS block in `style.css` restyle everything the browser would draw itself:
- **`<select>`** — keep writing normal selects (optgroups welcome). They're restyled (ink caret) and open a styled list (`.sel-pop`) with keyboard support and a search box over 12 options. The select stays the source of truth, so `value`, `change` and "skip redraw while a select is focused" all keep working. Add `data-native` only if you truly need the browser's list.
- **Suggestions** — `<input list="…">` + `<datalist>` opens the same styled list, filtered as you type.
- **Checkboxes** — styled automatically (rust when ticked). For choosing people/options prefer `.chip-btn`s.
- **Number fields** — no spinner arrows; add ± buttons (`.pm-btn`) where stepping matters.
- **Sliders** — styled `input[type=range]`.
- **Dates** — a plain text field (`2026-09-25`), no calendar pop-up.
- **Tooltips** — just use `title="…"`; it's shown as a styled `.tip-pop`.
- **Pop-ups/dialogs** — `ask()`, `askText()`, `tell()`, `pickFighters()`; never `alert/confirm/prompt`.

## Navigation
- One site nav (`mountNav` in `common.js`), grouped by how often a page is used.
  - **Player:** Posse · Battle Map · Forstall Scanner · World ▾ (Map, NPCs) · Store · ? (How to Play)
  - **Warden:** ★ Run the Game · Posse · Fight ▾ (Battle Map) · Forstall Scanner · World ▾ · Store · ?
- Dropdowns open on **tap** (never hover-only); the group label is highlighted when you're on one of its pages.
- Phones show the most-used links plus **Menu** (a full-screen grouped list).
- Warden mode lives in the nav: red underline + star, a **Needs you (n)** badge and a **Warden ▾** menu (switch to player view, Run the Game, Battle Map, backup).
- **Adding a page:** decide who uses it and how often. Frequent → top level. Reference/lore → World. Fighting → Fight (Warden) or the Battle Map. Warden-only tools → Warden ▾ or Run the Game.

## Building something new — checklist
1. Put it in a `.card.corner` with a `.head-row` (title + at most one action).
2. Choosing people/options → `.chip-btn`s in a `.field-step`. Lists of characters/enemies → `.item-row`s.
3. Buttons: one primary `.btn` per card; others `.secondary`; destructive = `.secondary.danger` + an `ask()`.
4. Sizes/colors/spacing only from tokens. Icons from `glyphs.js`.
5. Check it at 375px and in Warden + player views; bump the page's `?v=`.

## Warden mode theme (cool slate, steel blue & teal)
- The player side is warm (paper, rust, brass); the Warden's side is cool so the Warden always knows which seat they're in. In Warden mode (`body.warden-mode`, set by `mountNav`) tokens are overridden on `body.warden-mode` in style.css: `--paper`/`--surface` cool grey paper, `--accent` steel blue, `--rust` teal, `--line` blue-tinted, `--desk` dark slate; Warden-only tokens `--w-slate`, `--w-teal`, `--w-teal-pale`.
- Explicit rules: the masthead shows the Map of the West (`img/map.jpg`) under a slate gradient with a teal rule; slate nav with a teal underline, pale-teal current page and Warden menu; cards solid grey paper with steel-blue borders, corners and titles (field labels too); primary buttons slate lettered in pale teal; outline buttons steel blue **inside light surfaces only** (`.card`, `.modal`, `.sbox-in`) so buttons on dark surfaces keep their own look; selected chips teal; contents bar and sheet toolbar slate with teal pills; band labels pale teal on the desk. posse.css re-colors the sheet boxes and toolbar.
- New components: use tokens and they follow. Anything with a hard-coded light background or dark text on the page background needs a `body.warden-mode` rule — check it in Warden mode.
- The site nav (z 25) sits above the sticky sheet bar and contents bars (20 / 18) so its drop-down menus cover them.
