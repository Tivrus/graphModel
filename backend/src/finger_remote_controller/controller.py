"""High-level API: bind gestures to system-control callbacks."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from finger_remote_controller.camera import CameraSelector, open_camera, resolve_camera
from finger_remote_controller.drawing import draw_result
from finger_remote_controller.tracker import HandTracker
from finger_remote_controller.types import DetectedAction, FrameResult

ActionHandler = Callable[[DetectedAction, FrameResult], Any]
ANY_ACTION = "*"


@dataclass
class GestureEvent:
    """Fired when a gesture passes confidence / hold / cooldown filters."""

    action: DetectedAction
    result: FrameResult
    timestamp_ms: int


@dataclass
class FingerRemote:
    """Drop-in gesture remote for controlling systems from a webcam.

    Camera choice is remembered in ``~/.finger_remote_controller/settings.json``.

    Example::

        from finger_remote_controller import FingerRemote

        remote = FingerRemote()  # uses saved camera, or opens picker

        @remote.on("fist")
        def stop_system(action, result):
            print("STOP", action.confidence)

        remote.run(show_preview=True)
        # C during preview — re-open camera picker
    """

    camera: int | None = None
    model_path: str | Path | None = None
    width: int = 1280
    height: int = 720
    mirror: bool = True
    min_confidence: float = 0.7
    hold_frames: int = 3
    cooldown_ms: int = 600
    num_hands: int = 1
    prefer_saved_camera: bool = True
    save_camera_choice: bool = True
    settings_path: Path | None = None

    _handlers: dict[str, list[ActionHandler]] = field(default_factory=dict, init=False, repr=False)
    _running: bool = field(default=False, init=False, repr=False)
    _active_camera: int | None = field(default=None, init=False, repr=False)

    def on(self, action_name: str, handler: ActionHandler | None = None):
        """Register a handler for ``action_name`` (or ``"*"`` for all).

        Can be used as a decorator::

            @remote.on("pinch")
            def click(action, result):
                ...
        """

        def decorator(fn: ActionHandler) -> ActionHandler:
            self._handlers.setdefault(action_name, []).append(fn)
            return fn

        if handler is None:
            return decorator
        return decorator(handler)

    def off(self, action_name: str, handler: ActionHandler | None = None) -> None:
        if action_name not in self._handlers:
            return
        if handler is None:
            self._handlers.pop(action_name, None)
            return
        self._handlers[action_name] = [h for h in self._handlers[action_name] if h is not handler]

    def bind(self, mapping: dict[str, ActionHandler]) -> FingerRemote:
        """Bind many actions at once: ``{"fist": fn, "open_palm": fn2}``."""
        for name, handler in mapping.items():
            self.on(name, handler)
        return self

    def stop(self) -> None:
        self._running = False

    @property
    def active_camera(self) -> int | None:
        return self._active_camera

    def cameras(self) -> CameraSelector:
        return CameraSelector(settings_path=self.settings_path)

    def pick_camera(self, *, save: bool | None = None) -> int:
        """Open interactive camera picker and remember the choice."""
        should_save = self.save_camera_choice if save is None else save
        index = resolve_camera(
            force_pick=True,
            save=should_save,
            settings_path=self.settings_path,
        )
        self.camera = index
        self._active_camera = index
        return index

    def process_frame(self, frame: np.ndarray, timestamp_ms: int, tracker: HandTracker) -> FrameResult:
        """Low-level: process one frame."""
        return tracker.process(frame, timestamp_ms=timestamp_ms)

    def run(
        self,
        *,
        show_preview: bool = False,
        window_name: str = "Finger Remote Controller",
        pick_if_needed: bool = True,
        force_pick_camera: bool = False,
    ) -> None:
        """Open camera, track gestures, call bound handlers. Blocks until stop/Q/Esc.

        Preview keys:
          Q / Esc — quit
          C       — change camera (picker) and continue
        """
        camera_index = self._resolve_camera(
            pick_if_needed=pick_if_needed,
            force_pick=force_pick_camera,
        )
        cap = open_camera(camera_index, width=self.width, height=self.height)
        self._active_camera = camera_index
        self._running = True
        start = time.perf_counter()

        hold_name: str | None = None
        hold_count = 0
        last_fired: dict[str, int] = {}

        try:
            with HandTracker(
                model_path=self.model_path,
                num_hands=self.num_hands,
            ) as tracker:
                while self._running:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    if self.mirror:
                        frame = cv2.flip(frame, 1)

                    timestamp_ms = int((time.perf_counter() - start) * 1000)
                    result = tracker.process(frame, timestamp_ms=timestamp_ms)
                    action = self._select_action(result)

                    if action is None:
                        hold_name = None
                        hold_count = 0
                    elif action.name == hold_name:
                        hold_count += 1
                    else:
                        hold_name = action.name
                        hold_count = 1

                    if (
                        action is not None
                        and hold_count >= self.hold_frames
                        and self._cooldown_ok(action.name, timestamp_ms, last_fired)
                    ):
                        last_fired[action.name] = timestamp_ms
                        self._dispatch(action, result)
                        hold_count = 0

                    if show_preview:
                        annotated = draw_result(frame, result)
                        label = f"cam {self._active_camera}  |  C change camera"
                        cv2.putText(
                            annotated,
                            label,
                            (16, annotated.shape[0] - 16),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.55,
                            (220, 220, 220),
                            1,
                            cv2.LINE_AA,
                        )
                        cv2.imshow(window_name, annotated)
                        key = cv2.waitKey(1) & 0xFF
                        if key in (27, ord("q"), ord("Q")):
                            break
                        if key in (ord("c"), ord("C")):
                            cap.release()
                            camera_index = self.pick_camera()
                            cap = open_camera(camera_index, width=self.width, height=self.height)
                            hold_name = None
                            hold_count = 0
        finally:
            self._running = False
            cap.release()
            if show_preview:
                cv2.destroyWindow(window_name)

    def _resolve_camera(self, *, pick_if_needed: bool, force_pick: bool = False) -> int:
        index = resolve_camera(
            self.camera,
            prefer_saved=self.prefer_saved_camera,
            pick_if_needed=pick_if_needed,
            force_pick=force_pick,
            save=self.save_camera_choice,
            settings_path=self.settings_path,
        )
        self.camera = index
        return index

    def _select_action(self, result: FrameResult) -> DetectedAction | None:
        action = result.primary_action
        if action is None:
            return None
        if action.confidence < self.min_confidence:
            return None
        return action

    def _cooldown_ok(self, name: str, now_ms: int, last_fired: dict[str, int]) -> bool:
        prev = last_fired.get(name)
        if prev is None:
            return True
        return (now_ms - prev) >= self.cooldown_ms

    def _dispatch(self, action: DetectedAction, result: FrameResult) -> None:
        handlers = list(self._handlers.get(action.name, []))
        handlers.extend(self._handlers.get(ANY_ACTION, []))
        for handler in handlers:
            handler(action, result)
