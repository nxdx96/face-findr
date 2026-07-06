# Scraper Database Migration Plan

## Selected Architecture

Use PostgreSQL plus plain SQL migrations as the catalog system of record. Use `pg` from the Next.js API and Node import scripts. This repository does not currently use Prisma, and plain migrations fit the existing lightweight script-based pipeline without adding an ORM migration layer.

Use adapter-isolated scraping with a Scrapy-first operating model for high-volume discovery and refreshes. For this TypeScript app, the committed implementation starts with shared adapter contracts, parser utilities, a dry-run smoke command, and a limited live Sephora runner. If production crawling grows, the same adapter contract can be implemented by Scrapy spiders writing extracted product records into the same database upsert pipeline. Use Playwright only for product pages where public structured data cannot be fetched and parsed directly. Do not use Selenium for new work because there is no active maintained Selenium dependency here and Selenium would add slower, heavier browser automation without a current technical advantage.

## Current State

- Runtime recommendations load `raw_data/merge_df.csv`.
- Full generated normalized JSON exists under `data/`.
- No Postgres/Prisma schema is wired into the app.
- Product cards lack image URLs and external retailer CTA buttons.
- Existing source data has retailer URLs, prices, ratings, details, raw ingredients, categories, brands, and store names.
- Existing source data does not reliably include image URLs, availability, review counts, or retailer product IDs.

## Target State

- PostgreSQL tables hold retailers, brands, categories, products, retailer product listings, ingredients, ingredient aliases/groups, scrape runs, and scrape failures.
- Legacy CSV data is imported into PostgreSQL once, then the recommendation API reads the catalog from PostgreSQL.
- Scraper adapters extract public Sephora and Ulta product facts and call an idempotent upsert pipeline.
- Generated exports, raw HTML, screenshots, caches, and temporary scrape artifacts are ignored by Git.
- Product cards show image fallback, retailer display name, current price/currency, rating/review count when available, availability/staleness labels, and a safe external retailer link.

## Files Likely To Change

- `migrations/001_product_catalog.sql`
- `scripts/db_migrate.js`
- `scripts/import_legacy_catalog.js`
- `scripts/run_scrape.js`
- `src/lib/catalog/db.ts`
- `src/lib/recommendation/products.ts`
- `src/lib/recommendation/schemas.ts`
- `src/components/RecommendationResults.tsx`
- `scrapers/base/*`
- `scrapers/sephora/*`
- `scrapers/ulta/*`
- `scrapers/pipelines/*`
- `docs/current_data_architecture.md`
- `docs/scraper_database_migration_plan.md`
- `README.md`
- `IMPLEMENTATION_PROGRESS.md`

## Migration Order

1. Add database schema migrations and migration runner.
2. Add legacy CSV import that upserts retailers, brands, categories, products, retailer listings, ingredients, aliases, and group membership.
3. Update recommendation product loading to prefer PostgreSQL and map database rows to the existing deterministic recommendation engine.
4. Extend the API/product DTO with image, URL, currency, availability, review count, and retailer fields.
5. Update product cards to render images, fallback media, retailer price, availability labels, and safe retailer buttons.
6. Add adapter contracts, parser utilities, and smoke-runner scaffolding for Sephora and Ulta.
7. Add tests for schema text, import mapping/upsert helpers, URL validation, recommendation DTO fields, and frontend card requirements.
8. Run migrations/import/tests/typecheck/build where the environment allows.
9. Run a limited Sephora scrape and verify image, price, and link upserts before expanding batch size.

## Scraper Upsert Rules

- Prefer a stable retailer product ID when available.
- Otherwise match by retailer plus canonical URL.
- As a final conservative fallback, match by retailer plus normalized brand and normalized product name.
- Update existing retailer listing rows on each scrape instead of inserting duplicates.
- Track `last_scraped_at`, `last_seen_at`, `raw_source_hash`, price, image, rating, review count, availability, and canonical URL changes.
- Mark stale or unavailable listings instead of deleting records immediately.
- Log scrape failures with URL, error type, error message, retryability, and scrape run ID.

## Sephora And Ulta Feasibility

Sephora and Ulta are supportable for a limited public catalog refresh only if the implementation obeys each site's current robots rules and does not access account, cart, checkout, or logged-in content. Sephora declares a crawl delay, so the Sephora adapter defaults to low concurrency and at least a five-second delay. Ulta publishes sitemap indexes that can be used for discovery. Product extraction should first try public structured data such as JSON-LD or embedded product state. Playwright should be a fallback only for pages that do not expose enough public HTML/structured data through direct fetches.

## Risks And Blockers

- Retailer page markup and embedded state may change without notice.
- Network access and retailer access rules cannot be fully validated in this sandbox.
- The legacy catalog does not include images, so images appear only after scraper refreshes or a retailer feed import.
- `DATABASE_URL` and a running PostgreSQL instance are required for runtime catalog reads and import validation.
- Dependency installation timed out previously in this environment; `pg` must be installed before database scripts can run.
