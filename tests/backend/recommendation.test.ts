import test from "node:test";
import assert from "node:assert/strict";
import { recommendProducts } from "../../src/lib/recommendation/engine.ts";
import type { Product, RecommendationRequest } from "../../src/lib/recommendation/schemas.ts";

const baseProduct: Product = {
  id: "safe-1",
  brand: "Fixture",
  name: "Simple Shampoo",
  category: "shampoo",
  price: 12,
  rating: 4.4,
  details: "Gentle shampoo for dry hair.",
  ingredients: "Water, Cocamidopropyl Betaine, Glycerin",
  url: "https://example.test/simple",
  store: "Ulta",
  dataQuality: "complete",
};

function request(overrides: Partial<RecommendationRequest> = {}): RecommendationRequest {
  return {
    goal: { categories: ["shampoo"] },
    avoidedIngredients: [],
    avoidedIngredientGroups: [],
    strictSafetyMode: true,
    limit: 10,
    ...overrides,
  };
}

test("excludes fragrance when product lists parfum alias", () => {
  const products: Product[] = [
    baseProduct,
    {
      ...baseProduct,
      id: "fragrance-1",
      name: "Scented Shampoo",
      ingredients: "Water, Sodium Chloride, Parfum, Citric Acid",
    },
  ];

  const response = recommendProducts(
    products,
    request({
      avoidedIngredientGroups: [{ group: "fragrance", severity: "allergy" }],
    }),
  );

  assert.deepEqual(response.results.map((result) => result.product.id), ["safe-1"]);
  assert.equal(response.totalExcluded, 1);
});

test("excludes sulfate aliases SLS and sodium laureth sulfate", () => {
  const products: Product[] = [
    baseProduct,
    {
      ...baseProduct,
      id: "sls-1",
      name: "Clarifying Shampoo",
      ingredients: "Water, SLS, Cocamide MEA",
    },
    {
      ...baseProduct,
      id: "sles-1",
      name: "Foaming Shampoo",
      ingredients: "Water, Sodium Laureth Sulfate, Fragrance",
    },
  ];

  const response = recommendProducts(
    products,
    request({
      avoidedIngredientGroups: [{ group: "sulfates", severity: "sensitivity" }],
    }),
  );

  assert.deepEqual(response.results.map((result) => result.product.id), ["safe-1"]);
  assert.equal(response.totalExcluded, 2);
});

test("excludes exact avoided ingredient aliases", () => {
  const products: Product[] = [
    baseProduct,
    {
      ...baseProduct,
      id: "shea-1",
      name: "Rich Shampoo",
      ingredients: "Water, Butyrospermum Parkii (Shea) Butter, Glycerin",
    },
  ];

  const response = recommendProducts(
    products,
    request({
      avoidedIngredients: [{ term: "shea butter", severity: "allergy" }],
    }),
  );

  assert.deepEqual(response.results.map((result) => result.product.id), ["safe-1"]);
});

test("strict safety mode excludes missing ingredient data for allergy filters", () => {
  const products: Product[] = [
    baseProduct,
    {
      ...baseProduct,
      id: "missing-1",
      name: "Unknown Shampoo",
      ingredients: "",
      dataQuality: "missing-ingredients",
    },
  ];

  const response = recommendProducts(
    products,
    request({
      avoidedIngredients: [{ term: "fragrance", severity: "allergy" }],
      strictSafetyMode: true,
    }),
  );

  assert.deepEqual(response.results.map((result) => result.product.id), ["safe-1"]);
  assert.equal(response.totalExcluded, 1);
});

test("returns clear no-results reason when exclusions remove every product", () => {
  const products: Product[] = [
    {
      ...baseProduct,
      id: "fragrance-1",
      ingredients: "Water, Fragrance",
    },
  ];

  const response = recommendProducts(
    products,
    request({
      avoidedIngredientGroups: [{ group: "fragrance", severity: "allergy" }],
    }),
  );

  assert.equal(response.results.length, 0);
  assert.match(response.noResultsReason ?? "", /removed by category, rating, or safety filters/);
});
