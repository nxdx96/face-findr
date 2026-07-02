"use strict";

const fs = require("fs");
const path = require("path");

const DATA_ROOT = path.resolve(__dirname, "../../..", "data");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, fileName), "utf8"));
}

function normalizeIngredientName(value) {
  if (value == null) return "";
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[®™©]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*\/\s*/g, "/")
    .replace(/[\[\]{}]/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\bmay contain\b:?/gi, " ")
    .replace(/\+\/-/g, " ")
    .replace(/[^a-z0-9+./'-]+/g, " ")
    .replace(/^[.]+|[.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildIngredientIndex(aliasData = readJson("ingredient_aliases.json"), groupData = readJson("ingredient_groups.json")) {
  const exact = new Map();
  const canonicalByName = new Map();
  for (const ingredient of aliasData.ingredients) {
    canonicalByName.set(ingredient.canonical_name, ingredient);
    exact.set(normalizeIngredientName(ingredient.canonical_name), {
      canonical_name: ingredient.canonical_name,
      normalized_name: ingredient.normalized_name,
      match_type: "canonical"
    });
    for (const alias of ingredient.aliases || []) {
      exact.set(normalizeIngredientName(alias), {
        canonical_name: ingredient.canonical_name,
        normalized_name: ingredient.normalized_name,
        match_type: alias === ingredient.canonical_name ? "canonical" : "alias"
      });
    }
  }

  const groupsByIngredient = new Map();
  for (const group of groupData.groups) {
    for (const member of group.members || []) {
      const existing = groupsByIngredient.get(member) || [];
      existing.push({
        slug: group.slug,
        display_name: group.display_name,
        caution_level: group.caution_level
      });
      groupsByIngredient.set(member, existing);
    }
  }

  return { exact, canonicalByName, groupsByIngredient };
}

function matchIngredient(rawOrNormalized, index = buildIngredientIndex()) {
  const normalized = normalizeIngredientName(rawOrNormalized);
  const match = index.exact.get(normalized);
  if (!match) {
    return {
      raw_name: rawOrNormalized,
      normalized_name: normalized,
      canonical_name: null,
      match_type: "none",
      groups: []
    };
  }
  return {
    raw_name: rawOrNormalized,
    normalized_name: normalized,
    canonical_name: match.canonical_name,
    match_type: match.match_type,
    groups: index.groupsByIngredient.get(match.canonical_name) || []
  };
}

function splitTopLevel(value) {
  const parts = [];
  let buffer = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") parenDepth += 1;
    if (char === ")" && parenDepth > 0) parenDepth -= 1;
    if (char === "[") bracketDepth += 1;
    if (char === "]" && bracketDepth > 0) bracketDepth -= 1;
    if ((char === "," || char === ";") && parenDepth === 0 && bracketDepth === 0) {
      parts.push(buffer);
      buffer = "";
    } else {
      buffer += char;
    }
  }
  if (buffer.length > 0) parts.push(buffer);
  return parts;
}

function stripLeadIn(value) {
  return value
    .replace(/^ingredients\s*:?\s*/i, "")
    .replace(/^inactive ingredients\s*:?\s*/i, "")
    .replace(/^active ingredients\s*:?\s*/i, "");
}

function parseIngredientList(rawIngredients) {
  const raw = rawIngredients == null ? "" : String(rawIngredients);
  if (raw.trim() === "") return [];

  const normalizedMayContain = raw
    .replace(/may\s+contain\)?\s*:/gi, "May Contain:")
    .replace(/\+\/-/g, "+/-:");
  const chunks = splitTopLevel(normalizedMayContain);
  const parsed = [];
  let sectionLabel = null;
  let isMayContain = false;
  let position = 0;

  for (const chunk of chunks) {
    let token = stripLeadIn(chunk.trim());
    if (!token) continue;

    const mayContainMatch = token.match(/^(.*?)(May Contain:|\+\/-:)\s*(.*)$/i);
    if (mayContainMatch) {
      const before = mayContainMatch[1].trim().replace(/[.:]+$/, "");
      const after = mayContainMatch[3].trim();
      if (before) {
        position += 1;
        parsed.push(makeParsedToken(before, sectionLabel, false, position));
      }
      isMayContain = true;
      sectionLabel = sectionLabel || "May Contain";
      token = after;
      if (!token) continue;
    }

    const sectionMatch = token.match(/^([A-Za-z0-9][A-Za-z0-9 '&/+.-]{1,79}):\s*(.+)$/);
    if (sectionMatch && !/^(ci|fd&c|d&c)\s/i.test(sectionMatch[1])) {
      const possibleLabel = sectionMatch[1].trim();
      if (!/^(water|aqua|glycerin|mica|talc)$/i.test(possibleLabel)) {
        sectionLabel = possibleLabel;
        token = sectionMatch[2].trim();
      }
    }

    if (!token) continue;
    position += 1;
    parsed.push(makeParsedToken(token, sectionLabel, isMayContain, position));
  }

  return parsed;
}

function makeParsedToken(rawToken, sectionLabel, isMayContain, position) {
  const cleanedRaw = rawToken.trim().replace(/^[.:]+|[.:]+$/g, "").trim();
  const normalizedToken = normalizeIngredientName(cleanedRaw);
  const hasUnbalancedParentheses =
    (cleanedRaw.match(/\(/g) || []).length !== (cleanedRaw.match(/\)/g) || []).length ||
    (cleanedRaw.match(/\[/g) || []).length !== (cleanedRaw.match(/\]/g) || []).length;
  let parseConfidence = 0.95;
  if (isMayContain) parseConfidence = 0.88;
  if (sectionLabel && sectionLabel !== "May Contain") parseConfidence = Math.min(parseConfidence, 0.9);
  if (hasUnbalancedParentheses || normalizedToken.length === 0) parseConfidence = 0.55;
  return {
    raw_token: cleanedRaw,
    normalized_token: normalizedToken,
    section_label: sectionLabel,
    is_may_contain: Boolean(isMayContain),
    position,
    parse_confidence: parseConfidence
  };
}

function ingredientHasGroup(rawOrNormalized, groupSlug, index = buildIngredientIndex()) {
  const match = matchIngredient(rawOrNormalized, index);
  return match.groups.some((group) => group.slug === groupSlug);
}

module.exports = {
  normalizeIngredientName,
  buildIngredientIndex,
  matchIngredient,
  parseIngredientList,
  ingredientHasGroup
};
