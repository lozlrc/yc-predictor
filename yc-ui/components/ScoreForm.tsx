// yc-ui/components/ScoreForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseYouTubeId } from "../lib/parseYoutube";
import { scoreVideo, scoreUpload, ScoreResponse } from "../lib/api";

import ProgressTimeline, { StageKey } from "./ProgressTimeline";
import HistoryPanel, { HistoryItem } from "./HistoryPanel";
import ConfidenceBadge from "./ConfidenceBadge";
import ContributionCard from "./ContributionCard";

const HISTORY_KEY = "yc_predictor_history_v2";
const HISTORY_MAX = 12;

type Mode = "link" | "upload";

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryItem[];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch {}
}

export default function ScoreForm() {
  const [mode, setMode] = useState<Mode>("link");

  const [input, setInput] = useState("");
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<StageKey>("idle");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const stageTimer = useRef<number | null>(null);

  function scheduleStages() {
    if (stageTimer.current) window.clearTimeout(stageTimer.current);

    setStage("download");
    window.setTimeout(() => setStage("frames"), 2500);
    window.setTimeout(() => setStage("audio"), 4500);
    window.setTimeout(() => setStage("asr"), 6500);
    window.setTimeout(() => setStage("embed"), 12000);
  }

  function finishStages(success: boolean) {
    if (stageTimer.current) window.clearTimeout(stageTimer.current);
    setStage(success ? "done" : "idle");
  }

  // Shared result + history handling for both the link and upload paths.
  async function runScoring(fn: () => Promise<ScoreResponse>) {
    setErr(null);
    setResult(null);
    setLoading(true);
    scheduleStages();

    try {
      const out = await fn();
      setResult(out);
      finishStages(true);

      const next: HistoryItem[] = [
        {
          youtube_id: out.youtube_id,
          probability: out.yc_like_probability,
          confidence_label: out.confidence_label,
          at: Date.now(),
        },
        ...history.filter((h) => h.youtube_id !== out.youtube_id),
      ].slice(0, HISTORY_MAX);

      setHistory(next);
      saveHistory(next);
    } catch (e: any) {
      setErr(e?.message ?? "Scoring failed");
      finishStages(false);
    } finally {
      setLoading(false);
    }
  }

  async function onScore() {
    const id = parseYouTubeId(input);
    setYoutubeId(id);
    if (!id) {
      setErr("Could not parse a valid YouTube ID. Paste an 11-char ID or a YouTube URL.");
      setResult(null);
      return;
    }
    await runScoring(() => scoreVideo(id));
  }

  async function onScoreUpload() {
    if (!file) {
      setErr("Choose a video file first.");
      return;
    }
    await runScoring(() => scoreUpload(file));
  }

  function onPickFromHistory(id: string) {
    setMode("link");
    setInput(id);
    setYoutubeId(id);
  }

  function onClearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  const probPct = useMemo(() => {
    if (!result) return null;
    return Math.round(result.yc_like_probability * 1000) / 10;
  }, [result]);

  return (
    <div>
      <div className="mode-toggle" role="tablist" aria-label="Input source">
        <button
          role="tab"
          aria-selected={mode === "link"}
          className={`mode-tab${mode === "link" ? " on" : ""}`}
          onClick={() => setMode("link")}
        >
          YouTube link
        </button>
        <button
          role="tab"
          aria-selected={mode === "upload"}
          className={`mode-tab${mode === "upload" ? " on" : ""}`}
          onClick={() => setMode("upload")}
        >
          Upload video
        </button>
      </div>

      {mode === "link" ? (
        <>
          <div className="row">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="YouTube ID or URL (e.g. vtdm40KJyO4 or https://www.youtube.com/watch?v=vtdm40KJyO4)"
            />
            <button className="button" onClick={onScore} disabled={loading}>
              {loading ? "Scoring…" : "Score"}
            </button>
          </div>
          <div className="parsed-hint">
            Parsed ID <b>{youtubeId ?? "—"}</b>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <button
              className={`filepick${file ? " has-file" : ""}`}
              onClick={() => fileRef.current?.click()}
              disabled={loading}
            >
              {file ? file.name : "Choose a video file…"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button className="button" onClick={onScoreUpload} disabled={loading || !file}>
              {loading ? "Scoring…" : "Score"}
            </button>
          </div>
          <div className="parsed-hint">
            File <b>{file ? `${file.name} · ${(file.size / 1e6).toFixed(1)} MB` : "—"}</b>
          </div>
        </>
      )}

      <ProgressTimeline stage={loading ? stage : "idle"} error={err} />

      {result && probPct !== null ? (
        <div className="result">
          <div className="result__head">
            <div>
              <p className="section-label">YC-like probability</p>
              <div className="metric">
                {probPct}
                <span className="metric__unit">%</span>
              </div>
            </div>
            <ConfidenceBadge label={result.confidence_label} />
          </div>

          <div className="gauge">
            <div className="gauge__track">
              <span className="gauge__fill" style={{ width: `${probPct}%` }} />
              <span className="gauge__marker" style={{ left: `${probPct}%` }} />
            </div>
            <div className="gauge__ticks" aria-hidden="true">
              {[0, 25, 50, 75, 100].map((t) => (
                <span key={t} className="gauge__tick" style={{ left: `${t}%` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="result__raw">
            raw {result.yc_like_probability.toFixed(4)} · {result.label}
          </div>
        </div>
      ) : null}

      {result?.contrib ? <ContributionCard contrib={result.contrib} /> : null}

      <HistoryPanel items={history} onPick={onPickFromHistory} onClear={onClearHistory} />
    </div>
  );
}
