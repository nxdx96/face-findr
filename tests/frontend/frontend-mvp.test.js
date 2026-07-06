"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

function read(path) {
  return readFileSync(path, "utf8");
}

test("app route renders the onboarding experience without preview chrome", () => {
  const page = read("src/app/page.tsx");
  const onboarding = read("src/components/OnboardingFlow.tsx");
  const shell = read("src/components/AppShell.tsx");
  const layout = read("src/app/layout.tsx");

  assert.match(page, /<OnboardingFlow \/>/);
  assert.match(onboarding, /welcome-screen/);
  assert.match(onboarding, /IngrediFindr\.png/);
  assert.match(onboarding, /What are you shopping for\?/);
  assert.match(onboarding, /Plain-language notes/);
  assert.match(onboarding, /Review inferred filters/);
  assert.doesNotMatch(shell, /<header/);
  assert.doesNotMatch(shell, /Version 2 preview|V2/);
  assert.doesNotMatch(layout, /V2/);
});

test("results show required product details without retailer CTA", () => {
  const results = read("src/components/RecommendationResults.tsx");
  const badge = read("src/components/DataConfidenceBadge.tsx");

  assert.match(results, /RecommendationResults/);
  assert.doesNotMatch(results, /View at retailer/);
  assert.doesNotMatch(results, /purchase-link/);
  assert.match(results, /Strict ingredient exclusions/);
  assert.match(results, /No products match every strict filter/);
  assert.match(badge, /Ingredient data complete/);
  assert.match(badge, /Ingredients missing/);
});

test("safety copy avoids guarantees", () => {
  const safety = read("src/components/SafetyNotice.tsx");

  assert.match(safety, /cannot guarantee/);
  assert.match(safety, /reaction-free/);
  assert.match(safety, /medically suitable/);
});
