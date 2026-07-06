"use strict";

const { RetailerAdapter } = require("../base/adapter");
const { extractSitemapLocs, fetchText, isAllowedSephoraProductUrl } = require("../base/http");
const { decodeHtml, findProductJsonLd, normalizeWhitespace, parsePriceCents, textFromMeta } = require("../base/parsers");

class SephoraAdapter extends RetailerAdapter {
  get slug() {
    return "sephora";
  }

  get displayName() {
    return "Sephora";
  }

  async discoverProductUrls(options = {}) {
    const limit = options.all ? Number.POSITIVE_INFINITY : Number(options.limit || 25);
    const sitemapUrl = options.sitemapUrl || "https://www.sephora.com/sitemap.xml";
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
        if (isAllowedSephoraProductUrl(loc)) {
          productUrls.push(canonicalizeSephoraUrl(loc));
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
    const brand = typeof jsonLd.brand === "object" ? jsonLd.brand.name : jsonLd.brand || regexValue(html, /"brandName":"([^"]+)"/);
    const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers || {};
    const image = absoluteSephoraUrl(
      Array.isArray(jsonLd.image)
        ? jsonLd.image[0]
        : jsonLd.image || textFromMeta(html, "og:image") || regexValue(html, /<link[^>]+rel="preload"[^>]+href="([^"]*\/productimages\/[^"]+)"/i)
    );
    const name = normalizeProductName(jsonLd.name || textFromMeta(html, "og:title") || regexValue(html, /"displayName":"([^"]+)"/));
    const currentPriceCents = parsePriceCents(
      offer.price ||
        regexValue(html, /"salePrice":"([^"]+)"/) ||
        regexValue(html, /"listPrice":"([^"]+)"/) ||
        regexValue(html, /"valuePrice":"([^"]+)"/)
    );

    return {
      retailerSlug: this.slug,
      retailerProductId: extractSephoraProductId(url),
      canonicalUrl: canonicalizeSephoraUrl(url),
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
        : numberValue(regexValue(html, /"productRating":([0-9.]+)/)),
      reviewCount: jsonLd.aggregateRating?.reviewCount
        ? Number(jsonLd.aggregateRating.reviewCount)
        : numberValue(regexValue(html, /"reviews":([0-9]+)/)),
      availabilityStatus: normalizeAvailability(offer.availability),
      categoryPath: extractCategoryPath(html),
      rawExtractionConfidence: name && brand ? 0.75 : 0.4,
      extractionErrors: name && brand ? [] : ["missing_core_product_fields"]
    };
  }
}

function extractSephoraProductId(url) {
  return new URL(url).pathname.match(/P\d+/i)?.[0] || null;
}

function canonicalizeSephoraUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.searchParams.delete("icid2");
  return parsed.toString();
}

function extractIngredientText(html) {
  const embedded = regexValue(html, /"ingredientDesc":"([\s\S]*?)","/);
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

function absoluteSephoraUrl(value) {
  const cleaned = decodeHtml(unescapeJsonString(value || "")).trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  if (cleaned.startsWith("/")) return `https://www.sephora.com${cleaned}`;
  return cleaned;
}

function normalizeProductName(value) {
  return normalizeWhitespace(decodeHtml(unescapeJsonString(value))).replace(/\s*\|\s*Sephora\s*$/i, "");
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCategoryPath(html) {
  const names = [];
  const regex = /"productCategories":\{([\s\S]{0,2000}?)\}\s*[},]/;
  const categoryBlock = html.match(regex)?.[1] || "";
  const nameRegex = /"displayName":"([^"]+)"/g;
  let match;
  while ((match = nameRegex.exec(categoryBlock))) names.push(unescapeJsonString(match[1]));
  return names.reverse().join(" > ");
}

module.exports = { SephoraAdapter, canonicalizeSephoraUrl, extractSephoraProductId };
