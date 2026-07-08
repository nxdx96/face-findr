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

const PRODUCT_OPTIONS: { value: ProductCategory; label: string; description: string; domain: string }[] = [
  { value: "makeup", label: "Makeup", description: "Foundation, blush, eyes, and color", domain: "W. 01" },
  { value: "skincare", label: "Skincare", description: "Cleanse, moisturize, and comfort", domain: "W. 02" },
  { value: "haircare", label: "Haircare", description: "Wash, condition, and style support", domain: "W. 03" },
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
const STORE_OPTIONS = ["Sephora", "Ulta"];
const STEP_LABELS = ["The Goal", "Concerns", "Preferences", "The Avoid List", "The Receipt"];
const RAIL_NOTES = [
  "Pick one or more product worlds. Skincare starts selected so you can move quickly.",
  "Concerns nudge the ranking. They never diagnose, and they never exclude.",
  "Claims help ranking. They are not allergy filters - that's the next step.",
  "Product data can't guarantee a product is safe or reaction-free. When it's your skin on the line, we get conservative.",
  "Nothing gets applied silently. This is exactly what we'll send.",
];

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

  const inferredFilters = useMemo(() => inferFiltersFromText(state.freeText), [state.freeText]);
  const isHairFlow = state.categories.includes("haircare");
  const isSkinFlow = state.categories.includes("skincare") || state.categories.includes("makeup");
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
      avoidedIngredients: dedupeByTerm([...current.avoidedIngredients, { term: trimmed, severity: ingredientSeverity }]),
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

  if (screen === "welcome") {
    return <WelcomeScreen onEnter={() => setScreen("quiz")} />;
  }

  return (
    <div className="flow-screen">
      {screen === "quiz" && (
        <section className="quiz-screen" id="onboarding" aria-label="Ingredi-Findr onboarding quiz">
          <div className="quiz-card" ref={quizCardRef} tabIndex={-1}>
            <QuizHeader />
            <div className="quiz-layout">
              <StepRail step={step} />
              <div className="quiz-content">
                {step === 0 && (
                  <QuizStep
                    eyebrow="Step 01 of 05 - The Goal"
                    title={<>What are you shopping for <span>today?</span></>}
                    description="Choose one or more product worlds. What are you shopping for? Skincare is selected to start."
                  >
                    <div className="world-grid">
                      {PRODUCT_OPTIONS.map((option) => (
                        <button
                          type="button"
                          className={state.categories.includes(option.value) ? "world-card is-selected" : "world-card"}
                          key={option.value}
                          aria-pressed={state.categories.includes(option.value)}
                          onClick={() => toggleArray("categories", option.value, setState)}
                        >
                          <span className="world-index">{option.domain}</span>
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                          {state.categories.includes(option.value) && <em>Selected</em>}
                        </button>
                      ))}
                    </div>
                  </QuizStep>
                )}

                {step === 1 && (
                  <QuizStep
                    eyebrow="Step 02 of 05 - Concerns"
                    title={<>Where should things feel <span>better?</span></>}
                    description="Optional. Skip entirely if today is just a vibe."
                  >
                    {isSkinFlow && (
                      <ChipGroup
                        label="Skin + face"
                        values={SKIN_CONCERN_OPTIONS}
                        selected={state.skinConcerns}
                        onToggle={(value) => toggleArray("skinConcerns", value, setState)}
                      />
                    )}
                    {isHairFlow && (
                      <>
                        <ChipGroup
                          label="Hair"
                          values={HAIR_CONCERN_OPTIONS}
                          selected={state.hairConcerns}
                          onToggle={(value) => toggleArray("hairConcerns", value, setState)}
                        />
                        <ChipGroup
                          label="Scalp"
                          values={SCALP_CONCERN_OPTIONS}
                          selected={state.scalpConcerns}
                          onToggle={(value) => toggleArray("scalpConcerns", value, setState)}
                        />
                      </>
                    )}
                  </QuizStep>
                )}

                {step === 2 && (
                  <QuizStep
                    eyebrow="Step 03 of 05 - Preferences"
                    title={<>House <span>rules.</span></>}
                    description="What a product should claim, where it should live, and what it should cost."
                  >
                    <ChipGroup
                      label="Claims - ranking boosts"
                      values={PREFERENCE_OPTIONS}
                      selected={state.preferences}
                      onToggle={(value) => toggleArray("preferences", value, setState)}
                    />
                    <fieldset className="store-group">
                      <legend>Stores - optional</legend>
                      <div>
                        {STORE_OPTIONS.map((store) => (
                          <button
                            type="button"
                            key={store}
                            className={state.stores.includes(store) ? "store-card is-selected" : "store-card"}
                            aria-pressed={state.stores.includes(store)}
                            onClick={() => toggleArray("stores", store, setState)}
                          >
                            <span>{store}</span>
                            {state.stores.includes(store) && <b aria-hidden="true">✓</b>}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="range-grid">
                      <RangeControl
                        label="Max budget"
                        value={`$${state.budgetMax}`}
                        minLabel="$10"
                        maxLabel="$75+"
                        input={
                          <input
                            type="range"
                            min="10"
                            max="75"
                            step="5"
                            value={state.budgetMax}
                            onChange={(event) => setState({ ...state, budgetMax: Number(event.target.value) })}
                          />
                        }
                      />
                      <RangeControl
                        label="Minimum rating - hard filter"
                        value={`${state.minimumRating.toFixed(1)} stars`}
                        minLabel="Any"
                        maxLabel="5.0"
                        input={
                          <input
                            type="range"
                            min="3"
                            max="5"
                            step="0.1"
                            value={state.minimumRating}
                            onChange={(event) => setState({ ...state, minimumRating: Number(event.target.value) })}
                          />
                        }
                      />
                    </div>
                  </QuizStep>
                )}

                {step === 3 && (
                  <QuizStep
                    eyebrow="Step 04 of 05 - The Avoid List"
                    title={<>The do-not-<span>apply</span> list.</>}
                    description="Hard exclusions. Anything here gets matched by exact term, alias, and group before ranking even starts."
                  >
                    <div className="severity-block">
                      <span className="field-label">How serious is it?</span>
                      <div className="severity-grid" role="radiogroup" aria-label="Avoidance severity">
                        {(["preference", "sensitivity", "allergy"] as Severity[]).map((severity) => (
                          <label key={severity} className={ingredientSeverity === severity ? "severity-option is-selected" : "severity-option"}>
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
                      {ingredientSeverity !== "preference" && (
                        <p className="strict-copy">Strict mode on - missing or unclear ingredient lists get excluded.</p>
                      )}
                    </div>
                    <label className="search-field">
                      <span className="field-label">Ingredient or ingredient group</span>
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
                            <span>{suggestion.group ? `Group - ${formatSlug(suggestion.group)}` : suggestion.alias}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <SelectedFilters state={state} setState={setState} />
                    <ChipGroup
                      label="Or pick a whole group"
                      values={GROUP_OPTIONS}
                      selected={state.avoidedGroups.map((item) => item.group)}
                      onToggle={(value) => toggleAvoidedGroup(value, ingredientSeverity, setState)}
                    />
                    <label className="free-text">
                      <span className="field-label">Plain-language notes</span>
                      <textarea
                        value={state.freeText}
                        onChange={(event) => setState({ ...state, freeText: event.target.value })}
                        placeholder="Example: My scalp gets itchy with fragrance, and I prefer lightweight products under $30."
                      />
                      <small>We suggest filters from this. You approve them at review.</small>
                    </label>
                  </QuizStep>
                )}

                {step === 4 && (
                  <QuizStep
                    eyebrow="Step 05 of 05 - The Receipt"
                    title={<>Read it back to <span>me.</span></>}
                    description="Review inferred filters and confirm the receipt. Nothing gets applied silently. This is exactly what we'll send."
                  >
                    <ReviewPanel state={state} inferredFilters={inferredFilters} setState={setState} setStep={setStep} />
                  </QuizStep>
                )}
              </div>
            </div>
            <QuizFooter step={step} onBack={() => setStep(Math.max(0, step - 1))} onNext={() => setStep(Math.min(STEP_LABELS.length - 1, step + 1))} onSubmit={showResults} />
          </div>
        </section>
      )}

      {screen === "loadingRecommendations" && <LoadingScreen />}

      {(screen === "results" || screen === "emptyResults" || screen === "error") && (
        <div ref={resultsRef} tabIndex={-1}>
          <RecommendationResults
            response={response}
            error={requestError}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            onEditAnswers={() => {
              setStep(0);
              setScreen("quiz");
            }}
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

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div
      className="welcome-screen"
      role="button"
      tabIndex={0}
      aria-label="Enter Ingredi-Findr"
      onClick={onEnter}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEnter();
        }
      }}
    >
      <span className="blob blob--butter" />
      <span className="blob blob--mint" />
      <span className="blob blob--lavender" />
      <span className="corner-label corner-label--bl">Not medical advice</span>
      <div className="welcome-stack">
        <p className="welcome-eyebrow">* A beauty discovery instrument *</p>
        <Image src="/IngrediFindr.png" alt="Ingredi-Findr" width={460} height={248} priority className="welcome-logo" />
        <p className="welcome-tagline">Know what&apos;s in it <span>before</span> it&apos;s on you.</p>
        <p className="welcome-enter">- Click anywhere to enter -</p>
      </div>
    </div>
  );
}

function QuizHeader() {
  return (
    <header className="quiz-header">
      <Image src="/IngrediFindr.png" alt="Ingredi-Findr" width={164} height={88} priority />
      <span>Reads labels so you don&apos;t have to</span>
    </header>
  );
}

function StepRail({ step }: { step: number }) {
  return (
    <aside className="step-rail" aria-label="Quiz progress">
      <ol>
        {STEP_LABELS.map((label, index) => (
          <li key={label} className={index === step ? "is-active" : index < step ? "is-complete" : ""}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <b>{label}</b>
            {index === step && <i aria-hidden="true" />}
            {index < step && <em aria-hidden="true">✓</em>}
          </li>
        ))}
      </ol>
      <div className={step === 3 ? "rail-note rail-note--dark" : "rail-note"}>
        {step === 3 && <strong>The fine print</strong>}
        <p>{RAIL_NOTES[step]}</p>
      </div>
    </aside>
  );
}

function QuizStep({ eyebrow, title, description, children }: { eyebrow: string; title: ReactNode; description: string; children: ReactNode }) {
  return (
    <section className="quiz-step">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="step-description">{description}</p>
      <div className="step-body">{children}</div>
    </section>
  );
}

function QuizFooter({ step, onBack, onNext, onSubmit }: { step: number; onBack: () => void; onNext: () => void; onSubmit: () => void }) {
  const progress = ((step + 1) / STEP_LABELS.length) * 100;
  return (
    <footer className="quiz-footer">
      <button type="button" className="text-button" onClick={onBack} disabled={step === 0}>
        Back
      </button>
      <div className="progress-track" aria-label={`Step ${step + 1} of ${STEP_LABELS.length}`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {step < STEP_LABELS.length - 1 ? (
        <button type="button" className="button" onClick={onNext}>
          Continue
        </button>
      ) : (
        <button type="button" className="button button--large" onClick={onSubmit}>
          Show my matches
        </button>
      )}
    </footer>
  );
}

function LoadingScreen() {
  return (
    <section className="loading-screen" role="status" aria-live="polite">
      <span className="loading-blob" />
      <div>
        <h2>Finding matches...</h2>
        <ul className="loading-list">
          <li className="is-done">Reading labels</li>
          <li className="is-done">Checking fragrance aliases</li>
          <li className="is-active">Applying strict mode</li>
          <li>Ranking what survives</li>
        </ul>
      </div>
    </section>
  );
}

function ChipGroup<T extends string>({ label, values, selected, onToggle }: { label: string; values: readonly T[]; selected: readonly T[]; onToggle: (value: T) => void }) {
  return (
    <fieldset className="chip-group">
      <legend>{label}</legend>
      <div>
        {values.map((value) => (
          <button type="button" className={selected.includes(value) ? "chip is-selected" : "chip"} key={value} aria-pressed={selected.includes(value)} onClick={() => onToggle(value)}>
            {formatSlug(value)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function RangeControl({ label, value, minLabel, maxLabel, input }: { label: string; value: string; minLabel: string; maxLabel: string; input: ReactNode }) {
  return (
    <div className="range-control">
      <div>
        <span className="field-label">{label}</span>
        <b>{value}</b>
      </div>
      {input}
      <p>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </p>
    </div>
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
      <span className="field-label">Avoiding:</span>
      {items.map((item) => (
        <span className="token" key={`${item.type}-${item.label}`}>
          {item.label} <small>{item.detail}</small>
        </span>
      ))}
      <button type="button" className="text-button" onClick={() => setState({ ...state, avoidedIngredients: [], avoidedGroups: [] })}>
        Clear all
      </button>
    </div>
  );
}

function ReviewPanel({ state, inferredFilters, setState, setStep }: { state: QuizState; inferredFilters: Partial<QuizState>; setState: (state: QuizState) => void; setStep: (step: number) => void }) {
  const confirmed = applyInferredFilters(state, inferredFilters);
  return (
    <div className="receipt-panel">
      <ReceiptRow label="Shopping for" value={state.categories.map(formatSlug).join(", ")} onEdit={() => setStep(0)} />
      <ReceiptRow label="Concerns" value={summarizeConcerns(state).join(", ") || "No concerns selected"} onEdit={() => setStep(1)} />
      <ReceiptRow label="Preferences" value={[...state.preferences.map(formatSlug), `$${state.budgetMax} max`, `${state.minimumRating.toFixed(1)} stars min`, ...state.stores].join(", ")} onEdit={() => setStep(2)} />
      <ReceiptRow
        label="Avoiding - strict"
        value={summarizeAvoidance(state).join(", ") || "No avoid filters selected"}
        detail={state.strictSafetyMode ? "Severity: sensitivity/allergy filters exclude missing or unclear ingredient lists." : "Strict mode is relaxed for preference-only filters."}
        onEdit={() => setStep(3)}
        highlighted
      />
      <div className="receipt-row">
        <span>From your notes</span>
        <div>
          <b>{state.freeText ? `"${state.freeText}"` : "No notes added"}</b>
          {summarizeInferred(inferredFilters).length > 0 && <small>Suggest: {summarizeInferred(inferredFilters).join(", ")}</small>}
        </div>
        <div className="receipt-actions">
          {summarizeInferred(inferredFilters).length > 0 && (
            <button type="button" className="chip is-selected" onClick={() => setState(confirmed)}>
              Apply
            </button>
          )}
          <button type="button" className="text-button" onClick={() => setState({ ...state, freeText: "" })}>
            Remove
          </button>
        </div>
      </div>
      <p className="receipt-caption">First 20 shown - more available when the catalog has them.</p>
    </div>
  );
}

function ReceiptRow({ label, value, detail, onEdit, highlighted = false }: { label: string; value: string; detail?: string; onEdit: () => void; highlighted?: boolean }) {
  return (
    <div className={highlighted ? "receipt-row receipt-row--highlight" : "receipt-row"}>
      <span>{label}</span>
      <div>
        <b>{value}</b>
        {detail && <small>{detail}</small>}
      </div>
      <button type="button" className="text-button" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

function toggleArray<K extends keyof QuizState, T extends QuizState[K] extends Array<infer U> ? U : never>(key: K, value: T, setState: Dispatch<SetStateAction<QuizState>>) {
  setState((current) => {
    const currentValues = current[key] as T[];
    const nextValues = currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value];
    return { ...current, [key]: nextValues };
  });
}

function toggleAvoidedGroup(group: IngredientGroup, severity: Severity, setState: Dispatch<SetStateAction<QuizState>>) {
  setState((current) => {
    const exists = current.avoidedGroups.some((item) => item.group === group);
    return {
      ...current,
      strictSafetyMode: severity !== "preference" ? true : current.strictSafetyMode,
      avoidedGroups: exists ? current.avoidedGroups.filter((item) => item.group !== group) : [...current.avoidedGroups, { group, severity }],
    };
  });
}

function buildRecommendationRequest(state: QuizState): RecommendationRequest {
  return {
    goal: { categories: state.categories },
    concerns: { skin: state.skinConcerns, hair: state.hairConcerns, scalp: state.scalpConcerns },
    preferences: { claims: state.preferences, budget: { max: state.budgetMax }, stores: state.stores, minimumRating: state.minimumRating },
    avoidedIngredients: state.avoidedIngredients,
    avoidedIngredientGroups: state.avoidedGroups,
    strictSafetyMode: state.strictSafetyMode,
    limit: 100,
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

function summarizeConcerns(state: QuizState) {
  return [...state.skinConcerns, ...state.hairConcerns, ...state.scalpConcerns].map(formatSlug);
}

function summarizeAvoidance(state: QuizState) {
  return [
    ...state.avoidedIngredients.map((item) => `${item.term} (${item.severity})`),
    ...state.avoidedGroups.map((item) => `${formatSlug(item.group)} (${item.severity})`),
  ];
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
