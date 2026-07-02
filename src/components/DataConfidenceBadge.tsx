import type { ProductDataQuality } from "../lib/recommendation/schemas";

const LABELS: Record<ProductDataQuality, string> = {
  complete: "Ingredient data complete",
  partial: "Ingredient data partial",
  "missing-ingredients": "Ingredients missing",
  "unparseable-ingredients": "Ingredients unclear",
};

type DataConfidenceBadgeProps = {
  status: ProductDataQuality;
};

export function DataConfidenceBadge({ status }: DataConfidenceBadgeProps) {
  return <span className={`confidence-badge confidence-badge--${status}`}>{LABELS[status]}</span>;
}
