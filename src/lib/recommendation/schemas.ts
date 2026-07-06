export const PRODUCT_CATEGORIES = [
  "blush",
  "eyeliner",
  "eyeshadow",
  "foundation",
  "shampoo",
  "conditioner",
  "cleanser",
  "moisturizer",
  "face-wash",
  "haircare",
  "skincare",
  "makeup",
] as const;

export const SKIN_CONCERNS = [
  "dryness",
  "oiliness",
  "acne-prone",
  "redness",
  "sensitivity",
  "uneven-tone",
  "dullness",
  "texture",
] as const;

export const HAIR_CONCERNS = [
  "dryness",
  "oiliness",
  "frizz",
  "curls-coils",
  "color-treated",
  "flakes",
  "itchiness",
  "breakage",
  "volume",
  "damage",
] as const;

export const SCALP_CONCERNS = ["dryness", "oiliness", "flakes", "itchiness", "sensitivity"] as const;

export const PREFERENCES = [
  "fragrance-free",
  "sulfate-free",
  "silicone-free",
  "vegan",
  "cruelty-free",
  "oil-free",
  "non-comedogenic",
  "dermatologist-tested",
] as const;

export const INGREDIENT_GROUPS = [
  "fragrance",
  "sulfates",
  "silicones",
  "parabens",
  "essential-oils",
  "nut-oils",
  "coconut",
  "lanolin",
  "dyes-pigments",
] as const;

export const SEVERITIES = ["preference", "sensitivity", "allergy"] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type SkinConcern = (typeof SKIN_CONCERNS)[number];
export type HairConcern = (typeof HAIR_CONCERNS)[number];
export type ScalpConcern = (typeof SCALP_CONCERNS)[number];
export type Preference = (typeof PREFERENCES)[number];
export type IngredientGroup = (typeof INGREDIENT_GROUPS)[number];
export type Severity = (typeof SEVERITIES)[number];

export type AvoidedIngredient = {
  term: string;
  severity: Severity;
};

export type AvoidedIngredientGroup = {
  group: IngredientGroup;
  severity: Severity;
};

export type RecommendationRequest = {
  goal: {
    categories: ProductCategory[];
  };
  concerns?: {
    skin?: SkinConcern[];
    hair?: HairConcern[];
    scalp?: ScalpConcern[];
  };
  preferences?: {
    claims?: Preference[];
    budget?: {
      min?: number;
      max?: number;
    };
    stores?: string[];
    minimumRating?: number;
  };
  avoidedIngredients?: AvoidedIngredient[];
  avoidedIngredientGroups?: AvoidedIngredientGroup[];
  strictSafetyMode?: boolean;
  limit?: number;
};

export type ProductDataQuality = "complete" | "partial" | "missing-ingredients" | "unparseable-ingredients";

export type Product = {
  id: string;
  brand: string;
  name: string;
  category: string;
  price?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  details?: string;
  ingredients?: string;
  url?: string;
  canonicalUrl?: string;
  imageUrl?: string;
  imageAltText?: string;
  store?: string;
  retailerSlug?: string;
  availabilityStatus?: string;
  isStale?: boolean;
  lastScrapedAt?: string;
  dataQuality: ProductDataQuality;
};

export type ScoreComponents = {
  categoryFit: number;
  concernFit: number;
  rating: number;
  budgetFit: number;
  storeFit: number;
  dataCompleteness: number;
  preferenceClaims: number;
  penalties: number;
};

export type RecommendationResult = {
  product: Product;
  score: number;
  scoreComponents: ScoreComponents;
  matchReasons: string[];
  safetyNotes: string[];
};

export type RecommendationResponse = {
  results: RecommendationResult[];
  totalEligible: number;
  totalExcluded: number;
  appliedFilters: {
    categories: ProductCategory[];
    avoidedIngredients: AvoidedIngredient[];
    avoidedIngredientGroups: AvoidedIngredientGroup[];
    strictSafetyMode: boolean;
  };
  noResultsReason?: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function enumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  errors: string[],
): T[number][] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }

  const allowedSet = new Set<string>(allowed);
  const valid: T[number][] = [];
  value.forEach((item, index) => {
    if (typeof item !== "string" || !allowedSet.has(item)) {
      errors.push(`${path}[${index}] is not supported`);
      return;
    }
    valid.push(item as T[number]);
  });
  return valid;
}

function optionalNumber(value: unknown, path: string, errors: string[]): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number`);
    return undefined;
  }
  return value;
}

export function validateRecommendationRequest(input: unknown): ValidationResult<RecommendationRequest> {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["request body must be an object"] };

  const goalInput = input.goal;
  if (!isObject(goalInput)) {
    errors.push("goal must be an object");
  }

  const categories = isObject(goalInput)
    ? enumArray(goalInput.categories, PRODUCT_CATEGORIES, "goal.categories", errors)
    : [];
  if (categories.length === 0) errors.push("goal.categories must include at least one category");

  const concernsInput = isObject(input.concerns) ? input.concerns : {};
  const preferencesInput = isObject(input.preferences) ? input.preferences : {};
  const budgetInput = isObject(preferencesInput.budget) ? preferencesInput.budget : {};

  const avoidedIngredients = parseAvoidedIngredients(input.avoidedIngredients, errors);
  const avoidedIngredientGroups = parseAvoidedGroups(input.avoidedIngredientGroups, errors);
  const strictSafetyMode =
    typeof input.strictSafetyMode === "boolean"
      ? input.strictSafetyMode
      : hasStrictSeverity(avoidedIngredients, avoidedIngredientGroups);

  const limit = optionalNumber(input.limit, "limit", errors);
  if (limit !== undefined && (limit < 1 || limit > 100)) errors.push("limit must be between 1 and 100");

  const request: RecommendationRequest = {
    goal: { categories },
    concerns: {
      skin: concernsInput.skin === undefined ? undefined : enumArray(concernsInput.skin, SKIN_CONCERNS, "concerns.skin", errors),
      hair: concernsInput.hair === undefined ? undefined : enumArray(concernsInput.hair, HAIR_CONCERNS, "concerns.hair", errors),
      scalp: concernsInput.scalp === undefined ? undefined : enumArray(concernsInput.scalp, SCALP_CONCERNS, "concerns.scalp", errors),
    },
    preferences: {
      claims:
        preferencesInput.claims === undefined
          ? undefined
          : enumArray(preferencesInput.claims, PREFERENCES, "preferences.claims", errors),
      budget: {
        min: optionalNumber(budgetInput.min, "preferences.budget.min", errors),
        max: optionalNumber(budgetInput.max, "preferences.budget.max", errors),
      },
      stores: preferencesInput.stores === undefined ? undefined : parseStringList(preferencesInput.stores, "preferences.stores", errors),
      minimumRating: optionalNumber(preferencesInput.minimumRating, "preferences.minimumRating", errors),
    },
    avoidedIngredients,
    avoidedIngredientGroups,
    strictSafetyMode,
    limit: limit === undefined ? 20 : Math.floor(limit),
  };

  if (request.preferences?.budget?.min !== undefined && request.preferences?.budget?.max !== undefined) {
    if (request.preferences.budget.min > request.preferences.budget.max) {
      errors.push("preferences.budget.min cannot exceed preferences.budget.max");
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: request };
}

function parseStringList(value: unknown, path: string, errors: string[]): string[] {
  if (!isStringArray(value)) {
    errors.push(`${path} must be an array of strings`);
    return [];
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseAvoidedIngredients(value: unknown, errors: string[]): AvoidedIngredient[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push("avoidedIngredients must be an array");
    return [];
  }
  return value.flatMap((item, index) => {
    if (!isObject(item)) {
      errors.push(`avoidedIngredients[${index}] must be an object`);
      return [];
    }
    if (typeof item.term !== "string" || item.term.trim().length === 0) {
      errors.push(`avoidedIngredients[${index}].term is required`);
      return [];
    }
    if (!SEVERITIES.includes(item.severity as Severity)) {
      errors.push(`avoidedIngredients[${index}].severity is not supported`);
      return [];
    }
    return [{ term: item.term.trim(), severity: item.severity as Severity }];
  });
}

function parseAvoidedGroups(value: unknown, errors: string[]): AvoidedIngredientGroup[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push("avoidedIngredientGroups must be an array");
    return [];
  }
  return value.flatMap((item, index) => {
    if (!isObject(item)) {
      errors.push(`avoidedIngredientGroups[${index}] must be an object`);
      return [];
    }
    if (!INGREDIENT_GROUPS.includes(item.group as IngredientGroup)) {
      errors.push(`avoidedIngredientGroups[${index}].group is not supported`);
      return [];
    }
    if (!SEVERITIES.includes(item.severity as Severity)) {
      errors.push(`avoidedIngredientGroups[${index}].severity is not supported`);
      return [];
    }
    return [{ group: item.group as IngredientGroup, severity: item.severity as Severity }];
  });
}

function hasStrictSeverity(ingredients: AvoidedIngredient[], groups: AvoidedIngredientGroup[]): boolean {
  return [...ingredients, ...groups].some((item) => item.severity === "allergy" || item.severity === "sensitivity");
}
