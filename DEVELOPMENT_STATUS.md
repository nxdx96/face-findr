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
- Optional LLM adapter has disabled and invalid-output fallbacks.
- Root Next/TypeScript package configuration has been added.

## Validation Status

- Passing: `node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js`
- Passing: `node scripts/audit_data.js`
- Passing: `node scripts/normalize_products.js`
- Blocked: `npm run lint`, `npm run typecheck`, and `npm run build` because `npm install` timed out twice before installing `next` or `typescript`.

## Known Limitations

- No Postgres/Prisma schema or database import has been completed; runtime recommendations currently load `raw_data/merge_df.csv`.
- Product images are not available in the scraped dataset; cards use brand initials.
- Ingredient alias/group coverage is intentionally initial and should be curated.
- Browser E2E, accessibility automation, and CI workflows are not configured yet.
- External product URLs are validated during data audit, but route-level URL allowlisting is not implemented.
