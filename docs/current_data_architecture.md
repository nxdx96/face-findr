# Current Data Architecture

## Current State

Ingredi-Findr v2 is a Next.js app with API routes under `src/app/api`, deterministic recommendation logic under `src/lib/recommendation`, and product cards in `src/components/RecommendationResults.tsx`.

The active product source is still the legacy scrape CSV at `raw_data/merge_df.csv`. `src/lib/recommendation/products.ts` reads that file at runtime, parses CSV rows, and maps each row into the in-memory `Product` shape used by `recommendProducts`. The generated `data/normalized_products.json` and `data/product_ingredients.json` artifacts are produced by `scripts/normalize_products.js`, but runtime recommendations do not currently read those generated files.

Existing source fields are `index`, `brand`, `product`, `product_type`, `price`, `rating`, `details`, `ingredients`, `url`, and `store`. Product image URLs, availability state, review counts, scrape run metadata, and stable retailer product identifiers are not present in the committed CSV.

No current Prisma schema, PostgreSQL migration, or database client exists. The legacy `v1/pg_table.sql` is a small historic SQL file and is not wired to the Next.js application. Existing tests use Node's built-in test runner and mostly exercise schema validation, deterministic recommendation filtering, ingredient parsing, and static frontend contracts.

## Existing Scraper And Selenium Usage

The current repository does not include an active Selenium scraper in the v2 code path. The legacy `v1` folder contains the older static app and CSV/JSON outputs, but no maintained scraper orchestration. The current scrape result is represented by committed CSV files in `raw_data/`.

## Product Data Pipeline

`scripts/audit_data.js` audits `raw_data/merge_df.csv`. `scripts/normalize_products.js` uses `scripts/pipeline.js` to normalize product rows, map categories from `data/category_taxonomy.json`, extract deterministic attributes from product details, and parse ingredient tokens through `src/lib/ingredients`.

Generated full-catalog JSON artifacts are useful for audit and migration but should stop being the active application dataset. A small fixture is acceptable for local tests, but refreshed product catalog data should live in PostgreSQL.

## Recommendation Dependencies

`POST /api/recommendations` validates the request, loads products through `loadProducts()`, then runs `recommendProducts()`. The engine expects each product to include identity, category, price, rating, details, raw ingredient text, URL, store, and data quality. Ingredient exclusion decisions are deterministic and use exact normalized aliases/groups, not an LLM.

## Product Card Limitations

Product cards currently display brand initials instead of real product images. They show price, rating, and retailer text, but there is no external retailer CTA, image fallback logic, availability label, stale data warning, review count, or canonical retailer URL validation.

## Target State

PostgreSQL is the source of truth for products, brands, categories, ingredients, retailer listings, price/image/link metadata, availability, and scrape history. Runtime recommendations load product records from PostgreSQL, with the legacy CSV importer used only to seed useful historic data.

The application response shape should include product image URL, canonical product page URL, retailer display name, current price/currency, rating/review count, availability status, ingredient data confidence, match reasons, and safety notes. Product cards should render a responsive image when available and a safe external link such as `View at Sephora` or `View at Ulta`.

## Files Likely To Change

- `migrations/001_product_catalog.sql`
- `scripts/db_migrate.js`
- `scripts/import_legacy_catalog.js`
- `src/lib/catalog/db.ts`
- `src/lib/recommendation/products.ts`
- `src/lib/recommendation/schemas.ts`
- `src/app/api/recommendations/route.ts`
- `src/components/RecommendationResults.tsx`
- `scrapers/**`
- `tests/backend/**`
- `tests/frontend/**`
- `README.md`

## Risks And Blockers

- A live `DATABASE_URL` is required to prove the application is fully database-backed locally.
- The legacy CSV does not contain image URLs, availability, review counts, or stable retailer product IDs for every row.
- Retailer pages can change structure and access rules; scraper adapters must fail closed and log extraction failures.
- Public scrape behavior must obey robots, terms, rate limits, and only access public product/category/sitemap pages.
- Ingredient parsing remains deterministic and conservative; alias/group coverage needs curation over time.

## Sephora And Ulta Support

Sephora and Ulta can be supported for public product catalog refreshes if the crawler limits itself to public sitemap/category/product URLs, avoids account/cart/checkout/search flows, honors robots rules and crawl delays, and stores only product facts needed by the catalog.

As of July 6, 2026, `https://www.sephora.com/robots.txt` disallows private and high-risk paths such as basket, checkout, account/profile, search, browse, and `/gway/`, and declares `Crawl-delay: 5`. `https://www.ulta.com/robots.txt` disallows account/auth/wishlist-like areas for relevant agents and publishes sitemap indexes. This supports a conservative adapter strategy, not broad browser automation.
