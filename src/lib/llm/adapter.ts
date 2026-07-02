import {
  INGREDIENT_GROUPS,
  PREFERENCES,
  PRODUCT_CATEGORIES,
  SKIN_CONCERNS,
  type AvoidedIngredient,
  type AvoidedIngredientGroup,
  type IngredientGroup,
  type Preference,
  type ProductCategory,
  type SkinConcern,
  type ValidationResult,
} from "../recommendation/schemas.ts";

export type LlmInterpretation = {
  categories: ProductCategory[];
  skinConcerns: SkinConcern[];
  preferences: Preference[];
  avoidedIngredients: AvoidedIngredient[];
  avoidedIngredientGroups: AvoidedIngredientGroup[];
  uncertaintyNotes: string[];
};

export type LlmAdapterConfig = {
  provider: "disabled" | "openai-compatible";
  apiKey?: string;
  endpoint: string;
  model: string;
  timeoutMs: number;
};

export function llmConfigFromEnv(env: Record<string, string | undefined> = process.env): LlmAdapterConfig {
  return {
    provider: env.FACE_FINDR_LLM_ENABLED === "true" ? "openai-compatible" : "disabled",
    apiKey: env.FACE_FINDR_LLM_API_KEY,
    endpoint: env.FACE_FINDR_LLM_ENDPOINT ?? "https://api.openai.com/v1/chat/completions",
    model: env.FACE_FINDR_LLM_MODEL ?? "gpt-5.4-mini",
    timeoutMs: Number(env.FACE_FINDR_LLM_TIMEOUT_MS ?? 4000),
  };
}

export async function parseUserNeeds(
  freeText: string | undefined,
  config = llmConfigFromEnv(),
): Promise<LlmInterpretation> {
  const fallback = templateInterpretation(freeText);
  if (!freeText || config.provider === "disabled" || !config.apiKey) return fallback;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "Return strict JSON only. Interpret beauty product needs into supported enum values. Do not diagnose, guarantee safety, or invent product facts.",
          },
          {
            role: "user",
            content: freeText,
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return fallback;

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = validateLlmInterpretation(typeof content === "string" ? JSON.parse(content) : content);
    return parsed.ok ? parsed.value : fallback;
  } catch {
    return fallback;
  }
}

export function generateTemplateExplanation(matchReasons: string[], safetyNotes: string[]): string {
  return [...matchReasons.slice(0, 2), ...safetyNotes.slice(0, 1)].join(" ");
}

export function templateInterpretation(freeText = ""): LlmInterpretation {
  const text = freeText.toLowerCase();
  const categories = PRODUCT_CATEGORIES.filter((category) => text.includes(category)) as ProductCategory[];
  const skinConcerns = SKIN_CONCERNS.filter((concern) => text.includes(concern.replace("-", " "))) as SkinConcern[];
  const preferences = PREFERENCES.filter((preference) => text.includes(preference.replace("-", " "))) as Preference[];
  const avoidedIngredientGroups: AvoidedIngredientGroup[] = [];

  for (const group of INGREDIENT_GROUPS) {
    if (text.includes(group.replace("-", " ")) || text.includes(group)) {
      avoidedIngredientGroups.push({ group, severity: severityFromText(text) });
    }
  }

  if (/\bfragrance\b|\bparfum\b|\bperfume\b/.test(text)) {
    avoidedIngredientGroups.push({ group: "fragrance", severity: severityFromText(text) });
  }
  if (/\bsulfate\b|\bsls\b|\bsles\b/.test(text)) {
    avoidedIngredientGroups.push({ group: "sulfates", severity: severityFromText(text) });
  }

  return {
    categories,
    skinConcerns,
    preferences,
    avoidedIngredients: [],
    avoidedIngredientGroups: dedupeGroups(avoidedIngredientGroups),
    uncertaintyNotes: freeText ? ["Template parser used; confirm inferred filters before applying."] : [],
  };
}

export function validateLlmInterpretation(input: unknown): ValidationResult<LlmInterpretation> {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["LLM output must be an object"] };
  }
  const record = input as Record<string, unknown>;
  const categories = readEnumArray(record.categories, PRODUCT_CATEGORIES, "categories", errors) as ProductCategory[];
  const skinConcerns = readEnumArray(record.skinConcerns, SKIN_CONCERNS, "skinConcerns", errors) as SkinConcern[];
  const preferences = readEnumArray(record.preferences, PREFERENCES, "preferences", errors) as Preference[];

  const groups = Array.isArray(record.avoidedIngredientGroups) ? record.avoidedIngredientGroups : [];
  const avoidedIngredientGroups = groups.flatMap((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push(`avoidedIngredientGroups[${index}] must be an object`);
      return [];
    }
    const group = (item as Record<string, unknown>).group;
    const severity = (item as Record<string, unknown>).severity;
    if (!INGREDIENT_GROUPS.includes(group as IngredientGroup)) errors.push(`avoidedIngredientGroups[${index}].group is unsupported`);
    if (!["preference", "sensitivity", "allergy"].includes(severity as string)) {
      errors.push(`avoidedIngredientGroups[${index}].severity is unsupported`);
    }
    return [{ group: group as IngredientGroup, severity: severity as "preference" | "sensitivity" | "allergy" }];
  });

  const output: LlmInterpretation = {
    categories,
    skinConcerns,
    preferences,
    avoidedIngredients: [],
    avoidedIngredientGroups,
    uncertaintyNotes: Array.isArray(record.uncertaintyNotes)
      ? record.uncertaintyNotes.filter((note): note is string => typeof note === "string")
      : [],
  };

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: output };
}

function readEnumArray(value: unknown, allowed: readonly string[], path: string, errors: string[]) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  return value.filter((item) => {
    const ok = typeof item === "string" && allowed.includes(item);
    if (!ok) errors.push(`${path} contains unsupported value`);
    return ok;
  });
}

function severityFromText(text: string): "preference" | "sensitivity" | "allergy" {
  if (/\ballerg|anaphylaxis|hives\b/.test(text)) return "allergy";
  if (/\bsensitive|react|irritat/.test(text)) return "sensitivity";
  return "preference";
}

function dedupeGroups(groups: AvoidedIngredientGroup[]): AvoidedIngredientGroup[] {
  const byGroup = new Map<string, AvoidedIngredientGroup>();
  for (const group of groups) byGroup.set(group.group, group);
  return [...byGroup.values()];
}
