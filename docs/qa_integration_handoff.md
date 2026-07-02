# QA Integration Handoff

## Test Commands

Run from the repository root:

```powershell
node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js
```

Fallback if the local Node runtime cannot execute `.ts` tests directly:

```powershell
node --test tests/data-pipeline/*.test.js tests/frontend/*.test.js
```

No root `package.json`, CI workflow, Playwright config, Axe setup, or installable root dependency set is currently present. Add those in a product-integration task before requiring `npm test`, `npm run lint`, `npm run typecheck`, or browser E2E checks.

## MVP Acceptance Criteria

### Hard Ingredient Exclusions

- Products containing a confirmed avoided ingredient are excluded from recommendations.
- Products containing a confirmed alias of an avoided ingredient are excluded. Examples: `parfum`, `perfume`, and `aroma` match fragrance; `SLS` and `SLES` match sulfate exclusions.
- Products containing any confirmed member of an avoided ingredient group are excluded.
- `May Contain`, shade-specific, and bundle-section ingredients count as present for hard exclusions unless a future verified shade-level dataset proves otherwise.
- Fuzzy matching may suggest data-cleanup candidates but must not power hard exclusion decisions.

### Strict Mode Behavior

- Strict mode defaults to on whenever a user submits an allergy or sensitivity.
- In strict mode, products with missing, empty, or unparseable ingredient data are excluded when any allergy or sensitivity filter is active.
- Preference-only exclusions may remain non-strict unless the user explicitly enables strict mode.
- Results must show which avoided ingredients/groups were checked and that no confirmed match was found for shown products.

### Incomplete Ingredient Data Behavior

- Missing or unparseable ingredient lists are never treated as evidence that a product is free of an ingredient.
- Non-strict results with incomplete ingredient data must show an uncertainty note such as "Ingredient data is incomplete; safety exclusions cannot be fully confirmed."
- Empty ingredient data must be tracked with a product data-quality status such as `missing-ingredients` or `unparseable-ingredients`.
- Imported product records must preserve the raw ingredient string for traceability.

### Recommendation Transparency

- Each recommendation includes score components, concise match reasons, safety notes, data quality, store, price, rating when available, and a retailer URL only after URL validation.
- Recommendation explanations must be generated from deterministic product facts and validated filters, not invented attributes.
- Empty states must explain whether no product data exists or filters removed all eligible products.
- The app must avoid guarantee language, diagnosis language, and claims that a product is medically suitable or reaction-free.

### Free-Text AI Fallback Behavior

- Free-text notes are optional and sensitive.
- The app must work with the LLM disabled or unconfigured.
- If the LLM fails, times out, returns invalid JSON, or returns unsupported enum values, the system falls back to deterministic quiz inputs and template parsing.
- LLM-inferred filters are suggestions until the user confirms them.
- LLM prompts must not include direct identifiers and must not be logged with raw allergy/sensitivity notes.

### Accessibility And Mobile Flow

- The MVP should meet WCAG 2.2 AA contrast.
- The onboarding flow, ingredient autocomplete, review step, strict-mode toggle, filters, and result links must be keyboard accessible.
- Every input and interactive control must have a programmatic accessible name.
- Focus states must be visible and focus order must follow the visual flow.
- Safety and data-quality status cannot rely on color alone.
- Motion must respect reduced-motion preferences.
- Mobile layouts must support category selection, avoided ingredient entry, review, empty results, and filter adjustments without horizontal scrolling or clipped text.

## Risks And Blockers

- There is no root package manifest or CI workflow, so full Next.js build, lint, typecheck, Playwright, and Axe checks are not currently runnable from the root.
- Scraped product details and ingredient text are untrusted and may contain malformed text, retailer claims, or unsafe HTML-like content. Product rendering must escape/sanitize these fields.
- External product URLs are scraped data. Final integration must validate protocol and domain expectations before rendering clickable links.
- Some product claims in details may be retailer marketing text. Claims such as fragrance-free, dermatologist-tested, vegan, and cruelty-free must be shown only with source confidence and without medical guarantees.
- The current deterministic parser is intentionally conservative. It may miss complex INCI variants until the alias/group tables are expanded.
- Product images are not available in the current data source.
- The database schema/import task is not complete in this repository state; normalized JSON exists, but production Postgres/Prisma migration verification remains a cross-agent dependency.

## Cross-Agent Dependencies

- Data pipeline owner must provide a repeatable import that emits normalized product records, ingredient tokens, parse confidence, data-quality flags, canonical ingredients, aliases, and ingredient groups.
- Backend owner must keep recommendation filtering deterministic and enforce request validation, rate limits, logging redaction, URL validation, and server-side secret handling.
- Frontend owner must wire the onboarding flow to backend APIs, preserve explicit user confirmation of inferred filters, and display safety/disclaimer copy near relevant inputs and results.
- Accessibility owner must add browser-level keyboard, focus, mobile, and Axe checks once the root app runtime and Playwright/Axe dependencies exist.
- Integration owner must add root-level package scripts and CI before treating this as release-ready.

## Final Integration Task Must Verify

- `node --test` passes for backend, data-pipeline, and frontend contract tests in the target Node version.
- Root package scripts exist and run: lint, typecheck, build, unit tests, and browser E2E/accessibility checks.
- Hard exclusions remove products for exact ingredient, alias, group, and `May Contain` matches.
- Strict mode excludes incomplete ingredient data when allergy/sensitivity filters are active.
- Non-strict incomplete-data results display uncertainty.
- LLM-disabled and invalid-output paths still produce usable, deterministic behavior.
- No raw free-text allergy/sensitivity notes, model prompts, API keys, or authorization headers appear in application logs.
- Scraped text is escaped/sanitized and scraped URLs are validated before rendering.
- Approved disclaimer copy appears near allergy/sensitivity entry and recommendation results.
- Mobile and keyboard-only users can complete onboarding, review inferred filters, inspect recommendations, and recover from empty results.
