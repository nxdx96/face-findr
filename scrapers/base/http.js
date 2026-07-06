"use strict";

const DISALLOWED_SEPHORA_PATH_PREFIXES = [
  "/sephoratv",
  "/basket",
  "/browse/",
  "/checkout",
  "/contentStore/",
  "/error/",
  "/lovelist/",
  "/profile/",
  "/search",
  "/shopping-list",
  "/beauty-win-promo",
  "/share",
  "/purchase-history",
  "/gway/"
];

const DISALLOWED_ULTA_PATH_PREFIXES = [
  "/account/",
  "/auth/",
  "/authorize/",
  "/u/",
  "/wishlists/",
  "/curbside-alert/",
  "/community/groups/"
];

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "user-agent": options.userAgent || "Ingredi-Findr catalog refresh (+public product metadata only)",
      "accept": options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    redirect: "follow",
    signal: options.signal
  });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} for ${url}`);
    error.status = response.status;
    throw error;
  }

  return response.text();
}

function extractSitemapLocs(xml) {
  const locs = [];
  const regex = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    locs.push(decodeXml(match[1].trim()));
  }
  return locs;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function isAllowedSephoraProductUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (host !== "sephora.com" && host !== "www.sephora.com") return false;
    if (!url.pathname.includes("/product/")) return false;
    return !DISALLOWED_SEPHORA_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  } catch (_error) {
    return false;
  }
}

function isAllowedUltaProductUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (host !== "ulta.com" && host !== "www.ulta.com") return false;
    if (!url.pathname.startsWith("/p/")) return false;
    if (!url.searchParams.get("sku")) return false;
    return !DISALLOWED_ULTA_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  } catch (_error) {
    return false;
  }
}

module.exports = {
  fetchText,
  extractSitemapLocs,
  isAllowedSephoraProductUrl,
  isAllowedUltaProductUrl
};
