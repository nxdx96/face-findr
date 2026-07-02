"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ingredientHasGroup,
  matchIngredient,
  normalizeIngredientName,
  parseIngredientList
} = require("../../src/lib/ingredients");
const {
  mapCategory,
  normalizeDisplayName,
  parsePriceCents,
  parseRating
} = require("../../scripts/pipeline");

test("normalizes ingredient names deterministically", () => {
  assert.equal(normalizeIngredientName("Butyrospermum Parkii (Shea) Butter."), "butyrospermum parkii shea butter");
});

test("parses shade section and may contain tokens", () => {
  const tokens = parseIngredientList("Desert Rose: Talc, Dimethicone. May Contain: Mica, Titanium Dioxide (CI 77891).");
  assert.equal(tokens[0].section_label, "Desert Rose");
  assert.equal(tokens[0].raw_token, "Talc");
  assert.equal(tokens[1].raw_token, "Dimethicone");
  assert.equal(tokens[1].is_may_contain, false);
  assert.equal(tokens[2].raw_token, "Mica");
  assert.equal(tokens[2].is_may_contain, true);
  assert.equal(tokens[3].normalized_token, "titanium dioxide ci 77891");
});

test("keeps parenthetical commas together", () => {
  const tokens = parseIngredientList("Iron Oxides (CI 77491, CI 77492, CI 77499), Mica");
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].raw_token, "Iron Oxides (CI 77491, CI 77492, CI 77499)");
});

test("parses multi-product sections when labeled", () => {
  const tokens = parseIngredientList("Shampoo: Water, Sodium Laureth Sulfate; Conditioner: Water, Dimethicone");
  assert.equal(tokens[0].section_label, "Shampoo");
  assert.equal(tokens[1].section_label, "Shampoo");
  assert.equal(tokens[2].section_label, "Conditioner");
  assert.equal(tokens[3].section_label, "Conditioner");
});

test("matches aliases and ingredient groups without fuzzy matching", () => {
  const fragrance = matchIngredient("Parfum");
  assert.equal(fragrance.canonical_name, "Fragrance");
  assert.equal(fragrance.match_type, "alias");
  assert.equal(ingredientHasGroup("SLES", "sulfates"), true);
  assert.equal(ingredientHasGroup("Dimethiconol", "silicones"), true);
  assert.equal(ingredientHasGroup("Cocos Nucifera (Coconut) Oil", "coconut"), true);
});

test("normalizes product fields and category taxonomy", () => {
  assert.equal(parsePriceCents(" $18.99 "), 1899);
  assert.equal(parseRating("4.7"), 4.7);
  assert.equal(parseRating("9.1"), null);
  assert.equal(normalizeDisplayName("Online Only Powder Blush"), "Powder Blush");
  assert.equal(mapCategory("face wash").slug, "skincare-cleanser");
  assert.equal(mapCategory("shampoo").domain, "haircare");
});
