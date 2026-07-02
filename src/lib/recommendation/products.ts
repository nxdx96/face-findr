import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Product, ProductDataQuality } from "./schemas.ts";

export type ProductSourceRow = Record<string, string>;

const PRODUCT_CACHE: { products?: Product[] } = {};

export async function loadProducts(csvPath = path.join(process.cwd(), "raw_data", "merge_df.csv")): Promise<Product[]> {
  if (PRODUCT_CACHE.products && csvPath.endsWith(path.join("raw_data", "merge_df.csv"))) return PRODUCT_CACHE.products;

  const csv = await readFile(csvPath, "utf8");
  const rows = parseCsv(csv);
  const products = rows.map(rowToProduct);

  if (csvPath.endsWith(path.join("raw_data", "merge_df.csv"))) PRODUCT_CACHE.products = products;
  return products;
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
    rating: parseNumber(row.rating),
    details: clean(row.details),
    ingredients,
    url: clean(row.url),
    store: clean(row.store),
    dataQuality,
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
