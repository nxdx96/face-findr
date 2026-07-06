"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { SephoraAdapter } = require("../../scrapers/sephora/adapter");
const { UltaAdapter } = require("../../scrapers/ulta/adapter");
const { validateExtractedProduct } = require("../../scrapers/pipelines/upsert");

function productFixture(name, brand) {
  return `
    <html>
      <head>
        <meta property="og:image" content="https://images.example.test/product.jpg">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "${name}",
            "brand": { "name": "${brand}" },
            "description": "Fixture description",
            "image": "https://images.example.test/product.jpg",
            "offers": { "price": "24.50", "priceCurrency": "USD", "availability": "https://schema.org/InStock" },
            "aggregateRating": { "ratingValue": "4.6", "reviewCount": "128" }
          }
        </script>
      </head>
      <body><h2>Ingredients</h2><p>Water, Glycerin, Fragrance</p></body>
    </html>
  `;
}

test("Sephora adapter extracts public product structured data", () => {
  const adapter = new SephoraAdapter();
  const product = adapter.extractProduct(productFixture("Serum", "Fixture Brand"), "https://www.sephora.com/product/serum-P12345?icid2=grid");

  assert.equal(product.retailerSlug, "sephora");
  assert.equal(product.retailerProductId, "P12345");
  assert.equal(product.name, "Serum");
  assert.equal(product.brand, "Fixture Brand");
  assert.equal(product.currentPriceCents, 2450);
  assert.equal(product.availabilityStatus, "in_stock");
  assert.equal(validateExtractedProduct(product).ok, true);
});

test("Ulta adapter extracts public product structured data", () => {
  const adapter = new UltaAdapter();
  const product = adapter.extractProduct(productFixture("Cleanser", "Fixture Brand"), "https://www.ulta.com/p/cleanser?sku=1234567");

  assert.equal(product.retailerSlug, "ulta");
  assert.equal(product.retailerProductId, "1234567");
  assert.equal(product.name, "Cleanser");
  assert.equal(product.brand, "Fixture Brand");
  assert.equal(product.currentPriceCents, 2450);
  assert.equal(product.availabilityStatus, "in_stock");
  assert.equal(validateExtractedProduct(product).ok, true);
});
