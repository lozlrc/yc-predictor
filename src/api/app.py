# src/api/app.py
from pathlib import Path
import json

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

import numpy as np
import torch
from faster_whisper import WhisperModel

from src.config import NN_PATH, META_PATH, ensure_dirs, TMP_VIDEOS, TMP_AUDIO, TMP_FRAMES
from src.media.youtube import download_youtube
from src.media.audio import extract_wav
from src.media.frames import extract_first_n_frames
from src.features.frame_feats import summarize_first_frames
from src.features.text_embed import TextEmbedder
from src.train.nn_model import YCMLP


app = FastAPI(title="YC Predictor (NN: Transcript + First-10-Frames)")


class ScoreReq(BaseModel):
    youtube_id: str


class ScoreResp(BaseModel):
    youtube_id: str
    yc_like_probability: float
    label: str
    confidence_label: str
    transcript: str
    frame_features: dict


_model = None
_asr = None
_embed = None
_device = "cuda" if torch.cuda.is_available() else "cpu"

_num_keys = None
_mu = None
_sd = None


def sigmoid(x: float) -> float:
    return float(1.0 / (1.0 + np.exp(-x)))


def confidence_label(prob: float) -> str:
    """Plain-language band for the probability (drives the UI badge)."""
    if prob >= 0.65:
        return "Likely to get accepted"
    if prob >= 0.45:
        return "Almost there"
    if prob >= 0.30:
        return "Borderline"
    return "Unlikely"


@app.on_event("startup")
def startup():
    global _model, _asr, _embed, _num_keys, _mu, _sd

    ensure_dirs()

    if not NN_PATH.exists() or not META_PATH.exists():
        print("WARNING: Model/meta missing. Train with: python3 -m src.train.train_text")
        _model = None
    else:
        ckpt = torch.load(NN_PATH, map_location="cpu")
        _model = YCMLP(
            input_dim=int(ckpt["input_dim"]),
            hidden_dims=list(ckpt.get("hidden_dims", [128, 32])),
            dropout=float(ckpt.get("dropout", 0.5)),
        )
        _model.load_state_dict(ckpt["state_dict"])
        _model.to(_device).eval()

        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        _num_keys = list(meta["numeric_features"])
        _mu = np.array(meta["numeric_scaler"]["mean"], dtype=np.float32)
        _sd = np.array(meta["numeric_scaler"]["std"], dtype=np.float32)
        _sd = np.where(_sd < 1e-6, 1.0, _sd)

    _asr = WhisperModel("base", device="cpu", compute_type="int8")
    _embed = TextEmbedder(device="cpu")


def transcribe_wav(wav_path: Path) -> str:
    segments, _ = _asr.transcribe(str(wav_path), vad_filter=True)
    parts = []
    for seg in segments:
        t = (seg.text or "").strip()
        if t:
            parts.append(t)
    return " ".join(parts)


def _score_video(video_path: Path, ident: str) -> ScoreResp:
    """Run the frames + transcript pipeline on a local video file and score it.

    Shared by the YouTube path (which downloads first) and the direct-upload path.
    `ident` is used to namespace extracted frames and to label the result.
    """
    frame_dir = TMP_FRAMES / ident
    frames = extract_first_n_frames(video_path, frame_dir, n=10, fps=1)
    frame_summary = summarize_first_frames(frames)

    wav_path = extract_wav(video_path, TMP_AUDIO)
    transcript = transcribe_wav(wav_path)
    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Could not transcribe audio for this video.")

    X_text = _embed.encode([transcript]).astype(np.float32)

    feats = {
        "mean_brightness": float(getattr(frame_summary, "mean_brightness", 0.0)),
        "std_brightness": float(getattr(frame_summary, "std_brightness", 0.0)),
        "mean_edge_density": float(getattr(frame_summary, "mean_edge_density", 0.0)),
        "mean_motion_energy": float(getattr(frame_summary, "mean_motion_energy", 0.0)),
        "n_frames": float(getattr(frame_summary, "n_frames", 0.0)),
    }

    x_num_raw = np.array([[float(feats.get(k, 0.0)) for k in _num_keys]], dtype=np.float32)
    x_num = (x_num_raw - _mu) / _sd

    X = np.hstack([X_text, x_num]).astype(np.float32)

    with torch.no_grad():
        logit = float(_model(torch.from_numpy(X).to(_device)).item())
    prob = sigmoid(logit)

    # Old behavior: fixed 0.50 threshold for labeling
    label = "YC-like" if prob >= 0.50 else "Not YC-like"

    return ScoreResp(
        youtube_id=ident,
        yc_like_probability=prob,
        label=label,
        confidence_label=confidence_label(prob),
        transcript=transcript,
        frame_features=feats,
    )


@app.post("/score", response_model=ScoreResp)
def score(req: ScoreReq):
    if _model is None:
        raise HTTPException(status_code=400, detail="Model not trained. Run: python3 -m src.train.train_text")

    yt = req.youtube_id.strip()
    if not yt:
        raise HTTPException(status_code=400, detail="youtube_id is required.")

    video_path = download_youtube(yt, TMP_VIDEOS)
    return _score_video(video_path, yt)


@app.post("/score-upload", response_model=ScoreResp)
async def score_upload(file: UploadFile = File(...)):
    """Score a video the user uploads directly, skipping the YouTube download."""
    if _model is None:
        raise HTTPException(status_code=400, detail="Model not trained. Run: python3 -m src.train.train_text")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")

    ensure_dirs()
    name = file.filename or "upload.mp4"
    suffix = Path(name).suffix or ".mp4"
    ident = "".join(c if c.isalnum() else "_" for c in Path(name).stem)[:64] or "upload"
    dest = TMP_VIDEOS / f"upload_{ident}{suffix}"
    dest.write_bytes(data)

    return _score_video(dest, ident)