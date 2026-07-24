"use client";

export type Contrib = {
  intercept: number;
  text_logit: number;
  frames_logit: number;
  total_logit: number;
};

function fmt(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(3)}`;
}

function SignedBar({ label, value, max, total }: { label: string; value: number; max: number; total?: boolean }) {
  const pos = value >= 0;
  const frac = max > 0 ? Math.min(Math.abs(value) / max, 1) : 0;
  const half = frac * 50; // % of full track (center = 50%)

  return (
    <div className={`sbar-row${total ? " sbar-row--total" : ""}`}>
      <div className="sbar-row__label">{label}</div>
      <div className="sbar">
        <span className="sbar__axis" aria-hidden="true" />
        <span
          className={`sbar__fill sbar__fill--${pos ? "pos" : "neg"}`}
          style={pos ? { left: "50%", width: `${half}%` } : { left: `${50 - half}%`, width: `${half}%` }}
        />
      </div>
      <div className={`sbar-row__val sbar-row__val--${pos ? "pos" : "neg"}`}>{fmt(value)}</div>
    </div>
  );
}

export default function ContributionCard({ contrib }: { contrib: Contrib }) {
  const { intercept, text_logit, frames_logit, total_logit } = contrib;

  const max = Math.max(
    Math.abs(intercept),
    Math.abs(text_logit),
    Math.abs(frames_logit),
    Math.abs(total_logit),
  );

  return (
    <div className="card contrib">
      <p className="section-label">Feature contribution</p>
      <p className="small contrib__note">
        Contributions in <b>logit</b> space (linear score before the sigmoid). Positive pushes toward
        “accepted”, negative pushes away.
      </p>

      <SignedBar label="Intercept" value={intercept} max={max} />
      <SignedBar label="Text embedding" value={text_logit} max={max} />
      <SignedBar label="Frame features" value={frames_logit} max={max} />
      <SignedBar label="Total logit" value={total_logit} max={max} total />
    </div>
  );
}
