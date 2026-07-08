"use client";

import { useEffect, useState } from "react";
import type { RecommendationResponse, RecommendationResult } from "../lib/recommendation/schemas";
import { DataConfidenceBadge } from "./DataConfidenceBadge";

type RecommendationResultsProps = {
  response: RecommendationResponse | null;
  error?: string | null;
  sortMode: string;
  onSortModeChange: (value: string) => void;
  onEditAnswers: () => void;
  strictSafetyMode: boolean;
  onStrictSafetyModeChange: (value: boolean) => void;
};

export function RecommendationResults({
  response,
  error,
  sortMode,
  onSortModeChange,
  onEditAnswers,
  strictSafetyMode,
  onStrictSafetyModeChange,
}: RecommendationResultsProps) {
  const [visibleCount, setVisibleCount] = useState(20);
  const sortedResults = sortResults(response?.results ?? [], sortMode);
  const visibleResults = sortedResults.slice(0, visibleCount);
  const categories = response?.appliedFilters.categories.map((category) => category.replace(/-/g, " ")).join(", ") || "beauty";

  useEffect(() => {
    setVisibleCount(20);
  }, [response, sortMode]);

  return (
    <section className="results-section" id="results" aria-labelledby="results-heading">
      <header className="results-header">
        <div>
          <span className="eyebrow">Your shortlist - {categories}</span>
          <h2 id="results-heading">
            {sortedResults.length || 0} matches, ranked and <span>receipted.</span>
          </h2>
          <p>Every card shows its work. Ingredient confidence is visible so incomplete records are not treated as guarantees.</p>
        </div>
        <nav className="results-nav" aria-label="Results actions">
          <button type="button" onClick={onEditAnswers}>Edit my answers</button>
          <a href="/">Start over</a>
        </nav>
      </header>

      <div className="results-toolbar" aria-label="Results filters and sorting">
        <div className="sort-tabs" role="radiogroup" aria-label="Sort results">
          {[
            ["match", "Best match"],
            ["price-low", "Price"],
            ["rating", "Rating"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={sortMode === value ? "is-active" : ""}
              aria-pressed={sortMode === value}
              onClick={() => onSortModeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className={strictSafetyMode ? "strict-toggle is-on" : "strict-toggle"}>
          <input
            type="checkbox"
            checked={strictSafetyMode}
            onChange={(event) => onStrictSafetyModeChange(event.target.checked)}
          />
          <span>Strict ingredient exclusions - {strictSafetyMode ? "on" : "off"}</span>
        </label>
        {response && (
          <p className="result-count" aria-live="polite">
            {visibleResults.length} shown of {sortedResults.length} · {response.totalExcluded} filtered out
          </p>
        )}
      </div>

      <aside className="buy-strip">
        <strong>Before you buy</strong>
        <p>Labels change. Always verify the current ingredient list, price, and shade details on the retailer page.</p>
      </aside>

      {error ? (
        <EmptyState title="Something's off on our end." copy={error} />
      ) : response?.noResultsReason ? (
        <EmptyState title="No products match every strict filter" copy={response.noResultsReason} />
      ) : (
        <div className="product-grid">
          {visibleResults.map((result) => (
            <ProductCard key={productCardKey(result)} result={result} />
          ))}
        </div>
      )}
      {!error && !response?.noResultsReason && visibleCount < sortedResults.length && (
        <div className="show-more-wrap">
          <button type="button" className="show-more-button" onClick={() => setVisibleCount((count) => count + 10)}>
            Show {Math.min(10, sortedResults.length - visibleCount)} more
          </button>
        </div>
      )}
    </section>
  );
}

function productCardKey(result: RecommendationResult) {
  const { product } = result;
  return [product.retailerSlug, product.canonicalUrl || product.url, product.id].filter(Boolean).join(":");
}

function ProductCard({ result }: { result: RecommendationResult }) {
  const { product } = result;
  const retailerName = product.store ?? "Retailer";
  const productUrl = product.canonicalUrl || product.url;
  const priceLabel = formatPrice(product.price, product.currency);
  const freshnessLabel = product.isStale ? "Price checked earlier" : product.lastScrapedAt ? "Recently checked" : "Check retailer";

  return (
    <article className="product-card">
      <div className="product-card__media">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.imageAltText || `${product.brand} ${product.name}`} loading="lazy" />
        ) : (
          <div className="image-fallback" aria-label="No image on file">
            <span aria-hidden="true">{product.brand.slice(0, 1)}</span>
            <b>No image on file</b>
          </div>
        )}
        <span className="score-pill">{result.score}% match</span>
      </div>
      <div className="product-card__body">
        <p className="product-meta">
          <span>{product.brand} - {retailerName}</span>
          <span>{priceLabel} · {product.rating?.toFixed(1) ?? "No rating"} stars{product.reviewCount ? ` (${product.reviewCount})` : ""}</span>
        </p>
        <h3>{product.name}</h3>
        <DataConfidenceBadge status={product.dataQuality} />
        <div className="card-divider" />
        <p className="reason-copy">Why: {result.matchReasons.slice(0, 3).join(" · ")}</p>
        <p className="safety-copy">{result.safetyNotes[0]}</p>
        <div className="card-divider" />
        <div className="card-footer">
          {productUrl ? (
            <a className="retailer-link" href={productUrl} target="_blank" rel="noopener noreferrer nofollow">
              View at {retailerName}
            </a>
          ) : <span />}
          <span>{freshnessLabel}</span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-blob" />
      <h3>{title}</h3>
      <p>{copy}</p>
      <div className="recovery-chips">
        <span>Raise budget</span>
        <span>Remove store</span>
        <span>Relax strict mode with care</span>
      </div>
    </div>
  );
}

function formatPrice(price: number | undefined, currency = "USD") {
  if (price === undefined) return "Price unavailable";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

function sortResults(results: RecommendationResult[], sortMode: string) {
  const next = [...results];
  if (sortMode === "price-low") return next.sort((a, b) => (a.product.price ?? 999) - (b.product.price ?? 999));
  if (sortMode === "rating") return next.sort((a, b) => (b.product.rating ?? 0) - (a.product.rating ?? 0));
  return next.sort((a, b) => b.score - a.score);
}
