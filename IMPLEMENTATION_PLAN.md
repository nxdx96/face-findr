# Face-Findr Version 2 Implementation Plan

## 1. Review of the existing codebase and scraped dataset

Face-Findr v1 is a portfolio-style beauty discovery app that uses a clickable face map to explore a limited set of makeup categories. The current application is built with static HTML, vanilla JavaScript, Bootstrap, p5.js, D3, Plotly, a small Express static server, a Flask data-prep script, and CSV/JSON product data.

Current repo facts:

- `index.html`, `static/css`, and `js/` contain the v1 single-page experience.
- `server.js` serves the existing static app with Express.
- `app.py` converts CSV files in `prod_data/` into `makeup_data.json`; it is not a production recommendation API.
- `raw_data/merge_df.csv` is the best foundation for v2 because it includes the full merged scraped dataset.
- `prod_data/` contains top/bottom 10 CSV slices used by v1 visualizations, but those files are too narrow for personalized recommendations.
- Existing product fields are `index`, `brand`, `product`, `product_type`, `price`, `rating`, `details`, `ingredients`, `url`, and `store`.
- Current scraped categories include makeup, skincare, and haircare data such as blush, eyeliner, eyeshadow, foundation, shampoo, conditioner, face cleanser, face moisturizer, moisturizer, and face wash.

Assumption: v2 should use `raw_data/merge_df.csv` as the source of truth, while keeping `prod_data/` only as legacy/reference output.

## 2. Data audit and normalization plan for product names, brands, categories, ingredient lists, and product attributes

Start v2 by creating a repeatable data audit script that reads `raw_data/merge_df.csv` and produces a data-quality report before any recommendation logic is built.

Audit tasks:

- Count total products, duplicate rows, missing values, invalid URLs, empty ingredient lists, empty details, non-numeric prices, and non-numeric ratings.
- Normalize column names to lowercase snake_case and trim whitespace from field names and values.
- Normalize brands with consistent casing, whitespace cleanup, encoding cleanup, and duplicate detection.
- Normalize product names by trimming, decoding mojibake where possible, removing retailer-only labels such as "Online Only" only when stored separately as metadata, and preserving the original display name.
- Normalize product categories into a controlled taxonomy: makeup, skincare, haircare, and subcategories such as foundation, blush, eyeshadow, eyeliner, shampoo, conditioner, cleanser, moisturizer, and face wash.
- Extract structured attributes from `details` when available, such as fragrance-free, dermatologist-tested, non-comedogenic, cruelty-free, vegan, oil-free, hydration claims, finish, coverage, and product set/bundle notes.
- Keep every derived attribute traceable with a source field and confidence level because many claims come from free text.
- Flag products with unusable or ambiguous ingredient text for exclusion from strict safety-filtered recommendations unless the user allows incomplete data.

Deliverables:

- `data_audit_report.md` or equivalent generated report.
- A normalized product import table or JSON artifact.
- A list of category mappings and attribute extraction rules.
- A list of data gaps that affect recommendation quality.

## 3. Recommended data model and database schema

Use PostgreSQL for production data storage because the existing project already references Postgres and the product data is relational. Add Prisma as the TypeScript ORM if the frontend/backend is rebuilt with Next.js.

Recommended core tables:

- `products`: id, source_row_id, brand_id, display_name, normalized_name, category_id, price_cents, rating, details, product_url, store, image_url, data_quality_status, created_at, updated_at.
- `brands`: id, display_name, normalized_name.
- `categories`: id, parent_id, slug, display_name, product_domain where product_domain is makeup, skincare, or haircare.
- `ingredients`: id, canonical_name, normalized_name, inci_name, description, created_at, updated_at.
- `ingredient_aliases`: id, ingredient_id, alias, normalized_alias, match_type.
- `product_ingredients`: product_id, ingredient_id, raw_name, position, section_label, is_may_contain, parse_confidence.
- `product_attributes`: product_id, attribute_key, attribute_value, source_field, confidence.
- `ingredient_groups`: id, slug, display_name, description, caution_level.
- `ingredient_group_members`: ingredient_group_id, ingredient_id, evidence_source, confidence.
- `user_profiles`: id, auth_user_id nullable, skin_type, hair_type, created_at, updated_at.
- `user_preferences`: user_profile_id, preference_key, preference_value, source, confidence.
- `user_excluded_ingredients`: user_profile_id, ingredient_id nullable, raw_term, exclusion_type, match_confidence.
- `recommendation_sessions`: id, user_profile_id nullable, normalized_input_json, safety_filters_json, created_at.
- `recommendation_results`: session_id, product_id, score, rank, explanation_json, excluded_match_summary_json.

For an MVP, anonymous users can keep quiz answers in browser session state and submit them to the recommendation API without creating an account. Persist profiles only after the user chooses to save results.

## 4. Approach for parsing, standardizing, and matching ingredient names, including aliases and common ingredient-name variations

Ingredient handling should be deterministic and conservative because safety filtering is the highest-risk product behavior.

Parsing approach:

- Preserve the original `ingredients` string exactly for display and traceability.
- Split ingredient lists with a parser that handles commas, semicolons, periods, parentheses, brackets, "May Contain", "+/-", shade sections, product sections, and bundled product sections.
- Store ingredient position because earlier ingredients may indicate higher concentration, but do not imply exact concentration.
- Treat "May Contain" ingredients as present for exclusion filtering unless a later product-specific dataset can distinguish shades.
- Split multi-product bundles into section labels where possible, such as foundation, loose powder, pressed highlighter, shampoo, or conditioner.
- Normalize ingredient tokens by lowercasing, trimming, removing excess punctuation, converting HTML/entities, collapsing whitespace, and standardizing common Latin/INCI parenthetical forms.

Alias and variation handling:

- Create an alias table for exact and normalized matches, such as fragrance, parfum, aroma, flavor/aroma, perfume, dimethicone variants, sodium laureth sulfate, SLES, sodium lauryl sulfate, SLS, coconut oil, cocos nucifera oil, shea butter, and butyrospermum parkii.
- Use deterministic exact/alias matching first.
- Use fuzzy matching only as a suggestion workflow for data cleanup, not for hard exclusion decisions.
- Maintain ingredient groups for user-friendly preferences such as fragrance-free, silicone-free, sulfate-free, essential-oil-free, paraben-free, lanolin-free, nut-oil-free, coconut-free, and dye/pigment caution groups.
- Record confidence for every parsed ingredient and alias match.

Safety rule: if a user excludes an ingredient or ingredient group, any product with a confirmed or likely matching ingredient should be excluded from recommendations. Products with missing or unparseable ingredient lists should be labeled "ingredient data incomplete" and should not appear in strict safety mode.

## 5. User flow and interaction design recommendations for collecting concerns, preferences, and avoided ingredients

Design v2 around a friendly quiz that feels lightweight but captures enough structure for reliable recommendations.

Recommended flow:

- Start with a product goal step: "What are you looking for today?" with category choices across makeup, skincare, and haircare.
- Ask only relevant follow-up questions based on category, such as skin type for face products and hair/scalp type for haircare.
- Collect skin concerns such as dryness, oiliness, acne-prone skin, redness, sensitivity, uneven tone, dullness, texture, and mature skin.
- Collect hair/scalp concerns such as dryness, oiliness, frizz, curls/coils, color-treated hair, flakes, itchiness, breakage, volume, and damage.
- Collect preferences such as fragrance-free, silicone-free, sulfate-free, vegan, cruelty-free, oil-free, non-comedogenic, dermatologist-tested, budget range, store preference, and minimum rating.
- Provide an avoided ingredients step with autocomplete against canonical ingredients and aliases.
- Include a plain-language free-text box for concerns, allergies, and preferences.
- Show a review step before results that lets users confirm inferred filters and remove anything incorrect.
- Allow users to adjust filters from the results page without restarting the quiz.

UX requirements:

- Keep the tone warm, modern, cute, and calm without making medical claims.
- Use chips, segmented controls, searchable comboboxes, checkboxes, and sliders instead of long forms.
- Use progressive disclosure so users are not asked hair questions when searching makeup only, unless they choose haircare.
- Always distinguish "I prefer to avoid" from "I am allergic/sensitive" because allergy filters should be treated as stricter.
- Display safety copy near allergy inputs and results, not hidden in a footer.

## 6. Recommendation system design, including deterministic filtering, scoring, and where AI/LLMs should and should not be used

The recommendation engine should use deterministic filtering first, scoring second, and AI only as an assistive interpretation/explanation layer.

Deterministic filtering:

- Filter by selected product categories.
- Exclude products with confirmed matches against user allergens, sensitivities, avoided ingredients, and avoided ingredient groups.
- Apply strict mode by excluding products with missing or unparseable ingredient data when safety filters are present.
- Apply optional filters such as price range, store, minimum rating, fragrance-free, sulfate-free, silicone-free, vegan, cruelty-free, and non-comedogenic only when the dataset supports them with acceptable confidence.

Scoring:

- Score remaining products by concern match from product category, attributes extracted from details, ingredient groups, rating, price fit, store preference, and data completeness.
- Give higher weight to hard user needs than cosmetic preferences.
- Penalize products with low data confidence or unclear claims.
- Keep score components explainable and stored in `explanation_json`.

LLM use:

- Use the LLM to translate plain-language user input into structured candidate filters and concerns.
- Use the LLM to draft user-friendly explanations from validated recommendation facts.
- Do not use the LLM to decide whether an excluded ingredient is present in a product.
- Do not use the LLM as the sole source for medical, allergy, diagnosis, or product safety claims.
- Do not let the LLM invent product attributes not found in the dataset or approved enrichment tables.

Recommendation output should show products that passed hard exclusions, why they matched, which filters were applied, and which ingredient exclusions were checked.

## 7. LLM architecture and prompt design considerations, including structured outputs, guardrails, validation, cost control, and fallbacks

Use an LLM as a bounded service behind backend APIs. The frontend should never call the model directly.

Recommended model strategy:

- Use `gpt-5.4-mini` as the default production model for user-facing flows because the app needs low-latency, cost-conscious calls for free-text interpretation and short recommendation explanations.
- Use `gpt-5.5` only for escalation paths and internal/admin workflows, such as resolving ambiguous taxonomy rules, improving prompts, reviewing ingredient-group mappings, or handling rare complex interpretation cases.
- Keep ingredient safety filtering deterministic. The model may suggest candidate exclusions from plain language, but backend ingredient parsing, alias matching, and ingredient-group rules must decide whether a product is excluded.
- Route all model calls through a backend LLM service so model names, prompts, validation, caching, rate limits, and fallbacks can be changed without frontend changes.

Recommended LLM tasks:

- `parseUserNeeds`: convert free text into structured concerns, product categories, ingredient exclusions, ingredient group exclusions, and uncertainty notes.
- `generateRecommendationExplanation`: convert deterministic recommendation facts into concise, friendly explanations.
- `summarizeSafetyNotice`: provide standard safety messaging selected from approved templates.

Structured output:

- Require JSON schema outputs with fixed enums for categories, concerns, preferences, and exclusion types.
- Validate every model response with a runtime schema validator such as Zod.
- Reject unknown enum values unless they can be mapped deterministically.
- Require the model to include confidence and evidence text for inferred constraints.
- Run all inferred ingredient terms through the canonical ingredient/alias matcher before they become filters.

Guardrails:

- System prompts must state that the model cannot diagnose, guarantee safety, or create medical advice.
- Prompts must require "unknown" or "not enough data" instead of guessing.
- Prompts must instruct the model to use only supplied product facts when explaining recommendations.
- Backend validation must remove unsupported claims before responses reach the UI.

Cost control:

- Use deterministic logic for browsing, filtering, scoring, and exact ingredient checks.
- Call the LLM only when the user provides free text or when explanation copy is needed.
- Cache normalized free-text interpretations by hashed input.
- Batch explanations for a page of results when possible.
- Provide a no-AI fallback that uses quiz selections and template explanations.

Fallbacks:

- If the LLM fails, continue with structured quiz inputs only.
- If inferred filters are low confidence, show them as suggestions for user confirmation.
- If product data is incomplete, clearly say the recommendation cannot confirm every ingredient constraint.

## 8. Frontend framework, component architecture, visual direction, and accessibility requirements

Recommended stack:

- Next.js with TypeScript for a modern full-stack app structure.
- React Server Components for product/result pages where practical.
- Tailwind CSS plus a small design-token layer for consistent spacing, color, and typography.
- shadcn/ui or Radix UI primitives for accessible dialogs, comboboxes, tabs, popovers, and form controls.
- Lucide icons for clear interface actions.
- React Hook Form plus Zod for quiz and preference validation.

Component architecture:

- `OnboardingFlow`: controls steps, branching, progress, and review.
- `ConcernSelector`: skin, hair, and product-category concern chips.
- `IngredientAvoidanceInput`: ingredient autocomplete with alias awareness and severity labels.
- `PreferenceFilters`: fragrance-free, silicone-free, sulfate-free, vegan, cruelty-free, budget, rating, and store controls.
- `RecommendationResults`: ranked product list with filters, sorting, and empty states.
- `RecommendationCard`: product identity, store, price, rating, match reasons, excluded-ingredient confirmation, and purchase link.
- `SafetyNotice`: reusable disclaimer and uncertainty component.
- `DataConfidenceBadge`: communicates complete, partial, or incomplete ingredient data.

Visual direction:

- Modern, polished, cute, and easy to scan.
- Use a soft but not one-note palette, for example blush pink accents, clean white space, mint or sky secondary accents, and high-contrast text.
- Prefer rounded cards for product results, pill chips for selected preferences, clear progress indicators, and subtle motion for step transitions.
- Avoid dense charts as the main interaction; v2 is recommendation-first, not visualization-first.

Accessibility:

- Meet WCAG 2.2 AA contrast.
- Support keyboard-only completion of the quiz and results filtering.
- Provide visible focus states and accessible labels for all controls.
- Do not rely on color alone for safety or match status.
- Respect reduced-motion preferences.
- Ensure mobile layouts support one-handed scanning and filtering.

## 9. Backend/API architecture, authentication approach if needed, and data storage

Recommended architecture:

- Use Next.js API routes or route handlers for the MVP.
- Use PostgreSQL as the primary database.
- Use Prisma migrations and seed scripts for normalized product data.
- Keep data import and normalization scripts separate from runtime API code.
- Add a background enrichment pipeline later if product data is refreshed from retailers.

Core APIs:

- `POST /api/onboarding/interpret`: accepts quiz state and optional free text, returns validated inferred constraints.
- `POST /api/recommendations`: accepts normalized preferences and returns filtered/scored products with explanations.
- `GET /api/ingredients/search`: supports autocomplete for canonical ingredients and aliases.
- `GET /api/products/:id`: returns detailed product data, raw ingredients, parsed ingredients, and safety notes.
- `POST /api/profiles`: optional save endpoint if accounts are added.

Authentication:

- MVP should support anonymous recommendations without authentication.
- Add optional accounts only for saved profiles, saved avoid lists, and recommendation history.
- If authentication is added, use a managed provider such as Clerk, Auth.js, or Supabase Auth rather than custom password handling.

Data storage:

- Store product and ingredient data in Postgres.
- Store anonymous quiz state in browser session/local storage with clear controls to clear it.
- Store saved user profiles only with explicit user consent.
- Do not store raw free-text health/allergy notes longer than needed unless the user creates an account and opts in.

## 10. Privacy and security considerations for sensitive user-entered information

User allergy, sensitivity, skin, scalp, and hair concern data should be treated as sensitive preference data even if the app is not a medical product.

Privacy requirements:

- Make anonymous use available.
- Ask for consent before saving profiles or free-text concerns.
- Store the minimum needed data for recommendations.
- Allow users to delete saved profile data.
- Avoid logging raw allergy or health-related free text.
- Hash or redact free-text inputs before analytics where possible.
- Keep LLM prompts free of direct identifiers.
- Document what is sent to the LLM and why.

Security requirements:

- Validate all API inputs with schemas.
- Rate-limit LLM and recommendation endpoints.
- Escape and sanitize product data before rendering because scraped text is untrusted.
- Keep API keys server-side only.
- Use environment variables for secrets.
- Use HTTPS in production.
- Add dependency scanning and avoid unsupported legacy frontend libraries in v2.

Safety messaging:

- State that recommendations are informational and based on available ingredient data.
- State that the app does not diagnose or treat skin, scalp, hair, or allergy conditions.
- Encourage patch testing.
- Encourage consulting a dermatologist, allergist, or medical professional for severe allergies, persistent symptoms, or reactions.
- Avoid language that guarantees a product is safe or reaction-free.

## 11. Testing strategy for ingredient exclusions, recommendation correctness, AI output validation, and user interface flows

Ingredient and data tests:

- Unit test ingredient parser behavior for commas, parentheses, "May Contain", "+/-", shade sections, bundles, and duplicate ingredients.
- Unit test canonicalization and alias matching for fragrance/parfum, sulfates, silicones, nut oils, coconut derivatives, dyes, and common INCI variants.
- Snapshot-test normalized output from a representative subset of `raw_data/merge_df.csv`.
- Test that missing or unparseable ingredients are excluded in strict safety mode.

Recommendation tests:

- Verify hard exclusions always remove products containing excluded ingredients or groups.
- Verify deterministic filters work for category, price, store, rating, and supported attributes.
- Verify scoring is stable and explainable for known fixture profiles.
- Verify empty states when all products are excluded.
- Verify products with incomplete data are clearly labeled or excluded based on mode.

LLM tests:

- Validate structured outputs against schema.
- Test prompt fixtures such as "my scalp gets itchy and I react badly to fragrance" and confirm expected constraints are suggested.
- Test adversarial prompts that ask for diagnosis, medical guarantees, or invented product facts.
- Test fallback behavior when the LLM returns invalid JSON, unsupported values, low confidence, or times out.

UI tests:

- Use Playwright for onboarding flow, ingredient autocomplete, review step, results filtering, empty state, and mobile layout.
- Test keyboard navigation and focus order through the quiz and results.
- Test visible safety messaging on allergy entry and recommendation results.
- Add accessibility checks with Axe or Playwright accessibility tooling.

## 12. Development phases with milestones, dependencies, and suggested implementation order

Phase 1: Product and data foundation

- Confirm v2 scope, supported categories, and MVP success criteria.
- Audit `raw_data/merge_df.csv`.
- Define normalized taxonomy for product domains and categories.
- Build import scripts and normalized database schema.
- Seed Postgres from the scraped dataset.

Phase 2: Ingredient intelligence foundation

- Build ingredient parser and canonicalization pipeline.
- Create initial alias and ingredient-group tables.
- Parse all product ingredients and generate parse-confidence reports.
- Add data-quality flags for strict safety filtering.

Phase 3: Recommendation engine

- Implement deterministic category, preference, and safety filters.
- Implement scoring with explainable score components.
- Build recommendation result DTOs with match reasons and safety confirmations.
- Add unit tests for exclusions, scoring, and empty states.

Phase 4: LLM-assisted interpretation

- Add backend-only LLM service with `gpt-5.4-mini` as the default model and `gpt-5.5` reserved for escalation/internal workflows.
- Implement free-text concern parsing into candidate filters.
- Add user confirmation for inferred constraints.
- Add explanation generation from deterministic recommendation facts.
- Add fallbacks and caching.

Phase 5: Frontend v2 experience

- Build Next.js app shell and design system.
- Implement onboarding flow, ingredient autocomplete, preferences review, and responsive results.
- Add safety and uncertainty messaging.
- Add product detail view with raw ingredients and parsed ingredient highlights.

Phase 6: Privacy, polish, and production readiness

- Add anonymous session handling and optional saved profiles if needed.
- Add rate limits, input validation, sanitized rendering, and logging redaction.
- Complete Playwright and accessibility tests.
- Prepare deployment with database migrations, seed scripts, environment variables, and README updates.

Suggested MVP milestone:

- A user can choose a category, enter concerns and avoided ingredients, confirm AI-inferred filters, receive ranked products, and see clear explanations showing why each product matched and which excluded ingredients were not found based on available parsed data.

## 13. Open questions and assumptions to resolve before development begins

Assumptions:

- V2 can replace the v1 interaction model instead of preserving the clickable face map as the main navigation.
- The full merged dataset in `raw_data/merge_df.csv` is allowed to be used as the v2 product foundation.
- Product images are not currently available in the dataset, so v2 will either use clean placeholder visuals or add image scraping/enrichment as a later phase.
- Ingredient-free claims such as vegan, cruelty-free, sulfate-free, and silicone-free should be shown only when supported by parsed ingredients, product details, or curated enrichment data.
- Anonymous use is preferred for MVP, with accounts deferred until saved profiles are required.
- The app should support makeup, skincare, and haircare categories present in the current merged dataset.

Open questions:

- Should v2 keep the Face-Findr name and visual identity, or introduce a refreshed brand direction?
- Should product data remain static from the existing scrape for MVP, or should v2 include a refreshable scraping/import pipeline?
- Which categories should launch first if the full dataset needs to be narrowed for quality: all categories, only haircare/skincare, or the original four makeup categories plus haircare?
- Should strict safety mode be the default whenever users enter allergies or sensitivities?
- Should users be able to save profiles and recommendation history in the first release?
- Are there preferred LLM providers, budget limits, or deployment constraints?
- What monthly LLM budget and latency target should determine when, if ever, `gpt-5.5` is used in user-facing flows?
- Should external ingredient knowledge sources be added, and if so, which sources are acceptable for ingredient descriptions and grouping?
