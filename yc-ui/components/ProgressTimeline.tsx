"use client";

type Stage = {
  key: string;
  label: string;
};

const STAGES: Stage[] = [
  { key: "idle", label: "Waiting" },
  { key: "download", label: "Downloading video" },
  { key: "frames", label: "Extracting frames" },
  { key: "audio", label: "Extracting audio" },
  { key: "asr", label: "Transcribing speech" },
  { key: "embed", label: "Embedding + scoring" },
  { key: "done", label: "Done" },
];

export type StageKey = (typeof STAGES)[number]["key"];

// visible processing steps (idle/done are states, not steps)
const STEPS = STAGES.filter((s) => s.key !== "idle" && s.key !== "done");

export default function ProgressTimeline({
  stage,
  error,
}: {
  stage: StageKey;
  error?: string | null;
}) {
  const idx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="card stepper">
      <p className="section-label">Progress</p>

      <div className="stepper__list" style={{ marginTop: 14 }}>
        {STEPS.map((s, i) => {
          const stepIdx = STAGES.findIndex((x) => x.key === s.key);
          const done = idx > stepIdx;
          const active = idx === stepIdx;
          const state = done ? "done" : active ? "active" : "pending";

          return (
            <div key={s.key} className={`step step--${state}`}>
              <div className="step__num">{done ? "✓" : i + 1}</div>
              <div className="step__label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="error" style={{ marginTop: 16 }} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
