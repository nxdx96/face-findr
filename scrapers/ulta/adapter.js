"use strict";

const { RetailerAdapter } = require("../base/adapter");
const { extractSitemapLocs, fetchText, isAllowedUltaProductUrl } = require("../base/http");
const { decodeHtml, findProductJsonLd, normalizeWhitespace, parsePriceCents, textFromMeta } = require("../base/parsers");

class UltaAdapter extends RetailerAdapter {
  get slug() {
    return "ulta";
  }

  get displayName() {
    return "Ulta";
  }

  async discoverProductUrls(options = {}) {
    const limit = options.all ? Number.POSITIVE_INFINITY : Number(options.limit || 25);
    const sitemapUrl = options.sitemapUrl || "https://www.ulta.com/sitemap/index.xml";
    const seenSitemaps = new Set();
    const queuedSitemaps = [sitemapUrl];
    const productUrls = [];

    while (queuedSitemaps.length > 0 && productUrls.length < limit) {
      const current = queuedSitemaps.shift();
      if (!current || seenSitemaps.has(current)) continue;
      seenSitemaps.add(current);

      const xml = await fetchText(current, {
        userAgent: this.config.userAgent,
        accept: "application/xml,text/xml,*/*;q=0.8"
      });
      const locs = extractSitemapLocs(xml);

      for (const loc of locs) {
        if (productUrls.length >= limit) break;
        if (isAllowedUltaProductUrl(loc)) {
          productUrls.push(canonicalizeUltaUrl(loc));
          continue;
        }
        if (/sitemap/i.test(loc) && !seenSitemaps.has(loc)) queuedSitemaps.push(loc);
      }
    }

    const uniqueUrls = [...new Set(productUrls)];
    return options.all ? uniqueUrls : uniqueUrls.slice(0, limit);
  }

  async fetchProductHtml(url) {
    return fetchText(url, { userAgent: this.config.userAgent });
  }

  extractProduct(html, url) {
    const jsonLd = findProductJsonLd(html) || {};
    const brand = typeof jsonLd.brand === "object"
      ? jsonLd.brand.name
      : jsonLd.brand || regexValue(html, /"brandName"\s*:\s*"([^"]+)"/) || regexValue(html, /"brand"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"/);
    const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers || {};
    const image = absoluteUltaUrl(
      Array.isArray(jsonLd.image)
        ? jsonLd.image[0]
        : jsonLd.image || textFromMeta(html, "og:image") || regexValue(html, /"imageUrl"\s*:\s*"([^"]+)"/) || regexValue(html, /"primaryImageUrl"\s*:\s*"([^"]+)"/)
    );
    const name = normalizeProductName(jsonLd.name || textFromMeta(html, "og:title") || regexValue(html, /"productName"\s*:\s*"([^"]+)"/) || regexValue(html, /"name"\s*:\s*"([^"]+)"/));
    const currentPriceCents = parsePriceCents(
      offer.price ||
        regexValue(html, /"salePrice"\s*:\s*"?([^",}]+)"?/) ||
        regexValue(html, /"listPrice"\s*:\s*"?([^",}]+)"?/) ||
        regexValue(html, /"price"\s*:\s*"?([^",}]+)"?/)
    );

    return {
      retailerSlug: this.slug,
      retailerProductId: extractUltaProductId(url),
      canonicalUrl: canonicalizeUltaUrl(url),
      retailerUrl: url,
      brand: normalizeWhitespace(brand),
      name,
      description: normalizeWhitespace(jsonLd.description || textFromMeta(html, "og:description")),
      ingredientTextRaw: extractIngredientText(html),
      imageUrl: image || null,
      imageAltText: name,
      currentPriceCents,
      currency: offer.priceCurrency || "USD",
      rating: jsonLd.aggregateRating?.ratingValue
        ? Number(jsonLd.aggregateRating.ratingValue)
        : numberValue(regexValue(html, /"rating"\s*:\s*([0-9.]+)/) || regexValue(html, /"ratingValue"\s*:\s*"?([0-9.]+)"?/)),
      reviewCount: jsonLd.aggregateRating?.reviewCount
        ? Number(jsonLd.aggregateRating.reviewCount)
        : numberValue(regexValue(html, /"reviewCount"\s*:\s*"?([0-9]+)"?/)),
      availabilityStatus: normalizeAvailability(offer.availability),
      categoryPath: extractCategoryPath(html),
      rawExtractionConfidence: name && brand ? 0.75 : 0.4,
      extractionErrors: name && brand ? [] : ["missing_core_product_fields"]
    };
  }
}

function extractUltaProductId(url) {
  const parsed = new URL(url);
  return parsed.searchParams.get("sku") || parsed.searchParams.get("productId");
}

function canonicalizeUltaUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  const sku = parsed.searchParams.get("sku");
  const productId = parsed.searchParams.get("productId");
  parsed.search = "";
  if (sku) parsed.searchParams.set("sku", sku);
  if (productId) parsed.searchParams.set("productId", productId);
  return parsed.toString();
}

function extractIngredientText(html) {
  const embedded = regexValue(html, /"ingredients"\s*:\s*"([\s\S]*?)"/) || regexValue(html, /"ingredientDesc"\s*:\s*"([\s\S]*?)"/);
  if (embedded) return normalizeWhitespace(decodeHtml(unescapeJsonString(embedded)).replace(/<[^>]+>/g, " "));
  const match = html.match(/Ingredients<\/[^>]+>\s*<[^>]+>([\s\S]{0,5000}?)<\/[^>]+>/i);
  return normalizeWhitespace(match?.[1]?.replace(/<[^>]+>/g, " ") || "");
}

function normalizeAvailability(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("instock")) return "in_stock";
  if (text.includes("outofstock")) return "out_of_stock";
  return "unknown";
}

function regexValue(html, regex) {
  const match = html.match(regex);
  return match ? unescapeJsonString(match[1]) : "";
}

function unescapeJsonString(value) {
  return String(value || "")
    .replace(/\\"/g, "\"")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ");
}

function absoluteUltaUrl(value) {
  const cleaned = decodeHtml(unescapeJsonString(value || "")).trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  if (cleaned.startsWith("/")) return `https://www.ulta.com${cleaned}`;
  return cleaned;
}

function normalizeProductName(value) {
  return normalizeWhitespace(decodeHtml(unescapeJsonString(value)))
    .replace(/\s*\|\s*Ulta Beauty\s*$/i, "")
    .replace(/\s*\|\s*Ulta\s*$/i, "");
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCategoryPath(html) {
  const matches = [...html.matchAll(/"categoryName"\s*:\s*"([^"]+)"/g)].map((match) => unescapeJsonString(match[1]));
  return [...new Set(matches)].slice(0, 5).join(" > ");
}

module.exports = { UltaAdapter, canonicalizeUltaUrl, extractUltaProductId };
