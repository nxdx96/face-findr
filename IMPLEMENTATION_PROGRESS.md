# Implementation Progress

## What Was Integrated

- Data pipeline artifacts were regenerated from `raw_data/merge_df.csv`.
- Backend recommendation routes and deterministic engine were kept as the source of truth for filtering and scoring.
- Frontend recommendation and ingredient-search client was switched from mock-only behavior to live API calls.
- Mock recommendation data remains available only when `NEXT_PUBLIC_FACE_FINDR_USE_MOCKS=true`.
- Root Next.js, TypeScript, ESLint, and npm script configuration was added.
- README, development status, and API contract documentation were updated.

## Files Changed

- `.gitignore`
- `.eslintrc.json`
- `package.json`
- `next.config.mjs`
- `next-env.d.ts`
- `tsconfig.json`
- `README.md`
- `DEVELOPMENT_STATUS.md`
- `IMPLEMENTATION_PROGRESS.md`
- `docs/api_contract.md`
- `docs/data_audit_report.md`
- `data/normalized_products.json`
- `data/product_ingredients.json`
- `src/components/OnboardingFlow.tsx`
- `src/components/RecommendationResults.tsx`
- `src/components/recommendationsClient.ts`

## Commands Run And Outcomes

- `git status --short --branch`: current branch is `branch_v2`.
- `git branch --all --verbose`: no local parallel feature branches beyond `branch_v2`; legacy remote branches remain.
- `git worktree list`: only the main worktree is registered.
- `node scripts/audit_data.js`: passed; audited 1,718 rows and wrote `docs/data_audit_report.md`.
- `node scripts/normalize_products.js`: passed; normalized 1,718 products and parsed 67,625 ingredient tokens.
- `node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js`: passed, 23/23 tests.
- `npm install`: timed out after 120 seconds; no lockfile produced.
- `npm install`: retried with 300 second timeout; timed out again.
- `npm test`: passed, 23/23 tests.
- `npm run typecheck`: failed because `tsc` was not installed.
- `npm run lint`: failed because `next` was not installed.
- `npm run build`: failed because `next` was not installed.

## Tests Passing

- Backend schema validation tests.
- Recommendation hard-exclusion and strict-mode tests.
- LLM disabled and invalid-output fallback tests.
- Data pipeline ingredient parser, alias, group, and normalization tests.
- Static frontend MVP contract tests.

## Tests Skipped Or Blocked

- `npm run lint`: blocked by incomplete dependency install.
- `npm run typecheck`: blocked by incomplete dependency install.
- `npm run build`: blocked by incomplete dependency install.
- Browser E2E and accessibility tests: not configured in this repository yet.
- Database import validation: blocked because no Postgres/Prisma schema or seed command exists.

## Known Limitations

- Runtime product loading is CSV-based, not database-backed.
- No product images are available.
- Alias and ingredient-group data need ongoing curation.
- Full dependency installation did not complete in this environment.
- The partial root `node_modules` directory from the timed-out install was removed to avoid misleading local state.

## Required Environment Variables

- None required for deterministic recommendations.
- `NEXT_PUBLIC_FACE_FINDR_USE_MOCKS=true` enables isolated frontend local mocks.
- `FACE_FINDR_LLM_ENABLED=true` enables optional backend LLM interpretation.
- `FACE_FINDR_LLM_API_KEY` is required only when LLM integration is enabled.
- `FACE_FINDR_LLM_ENDPOINT`, `FACE_FINDR_LLM_MODEL`, and `FACE_FINDR_LLM_TIMEOUT_MS` are optional LLM overrides.

## Local Setup And Run Instructions

```powershell
npm install
npm run data:audit
npm run data:normalize
npm test
npm run dev
```

Open `http://localhost:3000`.

If dependency install remains unavailable, the currently runnable validation command is:

```powershell
node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js
```

## Next Three Highest-Priority Tasks

1. Complete dependency installation and run `npm run lint`, `npm run typecheck`, and `npm run build`.
2. Add Playwright plus accessibility checks for onboarding, ingredient autocomplete, strict-mode toggling, results, and mobile layouts.
3. Add a Postgres/Prisma schema and repeatable seed/import path for normalized products and parsed ingredients.
