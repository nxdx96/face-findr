"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

function read(path) {
  return readFileSync(path, "utf8");
}

test("v2 app route renders the onboarding experience", () => {
  const page = read("src/app/page.tsx");
  const onboarding = read("src/components/OnboardingFlow.tsx");

  assert.match(page, /<OnboardingFlow \/>/);
  assert.match(onboarding, /What are you shopping for\?/);
  assert.match(onboarding, /Plain-language notes/);
  assert.match(onboarding, /Review inferred filters/);
});

test("results show required product and ingredient-confidence details", () => {
  const results = read("src/components/RecommendationResults.tsx");
  const badge = read("src/components/DataConfidenceBadge.tsx");

  assert.match(results, /RecommendationResults/);
  assert.match(results, /View at retailer/);
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
