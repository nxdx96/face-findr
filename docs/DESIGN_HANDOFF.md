# Ingredi-Findr — Frontend Design Handoff (v2)

Prompt-ready spec for implementing the Ingredi-Findr UI. Pair this with `docs/product_purpose_and_user_flow.md` (product logic, API contracts) — this file covers the visual system and screen-by-screen UI. Reference mockups: `DESIGN_MOCKUP.html`, turn 2 (screens 2a–2h). Logo asset: `public/IngrediFindr.png`.

---

## 1. Design direction

Whimsical-editorial: cream ground, chunky rounded outlines, hot-pink selected states, butter "highlighter" marks on the accent word of every headline, small offset shadows (pink or butter) on primary/selected elements. Playful but precise — safety copy stays strictly factual. No gradients. The blobby rounded logo sets the shape language: generous border-radii everywhere, bold 1.5px ink outlines, occasional mint/lavender circles as decoration (never load-bearing).

## 2. Design tokens

### Color
| Token | Value | Use |
|---|---|---|
| `--ink` | `#211A1F` | Text, primary buttons, strong 1.5px borders |
| `--cream` | `#FFF8F0` | Page background |
| `--surface` | `#FFFFFF` | Cards, inputs, unselected chips |
| `--hot-pink` | `#F56CB7` | Selected states, progress fill, score badges, button offset shadow |
| `--deep-pink` | `#C93E83` | Links, active step numbers, eyebrows, strict-mode text (readable pink) |
| `--olive` | `#9A8000` | Decorative: checkmarks, stale-freshness text |
| `--deep-olive` | `#665500` | Readable olive: header tagline, safety notes, partial-data state |
| `--butter` | `#FFE49B` | Headline highlights, offset shadows, before-you-buy strip, welcome blob |
| `--butter-tint` | `#FFF1CE` | Highlighted rows (receipt avoid row, search hover) |
| `--mint` | `#B8E8C5` | Decorative dots; complete-confidence dot fill |
| `--lavender` | `#C9B5FF` | Decorative dots; no-image fallback (`#EDE4FF` bg, lavender initial) |
| `--ok` | `#2F7A52` | "Ingredient data complete" text (pairs with mint dot) |
| hairline | `rgba(33,26,31,.14)` | Minor dividers, row borders |
| border-mid | `rgba(33,26,31,.28)` | Unselected chip/input borders |
| muted | `rgba(33,26,31,.55)` | Secondary text (.4–.7 range) |

### Type (Google Fonts)
- **Space Grotesk** (400–700) — headings, all data/labels/eyebrows (uppercase, letter-spacing `.08–.22em`), product names, buttons, prices.
- **Manrope** (400–800) — body copy, chips, notes. NOTE: Manrope has no italic — never italicize it.
- **Bricolage Grotesque** (400–800) — hero/editorial moments only: welcome tagline, world-card names, store names, loading headline, results masthead.

Scale (desktop): step headline Space Grotesk 600 46px/1.15; results masthead Bricolage 700 54px; loading Bricolage 700 52px; card product name Space Grotesk 700 21px; body Manrope 15–16px/1.5; chips Manrope 13px; labels Space Grotesk 10–12px. Never below 10px.

### Shape & effects
- Screen/card radius 18–20px; inner cards 14–18px; pills 999px; highlight spans 10–14px.
- Strong borders: `1.5px solid ink` (headers/footers/cards/segmented controls). Minor dividers: 1px hairline.
- Offset shadows (whimsy, use sparingly): primary buttons `3px 3px 0 hot-pink` (large CTA `4px 4px 0`), selected world/store cards + search dropdown + show-more `3–4px 4px 0 butter`.
- Headline accent word: `<span>` with butter bg, radius 12px, padding 0 14px. Welcome tagline uses hot-pink for its accent span.

### Layout
Same skeleton as before: 1280px design width, 48px horizontal padding, quiz grid `280px rail + 72px gap + 1fr`, header/footer bars with full-width 1.5px ink borders.

## 3. Shared chrome

**Header** (every screen post-welcome): flex row, 1.5px ink bottom border, 16px vertical padding. Left: logo image (`IngrediFindr.png`) at 46px height. Right: Space Grotesk 11px letterspaced tagline `READS LABELS SO YOU DON'T HAVE TO` in deep-olive (results swaps in `EDIT MY ANSWERS` deep-pink underlined + `START OVER` muted).

**Quiz footer**: 1.5px ink top border. Left `← BACK` deep-pink underlined Space Grotesk (muted 30% on step 1). Center: 3px rounded progress track (`rgba(33,26,31,.12)`) with hot-pink fill at 20/40/60/80/100%. Right: primary pill — ink bg, cream text, Space Grotesk 700 14px, `3px 3px 0` hot-pink shadow. `Continue →` / `Review →`; step 5 shows `05 / 05` instead.

**Step rail**: rows `01 The Goal … 05 The Receipt`, hairline separated. Active: deep-pink Space Grotesk number, ink 700 Space Grotesk name, 9px hot-pink dot. Completed: muted Manrope + olive `✓`. Upcoming: muted Manrope. Below: contextual note card — white, 1.5px `rgba(33,26,31,.18)` border, radius 14px, Manrope 13px; step 4's is inverted (ink bg, butter `THE FINE PRINT` label, cream text).

**Question header**: deep-pink eyebrow `STEP 0X OF 05 — NAME` → Space Grotesk 600 46px headline with one butter-highlighted word → Manrope muted subtitle.

**Chips**: pill, padding 10×18. Unselected: white bg, 1.5px border-mid, Manrope 500. Selected: hot-pink bg, 1.5px ink border, Manrope 700, trailing " ✓".

## 4. Screens

### 2a — Welcome
Full-viewport cream, entirely clickable (role="button"; Enter/Space too). Decor: big butter circle (~520px, 70% opacity) offset behind center; small mint (74px) top-right and lavender (46px) bottom-left circles. Corner labels in deep-olive Space Grotesk: `VOL. 01 — DISCOVERY` / `SEPHORA + ULTA` / `NOT MEDICAL ADVICE` / `N° 001`. Centered stack: eyebrow `✶ A BEAUTY DISCOVERY INSTRUMENT ✶` (pink stars) → logo image ~460px wide → Bricolage 26px tagline "Know what's in it **before** it's on you." (before = hot-pink highlight span) → `— CLICK ANYWHERE TO ENTER —` with short ink dashes.

### 2b — Step 1: Goal
Headline "What are we shopping for ⟦today?⟧". Three world cards (3-col, max 820px, radius 18px): Space Grotesk index `W. 01`, Bricolage 700 26px name, Manrope category list. Selected: hot-pink bg, ink border, butter offset shadow, `✓ SELECTED`. Multi-select; Skincare default.

### 2c — Step 2: Concerns
Headline "Where should things feel ⟦better?⟧"; subtitle "Optional. Skip entirely if today is just a vibe." Chip groups under Space Grotesk labels (`SKIN + FACE`; hair/scalp groups appear when Haircare selected). Rail note: "Concerns nudge the ranking. They never diagnose, and they never exclude."

### 2d — Step 3: Preferences
Headline "House ⟦rules.⟧" Sections:
- `CLAIMS — RANKING BOOSTS`: 8 chips (Fragrance-free default).
- `STORES — OPTIONAL`: radius-14 cards, Bricolage 700 18px store name; selected = pink + ink border + butter shadow + ✓.
- `MAX BUDGET` / `MINIMUM RATING — HARD FILTER` sliders: Space Grotesk 700 20px value; 3px rounded track, hot-pink fill, 18px ink knob with 3.5px butter ring; Space Grotesk min/max captions.
Rail note: "Claims help ranking. They are not allergy filters — that's the next step."

### 2e — Step 4: The Avoid List
Headline "The do-not-⟦apply⟧ list." Subtitle: "Hard exclusions. Anything here gets matched by exact term, alias, and group — before ranking even starts."
- Severity segmented pill: white container, 1.5px ink border; segments Preference / Sensitivity / Allergy; selected = hot-pink with 1.5px ink side borders, Manrope 700. Sensitivity/Allergy shows deep-pink status: `● STRICT MODE ON — MISSING OR UNCLEAR INGREDIENT LISTS GET EXCLUDED`.
- Search: white input, 1.5px ink border, radius 16px, `⌕` prefix, Space Grotesk text; calls `GET /api/ingredients/search?q=&limit=10` after 2+ chars. Dropdown 8px below: radius 16, ink border, butter offset shadow; rows = name (typed prefix at weight 800) + right Space Grotesk tag (`GROUP — FRAGRANCE` deep-pink when highlighted, else muted); hover bg butter-tint.
- Added terms: `AVOIDING:` + ink pill tokens (Space Grotesk, hot-pink `×`) + `CLEAR ALL` underlined.
- `OR PICK A WHOLE GROUP`: 9 chips (Fragrance, Sulfates, Silicones, Parabens, Essential oils, Nut oils, Coconut, Lanolin, Dyes + pigments).
- Notes textarea: white, border-mid, radius 14; helper `WE SUGGEST FILTERS FROM THIS. YOU APPROVE THEM AT REVIEW.`
- Rail fine-print card (ink bg): "Product data can't guarantee a product is safe or reaction-free. When it's your skin on the line, we get conservative."

### 2f — Step 5: The Receipt
Centered column (max 880px). "Read it back to ⟦me.⟧" / "Nothing gets applied silently. This is exactly what we'll send."
Receipt table: 2px ink top + bottom borders, hairline rows. Grid `200px Space Grotesk label | Space Grotesk 700 18px value | EDIT link (deep-pink underlined)`. Rows: SHOPPING FOR / CONCERNS / PREFERENCES / AVOIDING — STRICT / FROM YOUR NOTES.
- AVOIDING row: butter-tint bg, radius 12, full-bleed; deep-pink label; sub-line Space Grotesk 10.5px deep-pink: `SEVERITY: SENSITIVITY → STRICT MODE ON. MATCHED BY TERM, ALIAS + GROUP, BEFORE RANKING.`
- FROM YOUR NOTES: quoted note + "Suggest: cap budget at **$30**?" with Apply (selected-chip style) / Keep $35 (unselected chip); REMOVE link.
CTA: large ink pill `Show my matches →` with `4px 4px 0` hot-pink shadow + caption `UP TO 20 RESULTS — RANKED, WITH REASONS`.

### 2g — Loading
Cream, butter circle (~360px, 70%, gentle pulse) + small mint/lavender dots. Bricolage 700 52px "Finding matches…" + Space Grotesk checklist: done = olive `✓` + ink text; active = deep-pink `●`; pending = 35% ink `○`. Stages: READING 1,240 LABELS / CHECKING FRAGRANCE ALIASES / APPLYING STRICT MODE / RANKING WHAT SURVIVES.

### 2h — Results
- Masthead: deep-pink eyebrow (`YOUR SHORTLIST — SKINCARE, FRAGRANCE-FREE, UNDER $35`), Bricolage 700 54px "{n} matches, ranked and ⟦receipted.⟧", Manrope subtitle ("Every card shows its work — no black boxes…").
- Toolbar (1.5px ink top border): sort segmented pill (white container, ink border; active segment hot-pink Manrope 700). Strict toggle pill: ON = ink bg, cream Space Grotesk `STRICT EXCLUSIONS — ON`, butter mini-switch; OFF = white, border-mid, gray switch. Toggling re-fetches. Right: `{n} SHOWN · {m} FILTERED OUT`.
- Before-you-buy strip: solid butter bg, 1.5px ink bottom border; `BEFORE YOU BUY` Space Grotesk 700 + Manrope ink text: "Labels change. Always verify the current ingredient list, price, and shade details on the retailer page."
- Grid 3-col, 24px gap. Footer: white pill `Show N more`, ink border, butter shadow.

**Product card** (white, 1.5px ink border, radius 20, overflow hidden):
1. Image area h≈230, 1.5px ink border below: product photo (cover) or striped placeholder `repeating-linear-gradient(45deg,#FFF3D6 0 10px,#FFE9C2 10px 20px)`; no-image fallback = `#EDE4FF` bg + Bricolage 800 92px lavender brand initial + `NO IMAGE ON FILE`. Score badge top-right: hot-pink bg, 1.5px ink border, radius 10, Space Grotesk 700 `96% match`.
2. Meta row Space Grotesk 10.5px letterspaced: `BRAND — RETAILER` | `$28 · 4.7★ (2.1K)`.
3. Product name Space Grotesk 700 21px.
4. Confidence: 8px dot (mint fill + `--ok` border for complete; butter fill + deep-olive border for partial) + Space Grotesk uppercase in `--ok`/deep-olive: COMPLETE / PARTIAL / MISSING / UNCLEAR.
5. Hairline; reasons Manrope 12.5px muted: `Why: fragrance-free confirmed on label · …`.
6. Safety note Manrope 600 12px deep-olive: "No confirmed matches for your avoid list — full label parsed." / partial variant: "Parsed label shows no fragrance, but shade variants are unparsed — treat with care."
7. Hairline; `VIEW AT SEPHORA ↗` deep-pink Space Grotesk underlined (new tab, `rel="noopener noreferrer"`) + freshness `CHECKED 2D AGO` muted (stale = olive, e.g. `PRICE CHECKED 6D AGO`).

### Empty & error states (not mocked — follow the system)
- Empty: cream, butter blob, Space Grotesk headline "Nothing survived the ⟦strict⟧ filters." + backend reason + recovery chips (broaden categories, lower rating, raise budget, remove store, remove avoid items, relax strict mode — with safety caveat).
- Error: same layout, "Something's off on our end." + product doc's error copy + outlined retry pill.

## 5. Interaction notes
- Hover: chips/cards border-mid → ink; links hot-pink → deep-pink underline; buttons translate -1px with shadow growing 1px. Transitions ≤150ms ease-out.
- Focus: 2px ink outline, 2px offset, on all interactive elements.
- Welcome screen: whole surface is a button.
- Sliders/segmented/toggles: full keyboard + ARIA.
- Uppercase labels via CSS `text-transform`; hit targets ≥44px on touch.
- Manrope has no italic — use weight or color for emphasis instead.

## 6. Voice cheatsheet
Step names: The Goal / Concerns / Preferences / The Avoid List / The Receipt. Every headline pairs a plain phrase with one butter-highlighted word. Playful in navigation and headlines; strictly factual in safety copy (severity, strict mode, confidence, before-you-buy). Never overclaim safety — the product doc's boundaries section is binding.
