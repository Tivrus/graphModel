"""MediaPipe Hand Landmarker wrapper for real-time finger tracking."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from finger_remote_controller.actions import (
    ActionRecognizer,
    compute_finger_state,
    compute_palm_center,
)
from finger_remote_controller.model import ensure_model
from finger_remote_controller.types import (
    FrameResult,
    Hand,
    Handedness,
    landmarks_from_mp,
)


class HandTracker:
    """Tracks hands and recognizes actions from BGR/RGB camera frames.

    Example::

        with HandTracker() as tracker:
            result = tracker.process(frame_bgr, timestamp_ms=0)
            print(result.primary_action)
    """

    def __init__(
        self,
        model_path: str | Path | None = None,
        *,
        num_hands: int = 2,
        min_hand_detection_confidence: float = 0.5,
        min_hand_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        recognize_actions: bool = True,
    ) -> None:
        self._model_path = ensure_model(model_path)
        self._recognize_actions = recognize_actions
        self._action_recognizer = ActionRecognizer() if recognize_actions else None
        self._landmarker: Any | None = None
        self._num_hands = num_hands
        self._min_hand_detection_confidence = min_hand_detection_confidence
        self._min_hand_presence_confidence = min_hand_presence_confidence
        self._min_tracking_confidence = min_tracking_confidence

    def open(self) -> HandTracker:
        options = vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(self._model_path)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=self._num_hands,
            min_hand_detection_confidence=self._min_hand_detection_confidence,
            min_hand_presence_confidence=self._min_hand_presence_confidence,
            min_tracking_confidence=self._min_tracking_confidence,
        )
        self._landmarker = vision.HandLandmarker.create_from_options(options)
        return self

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None
        if self._action_recognizer is not None:
            self._action_recognizer.reset()

    def __enter__(self) -> HandTracker:
        return self.open()

    def __exit__(self, *args: object) -> None:
        self.close()

    def process(
        self,
        frame: np.ndarray,
        timestamp_ms: int,
        *,
        bgr: bool = True,
    ) -> FrameResult:
        """Detect hands and actions on a single frame.

        Parameters
        ----------
        frame:
            HxWx3 uint8 image.
        timestamp_ms:
            Monotonic timestamp in milliseconds (required by VIDEO mode).
        bgr:
            True if the frame comes from OpenCV (BGR). Converted to RGB internally.
        """
        if self._landmarker is None:
            raise RuntimeError("HandTracker is not open. Use `with HandTracker() as t:`")

        rgb = frame[:, :, ::-1].copy() if bgr else frame
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        detection = self._landmarker.detect_for_video(mp_image, timestamp_ms)

        hands: list[Hand] = []
        for i, raw_landmarks in enumerate(detection.hand_landmarks):
            landmarks = landmarks_from_mp(raw_landmarks)
            handedness = Handedness.UNKNOWN
            score = 0.0
            if detection.handedness and i < len(detection.handedness):
                cats = detection.handedness[i]
                if cats:
                    handedness = (
                        Handedness.LEFT
                        if cats[0].category_name == "Left"
                        else Handedness.RIGHT
                        if cats[0].category_name == "Right"
                        else Handedness.UNKNOWN
                    )
                    score = float(cats[0].score)

            fingers = compute_finger_state(landmarks, handedness.value)
            palm = compute_palm_center(landmarks)
            hands.append(
                Hand(
                    landmarks=landmarks,
                    handedness=handedness,
                    score=score,
                    fingers=fingers,
                    palm_center=palm,
                )
            )

        actions = []
        if self._action_recognizer is not None:
            actions = self._action_recognizer.recognize(hands)

        return FrameResult(hands=hands, actions=actions, timestamp_ms=timestamp_ms)
