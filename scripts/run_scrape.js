#!/usr/bin/env node
"use strict";

const { loadLocalEnv } = require("./load_env");
const { Client } = require("pg");
const { sleep } = require("../scrapers/base/adapter");
const { SephoraAdapter } = require("../scrapers/sephora/adapter");
const { UltaAdapter } = require("../scrapers/ulta/adapter");
const { upsertExtractedProduct, validateExtractedProduct } = require("../scrapers/pipelines/upsert");

const ADAPTERS = {
  sephora: SephoraAdapter,
  ulta: UltaAdapter
};

loadLocalEnv();

async function main() {
  const retailer = getArg("--retailer") || "sephora";
  const Adapter = ADAPTERS[retailer];
  if (!Adapter) throw new Error(`Unsupported retailer: ${retailer}`);

  const all = hasFlag("--all");
  const limit = all ? undefined : Number(getArg("--limit") || 5);
  const dryRun = hasFlag("--dry-run");
  const countOnly = hasFlag("--count-only");
  const skipExistingImages = hasFlag("--skip-existing-images");
  const shard = optionalIntegerArg("--shard");
  const shards = optionalIntegerArg("--shards");
  const delayMs = Number(getArg("--delay-ms") || process.env.SCRAPER_DELAY_MS || 5000);
  const sitemapUrl = getArg("--sitemap-url");
  const adapter = new Adapter({ delayMs });
  const shardConfig = validateShardConfig(retailer, shard, shards);

  console.log(`${adapter.displayName} scrape starting. limit=${all ? "all" : limit} delayMs=${delayMs} dryRun=${dryRun}${shardConfig ? ` shard=${shardConfig.shard}/${shardConfig.shards}` : ""}`);
  let urls = await adapter.discoverProductUrls({ all, limit, sitemapUrl });
  console.log(`Discovered ${urls.length} allowed ${adapter.displayName} product URL(s).`);

  if (shardConfig) {
    const before = urls.length;
    urls = applyShard(urls, shardConfig.shard, shardConfig.shards);
    console.log(`Shard ${shardConfig.shard}/${shardConfig.shards} selected ${urls.length} of ${before} URL(s).`);
  }

  if (countOnly) {
    console.log(`${adapter.displayName} product URL count: ${urls.length}`);
    return;
  }

  if (dryRun) {
    for (const url of urls) console.log(url);
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for a committed scrape. Use --dry-run to test discovery only.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const retailerId = await ensureRetailer(client, adapter);
  if (skipExistingImages) {
    const before = urls.length;
    urls = await filterAlreadyRefreshedUrls(client, adapter, urls);
    console.log(`Skipped ${before - urls.length} already-refreshed URL(s); ${urls.length} URL(s) remain.`);
  }

  const scrapeRunId = await startScrapeRun(client, retailerId);
  const summary = {
    pagesProcessed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsFailed: 0
  };

  try {
    for (const [index, url] of urls.entries()) {
      if (index > 0) await sleep(delayMs);
      try {
        console.log(`Fetching ${index + 1}/${urls.length}: ${url}`);
        const html = await adapter.fetchProductHtml(url);
        const extracted = adapter.extractProduct(html, url);
        const validation = validateExtractedProduct(extracted);
        if (!validation.ok) throw new Error(validation.errors.join("; "));

        const existed = await retailerProductExists(client, extracted.retailerSlug, extracted.canonicalUrl);
        await client.query("BEGIN");
        await upsertExtractedProduct(client, extracted);
        await client.query("COMMIT");

        summary.pagesProcessed += 1;
        if (existed) summary.productsUpdated += 1;
        else summary.productsCreated += 1;
      } catch (error) {
        await rollbackIfNeeded(client);
        summary.productsFailed += 1;
        await logFailure(client, scrapeRunId, url, error);
        console.error(`Failed ${url}: ${error.message}`);
      }
      await updateScrapeRun(client, scrapeRunId, "running", summary);
    }

    const status = summary.productsFailed === urls.length && urls.length > 0 ? "failed" : "completed";
    await updateScrapeRun(client, scrapeRunId, status, summary, true);
    await markRetailerComplete(client, retailerId, status);
    console.log(`Scrape ${status}: ${JSON.stringify(summary)}`);
  } finally {
    await client.end();
  }
}

function getArg(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function optionalIntegerArg(name) {
  const value = getArg(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function validateShardConfig(retailer, shard, shards) {
  if (shard === undefined && shards === undefined) return null;
  if (retailer !== "ulta") throw new Error("--shard/--shards are enabled for Ulta only.");
  if (shard === undefined || shards === undefined) throw new Error("--shard and --shards must be provided together.");
  if (shards < 2) throw new Error("--shards must be at least 2.");
  if (shard < 0 || shard >= shards) throw new Error("--shard must be between 0 and --shards - 1.");
  return { shard, shards };
}

function applyShard(urls, shard, shards) {
  return urls.filter((_, index) => index % shards === shard);
}

async function ensureRetailer(client, adapter) {
  const result = await client.query(
    `INSERT INTO retailers (slug, display_name, base_url, scrape_status)
     VALUES ($1, $2, $3, 'running')
     ON CONFLICT (slug) DO UPDATE
     SET display_name = EXCLUDED.display_name,
         base_url = EXCLUDED.base_url,
         scrape_status = 'running',
         updated_at = now()
     RETURNING id`,
    [adapter.slug, adapter.displayName, adapter.slug === "sephora" ? "https://www.sephora.com" : "https://www.ulta.com"]
  );
  return result.rows[0].id;
}

async function startScrapeRun(client, retailerId) {
  const result = await client.query(
    "INSERT INTO scrape_runs (retailer_id, status) VALUES ($1, 'running') RETURNING id",
    [retailerId]
  );
  return result.rows[0].id;
}

async function updateScrapeRun(client, scrapeRunId, status, summary, complete = false) {
  await client.query(
    `UPDATE scrape_runs
     SET status = $2,
         pages_processed = $3,
         products_created = $4,
         products_updated = $5,
         products_failed = $6,
         completed_at = CASE WHEN $7 THEN now() ELSE completed_at END
     WHERE id = $1`,
    [
      scrapeRunId,
      status,
      summary.pagesProcessed,
      summary.productsCreated,
      summary.productsUpdated,
      summary.productsFailed,
      complete
    ]
  );
}

async function markRetailerComplete(client, retailerId, status) {
  await client.query(
    `UPDATE retailers
     SET scrape_status = $2,
         last_successful_sync_at = CASE WHEN $2 = 'completed' THEN now() ELSE last_successful_sync_at END,
         updated_at = now()
     WHERE id = $1`,
    [retailerId, status]
  );
}

async function retailerProductExists(client, retailerSlug, canonicalUrl) {
  const result = await client.query(
    `SELECT 1
     FROM retailer_products rp
     JOIN retailers r ON r.id = rp.retailer_id
     WHERE r.slug = $1 AND rp.canonical_url = $2
     LIMIT 1`,
    [retailerSlug, canonicalUrl]
  );
  return Boolean(result.rowCount);
}

async function filterAlreadyRefreshedUrls(client, adapter, urls) {
  const productIds = urls.map((url) => extractRetailerProductId(adapter, url)).filter(Boolean);
  if (productIds.length === 0) return urls;

  const result = await client.query(
    `SELECT rp.retailer_product_id
     FROM retailer_products rp
     JOIN retailers r ON r.id = rp.retailer_id
     WHERE r.slug = $1
       AND rp.retailer_product_id = ANY($2)
       AND rp.image_url IS NOT NULL`,
    [adapter.slug, productIds]
  );
  const refreshedIds = new Set(result.rows.map((row) => row.retailer_product_id));
  return urls.filter((url) => {
    const productId = extractRetailerProductId(adapter, url);
    return !productId || !refreshedIds.has(productId);
  });
}

function extractRetailerProductId(adapter, url) {
  if (adapter.constructor.name === "SephoraAdapter") return url.match(/P\d+/i)?.[0] || null;
  if (adapter.constructor.name === "UltaAdapter") {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("sku") || parsed.searchParams.get("productId");
    } catch (_error) {
      return null;
    }
  }
  return null;
}

async function logFailure(client, scrapeRunId, url, error) {
  await client.query(
    `INSERT INTO scrape_failures (scrape_run_id, retailer_url, error_type, error_message, retryable)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      scrapeRunId,
      url,
      error.status ? `http_${error.status}` : error.validationErrors ? "validation" : "extraction",
      String(error.message || error).slice(0, 1000),
      !error.status || error.status >= 500
    ]
  );
}

async function rollbackIfNeeded(client) {
  try {
    await client.query("ROLLBACK");
  } catch (_error) {
    // No active transaction.
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
