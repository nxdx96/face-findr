import { findExclusionMatches, hasSupportedClaim, parseIngredients } from "./ingredients.ts";
import type {
  Product,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationResult,
  ScoreComponents,
} from "./schemas.ts";

const CATEGORY_GROUPS: Record<string, string[]> = {
  makeup: ["blush", "eyeliner", "eyeshadow", "foundation"],
  skincare: ["cleanser", "moisturizer", "face-wash"],
  haircare: ["shampoo", "conditioner"],
};

const CONCERN_KEYWORDS: Record<string, string[]> = {
  dryness: ["hydrating", "hydration", "moisture", "moisturizing", "nourishing", "dry"],
  oiliness: ["oil-free", "oil control", "matte", "clarifying"],
  "acne-prone": ["non-comedogenic", "blemish", "acne", "clarifying"],
  redness: ["calming", "soothing", "redness"],
  sensitivity: ["sensitive", "gentle", "fragrance-free", "dermatologist-tested"],
  "uneven-tone": ["tone", "brightening", "dark spot"],
  dullness: ["brightening", "radiance", "glow"],
  texture: ["smoothing", "texture", "exfoliating"],
  frizz: ["frizz", "smoothing", "anti-frizz"],
  "curls-coils": ["curl", "coily", "coil", "definition"],
  "color-treated": ["color-treated", "colour-treated", "color safe"],
  flakes: ["flake", "dandruff", "scalp"],
  itchiness: ["itch", "soothing", "scalp"],
  breakage: ["strengthening", "breakage", "repair"],
  volume: ["volume", "volumizing", "body"],
  damage: ["repair", "damage", "bond", "strengthening"],
};

export function recommendProducts(products: Product[], request: RecommendationRequest): RecommendationResponse {
  const eligible: RecommendationResult[] = [];
  let totalExcluded = 0;

  for (const product of products) {
    if (!matchesCategory(product, request.goal.categories)) {
      totalExcluded += 1;
      continue;
    }

    const exclusionMatches = findExclusionMatches(
      product,
      request.avoidedIngredients ?? [],
      request.avoidedIngredientGroups ?? [],
      request.strictSafetyMode ?? false,
    );

    if (exclusionMatches.length > 0) {
      totalExcluded += 1;
      continue;
    }

    if (request.preferences?.minimumRating !== undefined && (product.rating ?? 0) < request.preferences.minimumRating) {
      totalExcluded += 1;
      continue;
    }

    eligible.push(scoreProduct(product, request));
  }

  eligible.sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name));
  const results = eligible.slice(0, request.limit ?? 20);

  return {
    results,
    totalEligible: eligible.length,
    totalExcluded,
    appliedFilters: {
      categories: request.goal.categories,
      avoidedIngredients: request.avoidedIngredients ?? [],
      avoidedIngredientGroups: request.avoidedIngredientGroups ?? [],
      strictSafetyMode: request.strictSafetyMode ?? false,
    },
    noResultsReason: results.length === 0 ? noResultsReason(products.length, totalExcluded) : undefined,
  };
}

export function scoreProduct(product: Product, request: RecommendationRequest): RecommendationResult {
  const scoreComponents: ScoreComponents = {
    categoryFit: categoryFit(product, request),
    concernFit: concernFit(product, request),
    rating: ratingScore(product),
    budgetFit: budgetFit(product, request),
    storeFit: storeFit(product, request),
    dataCompleteness: dataCompletenessScore(product),
    preferenceClaims: preferenceClaimScore(product, request),
    penalties: dataPenalty(product),
  };

  const score = Math.max(
    0,
    Math.round(
      Object.values(scoreComponents).reduce((sum, value) => sum + value, 0) * 100,
    ) / 100,
  );

  return {
    product,
    score,
    scoreComponents,
    matchReasons: buildMatchReasons(product, request, scoreComponents),
    safetyNotes: buildSafetyNotes(product, request),
  };
}

function matchesCategory(product: Product, categories: string[]): boolean {
  return categories.some((category) => {
    if (category === product.category) return true;
    return CATEGORY_GROUPS[category]?.includes(product.category) ?? false;
  });
}

function categoryFit(product: Product, request: RecommendationRequest): number {
  if (request.goal.categories.includes(product.category as never)) return 35;
  if (request.goal.categories.some((category) => CATEGORY_GROUPS[category]?.includes(product.category))) return 28;
  return 0;
}

function concernFit(product: Product, request: RecommendationRequest): number {
  const concerns = [
    ...(request.concerns?.skin ?? []),
    ...(request.concerns?.hair ?? []),
    ...(request.concerns?.scalp ?? []),
  ];
  if (concerns.length === 0) return 0;

  const haystack = `${product.name} ${product.details ?? ""}`.toLowerCase();
  const hits = concerns.filter((concern) => (CONCERN_KEYWORDS[concern] ?? []).some((keyword) => haystack.includes(keyword)));
  return Math.min(20, hits.length * 8);
}

function ratingScore(product: Product): number {
  if (product.rating === undefined) return 0;
  return Math.min(15, Math.max(0, product.rating / 5) * 15);
}

function budgetFit(product: Product, request: RecommendationRequest): number {
  const budget = request.preferences?.budget;
  if (!budget || (budget.min === undefined && budget.max === undefined)) return 0;
  if (product.price === undefined) return -3;
  if (budget.min !== undefined && product.price < budget.min) return 3;
  if (budget.max !== undefined && product.price > budget.max) return -8;
  return 10;
}

function storeFit(product: Product, request: RecommendationRequest): number {
  const stores = request.preferences?.stores?.map((store) => store.toLowerCase());
  if (!stores || stores.length === 0) return 0;
  return product.store && stores.includes(product.store.toLowerCase()) ? 8 : 0;
}

function dataCompletenessScore(product: Product): number {
  if (product.dataQuality === "complete") return 7;
  if (product.dataQuality === "partial") return 2;
  return -8;
}

function preferenceClaimScore(product: Product, request: RecommendationRequest): number {
  const claims = request.preferences?.claims ?? [];
  if (claims.length === 0) return 0;
  const supported = claims.filter((claim) => hasSupportedClaim(product, claim));
  return Math.min(15, supported.length * 5);
}

function dataPenalty(product: Product): number {
  let penalty = 0;
  if (!product.details) penalty -= 2;
  if (product.rating === undefined) penalty -= 2;
  if (product.price === undefined) penalty -= 2;
  if (product.dataQuality !== "complete") penalty -= 4;
  return penalty;
}

function buildMatchReasons(product: Product, request: RecommendationRequest, components: ScoreComponents): string[] {
  const reasons: string[] = [];
  if (components.categoryFit > 0) reasons.push(`Matches requested ${product.category} category.`);
  if (components.concernFit > 0) reasons.push("Product details align with selected concerns.");
  if (components.rating >= 12) reasons.push(`Strong customer rating${product.rating ? ` (${product.rating.toFixed(1)}/5)` : ""}.`);
  if (components.budgetFit > 0) reasons.push("Fits the selected budget range.");
  if (components.storeFit > 0 && product.store) reasons.push(`Available from preferred store: ${product.store}.`);

  const claimHits = (request.preferences?.claims ?? []).filter((claim) => hasSupportedClaim(product, claim));
  if (claimHits.length > 0) reasons.push(`Supports preferences: ${claimHits.join(", ")}.`);
  if (reasons.length === 0) reasons.push("Eligible product with available product data.");
  return reasons.slice(0, 4);
}

function buildSafetyNotes(product: Product, request: RecommendationRequest): string[] {
  const notes: string[] = [];
  const parsed = parseIngredients(product.ingredients);
  if (parsed.parseable) {
    notes.push("No confirmed matches found for submitted avoided ingredients or groups.");
  } else if (request.strictSafetyMode) {
    notes.push("Ingredient data is incomplete and would be excluded in strict safety mode.");
  } else {
    notes.push("Ingredient data is incomplete; safety exclusions cannot be fully confirmed.");
  }
  if (product.dataQuality !== "complete") notes.push(`Product data quality: ${product.dataQuality}.`);
  return notes;
}

function noResultsReason(productCount: number, totalExcluded: number): string {
  if (productCount === 0) return "No product data is available.";
  if (totalExcluded >= productCount) return "All matching products were removed by category, rating, or safety filters.";
  return "No products matched the selected filters.";
}
