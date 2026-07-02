#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  DATA_DIR,
  DEFAULT_INPUT,
  ensureOutputDirs,
  normalizeProducts,
  readRawProducts,
  writeJson
} = require("./pipeline");

function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT;
  ensureOutputDirs();
  const rawProducts = readRawProducts(inputPath);
  const { products, productIngredients } = normalizeProducts(rawProducts);

  writeJson(path.join(DATA_DIR, "normalized_products.json"), {
    generated_at: new Date().toISOString(),
    source_file: path.relative(process.cwd(), inputPath),
    count: products.length,
    products
  });
  writeJson(path.join(DATA_DIR, "product_ingredients.json"), {
    generated_at: new Date().toISOString(),
    source_file: path.relative(process.cwd(), inputPath),
    count: productIngredients.length,
    product_ingredients: productIngredients
  });

  console.log(`Normalized ${products.length} products`);
  console.log(`Parsed ${productIngredients.length} ingredient tokens`);
  console.log("Wrote data/normalized_products.json and data/product_ingredients.json");
}

if (require.main === module) {
  main();
}
