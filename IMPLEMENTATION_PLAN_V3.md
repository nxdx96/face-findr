# FaceFinder Implementation Plan V3

## Goal

Turn the current MVP into a production-level application experience with a focused three-stage flow:

1. Logo-only welcome screen. Logo can be found in IngrediFindr.png
2. Centered quiz experience.
3. Recommendation results after submission.

The page should no longer feel like a prototype, preview, school project, or documentation demo. The experience should be quiet, direct, and polished.

## Non-Negotiable UI Removals

- Remove every visible version label from the MVP and public site.
- Remove any "preview" language from the MVP and public site.
- Remove all page headers and top navigation from the application flow.
- Remove hero panels, hero headings, slogans, intro paragraphs, and explanatory marketing copy.
- Remove the "View at retailer" button from recommendation cards.
- Do not show the full user journey on a single page at the same time.

These removals apply to desktop and mobile views.

## Required User Flow

### 1. Welcome Screen

The first screen should contain only the FaceFinder logo.

Requirements:

- Center the FaceFinder logo both vertically and horizontally.
- Do not include a header.
- Do not include a tagline, slogan, paragraph, helper text, CTA button, progress indicator, or footer copy.
- The entire screen should be clickable or tappable.
- Clicking or tapping anywhere transitions the user into the quiz.
- Keyboard users should be able to advance with `Enter` or `Space`.
- The screen should respect reduced-motion preferences.

Implementation notes:

- Use a full-viewport welcome state.
- Treat the logo screen as the first application state, not a marketing hero section.
- Keep any accessibility label concise, such as `FaceFinder`.

### 2. Quiz Screen

After the welcome interaction, transition to the quiz portion of the application.

Requirements:

- Display only the quiz card centered on the page.
- Do not include a header.
- Do not include a hero panel or hero heading.
- Do not display recommendation results while the quiz is active.
- Keep the onboarding steps focused on the existing recommendation inputs.
- Preserve the recommendation logic and data behavior already built for the MVP.
- Keep controls polished and production-ready: chips, segmented controls, checkboxes, sliders, autocomplete, and clear form states.
- Keep validation and safety messaging where needed, but avoid broad explanatory copy that makes the page feel like a pitch deck.

Layout requirements:

- The quiz card should sit in the visual center of the viewport.
- The quiz card should have responsive width constraints so it feels intentional on desktop, tablet, and mobile.
- The page background should support the card without becoming visually busy.
- Text should fit cleanly inside all controls.
- Transitions between quiz steps should be subtle and should not shift the layout unexpectedly.

### 3. Recommendation Transition

When the user clicks `Show recommendations`, the quiz card should disappear and the results view should appear.

Requirements:

- Trigger a transition from quiz state to results state.
- Do not keep the quiz card visible above or beside the recommendations.
- Do not show an intermediate hero, summary panel, or marketing block.
- Preserve the same recommendation result content and behavior except for the retailer button removal.
- Keep loading, empty, and error states centered and visually consistent with the rest of the application.
- Results should feel like the next screen in the app, not a section lower on the same page.

## Recommendation Result Requirements

Keep the current recommendation result structure unless it conflicts with this plan.

Keep:

- Product name.
- Brand.
- Category.
- Store label if already shown as product metadata.
- Price.
- Rating.
- Match reasons.
- Safety or ingredient data-quality notes.
- Any existing filter or sorting behavior that is already part of the MVP.

Remove:

- The `View at retailer` button.
- Any visible outbound retail CTA that makes the card feel like an affiliate shopping page.

If the product URL still exists in the data model, keep it available internally for future use, but do not surface it as a primary visible button in this flow.

## Application State Model

Use an explicit screen state instead of rendering every section at once.

Recommended states:

- `welcome`
- `quiz`
- `loadingRecommendations`
- `results`
- `emptyResults`
- `error`

Expected transitions:

- `welcome` -> user clicks/taps anywhere -> `quiz`
- `quiz` -> user submits quiz -> `loadingRecommendations`
- `loadingRecommendations` -> successful results -> `results`
- `loadingRecommendations` -> no matches -> `emptyResults`
- `loadingRecommendations` -> request failure -> `error`

The user should never see the welcome logo, quiz card, and recommendation results all at the same time.

## Component Scope

Likely files and components to update:

- `src/components/OnboardingFlow.tsx`
- `src/components/RecommendationResults.tsx`
- Any root page or app shell file that renders the header, hero area, or combined one-page layout.
- Any copy constants, tests, or snapshots that reference removed version or preview language.

Expected component changes:

- Add a logo-only welcome state.
- Remove app-level header rendering from the MVP route.
- Remove hero copy and hero layout from the onboarding route.
- Center the quiz card in its own screen state.
- Hide recommendations until the quiz is submitted.
- Remove the retailer CTA from recommendation cards.
- Preserve the existing API client and deterministic recommendation behavior.

## Visual Direction

The app should feel complete and production-ready.

Direction:

- Minimal.
- Polished.
- Calm.
- Focused.
- App-like, not landing-page-like.

Avoid:

- Preview badges.
- Version badges.
- Hero marketing sections.
- Large explanatory blocks.
- Decorative panels that do not support the core task.
- One-page stacked presentation of the whole journey.

## Motion Requirements

Use transitions to communicate progression between screens.

Recommended behavior:

- Welcome logo fades or gently scales out.
- Quiz card fades or slides in after welcome.
- Quiz card fades out after submission.
- Results fade or slide in after recommendations are ready.

Constraints:

- Keep motion subtle and fast.
- Avoid bouncy or playful animation that undercuts the production tone.
- Respect `prefers-reduced-motion` by switching to instant state changes or simple fades.

## Accessibility Requirements

- The logo-only welcome screen must be reachable and operable by keyboard.
- The clickable welcome area must have a clear accessible role and label.
- Quiz controls must retain accessible names, focus states, and validation feedback.
- Screen transitions must move focus to the new active screen.
- Results should announce loading, empty, and error states appropriately.
- Removing visual headers must not remove necessary semantic landmarks if they are needed for assistive technologies.

## Testing Requirements

Update or add tests that verify:

- No visible version or preview labels render in the MVP.
- No header renders in the MVP flow.
- The welcome screen initially renders only the FaceFinder logo.
- Clicking or tapping the welcome screen advances to the quiz.
- The quiz card is visible before submission and recommendations are not visible.
- Clicking `Show recommendations` hides the quiz card.
- Recommendation results render after submission.
- Recommendation cards do not render a `View at retailer` button.
- Keyboard activation works on the welcome screen.
- Reduced-motion mode does not depend on complex animation.

## Acceptance Criteria

The implementation is complete when:

- The first user-facing screen is only the centered FaceFinder logo.
- The user can click or tap anywhere on the welcome screen to enter the quiz.
- The quiz appears as a centered card with no header, hero panel, or hero heading.
- Recommendations are not displayed until after quiz submission.
- The quiz disappears when recommendations appear.
- Recommendation content remains intact except for removal of the retailer button.
- No visible version, preview, or school-project-style labels remain in the MVP or public site.
- The flow works on desktop and mobile.
- The flow remains keyboard accessible.
