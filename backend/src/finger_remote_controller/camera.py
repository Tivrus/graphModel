"""Camera discovery, interactive selection, and persistence."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from finger_remote_controller.settings import (
    clear_saved_camera,
    get_saved_camera,
    save_camera,
)


@dataclass(frozen=True, slots=True)
class CameraInfo:
    index: int
    width: int
    height: int
    backend: str

    def label(self) -> str:
        return f"#{self.index}  {self.width}x{self.height}  [{self.backend}]"


def _candidate_backends() -> list[tuple[str, int]]:
    backends: list[tuple[str, int]] = []
    # On Windows MSMF is usually more reliable than DSHOW for index capture.
    if hasattr(cv2, "CAP_MSMF"):
        backends.append(("MSMF", cv2.CAP_MSMF))
    if hasattr(cv2, "CAP_DSHOW"):
        backends.append(("DSHOW", cv2.CAP_DSHOW))
    backends.append(("ANY", cv2.CAP_ANY))
    return backends


def _open_capture(index: int) -> tuple[cv2.VideoCapture, str]:
    for name, backend in _candidate_backends():
        cap = cv2.VideoCapture(index, backend)
        if not cap.isOpened():
            cap.release()
            continue
        ok, frame = cap.read()
        if ok and frame is not None:
            return cap, name
        cap.release()
    return cv2.VideoCapture(), "NONE"


def list_cameras(max_index: int = 10) -> list[CameraInfo]:
    """Probe indices ``0..max_index-1`` and return cameras that open successfully."""
    found: list[CameraInfo] = []
    for index in range(max_index):
        cap, backend = _open_capture(index)
        if not cap.isOpened():
            continue
        ok, frame = cap.read()
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 0
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 0
        if ok and frame is not None:
            height, width = frame.shape[:2]
        found.append(CameraInfo(index=index, width=width, height=height, backend=backend))
        cap.release()
    return found


def print_cameras(cameras: list[CameraInfo] | None = None) -> list[CameraInfo]:
    cameras = cameras if cameras is not None else list_cameras()
    if not cameras:
        print("No cameras found")
        return cameras
    saved = get_saved_camera()
    print("Available cameras:")
    for cam in cameras:
        mark = "  ← saved" if saved is not None and cam.index == saved else ""
        print(f"  [{cam.index}] {cam.width}x{cam.height} ({cam.backend}){mark}")
    return cameras


def camera_available(index: int, cameras: list[CameraInfo] | None = None) -> bool:
    cameras = cameras if cameras is not None else list_cameras()
    return any(cam.index == index for cam in cameras)


def open_camera(index: int, width: int | None = None, height: int | None = None) -> cv2.VideoCapture:
    cap, _backend = _open_capture(index)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open camera {index}")
    if width is not None:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    if height is not None:
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    return cap


def _build_mosaic(tiles: list[np.ndarray]) -> np.ndarray:
    if len(tiles) == 1:
        return tiles[0]
    if len(tiles) == 2:
        return np.hstack(tiles)
    # 2-column grid for 3+ cameras
    rows: list[np.ndarray] = []
    for i in range(0, len(tiles), 2):
        pair = tiles[i : i + 2]
        if len(pair) == 1:
            pair.append(np.zeros_like(tiles[0]))
        row = np.hstack(pair)
        rows.append(row)
    width = max(r.shape[1] for r in rows)
    padded = []
    for row in rows:
        if row.shape[1] < width:
            pad = np.zeros((row.shape[0], width - row.shape[1], 3), dtype=np.uint8)
            row = np.hstack([row, pad])
        padded.append(row)
    return np.vstack(padded)


def pick_camera_interactive(
    cameras: list[CameraInfo] | None = None,
    *,
    max_index: int = 10,
    save: bool = True,
    settings_path: Path | None = None,
    highlight_saved: bool = True,
) -> int | None:
    """Show live previews of all cameras; press 0-9 to choose, Esc/Q to cancel.

    Keys:
      0-9  — select camera by index
      Enter — confirm currently highlighted (saved) camera
      S     — save currently highlighted without changing (noop if none)
      C     — clear saved camera preference
      Esc/Q — cancel
    """
    cameras = cameras if cameras is not None else list_cameras(max_index)
    if not cameras:
        print("No cameras found")
        return None

    caps: list[tuple[CameraInfo, cv2.VideoCapture]] = []
    for info in cameras:
        cap, _backend = _open_capture(info.index)
        if cap.isOpened():
            caps.append((info, cap))

    if not caps:
        print("No cameras could be opened for preview")
        return None

    saved = get_saved_camera(settings_path)
    # Cursor highlights saved camera if present, else first.
    indices = [info.index for info, _ in caps]
    cursor = indices.index(saved) if saved in indices else 0

    print("Camera picker:")
    print("  0-9     select camera index")
    print("  ←/→     move highlight")
    print("  Enter   confirm highlighted")
    print("  C       clear saved camera")
    print("  Esc / Q cancel")
    print_cameras([info for info, _ in caps])

    selected: int | None = None
    try:
        while selected is None:
            tiles: list[np.ndarray] = []
            for slot, (info, cap) in enumerate(caps):
                ok, frame = cap.read()
                if not ok or frame is None:
                    tile = np.zeros((180, 320, 3), dtype=np.uint8)
                else:
                    tile = cv2.resize(frame, (320, 180))

                is_cursor = slot == cursor
                is_saved = highlight_saved and saved is not None and info.index == saved
                border = (40, 220, 255) if is_cursor else (60, 60, 60)
                cv2.rectangle(tile, (0, 0), (319, 179), border, 3 if is_cursor else 1)

                title = f"#{info.index}  {info.width}x{info.height}"
                if is_saved:
                    title += "  [saved]"
                cv2.putText(
                    tile,
                    title,
                    (10, 28),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (40, 220, 255) if is_cursor else (230, 230, 230),
                    2,
                    cv2.LINE_AA,
                )
                hint = "ENTER to confirm" if is_cursor else "press index / arrows"
                cv2.putText(
                    tile,
                    hint,
                    (10, 170),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (200, 200, 200),
                    1,
                    cv2.LINE_AA,
                )
                tiles.append(tile)

            mosaic = _build_mosaic(tiles)
            cv2.imshow("Select camera", mosaic)
            key = cv2.waitKeyEx(30)

            if key in (27, ord("q"), ord("Q")):
                break
            if key in (13, 10):  # Enter
                selected = caps[cursor][0].index
                break
            if key in (ord("c"), ord("C")):
                clear_saved_camera(settings_path)
                saved = None
                print("Cleared saved camera")
                continue
            # Left / Right arrows (Windows waitKeyEx codes + fallbacks)
            if key in (2424832, 81, 2):  # left
                cursor = (cursor - 1) % len(caps)
                continue
            if key in (2555904, 83, 3):  # right
                cursor = (cursor + 1) % len(caps)
                continue
            if ord("0") <= (key & 0xFF) <= ord("9"):
                idx = (key & 0xFF) - ord("0")
                if idx in indices:
                    selected = idx
                    break
    finally:
        for _, cap in caps:
            cap.release()
        cv2.destroyWindow("Select camera")

    if selected is not None and save:
        info = next(i for i, _ in caps if i.index == selected)
        path = save_camera(selected, width=info.width, height=info.height, path=settings_path)
        print(f"Saved camera {selected} → {path}")

    return selected


def resolve_camera(
    camera: int | None = None,
    *,
    prefer_saved: bool = True,
    pick_if_needed: bool = True,
    force_pick: bool = False,
    save: bool = True,
    settings_path: Path | None = None,
    max_index: int = 10,
) -> int:
    """Resolve which camera to use.

    Order:
      1. ``force_pick`` → interactive picker
      2. explicit ``camera`` argument (optionally saved)
      3. previously saved camera, if still available
      4. interactive picker / single camera auto-select
    """
    cameras = list_cameras(max_index)

    if force_pick:
        if not cameras:
            raise RuntimeError("No cameras found")
        picked = pick_camera_interactive(cameras, save=save, settings_path=settings_path)
        if picked is None:
            raise RuntimeError("No camera selected")
        return picked

    if camera is not None:
        if not camera_available(camera, cameras):
            raise RuntimeError(f"Camera {camera} is not available")
        if save:
            save_camera(camera, path=settings_path)
        return camera

    if prefer_saved:
        saved = get_saved_camera(settings_path)
        if saved is not None and camera_available(saved, cameras):
            print(f"Using saved camera {saved}")
            return saved
        if saved is not None:
            print(f"Saved camera {saved} is unavailable — pick another")

    if not pick_if_needed:
        raise ValueError("camera is not set and picking is disabled")

    if not cameras:
        raise RuntimeError("No cameras found")
    if len(cameras) == 1:
        only = cameras[0].index
        if save:
            save_camera(only, width=cameras[0].width, height=cameras[0].height, path=settings_path)
        print(f"Using only available camera {only}")
        return only

    picked = pick_camera_interactive(cameras, save=save, settings_path=settings_path)
    if picked is None:
        raise RuntimeError("No camera selected")
    return picked


class CameraSelector:
    """Convenience facade for listing, picking, saving, and opening cameras."""

    def __init__(self, settings_path: Path | None = None, max_index: int = 10) -> None:
        self.settings_path = settings_path
        self.max_index = max_index

    def list(self) -> list[CameraInfo]:
        return list_cameras(self.max_index)

    def print(self) -> list[CameraInfo]:
        return print_cameras(self.list())

    @property
    def saved(self) -> int | None:
        return get_saved_camera(self.settings_path)

    def save(self, index: int, *, width: int | None = None, height: int | None = None) -> Path:
        return save_camera(index, width=width, height=height, path=self.settings_path)

    def clear(self) -> Path:
        return clear_saved_camera(self.settings_path)

    def pick(self, *, save: bool = True) -> int | None:
        return pick_camera_interactive(
            self.list(),
            save=save,
            settings_path=self.settings_path,
            max_index=self.max_index,
        )

    def resolve(
        self,
        camera: int | None = None,
        *,
        force_pick: bool = False,
        prefer_saved: bool = True,
        pick_if_needed: bool = True,
        save: bool = True,
    ) -> int:
        return resolve_camera(
            camera,
            prefer_saved=prefer_saved,
            pick_if_needed=pick_if_needed,
            force_pick=force_pick,
            save=save,
            settings_path=self.settings_path,
            max_index=self.max_index,
        )

    def open(
        self,
        camera: int | None = None,
        *,
        width: int | None = None,
        height: int | None = None,
        force_pick: bool = False,
    ) -> tuple[cv2.VideoCapture, int]:
        index = self.resolve(camera, force_pick=force_pick)
        return open_camera(index, width=width, height=height), index
