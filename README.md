# Face-Findr V2 Integration Notes

Face-Findr V2 is being prepared as a deterministic beauty recommendation MVP. The current repository contains a v2 skeleton under `src/`, normalized data artifacts under `data/`, legacy v1 assets under `v1/`, and tests under `tests/`.

This project must treat allergies, sensitivities, skin/scalp/hair concerns, and free-text notes as sensitive preference data. Recommendations are informational and must be based on available product and ingredient data.

## Local Setup

Prerequisites:

- Node.js with built-in `node:test` support and TypeScript import support for the existing `.ts` tests.
- No root package manifest is currently present. Do not run dependency installation from the repository root until a root `package.json` is added.
- The legacy v1 static app has its own `v1/package.json`; it is separate from the v2 skeleton.

Useful commands:

```powershell
node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js
node --test tests/data-pipeline/*.test.js tests/frontend/*.test.js
```

The first command is the intended full quality check. The second command is a fallback if the local Node runtime cannot execute TypeScript test files directly.

## Environment Variables

The LLM adapter is disabled unless explicitly enabled:

- `FACE_FINDR_LLM_ENABLED=true` enables an OpenAI-compatible backend-only adapter.
- `FACE_FINDR_LLM_API_KEY` stores the server-side model key. Never expose this to frontend code.
- `FACE_FINDR_LLM_ENDPOINT` overrides the chat-completions endpoint.
- `FACE_FINDR_LLM_MODEL` defaults to `gpt-5.4-mini`.
- `FACE_FINDR_LLM_TIMEOUT_MS` defaults to `4000`.

Production integration must redact or avoid logging raw free-text notes, allergy terms, sensitivities, API keys, request headers containing secrets, and model prompts containing user-entered sensitive preference data.

## Data And Import Assumptions

- `raw_data/merge_df.csv` is the source dataset described by the implementation plan.
- Normalized artifacts in `data/` are generated/reference data and should remain traceable to scraped source fields.
- Scraped product names, details, ingredients, URLs, stores, and claims are untrusted input.
- Product URLs must be validated before rendering or linking. Only `http:` and `https:` retailer URLs should be clickable.
- Missing or unparseable ingredient lists are not safe evidence that a product avoids an ingredient.

## Security And Privacy Expectations

- Use schema validation for every API request.
- Apply hard ingredient exclusions deterministically from parsed ingredients, aliases, and ingredient groups.
- Never use an LLM to decide whether a product contains an avoided ingredient.
- Default strict safety mode to enabled when a user enters an allergy or sensitivity.
- Keep API keys server-side and use HTTPS in production.
- Sanitize scraped text before rendering.
- Do not store raw free-text health/allergy notes unless the user explicitly saves a profile.
- Provide anonymous recommendations without account creation for MVP.

## Approved Disclaimer Language

Use this language in the app near allergy inputs and recommendation results:

> Face-Findr recommendations are informational and based on available product and ingredient data. Ingredient lists can be incomplete or change over time, so Face-Findr cannot guarantee that a product is safe, medically suitable, or reaction-free. Patch test when appropriate and consult a dermatologist, allergist, or medical professional for severe allergies, persistent symptoms, or reactions.

Avoid claims such as "safe for allergies", "dermatologist approved for you", "guaranteed non-reactive", or diagnosis/treatment language.

## Current Quality Checks

Tests currently cover:

- Ingredient parsing and alias/group matching.
- Recommendation hard exclusions and strict-mode incomplete-data behavior.
- Recommendation schema validation.
- LLM disabled/invalid-output fallback behavior.
- Static frontend contract checks for safety copy and required UI text.

See [docs/qa_integration_handoff.md](docs/qa_integration_handoff.md) for MVP acceptance criteria, risks, blockers, and final integration checks.
