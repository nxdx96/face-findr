export type IngredientGroupMatch = {
  slug: string;
  display_name: string;
  caution_level: string;
};

export type IngredientMatch = {
  raw_name: string;
  normalized_name: string;
  canonical_name: string | null;
  match_type: "canonical" | "alias" | "none";
  groups: IngredientGroupMatch[];
};

export type ParsedIngredientToken = {
  raw_token: string;
  normalized_token: string;
  section_label: string | null;
  is_may_contain: boolean;
  position: number;
  parse_confidence: number;
};

export type IngredientIndex = {
  exact: Map<string, Omit<IngredientMatch, "raw_name" | "groups">>;
  canonicalByName: Map<string, unknown>;
  groupsByIngredient: Map<string, IngredientGroupMatch[]>;
};

export function normalizeIngredientName(value: unknown): string;
export function buildIngredientIndex(aliasData?: unknown, groupData?: unknown): IngredientIndex;
export function matchIngredient(rawOrNormalized: string, index?: IngredientIndex): IngredientMatch;
export function parseIngredientList(rawIngredients: unknown): ParsedIngredientToken[];
export function ingredientHasGroup(rawOrNormalized: string, groupSlug: string, index?: IngredientIndex): boolean;
