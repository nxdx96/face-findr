import test from "node:test";
import assert from "node:assert/strict";
import { rowToProduct, validRetailerUrl } from "../../src/lib/recommendation/products.ts";

test("legacy product mapping includes retailer metadata fields", () => {
  const product = rowToProduct({
    index: "10",
    brand: "Fixture",
    product: "Hydrating Cleanser",
    product_type: "face cleanser",
    price: "$12.50",
    rating: "4.5",
    details: "Gentle cleanser.",
    ingredients: "Water, Glycerin",
    url: "https://www.ulta.com/hydrating-cleanser?productId=pimprod123",
    store: "Ulta",
  });

  assert.equal(product.currency, "USD");
  assert.equal(product.retailerSlug, "ulta");
  assert.equal(product.canonicalUrl, "https://www.ulta.com/hydrating-cleanser?productId=pimprod123");
  assert.equal(product.availabilityStatus, "unknown");
});

test("retailer URL validation allows only expected hosts for known retailers", () => {
  assert.equal(validRetailerUrl("https://www.sephora.com/product/example-P123", "sephora"), true);
  assert.equal(validRetailerUrl("https://www.ulta.com/example?productId=123", "ulta"), true);
  assert.equal(validRetailerUrl("https://evil.example/product/example-P123", "sephora"), false);
  assert.equal(validRetailerUrl("javascript:alert(1)", "ulta"), false);
});
