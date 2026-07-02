"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  AvoidedIngredient,
  AvoidedIngredientGroup,
  HairConcern,
  IngredientGroup,
  Preference,
  ProductCategory,
  RecommendationRequest,
  RecommendationResponse,
  ScalpConcern,
  Severity,
  SkinConcern,
} from "../lib/recommendation/schemas";
import { fetchIngredientSuggestions, fetchRecommendations, formatSlug } from "./recommendationsClient";
import type { IngredientSuggestion } from "./recommendationsClient";
import { RecommendationResults } from "./RecommendationResults";
import { SafetyNotice } from "./SafetyNotice";

const PRODUCT_OPTIONS: { value: ProductCategory; label: string; description: string; domain: string }[] = [
  { value: "makeup", label: "Makeup", description: "Foundation, blush, eyes, and color", domain: "makeup" },
  { value: "skincare", label: "Skincare", description: "Cleanse, moisturize, and comfort", domain: "skincare" },
  { value: "haircare", label: "Haircare", description: "Wash, condition, and style support", domain: "haircare" },
];

const SKIN_CONCERN_OPTIONS: SkinConcern[] = [
  "dryness",
  "oiliness",
  "acne-prone",
  "redness",
  "sensitivity",
  "uneven-tone",
  "dullness",
  "texture",
];
const HAIR_CONCERN_OPTIONS: HairConcern[] = [
  "dryness",
  "oiliness",
  "frizz",
  "curls-coils",
  "color-treated",
  "breakage",
  "volume",
  "damage",
];
const SCALP_CONCERN_OPTIONS: ScalpConcern[] = ["dryness", "oiliness", "flakes", "itchiness", "sensitivity"];
const PREFERENCE_OPTIONS: Preference[] = [
  "fragrance-free",
  "sulfate-free",
  "silicone-free",
  "vegan",
  "cruelty-free",
  "oil-free",
  "non-comedogenic",
  "dermatologist-tested",
];
const GROUP_OPTIONS: IngredientGroup[] = [
  "fragrance",
  "sulfates",
  "silicones",
  "parabens",
  "essential-oils",
  "nut-oils",
  "coconut",
  "lanolin",
  "dyes-pigments",
];
const STORE_OPTIONS = ["Ulta", "Sephora", "Target"];
const STEPS = ["Goal", "Concerns", "Preferences", "Avoid", "Review"];
type AppScreen = "welcome" | "quiz" | "loadingRecommendations" | "results" | "emptyResults" | "error";

type QuizState = {
  categories: ProductCategory[];
  skinConcerns: SkinConcern[];
  hairConcerns: HairConcern[];
  scalpConcerns: ScalpConcern[];
  preferences: Preference[];
  stores: string[];
  budgetMax: number;
  minimumRating: number;
  avoidedIngredients: AvoidedIngredient[];
  avoidedGroups: AvoidedIngredientGroup[];
  freeText: string;
  strictSafetyMode: boolean;
};

const DEFAULT_STATE: QuizState = {
  categories: ["skincare"],
  skinConcerns: [],
  hairConcerns: [],
  scalpConcerns: [],
  preferences: ["fragrance-free"],
  stores: [],
  budgetMax: 35,
  minimumRating: 4,
  avoidedIngredients: [],
  avoidedGroups: [],
  freeText: "",
  strictSafetyMode: true,
};

export function OnboardingFlow() {
  const [screen, setScreen] = useState<AppScreen>("welcome");
  const [step, setStep] = useState(0);
  const [state, setState] = useState<QuizState>(DEFAULT_STATE);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientSeverity, setIngredientSeverity] = useState<Severity>("sensitivity");
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState("match");

  const request = useMemo(() => buildRecommendationRequest(state), [state]);
  const isHairFlow = state.categories.includes("haircare");
  const isSkinFlow = state.categories.includes("skincare") || state.categories.includes("makeup");
  const inferredFilters = inferFiltersFromText(state.freeText);
  const quizCardRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (screen === "quiz") quizCardRef.current?.focus();
    if (screen === "results" || screen === "emptyResults" || screen === "error") resultsRef.current?.focus();
  }, [screen]);

  async function updateIngredientSuggestions(value: string) {
    setIngredientQuery(value);
    try {
      setSuggestions(await fetchIngredientSuggestions(value));
    } catch {
      setSuggestions([]);
    }
  }

  function addAvoidedIngredient(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setState((current) => ({
      ...current,
      strictSafetyMode: ingredientSeverity !== "preference" ? true : current.strictSafetyMode,
      avoidedIngredients: dedupeByTerm([
        ...current.avoidedIngredients,
        { term: trimmed, severity: ingredientSeverity },
      ]),
    }));
    setIngredientQuery("");
    setSuggestions([]);
  }

  async function showResults() {
    setRequestError(null);
    setResponse(null);
    setScreen("loadingRecommendations");
    try {
      const nextResponse = await fetchRecommendations(buildRecommendationRequest({ ...state, ...applyInferredFilters(state, inferredFilters) }));
      setResponse(nextResponse);
      setScreen(nextResponse.noResultsReason || nextResponse.results.length === 0 ? "emptyResults" : "results");
    } catch {
      setResponse(null);
      setRequestError("Recommendations are unavailable right now. Check the local server and API configuration, then try again.");
      setScreen("error");
    }
  }

  function enterQuiz() {
    setScreen("quiz");
  }

  if (screen === "welcome") {
    return (
      <div
        className="welcome-screen"
        role="button"
        tabIndex={0}
        aria-label="Enter FaceFinder"
        onClick={enterQuiz}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            enterQuiz();
          }
        }}
        style={{
          alignItems: "center",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          minHeight: "100dvh",
          minWidth: "100vw",
          padding: "clamp(1.5rem, 5vw, 4rem)",
        }}
      >
        <Image
          src="/IngrediFindr.png"
          alt="FaceFinder"
          width={448}
          height={240}
          priority
          className="welcome-logo"
          style={{
            display: "block",
            height: "auto",
            maxHeight: "63vh",
            maxWidth: "min(90vw, 42rem)",
            objectFit: "contain",
            width: "100%",
          }}
        />
      </div>
    );
  }

  return (
    <div className="flow-screen">
      {screen === "quiz" && (
        <section className="quiz-screen" id="onboarding" aria-label="FaceFinder onboarding quiz">
        <div className="quiz-card" ref={quizCardRef} tabIndex={-1} aria-label="FaceFinder onboarding quiz">
          <Progress step={step} />
          {step === 0 && (
            <QuizStep title="What are you shopping for?" description="Choose one or more product worlds.">
              <div className="option-grid option-grid--three">
                {PRODUCT_OPTIONS.map((option) => (
                  <button
                    type="button"
                    className={state.categories.includes(option.value) ? "choice-card is-selected" : "choice-card"}
                    key={option.value}
                    aria-pressed={state.categories.includes(option.value)}
                    onClick={() => toggleArray("categories", option.value, setState)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </QuizStep>
          )}

          {step === 1 && (
            <QuizStep title="Tell us what should feel better" description="These are preferences and concerns, not diagnoses. Choose what matters for this shopping trip.">
              {isSkinFlow && (
                <ChipGroup
                  label="Skin and face concerns"
                  values={SKIN_CONCERN_OPTIONS}
                  selected={state.skinConcerns}
                  onToggle={(value) => toggleArray("skinConcerns", value, setState)}
                />
              )}
              {isHairFlow && (
                <>
                  <ChipGroup
                    label="Hair concerns"
                    values={HAIR_CONCERN_OPTIONS}
                    selected={state.hairConcerns}
                    onToggle={(value) => toggleArray("hairConcerns", value, setState)}
                  />
                  <ChipGroup
                    label="Scalp concerns"
                    values={SCALP_CONCERN_OPTIONS}
                    selected={state.scalpConcerns}
                    onToggle={(value) => toggleArray("scalpConcerns", value, setState)}
                  />
                </>
              )}
            </QuizStep>
          )}

          {step === 2 && (
            <QuizStep title="Set your shopping preferences" description="These help rank products but should not be treated like allergy filters.">
              <ChipGroup
                label="Preference claims"
                values={PREFERENCE_OPTIONS}
                selected={state.preferences}
                onToggle={(value) => toggleArray("preferences", value, setState)}
              />
              <ChipGroup
                label="Stores"
                values={STORE_OPTIONS}
                selected={state.stores}
                onToggle={(value) => toggleArray("stores", value, setState)}
              />
              <div className="range-grid">
                <label>
                  Max budget
                  <input
                    type="range"
                    min="10"
                    max="75"
                    step="5"
                    value={state.budgetMax}
                    onChange={(event) => setState({ ...state, budgetMax: Number(event.target.value) })}
                  />
                  <span>${state.budgetMax}</span>
                </label>
                <label>
                  Minimum rating
                  <input
                    type="range"
                    min="3"
                    max="5"
                    step="0.1"
                    value={state.minimumRating}
                    onChange={(event) => setState({ ...state, minimumRating: Number(event.target.value) })}
                  />
                  <span>{state.minimumRating.toFixed(1)} stars</span>
                </label>
              </div>
            </QuizStep>
          )}

          {step === 3 && (
            <QuizStep title="Avoided ingredients" description="Separate nice-to-avoid preferences from sensitivities and allergies. Stronger severities trigger stricter filtering.">
              <SafetyNotice compact />
              <div className="severity-grid" role="radiogroup" aria-label="Avoidance severity">
                {(["preference", "sensitivity", "allergy"] as Severity[]).map((severity) => (
                  <label key={severity} className="severity-option">
                    <input
                      type="radio"
                      name="severity"
                      value={severity}
                      checked={ingredientSeverity === severity}
                      onChange={() => setIngredientSeverity(severity)}
                    />
                    <span>{formatSlug(severity)}</span>
                  </label>
                ))}
              </div>
              <label className="search-field">
                Ingredient or ingredient group
                <input
                  value={ingredientQuery}
                  onChange={(event) => updateIngredientSuggestions(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addAvoidedIngredient(ingredientQuery);
                    }
                  }}
                  placeholder="Try fragrance, lanolin, coconut oil..."
                />
              </label>
              {suggestions.length > 0 && (
                <div className="suggestion-list" role="listbox" aria-label="Ingredient suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={`${suggestion.canonicalName}-${suggestion.alias}`}
                      onClick={() => addAvoidedIngredient(suggestion.canonicalName)}
                    >
                      <strong>{suggestion.canonicalName}</strong>
                      <span>{suggestion.alias}</span>
                    </button>
                  ))}
                </div>
              )}
              <ChipGroup
                label="Ingredient groups"
                values={GROUP_OPTIONS}
                selected={state.avoidedGroups.map((item) => item.group)}
                onToggle={(value) => toggleAvoidedGroup(value, ingredientSeverity, setState)}
              />
              <SelectedFilters state={state} setState={setState} />
              <label className="free-text">
                Plain-language notes
                <textarea
                  value={state.freeText}
                  onChange={(event) => setState({ ...state, freeText: event.target.value })}
                  placeholder="Example: My scalp gets itchy with fragrance, and I prefer lightweight products under $30."
                />
              </label>
            </QuizStep>
          )}

          {step === 4 && (
            <QuizStep title="Review inferred filters" description="Confirm what should be used before results. Remove anything that does not sound right.">
              <ReviewPanel state={state} inferredFilters={inferredFilters} setState={setState} />
            </QuizStep>
          )}

          <div className="quiz-actions">
            <button type="button" className="button button--secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="button" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}>
                Continue
              </button>
            ) : (
              <button type="button" className="button" onClick={showResults}>
                Show recommendations
              </button>
            )}
          </div>
        </div>
      </section>
      )}

      {screen === "loadingRecommendations" && (
        <section className="loading-screen" role="status" aria-live="polite">
          <div className="empty-state">
            <h2>Finding matches</h2>
          </div>
        </section>
      )}

      {(screen === "results" || screen === "emptyResults" || screen === "error") && (
        <div ref={resultsRef} tabIndex={-1}>
      <RecommendationResults
        response={response}
        error={requestError}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        strictSafetyMode={state.strictSafetyMode}
        onStrictSafetyModeChange={(strictSafetyMode) => {
          const next = { ...state, strictSafetyMode };
          setState(next);
          setRequestError(null);
          fetchRecommendations(buildRecommendationRequest(next)).then(setResponse).catch(() => {
            setResponse(null);
            setRequestError("Recommendations are unavailable right now. Check the local server and API configuration, then try again.");
            setScreen("error");
          });
        }}
      />
        </div>
      )}
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="stepper" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      {STEPS.map((label, index) => (
        <span key={label} className={index <= step ? "is-active" : ""}>
          {label}
        </span>
      ))}
    </div>
  );
}

function QuizStep({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="quiz-step">
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly T[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="chip-group">
      <legend>{label}</legend>
      <div>
        {values.map((value) => (
          <button
            type="button"
            className={selected.includes(value) ? "chip is-selected" : "chip"}
            key={value}
            aria-pressed={selected.includes(value)}
            onClick={() => onToggle(value)}
          >
            {formatSlug(value)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SelectedFilters({ state, setState }: { state: QuizState; setState: (state: QuizState) => void }) {
  const items = [
    ...state.avoidedIngredients.map((item) => ({ label: item.term, detail: item.severity, type: "ingredient" })),
    ...state.avoidedGroups.map((item) => ({ label: formatSlug(item.group), detail: item.severity, type: "group" })),
  ];
  if (items.length === 0) return null;

  return (
    <div className="selected-filters" aria-label="Selected avoidance filters">
      {items.map((item) => (
        <span key={`${item.type}-${item.label}`}>
          {item.label} <small>{item.detail}</small>
        </span>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() => setState({ ...state, avoidedIngredients: [], avoidedGroups: [] })}
      >
        Clear avoid list
      </button>
    </div>
  );
}

function ReviewPanel({
  state,
  inferredFilters,
  setState,
}: {
  state: QuizState;
  inferredFilters: Partial<QuizState>;
  setState: (state: QuizState) => void;
}) {
  const confirmed = applyInferredFilters(state, inferredFilters);
  return (
    <div className="review-panel">
      <ReviewBlock title="Shopping for" items={state.categories.map(formatSlug)} />
      <ReviewBlock title="Concerns" items={[...state.skinConcerns, ...state.hairConcerns, ...state.scalpConcerns].map(formatSlug)} />
      <ReviewBlock title="Preference filters" items={state.preferences.map(formatSlug)} />
      <ReviewBlock
        title="Avoided ingredients"
        items={[
          ...state.avoidedIngredients.map((item) => `${item.term} (${item.severity})`),
          ...state.avoidedGroups.map((item) => `${formatSlug(item.group)} (${item.severity})`),
        ]}
      />
      <div className="inferred-card">
        <h3>Inferred from notes</h3>
        <p>These are suggestions from simple frontend parsing only. Confirm before results.</p>
        <ReviewBlock title="Suggested filters" items={summarizeInferred(inferredFilters)} />
        <div className="review-actions">
          <button type="button" className="button button--secondary" onClick={() => setState(confirmed)}>
            Confirm suggestions
          </button>
          <button type="button" className="text-button" onClick={() => setState({ ...state, freeText: "" })}>
            Remove notes
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="review-block">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <div className="review-chips">
          {items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : (
        <p>No filters selected.</p>
      )}
    </div>
  );
}

function toggleArray<K extends keyof QuizState, T extends QuizState[K] extends Array<infer U> ? U : never>(
  key: K,
  value: T,
  setState: Dispatch<SetStateAction<QuizState>>,
) {
  setState((current) => {
    const currentValues = current[key] as T[];
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    return { ...current, [key]: nextValues };
  });
}

function toggleAvoidedGroup(
  group: IngredientGroup,
  severity: Severity,
  setState: Dispatch<SetStateAction<QuizState>>,
) {
  setState((current) => {
    const exists = current.avoidedGroups.some((item) => item.group === group);
    return {
      ...current,
      strictSafetyMode: severity !== "preference" ? true : current.strictSafetyMode,
      avoidedGroups: exists
        ? current.avoidedGroups.filter((item) => item.group !== group)
        : [...current.avoidedGroups, { group, severity }],
    };
  });
}

function buildRecommendationRequest(state: QuizState): RecommendationRequest {
  return {
    goal: { categories: state.categories },
    concerns: {
      skin: state.skinConcerns,
      hair: state.hairConcerns,
      scalp: state.scalpConcerns,
    },
    preferences: {
      claims: state.preferences,
      budget: { max: state.budgetMax },
      stores: state.stores,
      minimumRating: state.minimumRating,
    },
    avoidedIngredients: state.avoidedIngredients,
    avoidedIngredientGroups: state.avoidedGroups,
    strictSafetyMode: state.strictSafetyMode,
    limit: 20,
  };
}

function inferFiltersFromText(text: string): Partial<QuizState> {
  const lower = text.toLowerCase();
  const inferred: Partial<QuizState> = {};
  if (lower.includes("itch")) inferred.scalpConcerns = ["itchiness"];
  if (lower.includes("frizz")) inferred.hairConcerns = ["frizz"];
  if (lower.includes("red")) inferred.skinConcerns = ["redness"];
  if (lower.includes("fragrance") || lower.includes("parfum")) {
    inferred.avoidedGroups = [{ group: "fragrance", severity: lower.includes("allerg") ? "allergy" : "sensitivity" }];
    inferred.strictSafetyMode = true;
  }
  if (lower.includes("sulfate")) inferred.preferences = ["sulfate-free"];
  return inferred;
}

function applyInferredFilters(state: QuizState, inferred: Partial<QuizState>): QuizState {
  return {
    ...state,
    skinConcerns: dedupe([...(state.skinConcerns ?? []), ...(inferred.skinConcerns ?? [])]),
    hairConcerns: dedupe([...(state.hairConcerns ?? []), ...(inferred.hairConcerns ?? [])]),
    scalpConcerns: dedupe([...(state.scalpConcerns ?? []), ...(inferred.scalpConcerns ?? [])]),
    preferences: dedupe([...(state.preferences ?? []), ...(inferred.preferences ?? [])]),
    avoidedGroups: dedupeGroups([...(state.avoidedGroups ?? []), ...(inferred.avoidedGroups ?? [])]),
    strictSafetyMode: state.strictSafetyMode || Boolean(inferred.strictSafetyMode),
  };
}

function summarizeInferred(inferred: Partial<QuizState>) {
  return [
    ...(inferred.skinConcerns ?? []).map(formatSlug),
    ...(inferred.hairConcerns ?? []).map(formatSlug),
    ...(inferred.scalpConcerns ?? []).map(formatSlug),
    ...(inferred.preferences ?? []).map(formatSlug),
    ...(inferred.avoidedGroups ?? []).map((item) => `${formatSlug(item.group)} (${item.severity})`),
  ];
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function dedupeByTerm(values: AvoidedIngredient[]): AvoidedIngredient[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeGroups(values: AvoidedIngredientGroup[]): AvoidedIngredientGroup[] {
  const seen = new Set<IngredientGroup>();
  return values.filter((value) => {
    if (seen.has(value.group)) return false;
    seen.add(value.group);
    return true;
  });
}
