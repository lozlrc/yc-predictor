"use client";

export default function ConfidenceBadge({ label }: { label: string }) {
  const tone =
    label === "Likely to get accepted"
      ? "go"
      : label === "Almost there"
      ? "warn"
      : label === "Borderline"
      ? "neutral"
      : "danger";

  return (
    <span className={`pill pill--${tone}`}>
      <span className="pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
