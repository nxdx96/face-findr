# Ingredi-Findr V2 API Contract

## `POST /api/recommendations`

Accepts a normalized quiz request and returns deterministic ranked recommendations.

Request shape is defined by `RecommendationRequest` in `src/lib/recommendation/schemas.ts`.

Required fields:

```json
{
  "goal": {
    "categories": ["skincare"]
  }
}
```

Supported optional fields:

- `concerns.skin`, `concerns.hair`, `concerns.scalp`
- `preferences.claims`, `preferences.budget`, `preferences.stores`, `preferences.minimumRating`
- `avoidedIngredients`: `{ "term": "fragrance", "severity": "allergy" }`
- `avoidedIngredientGroups`: `{ "group": "sulfates", "severity": "sensitivity" }`
- `strictSafetyMode`
- `limit`

Response shape is `RecommendationResponse` from `src/lib/recommendation/schemas.ts`:

- `results[]`
- `totalEligible`
- `totalExcluded`
- `appliedFilters`
- `noResultsReason`

Each result includes:

- `product`: identity, category, current price/currency, rating/review count, retailer name/slug, product image URL, canonical retailer URL, availability/staleness state, and `dataQuality`
- `score`
- `scoreComponents`
- `matchReasons`
- `safetyNotes`

Safety constraints:

- Ingredient exclusions use deterministic parser and alias/group matching only.
- `May Contain` and shade/bundle parsed ingredients count as present for exclusions.
- Missing or unparseable ingredient data is excluded in strict safety mode when allergy or sensitivity filters exist.
- Retailer links open directly to public Sephora or Ulta product pages; the app does not embed retailer pages.
- Price, availability, ingredients, and ratings are based on the latest imported/scraped catalog data and are not guaranteed current.
- Response copy must avoid medical guarantees or diagnosis/treatment claims.

## `GET /api/ingredients/search`

Autocomplete endpoint for deterministic ingredient and ingredient-group candidates.

Query:

```text
/api/ingredients/search?q=fragrance&limit=10
```

Response:

```json
{
  "query": "fragrance",
  "results": [
    {
      "canonicalName": "fragrance",
      "alias": "parfum",
      "group": "fragrance"
    }
  ]
}
```

## `GET /api/health`

Returns basic runtime status and whether LLM integration is enabled.
