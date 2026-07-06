# Ingredi-Findr V2

Ingredi-Findr V2 is a Next.js MVP for deterministic beauty product recommendations across makeup, skincare, and haircare. Users complete a structured onboarding flow, submit preferences and ingredient constraints, and receive ranked products with match reasons, safety notes, and ingredient data-quality labels.

The project is designed around a safety-first recommendation model: ingredient exclusions are handled deterministically by parser, alias, and ingredient-group matching. Optional LLM integration can support copy or enrichment workflows, but it does not decide whether a product contains an avoided ingredient.

## Key Features

- Structured onboarding for category, concern, budget, store, rating, and claim preferences.
- Deterministic recommendation engine with transparent scoring components.
- Ingredient avoidance by exact term, aliases, and supported ingredient groups.
- Strict safety mode for allergy and sensitivity filters.
- Data-quality labels for complete, partial, missing, or unparseable ingredient data.
- API routes for recommendations, ingredient search, and runtime health checks.
- Data audit and normalization scripts for the scraped product dataset.

## Project Structure

```text
src/                 V2 Next.js application
src/app/api/         API routes
src/components/      Onboarding and recommendation UI
src/lib/             Recommendation, ingredient, and LLM logic
scripts/             Data audit and normalization scripts
data/                Generated normalized data outputs
raw_data/            Source scraped dataset
docs/                API and data documentation
tests/               Backend, frontend, and data-pipeline tests
v1/                  Preserved legacy application
```

## Requirements

- Node.js 22 or newer
- npm 11 or newer

## Getting Started

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Open `http://localhost:3000` in your browser.

### Mock Mode

The default frontend path calls the live API routes. To run the frontend against local mock recommendation data:

```powershell
$env:NEXT_PUBLIC_FACE_FINDR_USE_MOCKS="true"
npm run dev
```

Mock behavior is isolated in `src/components/recommendationsClient.ts`.

## Available Scripts

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
```

The test suite can also be run directly with Node:

```powershell
node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js
```

## Data Pipeline

The V2 app uses the scraped source dataset at `raw_data/merge_df.csv`.

Audit the raw product data:

```powershell
npm run data:audit
```

Normalize product and ingredient records:

```powershell
npm run data:normalize
```

Generated outputs:

- `docs/data_audit_report.md`
- `data/normalized_products.json`
- `data/product_ingredients.json`

Current audit summary:

- 1,718 rows
- 2 missing ingredient lists
- 43 invalid prices
- 6 invalid ratings
- 2 malformed URLs
- 1 unknown category row

## API Overview

The app exposes three primary API routes:

- `POST /api/recommendations` returns deterministic ranked product recommendations.
- `GET /api/ingredients/search` returns ingredient and ingredient-group autocomplete candidates.
- `GET /api/health` returns basic runtime status.

See [docs/api_contract.md](docs/api_contract.md) for request and response details.

## Safety Model

Ingredi-Findr is intentionally conservative about ingredient filtering:

- Hard ingredient exclusions are deterministic.
- Alias and ingredient-group matching are applied before ranking.
- LLM output is never trusted for ingredient exclusion decisions.
- Strict safety mode is enabled by default when allergy or sensitivity filters are present.
- In strict safety mode, products with missing or unparseable ingredient data are excluded when allergy or sensitivity filters are active.
- `May Contain` and shade or bundle ingredient variants count as present for exclusions.

Recommendations are informational only. Ingredi-Findr does not diagnose, treat, or guarantee that any product is safe or reaction-free.

## Environment Variables

No API key is required for the deterministic MVP flow.

Optional LLM integration:

```text
FACE_FINDR_LLM_ENABLED=true
FACE_FINDR_LLM_API_KEY=
FACE_FINDR_LLM_ENDPOINT=
FACE_FINDR_LLM_MODEL=gpt-5.4-mini
FACE_FINDR_LLM_TIMEOUT_MS=4000
```

Frontend mock mode:

```text
NEXT_PUBLIC_FACE_FINDR_USE_MOCKS=true
```

## Development Notes

- V2 application code lives in `src/`.
- The legacy app is preserved in `v1/`.
- API request validation types are defined in `src/lib/recommendation/schemas.ts`.
- Recommendation logic is centered in `src/lib/recommendation/engine.ts`.
- Ingredient parsing and matching utilities live under `src/lib/ingredients/` and `src/lib/recommendation/ingredients.ts`.
