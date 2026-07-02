"use strict";

const fs = require("fs");
const path = require("path");
const { parseCsv } = require("./csv");
const {
  buildIngredientIndex,
  matchIngredient,
  normalizeIngredientName,
  parseIngredientList
} = require("../src/lib/ingredients");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "raw_data", "merge_df.csv");
const DATA_DIR = path.join(ROOT, "data");
const DOCS_DIR = path.join(ROOT, "docs");

function readRawProducts(inputPath = DEFAULT_INPUT) {
  const csv = fs.readFileSync(inputPath, "utf8");
  return parseCsv(csv).records.map((record, offset) => ({
    source_row_id: parseSourceRowId(record.index, offset),
    brand: cleanText(record.brand),
    product: cleanText(record.product),
    product_type: cleanText(record.product_type),
    price: cleanText(record.price),
    rating: cleanText(record.rating),
    details: cleanText(record.details),
    ingredients: record.ingredients == null ? "" : String(record.ingredients),
    url: cleanText(record.url),
    store: cleanText(record.store),
    __row_number: record.__row_number
  }));
}

function parseSourceRowId(value, offset) {
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) ? parsed : offset;
}

function cleanText(value) {
  return String(value == null ? "" : value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeDisplayName(value) {
  return cleanText(value).replace(/\bOnline Only\b/gi, "").replace(/\s+/g, " ").trim();
}

function parsePriceCents(value) {
  const cleaned = cleanText(value).replace(/[$,]/g, "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function parseRating(value) {
  const parsed = Number.parseFloat(cleanText(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) return null;
  return parsed;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(cleanText(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function loadTaxonomy(taxonomyPath = path.join(DATA_DIR, "category_taxonomy.json")) {
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  const bySource = new Map();
  for (const category of taxonomy.categories) {
    for (const sourceValue of category.source_values) {
      bySource.set(normalizedKey(sourceValue), category);
    }
  }
  return { taxonomy, bySource };
}

function mapCategory(productType, taxonomyIndex = loadTaxonomy()) {
  const category = taxonomyIndex.bySource.get(normalizedKey(productType));
  if (!category) {
    return {
      slug: "unknown",
      display_name: "Unknown",
      domain: "unknown",
      subcategory: "unknown",
      source_value: cleanText(productType)
    };
  }
  return {
    slug: category.slug,
    display_name: category.display_name,
    domain: category.domain,
    subcategory: category.subcategory,
    source_value: cleanText(productType)
  };
}

function extractAttributes(details) {
  const text = cleanText(details).toLowerCase();
  const rules = [
    ["fragrance_free", /\bfragrance[-\s]?free\b/],
    ["dermatologist_tested", /\bdermatologist tested\b/],
    ["ophthalmologist_tested", /\bophthalmologist tested\b/],
    ["non_comedogenic", /\bnon[-\s]?comedogenic\b|\bnon-acnegenic\b/],
    ["cruelty_free", /\bcruelty[-\s]?free\b/],
    ["vegan", /\bvegan\b/],
    ["oil_free", /\boil[-\s]?free\b/],
    ["hydrating_claim", /\bhydrat(?:e|ing|ion)\b|\bmoisturiz(?:e|ing)\b/],
    ["bundle_or_set", /\bset\b|\bbundle\b|\bkit\b/]
  ];
  return rules
    .filter(([, regex]) => regex.test(text))
    .map(([attribute_key]) => ({
      attribute_key,
      attribute_value: true,
      source_field: "details",
      confidence: 0.7
    }));
}

function getDataQualityFlags(raw, parsedIngredients, category) {
  const flags = [];
  if (!raw.brand) flags.push("missing_brand");
  if (!raw.product) flags.push("missing_product_name");
  if (!raw.product_type) flags.push("missing_category");
  if (category.slug === "unknown") flags.push("unknown_category");
  if (parsePriceCents(raw.price) == null) flags.push("invalid_price");
  if (parseRating(raw.rating) == null) flags.push("invalid_rating");
  if (!raw.details) flags.push("missing_details");
  if (!raw.ingredients || raw.ingredients.trim() === "") flags.push("missing_ingredients");
  if (raw.ingredients && parsedIngredients.length === 0) flags.push("unparseable_ingredients");
  if (!isValidHttpUrl(raw.url)) flags.push("malformed_url");
  if (!raw.store) flags.push("missing_store");
  return flags;
}

function normalizeProducts(rawProducts, options = {}) {
  const taxonomyIndex = options.taxonomyIndex || loadTaxonomy();
  const ingredientIndex = options.ingredientIndex || buildIngredientIndex();
  const products = [];
  const productIngredients = [];

  for (const raw of rawProducts) {
    const category = mapCategory(raw.product_type, taxonomyIndex);
    const parsedIngredients = parseIngredientList(raw.ingredients);
    const dataQualityFlags = getDataQualityFlags(raw, parsedIngredients, category);
    const normalizedProduct = {
      id: `source-${raw.source_row_id}`,
      source_row_id: raw.source_row_id,
      source_row_number: raw.__row_number,
      brand_display_name: raw.brand,
      brand_normalized_name: normalizedKey(raw.brand),
      product_display_name: normalizeDisplayName(raw.product),
      product_normalized_name: normalizedKey(raw.product),
      category,
      price_cents: parsePriceCents(raw.price),
      rating: parseRating(raw.rating),
      details: raw.details,
      raw_ingredients: raw.ingredients,
      product_url: raw.url,
      store: raw.store,
      store_normalized_name: normalizedKey(raw.store),
      attributes: extractAttributes(raw.details),
      data_quality_flags: dataQualityFlags,
      data_quality_status: dataQualityFlags.length === 0 ? "complete" : "needs_review"
    };
    products.push(normalizedProduct);

    for (const token of parsedIngredients) {
      const match = matchIngredient(token.normalized_token, ingredientIndex);
      productIngredients.push({
        product_id: normalizedProduct.id,
        source_row_id: raw.source_row_id,
        raw_ingredient_string: raw.ingredients,
        raw_token: token.raw_token,
        normalized_token: token.normalized_token,
        canonical_name: match.canonical_name,
        alias_match_type: match.match_type,
        groups: match.groups.map((group) => group.slug),
        section_label: token.section_label,
        is_may_contain: token.is_may_contain,
        position: token.position,
        parse_confidence: token.parse_confidence
      });
    }
  }

  return { products, productIngredients };
}

function ensureOutputDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

module.exports = {
  ROOT,
  DEFAULT_INPUT,
  DATA_DIR,
  DOCS_DIR,
  readRawProducts,
  normalizeProducts,
  normalizedKey,
  normalizeDisplayName,
  parsePriceCents,
  parseRating,
  isValidHttpUrl,
  loadTaxonomy,
  mapCategory,
  extractAttributes,
  ensureOutputDirs,
  writeJson
};
