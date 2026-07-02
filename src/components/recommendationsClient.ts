import type {
  AvoidedIngredient,
  AvoidedIngredientGroup,
  ProductDataQuality,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationResult,
} from "../lib/recommendation/schemas";

export type FrontendProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  retailer: string;
  url: string;
  dataQuality: ProductDataQuality;
  matchReasons: string[];
  safetyNotes: string[];
  tags: string[];
};

export type IngredientSuggestion = {
  canonicalName: string;
  alias: string;
  group?: string;
};

const MOCK_PRODUCTS: FrontendProduct[] = [
  {
    id: "mock-1",
    brand: "Glow Garden",
    name: "Dewdrop Calm Moisturizer",
    category: "moisturizer",
    price: 22,
    rating: 4.7,
    retailer: "Ulta",
    url: "https://www.ulta.com/",
    dataQuality: "complete",
    matchReasons: ["Hydration-focused details", "Fits mid-range budget", "Complete ingredient list"],
    safetyNotes: ["No selected avoided ingredient was found in the mock ingredient facts."],
    tags: ["fragrance-free", "dermatologist-tested", "dryness", "redness"],
  },
  {
    id: "mock-2",
    brand: "Cloud Curl",
    name: "Soft Rinse Conditioner",
    category: "conditioner",
    price: 18,
    rating: 4.5,
    retailer: "Sephora",
    url: "https://www.sephora.com/",
    dataQuality: "partial",
    matchReasons: ["Targets frizz", "Works for curls and coils", "Under selected max price"],
    safetyNotes: ["Ingredient data is partial, so exclusions cannot be confirmed with full certainty."],
    tags: ["silicone-free", "frizz", "curls-coils", "damage"],
  },
  {
    id: "mock-3",
    brand: "Petal Pixel",
    name: "Bouncy Blush Balm",
    category: "blush",
    price: 16,
    rating: 4.3,
    retailer: "Ulta",
    url: "https://www.ulta.com/",
    dataQuality: "complete",
    matchReasons: ["Selected makeup category", "Highly rated for the price", "Readable ingredient data"],
    safetyNotes: ["Color pigments may vary by shade in real product data."],
    tags: ["makeup", "oil-free", "dyes-pigments"],
  },
  {
    id: "mock-4",
    brand: "Scalp Studio",
    name: "Quiet Roots Shampoo",
    category: "shampoo",
    price: 28,
    rating: 4.8,
    retailer: "Sephora",
    url: "https://www.sephora.com/",
    dataQuality: "complete",
    matchReasons: ["Scalp comfort match", "Sulfate-free claim available", "Strong rating"],
    safetyNotes: ["Mock facts do not replace professional advice for persistent scalp symptoms."],
    tags: ["sulfate-free", "itchiness", "flakes", "sensitivity"],
  },
  {
    id: "mock-5",
    brand: "Everyday Edit",
    name: "Clean Sweep Face Wash",
    category: "face-wash",
    price: 12,
    rating: 4.1,
    retailer: "Target",
    url: "https://www.target.com/",
    dataQuality: "missing-ingredients",
    matchReasons: ["Budget-friendly cleanser", "Simple routine fit"],
    safetyNotes: ["Ingredient data is missing and should be excluded in strict safety mode."],
    tags: ["cleanser", "oiliness"],
  },
];

const INGREDIENT_SUGGESTIONS: IngredientSuggestion[] = [
  { canonicalName: "Fragrance", alias: "parfum", group: "fragrance" },
  { canonicalName: "Sodium Laureth Sulfate", alias: "SLES", group: "sulfates" },
  { canonicalName: "Dimethicone", alias: "dimethiconol", group: "silicones" },
  { canonicalName: "Coconut Oil", alias: "cocos nucifera oil", group: "coconut" },
  { canonicalName: "Lanolin", alias: "lanolin alcohol", group: "lanolin" },
  { canonicalName: "Mica", alias: "mica", group: "dyes-pigments" },
];

export async function fetchIngredientSuggestions(query: string): Promise<IngredientSuggestion[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  if (shouldUseLocalMocks()) return filterMockIngredientSuggestions(normalized);

  const response = await fetch(`/api/ingredients/search?q=${encodeURIComponent(query)}&limit=10`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Ingredient search failed with status ${response.status}`);

  const payload = (await response.json()) as { results?: IngredientSuggestion[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

export async function fetchRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
  if (!shouldUseLocalMocks()) {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`Recommendation request failed with status ${response.status}`);
    return (await response.json()) as RecommendationResponse;
  }

  const results = buildMockResults(request);
  const totalExcluded = MOCK_PRODUCTS.length - results.length;

  return {
    results,
    totalEligible: results.length,
    totalExcluded,
    appliedFilters: {
      categories: request.goal.categories,
      avoidedIngredients: request.avoidedIngredients ?? [],
      avoidedIngredientGroups: request.avoidedIngredientGroups ?? [],
      strictSafetyMode: Boolean(request.strictSafetyMode),
    },
    noResultsReason:
      results.length === 0
        ? "Strict exclusions and filters removed every mock product. Loosen a preference, raise your budget, or allow incomplete ingredient data."
        : undefined,
  };
}

function shouldUseLocalMocks(): boolean {
  return process.env.NEXT_PUBLIC_FACE_FINDR_USE_MOCKS === "true";
}

function filterMockIngredientSuggestions(normalized: string): IngredientSuggestion[] {
  return INGREDIENT_SUGGESTIONS.filter((suggestion) =>
    `${suggestion.canonicalName} ${suggestion.alias} ${suggestion.group ?? ""}`.toLowerCase().includes(normalized),
  );
}

function buildMockResults(request: RecommendationRequest): RecommendationResult[] {
  const categories = new Set(request.goal.categories);
  const avoided = request.avoidedIngredients ?? [];
  const avoidedGroups = request.avoidedIngredientGroups ?? [];
  const maxPrice = request.preferences?.budget?.max;
  const minRating = request.preferences?.minimumRating ?? 0;
  const stores = new Set(request.preferences?.stores ?? []);
  const claims = request.preferences?.claims ?? [];
  const strictSafetyMode = Boolean(request.strictSafetyMode);

  return MOCK_PRODUCTS.filter((product) => {
    const categoryMatch =
      categories.size === 0 ||
      categories.has(product.category as never) ||
      categories.has(domainForCategory(product.category) as never);
    if (!categoryMatch) return false;
    if (maxPrice !== undefined && product.price > maxPrice) return false;
    if (product.rating < minRating) return false;
    if (stores.size > 0 && !stores.has(product.retailer)) return false;
    if (strictSafetyMode && product.dataQuality !== "complete") return false;
    if (hasAvoidedTag(product, avoided, avoidedGroups)) return false;
    return true;
  })
    .map((product) => {
      const preferenceHits = claims.filter((claim) => product.tags.includes(claim));
      const score = 72 + product.rating * 4 + preferenceHits.length * 5 - (product.dataQuality === "complete" ? 0 : 8);
      return {
        product: {
          id: product.id,
          brand: product.brand,
          name: product.name,
          category: product.category,
          price: product.price,
          rating: product.rating,
          url: product.url,
          store: product.retailer,
          dataQuality: product.dataQuality,
        },
        score: Math.round(score),
        scoreComponents: {
          categoryFit: 25,
          concernFit: 18,
          rating: Math.round(product.rating * 4),
          budgetFit: maxPrice === undefined || product.price <= maxPrice ? 10 : 0,
          storeFit: stores.size === 0 || stores.has(product.retailer) ? 5 : 0,
          dataCompleteness: product.dataQuality === "complete" ? 12 : 5,
          preferenceClaims: preferenceHits.length * 5,
          penalties: product.dataQuality === "complete" ? 0 : -8,
        },
        matchReasons: [...product.matchReasons, ...preferenceHits.map((claim) => `Matches ${formatSlug(claim)}`)],
        safetyNotes: product.safetyNotes,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function hasAvoidedTag(
  product: FrontendProduct,
  avoided: AvoidedIngredient[],
  avoidedGroups: AvoidedIngredientGroup[],
): boolean {
  const avoidedTerms = avoided.map((item) => item.term.toLowerCase());
  const avoidedGroupTerms = avoidedGroups.map((item) => item.group);
  return [...avoidedTerms, ...avoidedGroupTerms].some((term) => product.tags.includes(term));
}

function domainForCategory(category: string): string {
  if (["blush", "eyeliner", "eyeshadow", "foundation"].includes(category)) return "makeup";
  if (["shampoo", "conditioner", "haircare"].includes(category)) return "haircare";
  return "skincare";
}

export function formatSlug(value: string): string {
  return value.replace(/-/g, " ");
}
