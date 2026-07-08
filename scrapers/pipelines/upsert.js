"use strict";

const crypto = require("crypto");
const { parseIngredientList } = require("../../src/lib/ingredients");

function validateExtractedProduct(product) {
  const errors = [];
  if (!product.retailerSlug) errors.push("retailerSlug is required");
  if (!product.name) errors.push("name is required");
  if (!product.brand) errors.push("brand is required");
  if (!isValidHttpUrl(product.canonicalUrl)) errors.push("canonicalUrl must be HTTP(S)");
  if (product.imageUrl && !isValidHttpUrl(product.imageUrl)) errors.push("imageUrl must be HTTP(S)");
  return { ok: errors.length === 0, errors };
}

async function upsertExtractedProduct(client, product) {
  const validation = validateExtractedProduct(product);
  if (!validation.ok) {
    const error = new Error(validation.errors.join("; "));
    error.validationErrors = validation.errors;
    throw error;
  }

  const retailerId = await ensureRetailer(client, product.retailerSlug);
  const brandId = await ensureBrand(client, product.brand);
  const categoryId = await ensureCategory(client, inferCategory(product));
  const productId = await upsertProduct(client, product, brandId, categoryId);
  await upsertRetailerProduct(client, product, retailerId, productId);
  await replaceProductIngredients(client, productId, product.ingredientTextRaw || "");
  return productId;
}

async function ensureRetailer(client, slug) {
  const known = {
    sephora: ["Sephora", "https://www.sephora.com"],
    ulta: ["Ulta", "https://www.ulta.com"]
  };
  const [displayName, baseUrl] = known[slug] || [titleCase(slug), ""];
  const result = await client.query(
    `INSERT INTO retailers (slug, display_name, base_url, scrape_status)
     VALUES ($1, $2, $3, 'running')
     ON CONFLICT (slug) DO UPDATE
     SET display_name = EXCLUDED.display_name,
         base_url = EXCLUDED.base_url,
         scrape_status = 'running',
         updated_at = now()
     RETURNING id`,
    [slug, displayName, baseUrl]
  );
  return result.rows[0].id;
}

async function ensureBrand(client, displayName) {
  const normalizedName = normalizedKey(displayName);
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

async function ensureCategory(client, category) {
  const result = await client.query(
    `INSERT INTO categories (slug, display_name, product_domain)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE
     SET display_name = EXCLUDED.display_name,
         product_domain = EXCLUDED.product_domain,
         updated_at = now()
     RETURNING id`,
    [category.slug, category.displayName, category.domain]
  );
  return result.rows[0].id;
}

async function upsertProduct(client, product, brandId, categoryId) {
  const ingredientTextRaw = product.ingredientTextRaw || null;
  const dataQualityStatus = ingredientTextRaw ? "complete" : "missing-ingredients";
  const result = await client.query(
    `INSERT INTO products (
       canonical_name, normalized_name, brand_id, category_id, description,
       ingredient_text_raw, data_quality_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (brand_id, normalized_name, category_id) DO UPDATE
     SET canonical_name = EXCLUDED.canonical_name,
         description = EXCLUDED.description,
         ingredient_text_raw = COALESCE(EXCLUDED.ingredient_text_raw, products.ingredient_text_raw),
         data_quality_status = EXCLUDED.data_quality_status,
         updated_at = now()
     RETURNING id`,
    [
      product.name,
      normalizedKey(product.name),
      brandId,
      categoryId,
      product.description || null,
      ingredientTextRaw,
      dataQualityStatus
    ]
  );
  return result.rows[0].id;
}

async function upsertRetailerProduct(client, product, retailerId, productId) {
  const rawSourceHash = crypto.createHash("sha256").update(JSON.stringify(product)).digest("hex");
  const values = [
    retailerId,
    productId,
    product.retailerProductId || null,
    product.retailerUrl,
    product.canonicalUrl,
    product.imageUrl || null,
    product.imageAltText || null,
    product.currentPriceCents ?? null,
    product.currency || "USD",
    product.rating ?? null,
    product.reviewCount ?? null,
    product.availabilityStatus || "unknown",
    product.categoryPath || null,
    rawSourceHash
  ];

  if (product.retailerProductId) {
    const updated = await client.query(
      `UPDATE retailer_products
       SET product_id = $2,
           retailer_url = $4,
           canonical_url = $5,
           image_url = COALESCE($6, image_url),
           image_alt_text = COALESCE($7, image_alt_text),
           current_price_cents = COALESCE($8, current_price_cents),
           currency = $9,
           rating = COALESCE($10, rating),
           review_count = COALESCE($11, review_count),
           availability_status = $12,
           retailer_category_path = COALESCE($13, retailer_category_path),
           last_scraped_at = now(),
           last_seen_at = now(),
           raw_source_hash = $14,
           is_stale = false,
           updated_at = now()
       WHERE retailer_id = $1 AND retailer_product_id = $3`,
      values
    );
    if (updated.rowCount) return;

    const backfilled = await client.query(
      `UPDATE retailer_products
       SET product_id = $2,
           retailer_product_id = $3,
           retailer_url = $4,
           canonical_url = $5,
           image_url = COALESCE($6, image_url),
           image_alt_text = COALESCE($7, image_alt_text),
           current_price_cents = COALESCE($8, current_price_cents),
           currency = $9,
           rating = COALESCE($10, rating),
           review_count = COALESCE($11, review_count),
           availability_status = $12,
           retailer_category_path = COALESCE($13, retailer_category_path),
           last_scraped_at = now(),
           last_seen_at = now(),
           raw_source_hash = $14,
           is_stale = false,
           updated_at = now()
       WHERE retailer_id = $1
         AND ctid = (
           SELECT ctid
           FROM retailer_products
           WHERE retailer_id = $1
             AND retailer_product_id IS NULL
             AND (
               canonical_url = $5
               OR retailer_url = $4
               OR canonical_url LIKE '%' || $3 || '%'
               OR retailer_url LIKE '%' || $3 || '%'
             )
           ORDER BY updated_at DESC
           LIMIT 1
         )`,
      values
    );
    if (backfilled.rowCount) return;
  }

  await client.query(
    `INSERT INTO retailer_products (
       retailer_id, product_id, retailer_product_id, retailer_url, canonical_url,
       image_url, image_alt_text, current_price_cents, currency, rating, review_count,
       availability_status, retailer_category_path, last_scraped_at, last_seen_at,
       raw_source_hash, is_stale
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now(), $14, false)
     ON CONFLICT (retailer_id, canonical_url) DO UPDATE
     SET product_id = EXCLUDED.product_id,
         retailer_product_id = COALESCE(EXCLUDED.retailer_product_id, retailer_products.retailer_product_id),
         retailer_url = EXCLUDED.retailer_url,
         image_url = COALESCE(EXCLUDED.image_url, retailer_products.image_url),
         image_alt_text = COALESCE(EXCLUDED.image_alt_text, retailer_products.image_alt_text),
         current_price_cents = COALESCE(EXCLUDED.current_price_cents, retailer_products.current_price_cents),
         currency = EXCLUDED.currency,
         rating = COALESCE(EXCLUDED.rating, retailer_products.rating),
         review_count = COALESCE(EXCLUDED.review_count, retailer_products.review_count),
         availability_status = EXCLUDED.availability_status,
         retailer_category_path = COALESCE(EXCLUDED.retailer_category_path, retailer_products.retailer_category_path),
         last_scraped_at = now(),
         last_seen_at = now(),
         raw_source_hash = EXCLUDED.raw_source_hash,
         is_stale = false,
         updated_at = now()`,
    values
  );
}

async function replaceProductIngredients(client, productId, rawIngredients) {
  if (!rawIngredients) return;
  await client.query("DELETE FROM product_ingredients WHERE product_id = $1", [productId]);
  const tokens = parseIngredientList(rawIngredients);
  for (const token of tokens) {
    await client.query(
      `INSERT INTO product_ingredients (
         product_id, raw_name, normalized_name, position, section_label,
         is_may_contain, parse_confidence
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (product_id, position, normalized_name) DO NOTHING`,
      [
        productId,
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

function inferCategory(product) {
  const haystack = `${product.name || ""} ${product.description || ""} ${product.canonicalUrl || ""}`.toLowerCase();
  const rules = [
    ["foundation", "Foundation", "makeup", /\bfoundation\b/],
    ["blush", "Blush", "makeup", /\bblush\b/],
    ["eyeliner", "Eyeliner", "makeup", /\beyeliner\b|\beye liner\b/],
    ["eyeshadow", "Eyeshadow", "makeup", /\beyeshadow\b|\beye shadow\b/],
    ["shampoo", "Shampoo", "haircare", /\bshampoo\b/],
    ["conditioner", "Conditioner", "haircare", /\bconditioner\b/],
    ["cleanser", "Cleanser", "skincare", /\bcleanser\b|\bface wash\b/],
    ["moisturizer", "Moisturizer", "skincare", /\bmoisturizer\b|\bmoisturiser\b|\bcream\b/]
  ];
  const match = rules.find(([, , , regex]) => regex.test(haystack));
  if (!match) return { slug: "unknown", displayName: "Unknown", domain: "unknown" };
  const [subcategory, displayName, domain] = match;
  return { slug: `${domain}-${subcategory}`, displayName, domain };
}

function normalizedKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

module.exports = { inferCategory, upsertExtractedProduct, validateExtractedProduct };
