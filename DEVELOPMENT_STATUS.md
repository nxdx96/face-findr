# Development Status

Status as of 2026-07-02: integrated MVP code is present in `branch_v2`, with legacy v1 preserved under `v1/`.

## Complete

- Data audit and normalization scripts run against `raw_data/merge_df.csv`.
- Generated normalized product and ingredient artifacts exist under `data/`.
- Deterministic ingredient parser, alias matching, and ingredient-group matching are available.
- Recommendation engine applies category filters, hard ingredient exclusions, strict-mode incomplete-data exclusions, and explainable scoring.
- API routes exist for recommendations, ingredient autocomplete, and health.
- Frontend onboarding builds normalized recommendation requests and now calls the live API by default.
- Product cards render match reasons, safety notes, retailer links, confidence badges, empty states, and strict-mode controls.
- PostgreSQL catalog schema, migration runner, and legacy import script exist.
- Recommendation loading reads PostgreSQL when `DATABASE_URL` is configured.
- Local PostgreSQL database `ingredi-findr` has been migrated and seeded from the legacy CSV.
- Product cards support product images, retailer CTA links, current price/currency, review counts, availability labels, and fallback media.
- Sephora scraper discovery/upsert is enabled for limited public sitemap/product-page refreshes.
- Ulta scraper discovery/upsert is enabled for limited public sitemap/SKU-page refreshes.
- Ulta-only four-way sharding is enabled for parallel full refreshes; Sephora sharding is blocked.
- Optional LLM adapter has disabled and invalid-output fallbacks.
- Root Next/TypeScript package configuration has been added.

## Validation Status

- Passing: `npm test`
- Passing: `npm run typecheck`
- Passing: `npm run lint`
- Passing: `npm run build`
- Passing: `npm run db:migrate` against local PostgreSQL.
- Passing: `npm run db:import:legacy` against local PostgreSQL; imported 1,718 legacy CSV rows.
- Passing: `npm run scrape:smoke` with network approval; discovered five allowed Sephora product URLs.
- Passing: `npm run scrape:sephora` with network approval; processed 5 pages, created 1 listing, updated 4 listings, failed 0.
- Passing: `npm run scrape:sephora:count` with network approval; discovered 25,989 allowed Sephora product URLs.
- Passing: `npm run scrape:sephora:batch` with network approval; skipped 5 already-refreshed products and processed 95 additional pages, failed 0.
- Passing: `npm run scrape:ulta:count` with network approval; discovered 50,947 allowed Ulta SKU product URLs.
- Passing: `npm run scrape:ulta` with network approval; processed 5 pages, created 5 listings, failed 0.
- Passing: `npm run scrape:ulta:batch` with network approval; skipped 5 already-refreshed products and processed 95 additional pages, failed 0.
- Passing: Ulta shard count validation with network approval; shard 0/4 selected 12,737 of 50,947 URLs.
- Passing: Sephora shard guard validation; shard flags are rejected for Sephora.
- Passing: `node scripts/audit_data.js`
- Passing: `node scripts/normalize_products.js`

## Known Limitations

- Runtime recommendations load PostgreSQL only when `DATABASE_URL` is configured; otherwise they fall back to `raw_data/merge_df.csv`.
- Product images are not available in the legacy scraped dataset; limited scrape batches have populated images for the first 100 refreshed Sephora rows and first 100 refreshed Ulta rows.
- Ingredient alias/group coverage is intentionally initial and should be curated.
- Browser E2E, accessibility automation, and CI workflows are not configured yet.
- Live scraper crawling is limited to low-volume Sephora and Ulta sitemap/product-page refreshes. The full Sephora sitemap currently contains 25,989 allowed product URLs, and the full Ulta sitemap currently contains 50,947 allowed SKU product URLs. Ulta can be run in four shards; Sephora remains single-worker because of crawl-delay policy.
