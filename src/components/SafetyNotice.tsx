type SafetyNoticeProps = {
  title?: string;
  compact?: boolean;
};

export function SafetyNotice({ title = "Ingredient note", compact = false }: SafetyNoticeProps) {
  return (
    <aside className={compact ? "safety-notice safety-notice--compact" : "safety-notice"} id="safety">
      <strong>{title}</strong>
      <p>
        Face-Findr uses available product facts for filtering and cannot guarantee that a product is safe,
        reaction-free, or medically suitable. For allergies, severe reactions, or persistent concerns, check the
        retailer label and consult a qualified professional.
      </p>
    </aside>
  );
}
