# Face-Findr V2 Frontend Handoff

## Routes

- `/`: Next app route in `src/app/page.tsx`. Renders the modern v2 shell and onboarding/results experience.

The legacy v1 assets are left under `v1/` and are not modified by this frontend MVP.

## Components

- `src/components/AppShell.tsx`: Sticky header, brand mark, and page shell.
- `src/components/OnboardingFlow.tsx`: Client-side quiz state, conditional category flow, concern chips, preferences, avoided ingredients, plain-language notes, and review step.
- `src/components/RecommendationResults.tsx`: Results toolbar, sorting, strict-mode toggle, empty state, and product cards.
- `src/components/SafetyNotice.tsx`: Reusable ingredient uncertainty and safety-language notice.
- `src/components/DataConfidenceBadge.tsx`: Ingredient data confidence label.
- `src/components/recommendationsClient.ts`: Typed mock recommendation and ingredient-search client. Swap internals to call backend APIs later.

## Data Contracts

The frontend imports existing types from `src/lib/recommendation/schemas`:

- `RecommendationRequest`
- `RecommendationResponse`
- `RecommendationResult`
- `ProductDataQuality`
- concern, preference, category, ingredient group, and severity enums

Planned API swap points:

- `fetchRecommendations(request)` should become `POST /api/recommendations`.
- `fetchIngredientSuggestions(query)` should become `GET /api/ingredients/search?q=...`.

React components should continue to call only the frontend client module, not backend logic directly.

## Setup

This repository currently does not include an editable root frontend package or Next configuration in the allowed ownership boundary. The added files assume a standard Next.js app-router setup with TypeScript and global CSS support:

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/styles/globals.css`

If the project root package is restored or added later, expected commands are typically:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test` or `node --test`

## Known Limitations

- Results use mock products and simple frontend filtering only.
- Ingredient autocomplete uses a small local mock list.
- Plain-language inference is a transparent frontend placeholder, not an LLM service.
- No product images are available, so product cards use brand initials and gradients.
- No backend route, database, or recommendation-engine files were changed.
- A full Next build cannot be verified until root frontend package/config files exist.
