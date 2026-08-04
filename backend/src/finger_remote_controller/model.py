"""Download and cache the MediaPipe Hand Landmarker model."""

from __future__ import annotations

import urllib.request
from pathlib import Path

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)
MODEL_FILENAME = "hand_landmarker.task"


def default_model_dir() -> Path:
    return Path(__file__).resolve().parent / "models"


def ensure_model(model_path: str | Path | None = None) -> Path:
    """Return a path to the .task model, downloading it on first use."""
    path = Path(model_path) if model_path else default_model_dir() / MODEL_FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.stat().st_size > 0:
        return path

    print(f"Downloading Hand Landmarker model to {path} ...")
    urllib.request.urlretrieve(MODEL_URL, path)
    return path
