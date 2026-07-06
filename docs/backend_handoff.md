# Ingredi-Findr V2 Backend Handoff

## Scope

This MVP adds a deterministic recommendation backend under `src/lib/recommendation`, optional LLM scaffolding under `src/lib/llm`, and Next-style API route handlers under `src/app/api`.

The recommendation engine reads the existing data pipeline output from `raw_data/merge_df.csv` at runtime. It does not modify `raw_data`, `v1/prod_data`, `scripts`, frontend pages, or parser-owned files.

## API Contracts

### `POST /api/recommendations`

Returns ranked products after deterministic category filtering, hard ingredient exclusions, strict-mode incomplete-data exclusions, and explainable scoring.

Request:

```json
{
  "goal": {
    "categories": ["shampoo"]
  },
  "concerns": {
    "hair": ["dryness"],
    "scalp": ["itchiness"]
  },
  "preferences": {
    "claims": ["fragrance-free", "sulfate-free"],
    "budget": { "max": 25 },
    "stores": ["Ulta"],
    "minimumRating": 4
  },
  "avoidedIngredients": [
    { "term": "shea butter", "severity": "allergy" }
  ],
  "avoidedIngredientGroups": [
    { "group": "fragrance", "severity": "sensitivity" },
    { "group": "sulfates", "severity": "preference" }
  ],
  "strictSafetyMode": true,
  "limit": 10
}
```

Response:

```json
{
  "results": [
    {
      "product": {
        "id": "12",
        "brand": "Example",
        "name": "Gentle Shampoo",
        "category": "shampoo",
        "price": 14,
        "rating": 4.5,
        "store": "Ulta",
        "dataQuality": "complete"
      },
      "score": 72.5,
      "scoreComponents": {
        "categoryFit": 35,
        "concernFit": 8,
        "rating": 13.5,
        "budgetFit": 10,
        "storeFit": 8,
        "dataCompleteness": 7,
        "preferenceClaims": 0,
        "penalties": -9
      },
      "matchReasons": ["Matches requested shampoo category."],
      "safetyNotes": ["No confirmed matches found for submitted avoided ingredients or groups."]
    }
  ],
  "totalEligible": 1,
  "totalExcluded": 4,
  "appliedFilters": {
    "categories": ["shampoo"],
    "avoidedIngredients": [{ "term": "shea butter", "severity": "allergy" }],
    "avoidedIngredientGroups": [{ "group": "fragrance", "severity": "sensitivity" }],
    "strictSafetyMode": true
  }
}
```

If no products remain, `results` is empty and `noResultsReason` explains whether data is missing or filters removed all matches.

### `GET /api/ingredients/search?q=fragrance&limit=10`

Returns deterministic autocomplete candidates from canonical ingredients, aliases, and supported ingredient groups.

Response:

```json
{
  "query": "fragrance",
  "results": [
    { "canonicalName": "fragrance", "alias": "fragrance" },
    { "canonicalName": "fragrance", "alias": "parfum" }
  ]
}
```

### `GET /api/health`

Returns a lightweight status payload:

```json
{
  "status": "ok",
  "service": "Ingredi-Findr-recommendation-backend",
  "llm": "disabled"
}
```

## Schemas and Validation

Runtime validation is implemented in `src/lib/recommendation/schemas.ts` without external dependencies. It validates:

- Product goal categories.
- Skin, hair, and scalp concerns.
- Preference claims, budget, stores, and minimum rating.
- Avoided ingredients and ingredient groups.
- Exclusion severity: `preference`, `sensitivity`, or `allergy`.
- Recommendation request and response DTO shapes.

Strict safety mode defaults to `true` when any allergy or sensitivity is submitted.

## Safety Rules

Ingredient safety filtering is deterministic:

- A confirmed match to an avoided ingredient excludes the product.
- A confirmed match to an avoided ingredient alias excludes the product.
- A confirmed match to an avoided ingredient group excludes the product.
- `fragrance`, `parfum`, `perfume`, and `aroma` map to the fragrance group.
- `SLS`, `SLES`, `sodium lauryl sulfate`, and `sodium laureth sulfate` map to sulfates.
- In strict safety mode, products with missing or unparseable ingredients are excluded when allergy or sensitivity filters exist.
- The LLM adapter is never used to decide whether an ingredient appears in a product.

## Scoring

Eligible products are scored by:

- Category fit.
- Relevant concern keyword matches in product name/details.
- Rating.
- Budget fit.
- Store preference.
- Product-data completeness.
- Supported preference claims.
- Penalties for missing or unclear data.

Each result includes `scoreComponents`, concise `matchReasons`, and `safetyNotes`.

## LLM Adapter

`src/lib/llm/adapter.ts` is optional and fallback-first. Baseline recommendations work with no API key.

Environment variables:

- `FACE_FINDR_LLM_ENABLED=true` enables the adapter.
- `FACE_FINDR_LLM_API_KEY` supplies the server-side key.
- `FACE_FINDR_LLM_ENDPOINT` overrides the OpenAI-compatible endpoint.
- `FACE_FINDR_LLM_MODEL` defaults to `gpt-5.4-mini`.
- `FACE_FINDR_LLM_TIMEOUT_MS` defaults to `4000`.

Fallback behavior:

- If disabled, unconfigured, timed out, or invalid, the adapter returns a template interpretation.
- LLM outputs are schema-validated before use.
- Unsupported enum values are rejected.
- The adapter is intended for future free-text interpretation and explanation generation only.

## Data Dependencies

The runtime loader expects `raw_data/merge_df.csv` with these columns:

- `index`
- `brand`
- `product`
- `product_type`
- ` price `
- `rating`
- `details`
- `ingredients`
- `url`
- `store`

The loader normalizes category names such as `face cleanser`/`face_cleanser` to `cleanser`, parses numeric price/rating values, and assigns product data-quality flags.

## Integration Steps

1. Add a Next.js app/runtime or wire these route handlers into the chosen backend.
2. Keep the data pipeline producing `raw_data/merge_df.csv` or replace `loadProducts()` with a database adapter.
3. Submit structured quiz state to `POST /api/recommendations`.
4. Use `GET /api/ingredients/search` for avoided ingredient autocomplete.
5. Keep allergy and sensitivity filters explicit in the UI and default strict safety mode to enabled.

## Known Limitations

- No database adapter is included yet; the MVP reads the CSV directly.
- Ingredient parsing is conservative and exact/alias-based; fuzzy matching is intentionally not used for hard exclusions.
- Preference claims are only supported when present in product details or ingredient text.
- Concern scoring uses deterministic keyword matching, not clinical or cosmetic efficacy claims.
- Product images are not available in the current data source.
- The route handlers assume a future Next-style backend; the legacy `v1/server.js` static server was not modified.
