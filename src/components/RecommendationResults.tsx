"use client";

import type { RecommendationResponse, RecommendationResult } from "../lib/recommendation/schemas";
import { DataConfidenceBadge } from "./DataConfidenceBadge";
import { SafetyNotice } from "./SafetyNotice";

type RecommendationResultsProps = {
  response: RecommendationResponse | null;
  error?: string | null;
  sortMode: string;
  onSortModeChange: (value: string) => void;
  strictSafetyMode: boolean;
  onStrictSafetyModeChange: (value: boolean) => void;
};

export function RecommendationResults({
  response,
  error,
  sortMode,
  onSortModeChange,
  strictSafetyMode,
  onStrictSafetyModeChange,
}: RecommendationResultsProps) {
  const sortedResults = sortResults(response?.results ?? [], sortMode);

  return (
    <section className="results-section" id="results" aria-labelledby="results-heading">
      <div className="section-heading">
        <span className="eyebrow">Your shelf shortlist</span>
        <h2 id="results-heading">Recommendations</h2>
        <p>
          Results come from deterministic category, ingredient-exclusion, and ranking logic using the available product
          data. Ingredient confidence is shown so incomplete records are not treated as guarantees.
        </p>
      </div>

      <div className="results-toolbar" aria-label="Results filters and sorting">
        <label>
          Sort
          <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value)}>
            <option value="match">Best match</option>
            <option value="price-low">Price: low to high</option>
            <option value="rating">Rating</option>
          </select>
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={strictSafetyMode}
            onChange={(event) => onStrictSafetyModeChange(event.target.checked)}
          />
          Strict ingredient exclusions
        </label>
      </div>

      <SafetyNotice compact title="Before you buy" />

      {response && (
        <p className="result-count" aria-live="polite">
          Showing {sortedResults.length} match(es). {response.totalExcluded} product(s) filtered out.
        </p>
      )}

      {error ? (
        <div className="empty-state" role="status">
          <h3>Recommendations unavailable</h3>
          <p>{error}</p>
        </div>
      ) : response?.noResultsReason ? (
        <div className="empty-state" role="status">
          <h3>No products match every strict filter</h3>
          <p>{response.noResultsReason}</p>
        </div>
      ) : (
        <div className="product-grid">
          {sortedResults.map((result) => (
            <ProductCard key={result.product.id} result={result} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductCard({ result }: { result: RecommendationResult }) {
  const { product } = result;
  return (
    <article className="product-card">
      <div className="product-card__media" aria-hidden="true">
        <span>{product.brand.slice(0, 1)}</span>
      </div>
      <div className="product-card__body">
        <div className="product-card__header">
          <div>
            <p className="product-card__brand">{product.brand}</p>
            <h3>{product.name}</h3>
          </div>
          <span className="score-pill">{result.score}% match</span>
        </div>
        <div className="product-meta" aria-label="Product details">
          <span>${product.price?.toFixed(2) ?? "Price unavailable"}</span>
          <span>{product.rating?.toFixed(1) ?? "No rating"} stars</span>
          <span>{product.store ?? "Retailer unavailable"}</span>
        </div>
        <DataConfidenceBadge status={product.dataQuality} />
        <ul className="reason-list" aria-label="Match reasons">
          {result.matchReasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="safety-copy">{result.safetyNotes[0]}</p>
      </div>
    </article>
  );
}

function sortResults(results: RecommendationResult[], sortMode: string) {
  const next = [...results];
  if (sortMode === "price-low") return next.sort((a, b) => (a.product.price ?? 999) - (b.product.price ?? 999));
  if (sortMode === "rating") return next.sort((a, b) => (b.product.rating ?? 0) - (a.product.rating ?? 0));
  return next.sort((a, b) => b.score - a.score);
}
