# Ingredi-Findr — Frontend Design Handoff

Prompt-ready spec for implementing the Ingredi-Findr UI. Pair this with `product_purpose_and_user_flow.md` (product logic, API contracts) — this file covers the visual system and screen-by-screen UI. Reference mockups: `Ingredi-Findr End to End.dc.html` (screens 1a–1h).

---

## 1. Design direction

Editorial-magazine aesthetic: think designer print magazine crossed with a modern beauty brand. Warm blush + ink palette, hairline rules, generous whitespace, oversized serif headlines with italic accent words, monospace for data/labels. Voice is deadpan-playful ("The do-not-apply list", "Read it back to me") but dead serious about safety copy. No gradients, no rounded cards, no drop shadows on content — flat surfaces separated by hairlines. Pills (999px radius) are the ONLY rounded elements: chips, buttons, toggles.

## 2. Design tokens

### Color
| Token | Value | Use |
|---|---|---|
| `paper` | `#F7F1EA` | Page background |
| `surface` | `#FCF9F5` | Cards, inputs, unselected chips |
| `ink` | `#1C1917` | Text, primary buttons, strong borders |
| `blush` | `#E8B4B8` | Selected states, accent circle motif |
| `blush-tint` | `#F3DDDE` | Highlighted rows, hovered suggestions, image fallback bg |
| `rose` | `#A96A72` | Active step numbers, progress fill, strict-mode text, links hover |
| `hairline` | `rgba(28,25,23,.16)` | All dividers and default card borders |
| `border-mid` | `rgba(28,25,23,.3)` | Unselected chip/input borders |
| `muted` | `rgba(28,25,23,.55)` | Secondary text (use .4–.7 range as needed) |
| `ok` | `#5B7F5E` | "Ingredient data complete" |
| `warn` | `#C08A2D` | "Partial" / stale-price warnings |
| `bad` | `#B4545C` | "Missing" / "unclear" |

### Type (Google Fonts)
- **Instrument Serif** (400 + italic) — display. Headlines, product names, wordmark, big numbers. Italic for the accent word in every headline.
- **Archivo** (400/500/600) — UI. Body copy, chips, buttons.
- **IBM Plex Mono** (400/500) — data. Eyebrows, labels, metadata, badges, links. Always uppercase with letter-spacing `.08em–.22em`.

Scale (desktop): headline 52–56px/1.05; welcome wordmark 128px; card product name 24px; body 15–16px/1.5; chip 13px; mono labels 10–12px. Never below 10px.

### Layout
- Screens designed at 1280px; responsive, desktop-first.
- Screen padding: 48px horizontal. Header/footer bars: 22px vertical.
- Quiz layout grid: `280px [rail] + 72px gap + 1fr [content]`.
- Buttons: primary = ink bg, paper text, 999px pill, Archivo 600 14px, padding 14×30. Secondary = mono uppercase underlined text link.
- Chips: pill, padding 10×18. Unselected: `surface` bg + `border-mid` 1px. Selected: `blush` bg + `ink` 1px border + Archivo 500 + trailing " ✓".

## 3. Shared chrome

**Header** (every screen post-welcome): baseline-aligned flex row, hairline bottom border. Left: wordmark `Ingredi-Findr` in Instrument Serif 24px, "Findr" italic. Right: mono tagline `READS LABELS SO YOU DON'T HAVE TO` (results screen swaps this for `EDIT MY ANSWERS` / `START OVER` links).

**Quiz footer** (steps 1–5): hairline top border. Left: `← BACK` mono underlined link (muted/disabled on step 1). Center: 2px progress track (`rgba(28,25,23,.12)`) with `rose` fill at 20/40/60/80/100%. Right: primary pill button — `Continue →` (steps 1–3), `Review →` (step 4); step 5 replaces the button with `05 / 05`.

**Step rail** (left column, steps 1–5): rows of `01 The Goal / 02 Concerns / 03 Preferences / 04 The Avoid List / 05 The Receipt`, hairline-separated. Active: rose mono number, ink 600 name, 8px blush dot right-aligned. Completed: muted with `✓`. Upcoming: muted. Below the rail: a contextual note card (surface bg, hairline border, Instrument Serif italic 14px) — copy varies per step.

**Question header pattern** (right column): rose mono eyebrow `STEP 0X OF 05 — NAME` → serif headline with one italic word → Archivo muted subtitle.

## 4. Screens

### 1a — Welcome
Full-viewport `paper`. Entire screen clickable (also Enter/Space; move focus into quiz on entry). Large blush circle (~520px, 55% opacity) offset behind center. Mono corner labels: `VOL. 01 — DISCOVERY` / `SEPHORA + ULTA` / `NOT MEDICAL ADVICE` / `N° 001`. Centered stack: mono eyebrow `A BEAUTY DISCOVERY INSTRUMENT` → wordmark 128px → serif italic tagline "Know what's in it before it's on you." → `— CLICK ANYWHERE TO ENTER —` (mono with hairline dashes).

### 1b — Step 1: Goal
Headline "What are we shopping for *today?*". Three world cards in 3-col grid (max-width 820): mono index `W. 01`, serif name 30px, mono category list. Selected: blush bg, 1.5px ink border, `✓ SELECTED`, name italicized. Default: Skincare selected. Multi-select.

### 1c — Step 2: Concerns
Headline "Where should things feel *better?*"; subtitle "Optional. Skip entirely if today is just a vibe." Chip groups by mono label (`SKIN + FACE`; add `HAIR` / `SCALP` groups when Haircare selected — options per product doc). Below chips, hairline-topped mono note: `HAIR + SCALP CONCERNS APPEAR WHEN HAIRCARE IS SELECTED`. Rail note: "Concerns nudge the ranking. They never diagnose, and they never exclude."

### 1d — Step 3: Preferences
Headline "House *rules.*" Sections with mono labels:
- `CLAIMS — RANKING BOOSTS`: 8 chips (Fragrance-free default-selected).
- `STORES — OPTIONAL`: two rectangular (not pill) select cards, serif store name; selected = blush + 1.5px ink border + ✓.
- `MAX BUDGET` and `MINIMUM RATING — HARD FILTER` sliders: label row with serif value (22px, e.g. `$35`, `4.0★`); custom track — 2px hairline, rose filled portion, 16px ink knob with 3px blush ring; mono min/max captions under track (`$5 / $100+`, `ANY / 5.0★`).
Rail note: "Claims help ranking. They are not allergy filters — that's the next step."

### 1e — Step 4: The Avoid List
Headline "The do-not-*apply* list." Subtitle: "Hard exclusions. Anything here gets matched by exact term, alias, and group — before ranking even starts."
- Severity segmented pill: Preference / Sensitivity / Allergy. Selected segment blush with ink side borders. When Sensitivity or Allergy: show rose mono status with dot: `STRICT MODE ON — MISSING OR UNCLEAR INGREDIENT LISTS GET EXCLUDED`.
- Search: rectangular input (1.5px ink border, mono text, `⌕` prefix), calls `GET /api/ingredients/search?q=&limit=10` after 2+ chars. Dropdown attached below: rows with name (query substring bolded) left + mono type tag right (`GROUP — FRAGRANCE` / `ALIAS — FRAGRANCE`); hovered/active row `blush-tint`.
- Added terms: `AVOIDING:` label + ink pill tokens (mono, blush `×` to remove) + `CLEAR ALL` link.
- `OR PICK A WHOLE GROUP`: 9 chips (Fragrance, Sulfates, Silicones, Parabens, Essential oils, Nut oils, Coconut, Lanolin, Dyes + pigments).
- Notes textarea (surface, hairline border) with mono helper: `WE SUGGEST FILTERS FROM THIS. YOU APPROVE THEM AT REVIEW.`
- Rail note is inverted (ink bg): blush mono label `THE FINE PRINT` + paper serif italic: "Product data can't guarantee a product is safe or reaction-free. When it's your skin on the line, we get conservative."

### 1f — Step 5: The Receipt (review)
Centered column (max 880px), centered header: "Read it back to *me.*" / "Nothing gets applied silently. This is exactly what we'll send."
Receipt table: 1px ink top border, hairline row dividers, ink bottom border. Row grid: `200px mono label | serif 20px value | EDIT link`. Rows: SHOPPING FOR / CONCERNS / PREFERENCES / AVOIDING — STRICT / FROM YOUR NOTES.
- AVOIDING row: `blush-tint` full-bleed background, rose label, sub-line mono: `SEVERITY: SENSITIVITY → STRICT MODE ON. MATCHED BY TERM, ALIAS + GROUP, BEFORE RANKING.`
- FROM YOUR NOTES row: italic quote of the note + inline suggestion ("Suggest: cap budget at **$30**?") with Apply (selected-chip style) / dismiss chips; REMOVE link instead of EDIT.
CTA: large primary pill `Show my matches →` + mono caption `UP TO 20 RESULTS — RANKED, WITH REASONS`.

### 1g — Loading
`paper` full screen, blush circle (~340px, 40% opacity, gentle pulse animation) behind center. Serif italic 58px "Finding matches…" + mono stage checklist that ticks through: `✓ READING 1,240 LABELS` (count from catalog) / `✓ CHECKING FRAGRANCE ALIASES` / `● APPLYING STRICT MODE` (rose = in progress) / `○ RANKING WHAT SURVIVES` (35% ink = pending).

### 1h — Results
- Masthead: rose eyebrow summarizing filters (`YOUR SHORTLIST — SKINCARE, FRAGRANCE-FREE, UNDER $35`), serif 56px "{n} matches, ranked and *receipted.*", subtitle: "Every card shows its work — no black boxes, no vibes-only rankings. Ingredient confidence is printed right on the card, because incomplete data isn't a guarantee."
- Toolbar (hairline top+bottom): sort segmented pill (Best match / Price ↑ / Rating; active = blush). Strict toggle pill: ON = ink bg, paper mono text `STRICT EXCLUSIONS — ON`, blush mini-switch; OFF = surface bg, ink text, gray switch. Toggling re-fetches with new strictness. Right-aligned mono counts: `{n} SHOWN · {m} FILTERED OUT`.
- "Before you buy" strip (surface bg, hairlines): rose mono `BEFORE YOU BUY` + serif italic "Labels change. Always verify the current ingredient list, price, and shade details on the retailer page."
- Card grid: 3-col, 24px gap. Footer: outlined pill `Show N more`.

**Product card** (surface bg, hairline border, no radius):
1. Image area h≈230: product image (cover), or striped placeholder `repeating-linear-gradient(45deg,#F3E7DD 0 10px,#EDE0D2 10px 20px)`; no-image fallback = `blush-tint` bg + giant serif italic brand initial in rose + mono `NO IMAGE ON FILE`. Score badge top-right: ink bg, paper serif `96% match` ("match" italic).
2. Mono meta row, justified: `BRAND — RETAILER` | `$28 · 4.7★ (2.1K)`.
3. Serif product name 24px.
4. Confidence badge: 7px dot + mono uppercase, colored `ok`/`warn`/`bad`: COMPLETE / PARTIAL / MISSING / UNCLEAR.
5. Hairline, then reasons line (Archivo 12px, muted): `Why: fragrance-free confirmed on label · dryness keywords in details · under your $35`.
6. Safety note, serif italic 13px: e.g. "No confirmed matches for your avoid list — full label parsed." Partial-data variant: "Parsed label shows no fragrance, but shade variants are unparsed — treat with care."
7. Hairline, link row: mono underlined `VIEW AT SEPHORA ↗` (new tab, `rel="noopener noreferrer"`, canonical URL) + right mono freshness `CHECKED 2D AGO` (stale = `warn` color, e.g. `PRICE CHECKED 6D AGO`).

### Empty & error states (not mocked — follow the system)
- Empty: centered on paper. Serif headline "Nothing survived the *strict* filters." + backend no-results reason in mono + recovery actions as chips/links (broaden categories, lower rating, raise budget, remove store, remove avoid items, relax strict mode — with safety caveat). Keep the blush circle motif.
- Error: same layout, serif "Something's off on our end." + the product doc's error message in mono + outlined retry pill.

## 5. Interaction notes
- Hover: chips/cards get ink border (`border-mid` → ink); links go `rose`. Transitions ≤150ms ease-out.
- Focus: visible 2px ink outline with 2px offset on all interactive elements.
- Welcome screen: whole surface is a button (role="button", tabindex).
- Sliders/segmented controls/toggles need full keyboard + ARIA support.
- All mono microcopy uppercase via CSS `text-transform`, not source text.
- Hit targets ≥44px on touch.

## 6. Voice cheatsheet
Step names: The Goal / Concerns / Preferences / The Avoid List / The Receipt. Headlines pair a plain phrase with one italic word. Playful in navigation and headlines; strictly factual in safety copy (severity, strict mode, confidence, before-you-buy). Never overclaim safety — copy in product doc's boundaries section is binding.
