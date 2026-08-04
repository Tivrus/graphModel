"""Persist library settings (selected camera, etc.)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_SETTINGS: dict[str, Any] = {
    "camera_index": None,
    "camera_width": None,
    "camera_height": None,
}


def default_settings_path() -> Path:
    """User-writable config: ``~/.finger_remote_controller/settings.json``."""
    return Path.home() / ".finger_remote_controller" / "settings.json"


def load_settings(path: Path | None = None) -> dict[str, Any]:
    settings_path = path or default_settings_path()
    data = dict(DEFAULT_SETTINGS)
    if not settings_path.is_file():
        return data
    try:
        raw = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return data
    if isinstance(raw, dict):
        data.update(raw)
    return data


def save_settings(settings: dict[str, Any], path: Path | None = None) -> Path:
    settings_path = path or default_settings_path()
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    merged = dict(DEFAULT_SETTINGS)
    merged.update(settings)
    settings_path.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return settings_path


def get_saved_camera(path: Path | None = None) -> int | None:
    value = load_settings(path).get("camera_index")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def save_camera(
    index: int,
    *,
    width: int | None = None,
    height: int | None = None,
    path: Path | None = None,
) -> Path:
    settings = load_settings(path)
    settings["camera_index"] = int(index)
    if width is not None:
        settings["camera_width"] = int(width)
    if height is not None:
        settings["camera_height"] = int(height)
    return save_settings(settings, path)


def clear_saved_camera(path: Path | None = None) -> Path:
    settings = load_settings(path)
    settings["camera_index"] = None
    settings["camera_width"] = None
    settings["camera_height"] = None
    return save_settings(settings, path)
