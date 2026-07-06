import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPool, hasDatabaseUrl } from "../catalog/db.ts";
import type { Product, ProductDataQuality } from "./schemas.ts";

export type ProductSourceRow = Record<string, string>;

const PRODUCT_CACHE: { products?: Product[] } = {};
const DB_PRODUCT_CACHE: { products?: Product[] } = {};

export async function loadProducts(csvPath = path.join(process.cwd(), "raw_data", "merge_df.csv")): Promise<Product[]> {
  if (hasDatabaseUrl() && csvPath.endsWith(path.join("raw_data", "merge_df.csv"))) {
    return loadProductsFromDatabase();
  }

  if (PRODUCT_CACHE.products && csvPath.endsWith(path.join("raw_data", "merge_df.csv"))) return PRODUCT_CACHE.products;

  const csv = await readFile(csvPath, "utf8");
  const rows = parseCsv(csv);
  const products = rows.map(rowToProduct);

  if (csvPath.endsWith(path.join("raw_data", "merge_df.csv"))) PRODUCT_CACHE.products = products;
  return products;
}

export async function loadProductsFromDatabase(): Promise<Product[]> {
  if (DB_PRODUCT_CACHE.products) return DB_PRODUCT_CACHE.products;

  const result = await getPool().query<ProductCatalogRow>(`
    SELECT
      p.id::text AS product_id,
      p.canonical_name,
      p.description,
      p.ingredient_text_raw,
      p.data_quality_status,
      b.display_name AS brand_name,
      c.slug AS category_slug,
      c.product_domain,
      r.slug AS retailer_slug,
      r.display_name AS retailer_name,
      rp.canonical_url,
      rp.retailer_url,
      rp.image_url,
      rp.image_alt_text,
      rp.current_price_cents,
      rp.currency,
      rp.rating,
      rp.review_count,
      rp.availability_status,
      rp.is_stale,
      rp.last_scraped_at
    FROM products p
    JOIN brands b ON b.id = p.brand_id
    JOIN categories c ON c.id = p.category_id
    JOIN retailer_products rp ON rp.product_id = p.id
    JOIN retailers r ON r.id = rp.retailer_id
    WHERE r.is_enabled = true
      AND rp.canonical_url IS NOT NULL
      AND rp.availability_status <> 'removed'
    ORDER BY p.canonical_name ASC
  `);

  const products = result.rows.map(rowToCatalogProduct).filter(Boolean) as Product[];
  DB_PRODUCT_CACHE.products = products;
  return products;
}

export function clearProductCachesForTests(): void {
  PRODUCT_CACHE.products = undefined;
  DB_PRODUCT_CACHE.products = undefined;
}

export function rowToProduct(row: ProductSourceRow): Product {
  const ingredients = clean(row.ingredients);
  const dataQuality = ingredientDataQuality(ingredients);
  return {
    id: clean(row.index) || `${clean(row.brand)}:${clean(row.product)}`,
    brand: clean(row.brand),
    name: clean(row.product),
    category: normalizeCategory(clean(row.product_type)),
    price: parseNumber(row[" price "] ?? row.price),
    currency: "USD",
    rating: parseNumber(row.rating),
    details: clean(row.details),
    ingredients,
    url: clean(row.url),
    canonicalUrl: clean(row.url),
    store: clean(row.store),
    retailerSlug: normalizeRetailerSlug(clean(row.store)),
    availabilityStatus: "unknown",
    dataQuality,
  };
}

type ProductCatalogRow = {
  product_id: string;
  canonical_name: string;
  description: string | null;
  ingredient_text_raw: string | null;
  data_quality_status: ProductDataQuality | "needs_review";
  brand_name: string;
  category_slug: string;
  product_domain: string;
  retailer_slug: string;
  retailer_name: string;
  canonical_url: string;
  retailer_url: string;
  image_url: string | null;
  image_alt_text: string | null;
  current_price_cents: number | null;
  currency: string | null;
  rating: string | number | null;
  review_count: number | null;
  availability_status: string | null;
  is_stale: boolean | null;
  last_scraped_at: Date | string | null;
};

function rowToCatalogProduct(row: ProductCatalogRow): Product | null {
  const canonicalUrl = validRetailerUrl(row.canonical_url, row.retailer_slug) ? row.canonical_url : "";
  const retailerUrl = validRetailerUrl(row.retailer_url, row.retailer_slug) ? row.retailer_url : canonicalUrl;
  const imageUrl = row.image_url && isValidHttpUrl(row.image_url) ? row.image_url : undefined;
  if (!canonicalUrl && !retailerUrl) return null;

  return {
    id: row.product_id,
    brand: row.brand_name,
    name: row.canonical_name,
    category: categoryForEngine(row.category_slug, row.product_domain),
    price: row.current_price_cents == null ? undefined : row.current_price_cents / 100,
    currency: row.currency ?? "USD",
    rating: row.rating == null ? undefined : Number(row.rating),
    reviewCount: row.review_count ?? undefined,
    details: row.description ?? undefined,
    ingredients: row.ingredient_text_raw ?? undefined,
    url: retailerUrl,
    canonicalUrl,
    imageUrl,
    imageAltText: row.image_alt_text ?? undefined,
    store: row.retailer_name,
    retailerSlug: row.retailer_slug,
    availabilityStatus: row.availability_status ?? "unknown",
    isStale: Boolean(row.is_stale),
    lastScrapedAt: row.last_scraped_at ? new Date(row.last_scraped_at).toISOString() : undefined,
    dataQuality: toProductDataQuality(row.data_quality_status, row.ingredient_text_raw ?? ""),
  };
}

export function parseCsv(csv: string): ProductSourceRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...records] = rows;
  return records.map((record) => {
    const output: ProductSourceRow = {};
    headers.forEach((header, index) => {
      output[header] = record[index] ?? "";
    });
    return output;
  });
}

export function normalizeCategory(category: string): string {
  const normalized = category.toLowerCase().trim().replace(/_/g, "-").replace(/\s+/g, "-");
  if (["face-cleanser", "cleanser"].includes(normalized)) return "cleanser";
  if (["face-moisturizer", "moisturizer"].includes(normalized)) return "moisturizer";
  if (["face-wash", "facewash"].includes(normalized)) return "face-wash";
  return normalized;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value.replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function categoryForEngine(categorySlug: string, productDomain: string): string {
  const parts = categorySlug.split("-");
  const leaf = parts.length > 1 ? parts.slice(1).join("-") : categorySlug;
  if (leaf === "cleanser" || leaf === "moisturizer") return leaf;
  if (productDomain === "makeup" || productDomain === "skincare" || productDomain === "haircare") return leaf;
  return categorySlug;
}

function toProductDataQuality(status: string, ingredients: string): ProductDataQuality {
  if (status === "complete" || status === "partial" || status === "missing-ingredients" || status === "unparseable-ingredients") {
    return status;
  }
  return ingredientDataQuality(ingredients);
}

export function normalizeRetailerSlug(value: string): string | undefined {
  const normalized = value.toLowerCase().trim();
  if (normalized.includes("sephora")) return "sephora";
  if (normalized.includes("ulta")) return "ulta";
  return normalized ? normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined;
}

export function validRetailerUrl(value: string | undefined, retailerSlug: string | undefined): boolean {
  if (!isValidHttpUrl(value)) return false;
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (retailerSlug === "sephora") return hostname === "sephora.com" || hostname.endsWith(".sephora.com");
  if (retailerSlug === "ulta") return hostname === "ulta.com" || hostname.endsWith(".ulta.com");
  return true;
}

export function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function ingredientDataQuality(ingredients: string): ProductDataQuality {
  if (!ingredients) return "missing-ingredients";
  if (ingredients.length < 5 || /^n\/?a$/i.test(ingredients) || /^not available$/i.test(ingredients)) {
    return "unparseable-ingredients";
  }
  if (ingredients.length < 25) return "partial";
  return "complete";
}
