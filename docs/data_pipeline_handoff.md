# Data Pipeline Handoff

Generated for Face-Findr v2 MVP data foundation.

## Scope

This pipeline uses `raw_data/merge_df.csv` as the source of truth and preserves the raw source fields in generated artifacts. Ingredient parsing, alias matching, and group membership are deterministic. No LLM is used for ingredient parsing or matching.

## Commands

| Task | Command | Output |
| --- | --- | --- |
| Audit raw scrape | `node scripts/audit_data.js` | `docs/data_audit_report.md` |
| Normalize products and ingredients | `node scripts/normalize_products.js` | `data/normalized_products.json`, `data/product_ingredients.json` |
| Run focused tests | `node --test tests/data-pipeline/ingredients.test.js` | Parser, alias, group, and normalization tests |

Both scripts accept an optional CSV path argument. Example: `node scripts/audit_data.js raw_data/merge_df.csv`.

## Source Input

Expected CSV columns after header normalization:

| Field | Source column | Notes |
| --- | --- | --- |
| `index` | `index` | Used as `source_row_id` when numeric. |
| `brand` | `brand` | Trimmed and normalized for matching. |
| `product` | `product` | Preserved as display name; normalized name is separate. |
| `product_type` | `product_type` | Mapped through `data/category_taxonomy.json`. |
| `price` | ` price ` | Parsed to `price_cents`; invalid values become `null`. |
| `rating` | `rating` | Parsed as 0-5 number; invalid values become `null`. |
| `details` | `details` | Preserved and lightly scanned for deterministic attributes. |
| `ingredients` | `ingredients` | Preserved unchanged in `raw_ingredients` and `raw_ingredient_string`. |
| `url` | `url` | Validated as HTTP/HTTPS URL. |
| `store` | `store` | Trimmed and normalized. |

## Generated Artifacts

### `data/normalized_products.json`

Top-level shape:

```json
{
  "generated_at": "ISO timestamp",
  "source_file": "raw_data/merge_df.csv",
  "count": 1718,
  "products": []
}
```

Each product contains:

- `id`: stable import ID in `source-{source_row_id}` format.
- `source_row_id` and `source_row_number`: traceability back to the CSV.
- `brand_display_name`, `brand_normalized_name`.
- `product_display_name`, `product_normalized_name`.
- `category`: `{ slug, display_name, domain, subcategory, source_value }`.
- `price_cents`, `rating`, `details`, `raw_ingredients`, `product_url`, `store`, `store_normalized_name`.
- `attributes`: deterministic claims found in `details`, each with `attribute_key`, `attribute_value`, `source_field`, and `confidence`.
- `data_quality_flags`: row-level flags such as `missing_ingredients`, `invalid_price`, `invalid_rating`, `malformed_url`, `unknown_category`.
- `data_quality_status`: `complete` or `needs_review`.

### `data/product_ingredients.json`

Top-level shape:

```json
{
  "generated_at": "ISO timestamp",
  "source_file": "raw_data/merge_df.csv",
  "count": 67625,
  "product_ingredients": []
}
```

Each parsed ingredient row contains:

- `product_id`, `source_row_id`.
- `raw_ingredient_string`: original full ingredient text.
- `raw_token`: token as parsed from the raw string.
- `normalized_token`: deterministic normalized token.
- `canonical_name`: matched canonical ingredient, or `null`.
- `alias_match_type`: `canonical`, `alias`, or `none`.
- `groups`: deterministic ingredient group slugs.
- `section_label`: shade, product section, or bundle label when detected.
- `is_may_contain`: `true` for `May Contain` and `+/-` sections.
- `position`: token order within the source ingredient string.
- `parse_confidence`: deterministic parser confidence score from 0 to 1.

## Ingredient Library

Backend-facing module:

- `src/lib/ingredients/index.js`
- `src/lib/ingredients/index.d.ts`

Exported functions:

- `normalizeIngredientName(value)`
- `parseIngredientList(rawIngredients)`
- `buildIngredientIndex(aliasData, groupData)`
- `matchIngredient(rawOrNormalized, index)`
- `ingredientHasGroup(rawOrNormalized, groupSlug, index)`

Exported types in `index.d.ts`:

- `ParsedIngredientToken`
- `IngredientMatch`
- `IngredientGroupMatch`
- `IngredientIndex`

Reference data:

- `data/ingredient_aliases.json`
- `data/ingredient_groups.json`
- `data/category_taxonomy.json`

Initial ingredient groups include fragrance/parfum, sulfates, silicones, essential oils, and coconut derivatives. Matching is exact after deterministic normalization. Fuzzy matching is not used for safety decisions.

## Backend Consumption

The backend agent should import `data/normalized_products.json` into product, brand, category, attribute, and product detail tables. It should import `data/product_ingredients.json` into product ingredient rows after canonical ingredients and group tables are seeded from `data/ingredient_aliases.json` and `data/ingredient_groups.json`.

Recommended strict filtering behavior:

- Treat `is_may_contain: true` as present for exclusion filtering unless product-specific shade data is added later.
- Treat `canonical_name` and `groups` as deterministic matches only.
- Treat `alias_match_type: none` as unmatched, not safe or unsafe.
- Exclude or label products with `missing_ingredients` or `unparseable_ingredients` when strict ingredient filtering is enabled.
- Do not use fuzzy or LLM-derived matches for ingredient exclusion decisions.

## Known Data Gaps

- Audit found 2 missing ingredient lists, 43 invalid prices, 6 invalid ratings, 2 malformed URLs, and 1 unknown category row in the current scrape.
- Some scraped text contains mojibake such as `MÂ·AÂ·C`; this pipeline preserves source text and normalizes matching keys but does not rewrite brand display names globally.
- Product images are not present in `raw_data/merge_df.csv`.
- Attribute extraction from `details` is conservative and text-based; claims should be treated as dataset-derived signals, not guarantees.
- Ingredient aliases are intentionally initial coverage only and should be curated over time.
- Parser confidence reflects string parsing quality only. It is not a medical, allergy, or product safety guarantee.
