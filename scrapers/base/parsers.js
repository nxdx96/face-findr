"use strict";

function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const raw = decodeHtml(match[1].trim());
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else if (parsed && Array.isArray(parsed["@graph"])) blocks.push(...parsed["@graph"]);
      else blocks.push(parsed);
    } catch (_error) {
      continue;
    }
  }
  return blocks;
}

function findProductJsonLd(html) {
  return extractJsonLd(html).find((block) => {
    const type = block && block["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });
}

function textFromMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return decodeHtml(regex.exec(html)?.[1] || "");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

function parsePriceCents(value) {
  const amount = Number.parseFloat(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

module.exports = {
  decodeHtml,
  extractJsonLd,
  findProductJsonLd,
  normalizeWhitespace,
  parsePriceCents,
  textFromMeta
};
