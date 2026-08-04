"""Draw hand landmarks and action labels on frames."""

from __future__ import annotations

import cv2
import numpy as np

from finger_remote_controller.landmarks import HAND_CONNECTIONS
from finger_remote_controller.types import FrameResult, Hand


def draw_hand(frame: np.ndarray, hand: Hand) -> None:
    h, w = frame.shape[:2]
    points = [(int(lm.x * w), int(lm.y * h)) for lm in hand.landmarks]

    for a, b in HAND_CONNECTIONS:
        cv2.line(frame, points[a], points[b], (80, 200, 120), 2, cv2.LINE_AA)

    for x, y in points:
        cv2.circle(frame, (x, y), 4, (40, 140, 255), -1, cv2.LINE_AA)

    label = f"{hand.handedness.value} ({hand.score:.2f})"
    wx, wy = points[0]
    cv2.putText(
        frame,
        label,
        (wx - 20, wy + 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (240, 240, 240),
        2,
        cv2.LINE_AA,
    )


def draw_result(frame: np.ndarray, result: FrameResult) -> np.ndarray:
    """Return a copy of ``frame`` with landmarks and action overlay."""
    out = frame.copy()
    for hand in result.hands:
        draw_hand(out, hand)

    action = result.primary_action
    if action is not None:
        text = f"{action.name}  {action.confidence:.2f}"
        cv2.rectangle(out, (8, 8), (8 + 12 * len(text), 42), (20, 20, 20), -1)
        cv2.putText(
            out,
            text,
            (16, 34),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (60, 220, 255),
            2,
            cv2.LINE_AA,
        )
    return out
