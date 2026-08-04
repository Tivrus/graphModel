"""Finger state and gesture/action recognition from hand landmarks."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from finger_remote_controller.landmarks import (
    FINGER_TIP_PIP,
    LandmarkIndex,
)
from finger_remote_controller.types import (
    DetectedAction,
    FingerState,
    Hand,
    Landmark,
)

# Normalized 2D distance below which thumb+index tips count as a pinch.
PINCH_THRESHOLD = 0.05
# Minimum frames a swipe delta must persist / accumulate.
SWIPE_THRESHOLD = 0.12
SWIPE_HISTORY = 8


def _is_finger_extended(landmarks: tuple[Landmark, ...], tip: int, pip: int) -> bool:
    """Finger is extended when tip is farther from wrist than PIP (in image y inverted for upright)."""
    wrist = landmarks[LandmarkIndex.WRIST]
    tip_lm = landmarks[tip]
    pip_lm = landmarks[pip]
    # Use distance from wrist: extended finger tip is farther from wrist.
    return tip_lm.distance_2d(wrist) > pip_lm.distance_2d(wrist) * 1.05


def _is_thumb_extended(landmarks: tuple[Landmark, ...]) -> bool:
    tip = landmarks[LandmarkIndex.THUMB_TIP]
    ip = landmarks[LandmarkIndex.THUMB_IP]
    mcp = landmarks[LandmarkIndex.THUMB_MCP]
    # Thumb extends sideways; tip farther from MCP than IP, and away from palm.
    tip_dist = tip.distance_2d(mcp)
    ip_dist = ip.distance_2d(mcp)
    if tip_dist <= ip_dist * 1.05:
        return False
    index_mcp = landmarks[LandmarkIndex.INDEX_MCP]
    return tip.distance_2d(index_mcp) > ip.distance_2d(index_mcp)


def compute_finger_state(landmarks: tuple[Landmark, ...], handedness: str = "") -> FingerState:
    del handedness  # reserved for left/right-specific heuristics
    flags: dict[str, bool] = {
        "thumb": _is_thumb_extended(landmarks),
    }
    for name, (tip, pip) in FINGER_TIP_PIP.items():
        flags[name] = _is_finger_extended(landmarks, tip, pip)
    return FingerState(**flags)


def compute_palm_center(landmarks: tuple[Landmark, ...]) -> Landmark:
    idxs = (
        LandmarkIndex.WRIST,
        LandmarkIndex.INDEX_MCP,
        LandmarkIndex.MIDDLE_MCP,
        LandmarkIndex.RING_MCP,
        LandmarkIndex.PINKY_MCP,
    )
    xs = [landmarks[i].x for i in idxs]
    ys = [landmarks[i].y for i in idxs]
    zs = [landmarks[i].z for i in idxs]
    n = len(idxs)
    return Landmark(x=sum(xs) / n, y=sum(ys) / n, z=sum(zs) / n)


def _pinch_distance(landmarks: tuple[Landmark, ...]) -> float:
    tip = landmarks[LandmarkIndex.THUMB_TIP]
    index = landmarks[LandmarkIndex.INDEX_TIP]
    return tip.distance_2d(index)


def recognize_static_actions(hand: Hand) -> list[DetectedAction]:
    """Map finger configuration to named actions."""
    f = hand.fingers
    actions: list[DetectedAction] = []
    pinch = _pinch_distance(hand.landmarks)

    if pinch < PINCH_THRESHOLD:
        actions.append(
            DetectedAction(
                name="pinch",
                confidence=max(0.0, 1.0 - pinch / PINCH_THRESHOLD),
                details={"distance": pinch},
            )
        )

    pattern = (f.thumb, f.index, f.middle, f.ring, f.pinky)

    mapping: list[tuple[tuple[bool, ...], str, float]] = [
        ((False, False, False, False, False), "fist", 0.95),
        ((True, True, True, True, True), "open_palm", 0.95),
        ((False, True, False, False, False), "point", 0.9),
        ((False, True, True, False, False), "victory", 0.9),
        ((True, False, False, False, False), "thumbs_up", 0.85),
        ((True, False, False, False, True), "rock", 0.85),
        ((True, True, False, False, True), "love", 0.85),
        ((False, True, True, True, False), "three", 0.8),
        ((False, True, True, True, True), "four", 0.8),
        ((False, True, False, False, True), "horn", 0.8),
    ]

    for expected, name, conf in mapping:
        if pattern == expected:
            actions.append(DetectedAction(name=name, confidence=conf, details={"fingers": f.as_dict()}))
            break
    else:
        # Fallback: report finger count if no exact gesture matched.
        count = f.extended_count
        if count > 0 and not actions:
            actions.append(
                DetectedAction(
                    name=f"fingers_{count}",
                    confidence=0.6,
                    details={"fingers": f.as_dict()},
                )
            )

    return actions


@dataclass
class ActionRecognizer:
    """Recognizes static gestures and swipe actions across frames."""

    swipe_threshold: float = SWIPE_THRESHOLD
    history_size: int = SWIPE_HISTORY
    _palm_history: deque[Landmark] = field(default_factory=lambda: deque(maxlen=SWIPE_HISTORY))

    def reset(self) -> None:
        self._palm_history.clear()

    def recognize(self, hands: list[Hand]) -> list[DetectedAction]:
        if not hands:
            self.reset()
            return []

        # Primary hand = highest detection score.
        hand = max(hands, key=lambda h: h.score)
        actions = recognize_static_actions(hand)

        self._palm_history.append(hand.palm_center)
        swipe = self._detect_swipe()
        if swipe is not None:
            actions.append(swipe)

        return actions

    def _detect_swipe(self) -> DetectedAction | None:
        if len(self._palm_history) < self.history_size:
            return None
        first = self._palm_history[0]
        last = self._palm_history[-1]
        dx = last.x - first.x
        dy = last.y - first.y

        if abs(dx) > abs(dy) and abs(dx) >= self.swipe_threshold:
            name = "swipe_right" if dx > 0 else "swipe_left"
            return DetectedAction(
                name=name,
                confidence=min(1.0, abs(dx) / self.swipe_threshold),
                details={"dx": dx, "dy": dy},
            )
        if abs(dy) > abs(dx) and abs(dy) >= self.swipe_threshold:
            name = "swipe_down" if dy > 0 else "swipe_up"
            return DetectedAction(
                name=name,
                confidence=min(1.0, abs(dy) / self.swipe_threshold),
                details={"dx": dx, "dy": dy},
            )
        return None
