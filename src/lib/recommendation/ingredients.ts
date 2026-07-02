import type { AvoidedIngredient, AvoidedIngredientGroup, IngredientGroup, Product } from "./schemas.ts";

export type ParsedIngredients = {
  raw: string;
  tokens: string[];
  normalizedTokens: string[];
  parseable: boolean;
};

export type ExclusionMatch = {
  type: "ingredient" | "group" | "strict-incomplete-data";
  requested: string;
  matched: string;
  severity?: string;
};

const INGREDIENT_ALIASES: Record<string, string[]> = {
  fragrance: ["fragrance", "parfum", "perfume", "aroma", "flavor/aroma", "flavour/aroma"],
  "sodium lauryl sulfate": ["sodium lauryl sulfate", "sls"],
  "sodium laureth sulfate": ["sodium laureth sulfate", "sles"],
  "ammonium lauryl sulfate": ["ammonium lauryl sulfate", "als"],
  dimethicone: ["dimethicone", "dimethiconol", "amodimethicone"],
  "coconut oil": ["cocos nucifera oil", "cocos nucifera (coconut) oil", "coconut oil"],
  "shea butter": ["butyrospermum parkii", "butyrospermum parkii (shea) butter", "shea butter"],
  lanolin: ["lanolin", "lanolin alcohol"],
};

const GROUP_MEMBERS: Record<IngredientGroup, string[]> = {
  fragrance: ["fragrance"],
  sulfates: ["sodium lauryl sulfate", "sodium laureth sulfate", "ammonium lauryl sulfate"],
  silicones: ["dimethicone", "silicone", "cyclopentasiloxane", "cyclohexasiloxane", "amodimethicone"],
  parabens: ["methylparaben", "propylparaben", "butylparaben", "ethylparaben"],
  "essential-oils": ["lavender oil", "citrus oil", "limonene", "linalool", "eucalyptus oil", "peppermint oil"],
  "nut-oils": ["almond oil", "argan oil", "macadamia oil", "walnut oil"],
  coconut: ["coconut oil", "cocos nucifera oil"],
  lanolin: ["lanolin"],
  "dyes-pigments": ["red 40", "yellow 5", "blue 1", "iron oxides", "titanium dioxide", "carmine"],
};

const CANONICAL_BY_ALIAS = buildAliasIndex();

export function normalizeIngredientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/\bci\s*\d{4,5}\b/g, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[^a-z0-9/+ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIngredients(rawIngredients: string | undefined): ParsedIngredients {
  if (!rawIngredients || rawIngredients.trim().length < 3) {
    return { raw: rawIngredients ?? "", tokens: [], normalizedTokens: [], parseable: false };
  }

  const cleaned = rawIngredients
    .replace(/\bmay contain\b/gi, ", may contain ")
    .replace(/\+\/-/g, ", ")
    .replace(/[.;|]/g, ",");

  const tokens = cleaned
    .split(",")
    .map((token) => token.replace(/^[A-Za-z0-9 '\-/]+:\s*/, "").trim())
    .filter((token) => token.length > 1);

  const normalizedTokens = tokens.map(normalizeIngredientName).filter(Boolean);
  return {
    raw: rawIngredients,
    tokens,
    normalizedTokens,
    parseable: normalizedTokens.length > 0,
  };
}

export function findExclusionMatches(
  product: Product,
  avoidedIngredients: AvoidedIngredient[],
  avoidedGroups: AvoidedIngredientGroup[],
  strictSafetyMode: boolean,
): ExclusionMatch[] {
  const parsed = parseIngredients(product.ingredients);
  if (strictSafetyMode && isIncompleteIngredientData(product, parsed) && hasStrictSafetyFilter(avoidedIngredients, avoidedGroups)) {
    return [
      {
        type: "strict-incomplete-data",
        requested: "strict safety mode",
        matched: product.dataQuality,
      },
    ];
  }

  const normalizedTokens = new Set(parsed.normalizedTokens);
  const matches: ExclusionMatch[] = [];

  for (const avoided of avoidedIngredients) {
    const canonical = canonicalizeIngredient(avoided.term);
    const aliases = aliasesFor(canonical);
    const matched = aliases.find((alias) => normalizedTokens.has(alias));
    if (matched) {
      matches.push({ type: "ingredient", requested: avoided.term, matched, severity: avoided.severity });
    }
  }

  for (const avoidedGroup of avoidedGroups) {
    const members = GROUP_MEMBERS[avoidedGroup.group].flatMap((member) => aliasesFor(member));
    const matched = members.find((member) => normalizedTokens.has(member));
    if (matched) {
      matches.push({
        type: "group",
        requested: avoidedGroup.group,
        matched,
        severity: avoidedGroup.severity,
      });
    }
  }

  return matches;
}

export function canonicalizeIngredient(value: string): string {
  const normalized = normalizeIngredientName(value);
  return CANONICAL_BY_ALIAS.get(normalized) ?? normalized;
}

export function aliasesFor(value: string): string[] {
  const canonical = canonicalizeIngredient(value);
  const aliases = INGREDIENT_ALIASES[canonical] ?? [canonical];
  return [...new Set([canonical, ...aliases.map(normalizeIngredientName)])];
}

export function searchIngredientTerms(query: string, limit = 10): { canonicalName: string; alias: string; group?: IngredientGroup }[] {
  const normalizedQuery = normalizeIngredientName(query);
  if (normalizedQuery.length < 2) return [];

  const rows: { canonicalName: string; alias: string; group?: IngredientGroup }[] = [];
  for (const [canonicalName, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    for (const alias of aliasesFor(canonicalName)) {
      if (alias.includes(normalizedQuery) || canonicalName.includes(normalizedQuery)) {
        rows.push({ canonicalName, alias });
      }
    }
  }

  for (const [group, members] of Object.entries(GROUP_MEMBERS) as [IngredientGroup, string[]][]) {
    if (group.includes(normalizedQuery)) rows.push({ canonicalName: group, alias: group, group });
    for (const member of members) {
      if (member.includes(normalizedQuery)) rows.push({ canonicalName: member, alias: member, group });
    }
  }

  return dedupeSearchRows(rows).slice(0, limit);
}

export function hasSupportedClaim(product: Product, claim: string): boolean {
  const haystack = `${product.details ?? ""} ${product.ingredients ?? ""}`.toLowerCase();
  if (claim === "fragrance-free") return /\bfragrance[- ]free\b|\bno fragrance\b|\bunscented\b/.test(haystack);
  if (claim === "sulfate-free") return /\bsulfate[- ]free\b/.test(haystack);
  if (claim === "silicone-free") return /\bsilicone[- ]free\b/.test(haystack);
  if (claim === "vegan") return /\bvegan\b/.test(haystack);
  if (claim === "cruelty-free") return /\bcruelty[- ]free\b/.test(haystack);
  if (claim === "oil-free") return /\boil[- ]free\b/.test(haystack);
  if (claim === "non-comedogenic") return /\bnon[- ]comedogenic\b/.test(haystack);
  if (claim === "dermatologist-tested") return /\bdermatologist[- ]tested\b/.test(haystack);
  return false;
}

function buildAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    index.set(normalizeIngredientName(canonical), normalizeIngredientName(canonical));
    for (const alias of aliases) index.set(normalizeIngredientName(alias), normalizeIngredientName(canonical));
  }
  return index;
}

function isIncompleteIngredientData(product: Product, parsed: ParsedIngredients): boolean {
  return (
    product.dataQuality === "missing-ingredients" ||
    product.dataQuality === "unparseable-ingredients" ||
    !parsed.parseable
  );
}

function hasStrictSafetyFilter(ingredients: AvoidedIngredient[], groups: AvoidedIngredientGroup[]): boolean {
  return [...ingredients, ...groups].some((item) => item.severity === "allergy" || item.severity === "sensitivity");
}

function dedupeSearchRows(rows: { canonicalName: string; alias: string; group?: IngredientGroup }[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.canonicalName}:${row.alias}:${row.group ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
