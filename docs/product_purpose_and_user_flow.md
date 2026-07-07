# Ingredi-Findr Product Purpose And User Flow

## Product Purpose

Ingredi-Findr is a beauty product discovery app that helps users find makeup, skincare, and haircare products that better match their shopping goals, budget, preferences, and ingredient constraints.

The core product problem is that beauty shopping often requires users to compare many product pages, ingredient lists, retailer claims, ratings, and prices by hand. This is especially difficult for users who are trying to avoid specific ingredients or broad ingredient families such as fragrance, sulfates, silicones, parabens, essential oils, nut oils, coconut-derived ingredients, lanolin, or dyes and pigments. Ingredi-Findr turns that comparison process into a guided flow and returns a ranked shortlist with visible reasons and safety context.

The app is intentionally built around deterministic recommendation logic. The recommendation engine uses structured quiz answers, product catalog facts, ingredient parsing, alias matching, and ingredient-group matching to decide which products are eligible. Large language model output, if enabled elsewhere in the system, is not trusted to decide whether a product contains an avoided ingredient.

Ingredi-Findr is not a medical product. It does not diagnose skin, scalp, or hair conditions, and it does not guarantee that any product is safe, reaction-free, or medically suitable. Its purpose is to make product discovery more transparent and conservative, especially when ingredient exclusions matter.

## Who The Product Is For

Ingredi-Findr is designed for beauty shoppers who want a faster and more explainable way to narrow down products before purchasing.

Primary users include:

- Users shopping for skincare, makeup, or haircare across retailers such as Sephora and Ulta.
- Users with beauty preferences such as fragrance-free, sulfate-free, silicone-free, vegan, cruelty-free, oil-free, non-comedogenic, or dermatologist-tested products.
- Users with skin, hair, or scalp concerns who want products whose available descriptions appear aligned with those concerns.
- Users who need to avoid ingredients because of personal preference, sensitivity, or allergy.
- Users who want recommendations that show why each product appeared instead of only showing a black-box result.

## Product Principles

Ingredi-Findr follows several product principles:

- Safety-first filtering: ingredient exclusions are applied before ranking eligible products.
- Deterministic decisions: avoided ingredients and groups are matched by code, aliases, and known groups rather than free-form model judgment.
- Transparency: product cards show match reasons, safety notes, and ingredient data quality.
- Conservatism around incomplete data: strict safety mode can exclude products with missing or unclear ingredient data.
- User control: users can tune category, concerns, claims, stores, budget, rating, avoided ingredients, avoided groups, and strictness.
- Retailer handoff: the app helps users form a shortlist, then sends them to the retailer product page to review the current label, price, and availability before buying.

## High-Level App Flow

The user experience has four major phases:

1. Entry screen
2. Guided onboarding quiz
3. Recommendation request and loading state
4. Results, sorting, safety review, and retailer handoff

The main app route renders `AppShell` and `OnboardingFlow`. The visible experience starts with a welcome logo screen. After the user enters the app, the onboarding quiz collects structured preferences across five steps: Goal, Concerns, Preferences, Avoid, and Review.

When the user submits the quiz, the frontend sends a normalized recommendation request to `POST /api/recommendations`. The backend validates the request, loads product data, applies deterministic exclusions, scores eligible products, and returns a recommendation response. The frontend then displays the result grid, an empty state, or an error state.

## Start Of Flow: Welcome Screen

The first screen is a full-viewport welcome screen showing the Ingredi-Findr logo.

User actions:

- Click the welcome screen.
- Press Enter while the welcome screen is focused.
- Press Space while the welcome screen is focused.

Result:

- The app transitions into the onboarding quiz.
- Focus moves into the quiz card for accessibility.

Purpose:

- The welcome screen acts as a simple branded entry point.
- It avoids asking for information before the user has intentionally entered the experience.

## Onboarding Step 1: Goal

The first quiz step asks: "What are you shopping for?"

The user can select one or more product worlds:

- Makeup
- Skincare
- Haircare

Each world maps to a broader product domain:

- Makeup includes categories such as foundation, blush, eyeliner, and eyeshadow.
- Skincare includes categories such as cleanser, moisturizer, and face wash.
- Haircare includes categories such as shampoo and conditioner.

Default state:

- Skincare is selected by default.

User actions:

- Select or deselect one or more category cards.
- Continue to the next step.

How this affects recommendations:

- Category selection is the first eligibility filter.
- Products outside the selected product worlds are excluded before ranking.
- Category fit also contributes strongly to the final score.

## Onboarding Step 2: Concerns

The second quiz step asks the user to describe what should feel better for this shopping trip.

The available concern options depend on the selected product worlds.

If the user selected skincare or makeup, the app shows skin and face concerns:

- Dryness
- Oiliness
- Acne-prone
- Redness
- Sensitivity
- Uneven tone
- Dullness
- Texture

If the user selected haircare, the app shows hair concerns:

- Dryness
- Oiliness
- Frizz
- Curls and coils
- Color-treated hair
- Breakage
- Volume
- Damage

If the user selected haircare, the app also shows scalp concerns:

- Dryness
- Oiliness
- Flakes
- Itchiness
- Sensitivity

User actions:

- Toggle any concern chips that matter.
- Leave concerns blank if the shopping trip is not concern-driven.
- Continue to the next step.

How this affects recommendations:

- Concerns are used for ranking, not hard exclusion.
- The recommendation engine looks for related keywords in available product names and details.
- Products whose descriptions align with selected concerns can receive a higher score and a match reason.

Important limitation:

- Concern matching is informational. The app does not diagnose or treat conditions.

## Onboarding Step 3: Preferences

The third quiz step collects shopping preferences that help rank and filter the result set.

The user can select preference claims:

- Fragrance-free
- Sulfate-free
- Silicone-free
- Vegan
- Cruelty-free
- Oil-free
- Non-comedogenic
- Dermatologist-tested

The user can also select preferred stores:

- Ulta
- Sephora

The user sets two numeric preferences:

- Maximum budget
- Minimum rating

Default state:

- Fragrance-free is selected by default.
- Maximum budget defaults to `$35`.
- Minimum rating defaults to `4.0` stars.
- No store is selected by default.

User actions:

- Toggle preference claims.
- Toggle store preferences.
- Adjust the budget slider.
- Adjust the minimum rating slider.
- Continue to the next step.

How this affects recommendations:

- Minimum rating is a hard filter. Products below the selected rating are excluded.
- Budget affects ranking. Products within the selected range receive a positive score contribution, while products above the maximum budget are penalized.
- Store selection affects ranking. Products from selected stores receive a positive score contribution.
- Preference claims affect ranking when supported by available product facts.

Important distinction:

- Preference claims are not the same as allergy filters. For example, selecting fragrance-free as a preference helps ranking, while adding fragrance as an avoided ingredient group can exclude products.

## Onboarding Step 4: Avoided Ingredients

The fourth quiz step is the safety-focused part of the flow. It lets the user identify ingredients or ingredient groups they want to avoid and assign a severity.

The app presents a compact safety notice explaining that available product facts cannot guarantee that a product is safe, reaction-free, or medically suitable.

The user chooses an avoidance severity:

- Preference
- Sensitivity
- Allergy

The user can enter an ingredient or ingredient group in a search field. As the user types, the app calls `GET /api/ingredients/search` to return autocomplete candidates based on supported ingredient terms, aliases, and groups.

Example ingredient search terms include:

- Fragrance
- Lanolin
- Coconut oil
- Sodium Laureth Sulfate
- Dimethicone

The user can also select predefined ingredient groups:

- Fragrance
- Sulfates
- Silicones
- Parabens
- Essential oils
- Nut oils
- Coconut
- Lanolin
- Dyes and pigments

User actions:

- Choose whether the avoidance is a preference, sensitivity, or allergy.
- Search for and add an avoided ingredient.
- Select avoided ingredient groups.
- Clear the avoid list if needed.
- Add plain-language notes.
- Continue to review.

How severity affects behavior:

- Preference means the user would rather avoid the ingredient, but it does not automatically force strict safety behavior.
- Sensitivity and allergy automatically enable strict safety mode.
- Strict safety mode makes the app more conservative when ingredient data is missing or unparseable.

How avoided ingredients affect recommendations:

- Avoided ingredients and groups are hard exclusions.
- Matching happens before ranking.
- The app checks exact terms, aliases, and supported ingredient groups.
- Products with confirmed matches for avoided ingredients or groups are excluded.
- "May contain" and shade or bundle ingredient variants count as present for exclusion purposes.

Plain-language notes:

- The user can type natural notes such as: "My scalp gets itchy with fragrance, and I prefer lightweight products under $30."
- The current frontend performs simple local inference from these notes.
- For example, itch-related text can suggest scalp itchiness, fragrance-related text can suggest avoiding the fragrance group, and sulfate-related text can suggest a sulfate-free preference.
- These inferred filters are reviewed before results.

## Onboarding Step 5: Review

The fifth quiz step gives the user a chance to review what will be submitted.

The review screen summarizes:

- Shopping categories
- Selected concerns
- Preference filters
- Avoided ingredients
- Avoided ingredient groups
- Suggested filters inferred from plain-language notes

User actions:

- Review the selected filters.
- Confirm inferred suggestions from notes.
- Remove notes if the inferred suggestions are not useful.
- Go back to earlier steps to change answers.
- Submit by selecting "Show recommendations."

Purpose:

- This step prevents hidden interpretation from being silently applied.
- It gives the user a final chance to confirm that safety-sensitive filters are correct.

## Recommendation Request

When the user selects "Show recommendations," the frontend builds a structured request.

The request includes:

- Selected product categories
- Skin, hair, and scalp concerns
- Preference claims
- Budget
- Preferred stores
- Minimum rating
- Avoided ingredients
- Avoided ingredient groups
- Strict safety mode value
- Result limit, currently `20`

The app then enters a loading screen with the message "Finding matches."

The frontend normally sends the request to:

```text
POST /api/recommendations
```

If local mock mode is enabled through `NEXT_PUBLIC_FACE_FINDR_USE_MOCKS=true`, the frontend builds mock recommendation results instead of calling the live API route.

## Backend Recommendation Processing

The backend route performs three main actions:

1. Parse and validate the request body.
2. Load the product catalog.
3. Run the recommendation engine.

Validation ensures that:

- The request body is valid JSON.
- At least one product category is present.
- Categories, concerns, preferences, ingredient groups, and severities are supported values.
- Budget values are finite numbers.
- Minimum budget does not exceed maximum budget.
- Result limit is between `1` and `100`.

The recommendation engine then evaluates each product.

Products are excluded when:

- They do not match the selected category or product world.
- They contain a submitted avoided ingredient or avoided group.
- They have missing or unparseable ingredient data and strict safety mode requires exclusion.
- Their rating is below the selected minimum rating.

Eligible products are scored using:

- Category fit
- Concern fit
- Rating
- Budget fit
- Store fit
- Ingredient data completeness
- Supported preference claims
- Penalties for missing details, rating, price, or complete ingredient data

The final response includes:

- Ranked results
- Total eligible product count
- Total excluded product count
- Applied filters
- A no-results reason when no product survives the filters

## Results Screen

After a successful recommendation response, the app displays the recommendations screen.

The results header explains that recommendations come from deterministic category, ingredient-exclusion, and ranking logic using available product data. It also reminds the user that ingredient confidence is shown because incomplete records should not be treated as guarantees.

The results toolbar includes:

- Sort control
- Strict ingredient exclusions toggle

Sort options:

- Best match
- Price: low to high
- Rating

Strict ingredient exclusions:

- The toggle reflects the current strict safety mode.
- Changing the toggle sends another recommendation request with the updated strictness value.
- This lets users see how conservative filtering affects the shortlist.

The screen also shows:

- A "Before you buy" safety notice.
- The number of displayed matches.
- The number of products filtered out.

## Product Cards

Each recommendation appears as a product card.

Product cards can show:

- Product image, when available
- Fallback brand initial when no image is available
- Brand
- Product name
- Match score
- Price and currency
- Rating and review count
- Retailer
- Availability or staleness message
- Ingredient data confidence badge
- Match reasons
- Safety note
- Retailer link

Ingredient data confidence badges include:

- Ingredient data complete
- Ingredient data partial
- Ingredients missing
- Ingredients unclear

Match reasons explain why a product ranked well. Examples include:

- Matching the requested product category.
- Aligning with selected concerns.
- Having a strong customer rating.
- Fitting the selected budget.
- Being available from a preferred store.
- Supporting selected preference claims.

Safety notes explain what the app could or could not verify from the ingredient data. For example, a card may say that no confirmed matches were found for submitted avoided ingredients or that ingredient data is incomplete.

Retailer links:

- Open in a new tab.
- Point to the canonical product URL when available.
- Use safe external-link behavior.
- Send the user to the retailer to verify current label, price, availability, shade details, and purchasing terms.

## Empty Results State

If no products match every active filter, the app shows an empty state instead of product cards.

The empty state includes:

- A heading explaining that no products match every strict filter.
- A no-results reason from the backend.

Possible reasons include:

- No product data is available.
- All matching products were removed by category, rating, or safety filters.
- No products matched the selected filters.

How the user can recover:

- Go back and select broader categories.
- Lower the minimum rating.
- Raise the maximum budget.
- Remove a store preference.
- Remove lower-priority avoided ingredients or groups.
- Turn off strict ingredient exclusions only when appropriate for their risk tolerance.

## Error State

If the recommendation request fails, the app displays an error state.

The current user-facing message is:

```text
Recommendations are unavailable right now. Check the local server and API configuration, then try again.
```

This can happen when:

- The local development server is misconfigured.
- The recommendation API route is unavailable.
- Product data cannot be loaded.
- The request fails before a valid response is returned.

## Ingredient Search Flow

Ingredient autocomplete supports the avoided ingredient step.

The frontend sends a query to:

```text
GET /api/ingredients/search?q=<query>&limit=10
```

The response includes matching ingredient candidates:

- Canonical name
- Alias
- Optional ingredient group

The UI only shows suggestions after the query has at least two characters. If the request fails, the suggestion list is cleared and the user can still submit a typed term manually.

## Data Sources And Product Catalog

Ingredi-Findr uses a product catalog with fields such as:

- Product ID
- Brand
- Name
- Category
- Price
- Currency
- Rating
- Review count
- Product details
- Ingredients
- Retailer URL
- Canonical URL
- Product image URL
- Store
- Availability status
- Staleness state
- Data quality

The project supports PostgreSQL-backed recommendations when `DATABASE_URL` is configured. It also includes legacy CSV import and normalized data outputs. Retailer data is intended to come from public product data sources and scraper adapters for Sephora and Ulta.

Because product data can become stale, the app treats retailer information as a decision aid rather than a final source of truth. Users should always verify current product labels and retailer pages before purchase.

## Safety Model In Plain Language

Ingredi-Findr separates preference matching from safety-sensitive exclusion.

Preference matching asks:

- Does this product appear to support what the user likes?
- Does it fit their category, budget, store, rating, and claim preferences?
- Does it describe benefits related to selected concerns?

Safety-sensitive exclusion asks:

- Does this product contain something the user asked to avoid?
- Does the ingredient list contain an alias for that avoided ingredient?
- Does the product contain an ingredient that belongs to an avoided group?
- Is the ingredient data missing or unclear while strict safety mode is active?

The safety-sensitive path happens first. Products that fail exclusions do not get rescued by a high rating, low price, preferred retailer, or strong concern fit.

## End-To-End User Journey Example

A user enters the app because they want a fragrance-free moisturizer for sensitive, dry skin under `$35`.

They click the welcome screen and begin the quiz.

On the Goal step, they keep Skincare selected.

On the Concerns step, they select Dryness and Sensitivity.

On the Preferences step, they keep Fragrance-free selected, set a maximum budget of `$35`, keep the minimum rating at `4.0`, and optionally choose Ulta or Sephora.

On the Avoided Ingredients step, they choose Sensitivity as the severity, search for fragrance, and add the fragrance group to the avoid list. Strict safety mode is enabled because the severity is sensitivity.

On the Review step, they verify that skincare, dryness, sensitivity, fragrance-free, and fragrance avoidance are present. They submit the quiz.

The app sends the normalized request to the recommendations API. The backend removes products outside skincare, products below the minimum rating, products with confirmed fragrance matches, and products with insufficient ingredient data if strict safety mode requires it. It then ranks the remaining products by fit.

The user lands on the results screen. They see a shortlist of product cards with match percentages, prices, ratings, retailer names, data confidence badges, match reasons, and safety notes. They can sort by best match, price, or rating. They can also toggle strict ingredient exclusions to understand how incomplete ingredient data affects the shortlist.

Before buying, the user opens a retailer link and verifies the current product page, ingredient label, price, availability, and shade-specific details.

## Current Product Boundaries

Ingredi-Findr currently does not:

- Guarantee product safety.
- Replace clinician, dermatologist, allergist, or stylist advice.
- Diagnose or treat skin, hair, or scalp conditions.
- Guarantee retailer price, availability, or current ingredients.
- Treat incomplete product data as equivalent to complete data.
- Use LLM output as the authority for ingredient exclusions.

These boundaries are part of the product experience. They help keep the app useful without overstating what available product data can prove.
