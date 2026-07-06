#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { loadLocalEnv } = require("./load_env");
const {
  DEFAULT_INPUT,
  normalizeProducts,
  normalizedKey,
  readRawProducts
} = require("./pipeline");
const { parseIngredientList } = require("../src/lib/ingredients");

const ROOT = path.resolve(__dirname, "..");
const ALIASES_PATH = path.join(ROOT, "data", "ingredient_aliases.json");
const GROUPS_PATH = path.join(ROOT, "data", "ingredient_groups.json");

loadLocalEnv();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required before importing catalog data.");
  }

  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT;
  const rawProducts = readRawProducts(inputPath);
  const { products } = normalizeProducts(rawProducts);
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    await client.query("BEGIN");
    const retailers = await seedRetailers(client);
    const categories = await seedCategories(client);
    const ingredients = await seedIngredients(client);
    await seedIngredientGroups(client, ingredients);

    let imported = 0;
    for (const product of products) {
      const brandId = await upsertBrand(client, product.brand_display_name, product.brand_normalized_name);
      const categoryId = categories.get(product.category.slug) || categories.get(product.category.subcategory);
      const productId = await upsertProduct(client, product, brandId, categoryId);
      const retailerSlug = normalizeRetailerSlug(product.store);
      const retailerId = retailers.get(retailerSlug);
      if (retailerId && isValidRetailerUrl(product.product_url, retailerSlug)) {
        await upsertRetailerProduct(client, product, retailerId, productId, retailerSlug);
      }
      await replaceProductIngredients(client, productId, product.raw_ingredients, ingredients);
      imported += 1;
    }

    await client.query("COMMIT");
    console.log(`Imported ${imported} legacy products from ${path.relative(ROOT, inputPath)}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function seedRetailers(client) {
  const rows = [
    ["sephora", "Sephora", "https://www.sephora.com"],
    ["ulta", "Ulta", "https://www.ulta.com"]
  ];
  const ids = new Map();
  for (const [slug, displayName, baseUrl] of rows) {
    const result = await client.query(
      `INSERT INTO retailers (slug, display_name, base_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           base_url = EXCLUDED.base_url,
           updated_at = now()
       RETURNING id`,
      [slug, displayName, baseUrl]
    );
    ids.set(slug, result.rows[0].id);
  }
  return ids;
}

async function seedCategories(client) {
  const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "category_taxonomy.json"), "utf8"));
  const ids = new Map();
  for (const category of taxonomy.categories) {
    const result = await client.query(
      `INSERT INTO categories (slug, display_name, product_domain)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           product_domain = EXCLUDED.product_domain,
           updated_at = now()
       RETURNING id`,
      [category.slug, category.display_name, category.domain]
    );
    ids.set(category.slug, result.rows[0].id);
    ids.set(category.subcategory, result.rows[0].id);
  }
  return ids;
}

async function seedIngredients(client) {
  const aliasData = JSON.parse(fs.readFileSync(ALIASES_PATH, "utf8"));
  const ids = new Map();
  for (const ingredient of aliasData.ingredients) {
    const result = await client.query(
      `INSERT INTO ingredients (canonical_name, normalized_name)
       VALUES ($1, $2)
       ON CONFLICT (normalized_name) DO UPDATE
       SET canonical_name = EXCLUDED.canonical_name,
           updated_at = now()
       RETURNING id`,
      [ingredient.canonical_name, ingredient.normalized_name]
    );
    const ingredientId = result.rows[0].id;
    ids.set(ingredient.canonical_name, ingredientId);
    ids.set(ingredient.normalized_name, ingredientId);

    for (const alias of ingredient.aliases) {
      ids.set(normalizedKey(alias), ingredientId);
      await client.query(
        `INSERT INTO ingredient_aliases (ingredient_id, alias, normalized_alias, match_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (normalized_alias) DO UPDATE
         SET ingredient_id = EXCLUDED.ingredient_id,
             alias = EXCLUDED.alias,
             match_type = EXCLUDED.match_type`,
        [ingredientId, alias, normalizedKey(alias), alias === ingredient.normalized_name ? "canonical" : "alias"]
      );
    }
  }
  return ids;
}

async function seedIngredientGroups(client, ingredientIds) {
  const groupData = JSON.parse(fs.readFileSync(GROUPS_PATH, "utf8"));
  for (const group of groupData.groups) {
    const result = await client.query(
      `INSERT INTO ingredient_groups (slug, display_name, description, caution_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           caution_level = EXCLUDED.caution_level,
           updated_at = now()
       RETURNING id`,
      [group.slug, group.display_name, group.description, group.caution_level]
    );
    for (const member of group.members) {
      const ingredientId = ingredientIds.get(member);
      if (!ingredientId) continue;
      await client.query(
        `INSERT INTO ingredient_group_members (ingredient_group_id, ingredient_id)
         VALUES ($1, $2)
         ON CONFLICT (ingredient_group_id, ingredient_id) DO NOTHING`,
        [result.rows[0].id, ingredientId]
      );
    }
  }
}

async function upsertBrand(client, displayName, normalizedName) {
  const result = await client.query(
    `INSERT INTO brands (display_name, normalized_name)
     VALUES ($1, $2)
     ON CONFLICT (normalized_name) DO UPDATE
     SET display_name = EXCLUDED.display_name,
         updated_at = now()
     RETURNING id`,
    [displayName || "Unknown Brand", normalizedName || "unknown-brand"]
  );
  return result.rows[0].id;
}

async function upsertProduct(client, product, brandId, categoryId) {
  const status = product.data_quality_flags.includes("missing_ingredients")
    ? "missing-ingredients"
    : product.data_quality_flags.includes("unparseable_ingredients")
      ? "unparseable-ingredients"
      : product.data_quality_status === "complete"
        ? "complete"
        : "partial";

  const result = await client.query(
    `INSERT INTO products (
       canonical_name, normalized_name, brand_id, category_id, description,
       ingredient_text_raw, data_quality_status, legacy_source_row_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (brand_id, normalized_name, category_id) DO UPDATE
     SET canonical_name = EXCLUDED.canonical_name,
         description = EXCLUDED.description,
         ingredient_text_raw = EXCLUDED.ingredient_text_raw,
         data_quality_status = EXCLUDED.data_quality_status,
         legacy_source_row_id = EXCLUDED.legacy_source_row_id,
         updated_at = now()
     RETURNING id`,
    [
      product.product_display_name || "Unknown Product",
      product.product_normalized_name || `unknown-product-${product.source_row_id}`,
      brandId,
      categoryId,
      product.details || null,
      product.raw_ingredients || null,
      status,
      product.source_row_id
    ]
  );
  return result.rows[0].id;
}

async function upsertRetailerProduct(client, product, retailerId, productId, retailerSlug) {
  const canonicalUrl = canonicalizeRetailerUrl(product.product_url, retailerSlug);
  const rawSourceHash = crypto.createHash("sha256").update(JSON.stringify(product)).digest("hex");
  await client.query(
    `INSERT INTO retailer_products (
       retailer_id, product_id, retailer_product_id, retailer_url, canonical_url,
       current_price_cents, currency, rating, availability_status, retailer_category_path,
       last_scraped_at, last_seen_at, raw_source_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'USD', $7, 'unknown', $8, now(), now(), $9)
     ON CONFLICT (retailer_id, canonical_url) DO UPDATE
     SET product_id = EXCLUDED.product_id,
         retailer_url = EXCLUDED.retailer_url,
         current_price_cents = EXCLUDED.current_price_cents,
         rating = EXCLUDED.rating,
         retailer_category_path = EXCLUDED.retailer_category_path,
         last_scraped_at = now(),
         last_seen_at = now(),
         raw_source_hash = EXCLUDED.raw_source_hash,
         is_stale = false,
         updated_at = now()`,
    [
      retailerId,
      productId,
      extractRetailerProductId(product.product_url),
      product.product_url,
      canonicalUrl,
      product.price_cents,
      product.rating,
      product.category.source_value,
      rawSourceHash
    ]
  );
}

async function replaceProductIngredients(client, productId, rawIngredients, ingredientIds) {
  await client.query("DELETE FROM product_ingredients WHERE product_id = $1", [productId]);
  const tokens = parseIngredientList(rawIngredients);
  for (const token of tokens) {
    const ingredientId = ingredientIds.get(token.normalized_token) || null;
    await client.query(
      `INSERT INTO product_ingredients (
         product_id, ingredient_id, raw_name, normalized_name, position,
         section_label, is_may_contain, parse_confidence
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (product_id, position, normalized_name) DO NOTHING`,
      [
        productId,
        ingredientId,
        token.raw_token,
        token.normalized_token,
        token.position,
        token.section_label || null,
        token.is_may_contain,
        token.parse_confidence
      ]
    );
  }
}

function normalizeRetailerSlug(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("sephora")) return "sephora";
  if (normalized.includes("ulta")) return "ulta";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isValidRetailerUrl(value, retailerSlug) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (retailerSlug === "sephora") return host === "sephora.com" || host.endsWith(".sephora.com");
    if (retailerSlug === "ulta") return host === "ulta.com" || host.endsWith(".ulta.com");
    return true;
  } catch (_error) {
    return false;
  }
}

function canonicalizeRetailerUrl(value, retailerSlug) {
  const url = new URL(value);
  url.hash = "";
  if (retailerSlug === "sephora") url.searchParams.delete("icid2");
  return url.toString();
}

function extractRetailerProductId(value) {
  try {
    const url = new URL(value);
    return url.searchParams.get("productId") || url.pathname.match(/-P\d+/i)?.[0]?.slice(1) || null;
  } catch (_error) {
    return null;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
