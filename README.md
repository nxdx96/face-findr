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
- PostgreSQL product catalog migrations and legacy CSV import scripts.
- Adapter-based Sephora and Ulta scraper parser scaffolding for public product data refreshes.

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
- PostgreSQL 15 or newer for database-backed recommendations

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
npm run db:migrate
npm run db:import:legacy
npm run scrape:smoke
npm run scrape:sephora
npm run scrape:sephora:count
npm run scrape:sephora:batch
npm run scrape:sephora:all
npm run scrape:ulta
npm run scrape:ulta:count
npm run scrape:ulta:batch
npm run scrape:ulta:all
npm run scrape:ulta:all:shard0
npm run scrape:ulta:all:shard1
npm run scrape:ulta:all:shard2
npm run scrape:ulta:all:shard3
```

The test suite can also be run directly with Node:

```powershell
node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js
```

## Database And Data Pipeline

The V2 app uses PostgreSQL as the production product catalog when `DATABASE_URL` is configured. The legacy scraped source dataset at `raw_data/merge_df.csv` is still available as an import source and local fallback.

Required database environment variable:

```text
DATABASE_URL=postgres://user:password@localhost:5432/ingredi_findr
```

Run migrations:

```powershell
npm run db:migrate
```

Import usable legacy CSV data into PostgreSQL:

```powershell
npm run db:import:legacy
```

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

The full generated catalog should not be treated as the active application source. Scrape exports, raw HTML, screenshots, and cache files are ignored by Git.

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

Recommendation product cards display product images when present, graceful fallback media when absent, retailer name, current price/currency when available, rating/review count when available, availability/staleness copy, and a safe external `View at Sephora` or `View at Ulta` link.

## Scraper Smoke Test

The scraper architecture isolates retailer logic behind adapters under `scrapers/`. The smoke command validates Sephora sitemap discovery without writing to the database:

```powershell
npm run scrape:smoke
```

Run a limited committed Sephora refresh:

```powershell
$env:DATABASE_URL="postgres://user:password@localhost:5432/ingredi_findr"
npm run scrape:sephora
```

The default Sephora run discovers public product URLs from `https://www.sephora.com/sitemap.xml`, skips disallowed paths, uses a five-product limit, waits five seconds between product pages, extracts public product metadata, and upserts into PostgreSQL with scrape-run/failure logging.

For larger Sephora refreshes:

```powershell
npm run scrape:sephora:count
npm run scrape:sephora:batch
npm run scrape:sephora:all
```

`scrape:sephora:batch` processes up to 100 not-yet-refreshed product URLs. `scrape:sephora:all` processes the full currently discoverable Sephora sitemap and skips products that already have scraped images. As of July 6, 2026, Sephora's public sitemap discovery returns 25,989 allowed product URLs; with the required five-second delay, a full run is an overnight/multi-day job.

Sephora and Ulta refreshes should use public product/category/sitemap data only, honor robots rules and delays, avoid account/cart/checkout flows, and keep raw scrape artifacts out of Git.

Ulta uses SKU-level product URLs from `https://www.ulta.com/sitemap/index.xml`. Run:

```powershell
npm run scrape:ulta:count
npm run scrape:ulta:batch
npm run scrape:ulta:all
```

As of July 6, 2026, Ulta public sitemap discovery returns 50,947 allowed SKU product URLs. The batch command processes up to 100 not-yet-refreshed SKU URLs and skips rows that already have scraped images.

For faster Ulta-only full refreshes, run the four shard commands in separate terminals:

```powershell
npm run scrape:ulta:all:shard0
npm run scrape:ulta:all:shard1
npm run scrape:ulta:all:shard2
npm run scrape:ulta:all:shard3
```

Shard flags are intentionally rejected for Sephora. Each Ulta shard still uses the configured per-process delay and `--skip-existing-images`, so interrupted shards can be rerun safely.

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
