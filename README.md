# Face-Findr V2

Face-Findr V2 is a deterministic beauty recommendation MVP for makeup, skincare, and haircare products. A user completes onboarding, submits structured preferences to `POST /api/recommendations`, and receives ranked product cards with match reasons, safety notes, and ingredient data-quality labels.

The legacy application is preserved under `v1/`. The V2 app lives under `src/` and uses the scraped dataset in `raw_data/merge_df.csv`.

## Safety Model

- Hard ingredient exclusions are deterministic and use parser, alias, and ingredient-group matching.
- LLM output is never allowed to decide whether a product contains an avoided ingredient.
- Strict safety mode defaults on for allergies and sensitivities.
- In strict safety mode, products with missing or unparseable ingredient data are excluded when allergy or sensitivity filters are active.
- Recommendations are informational. Face-Findr does not diagnose, treat, or guarantee that any product is safe or reaction-free.

## Setup

Prerequisites:

- Node.js 22 or newer.
- npm 11 or newer.

Install dependencies:

```powershell
npm install
```

Run the V2 app:

```powershell
npm run dev
```

Then open `http://localhost:3000`.

Optional local mock mode:

```powershell
$env:NEXT_PUBLIC_FACE_FINDR_USE_MOCKS="true"
npm run dev
```

Mock mode is isolated in `src/components/recommendationsClient.ts`; the default frontend path calls the live API routes.

## Data Commands

```powershell
npm run data:audit
npm run data:normalize
```

Generated outputs:

- `docs/data_audit_report.md`
- `data/normalized_products.json`
- `data/product_ingredients.json`

Current audit summary: 1,718 rows, 2 missing ingredient lists, 43 invalid prices, 6 invalid ratings, 2 malformed URLs, and 1 unknown category row.

## Quality Commands

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

The Node test suite can also run without installed root dependencies:

```powershell
node --test tests/backend/*.test.ts tests/data-pipeline/*.test.js tests/frontend/*.test.js
```

## Environment Variables

LLM integration is optional and disabled by default:

- `FACE_FINDR_LLM_ENABLED=true`
- `FACE_FINDR_LLM_API_KEY`
- `FACE_FINDR_LLM_ENDPOINT`
- `FACE_FINDR_LLM_MODEL` defaults to `gpt-5.4-mini`
- `FACE_FINDR_LLM_TIMEOUT_MS` defaults to `4000`

Frontend local mock mode:

- `NEXT_PUBLIC_FACE_FINDR_USE_MOCKS=true`

No API key is required for the deterministic MVP flow.

## API Contracts

See [docs/api_contract.md](docs/api_contract.md).
