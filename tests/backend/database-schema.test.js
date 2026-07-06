"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const schema = readFileSync("migrations/001_product_catalog.sql", "utf8");

test("catalog migration defines required product and scrape tables", () => {
  for (const table of [
    "retailers",
    "brands",
    "categories",
    "products",
    "retailer_products",
    "ingredients",
    "ingredient_aliases",
    "product_ingredients",
    "ingredient_groups",
    "ingredient_group_members",
    "scrape_runs",
    "scrape_failures",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test("retailer products prevent duplicate listings by retailer id and canonical url", () => {
  assert.match(schema, /UNIQUE \(retailer_id, canonical_url\)/);
  assert.match(schema, /last_scraped_at timestamptz/);
  assert.match(schema, /is_stale boolean NOT NULL DEFAULT false/);
});
