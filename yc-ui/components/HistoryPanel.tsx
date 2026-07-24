"use client";

import ConfidenceBadge from "./ConfidenceBadge";

export type HistoryItem = {
  youtube_id: string;
  probability: number;
  confidence_label: string;
  at: number; // epoch ms
};

function fmtTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString();
}

export default function HistoryPanel({
  items,
  onPick,
  onClear,
}: {
  items: HistoryItem[];
  onPick: (youtubeId: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="history">
      <div className="history__head">
        <p className="section-label">History</p>
        <button className="linkbtn" onClick={onClear} disabled={items.length === 0}>
          Clear
        </button>
      </div>

      {items.length === 0 ? (
        <div className="small history__empty">No runs yet. Scored videos are saved locally in your browser.</div>
      ) : (
        <div>
          {items.map((it) => (
            <button key={it.at} className="hist-item" onClick={() => onPick(it.youtube_id)}>
              <div className="hist-item__id">{it.youtube_id}</div>
              <div className="hist-item__prob">{(it.probability * 100).toFixed(1)}%</div>
              <div className="hist-item__meta">{fmtTime(it.at)}</div>
              <div className="hist-item__conf">
                <ConfidenceBadge label={it.confidence_label} />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
