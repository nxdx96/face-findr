import test from "node:test";
import assert from "node:assert/strict";
import { validateRecommendationRequest } from "../../src/lib/recommendation/schemas.ts";

test("defaults strict safety mode on for allergy or sensitivity filters", () => {
  const result = validateRecommendationRequest({
    goal: { categories: ["shampoo"] },
    avoidedIngredientGroups: [{ group: "fragrance", severity: "sensitivity" }],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.strictSafetyMode, true);
    assert.deepEqual(result.value.avoidedIngredientGroups, [{ group: "fragrance", severity: "sensitivity" }]);
  }
});

test("keeps preference-only exclusions non-strict unless explicitly requested", () => {
  const result = validateRecommendationRequest({
    goal: { categories: ["skincare"] },
    avoidedIngredients: [{ term: "coconut oil", severity: "preference" }],
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.strictSafetyMode, false);
});

test("rejects unsupported categories, groups, severities, and invalid limits", () => {
  const result = validateRecommendationRequest({
    goal: { categories: ["supplement"] },
    avoidedIngredientGroups: [
      { group: "medical-advice", severity: "allergy" },
      { group: "fragrance", severity: "guaranteed-safe" },
    ],
    limit: 101,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /goal\.categories\[0\] is not supported/);
    assert.match(result.errors.join("\n"), /avoidedIngredientGroups\[0\]\.group is not supported/);
    assert.match(result.errors.join("\n"), /avoidedIngredientGroups\[1\]\.severity is not supported/);
    assert.match(result.errors.join("\n"), /limit must be between 1 and 100/);
  }
});

test("trims free-form avoided ingredient terms before recommendation use", () => {
  const result = validateRecommendationRequest({
    goal: { categories: ["conditioner"] },
    avoidedIngredients: [{ term: "  parfum  ", severity: "allergy" }],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.avoidedIngredients, [{ term: "parfum", severity: "allergy" }]);
    assert.equal(result.value.strictSafetyMode, true);
  }
});
