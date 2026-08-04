"""Shared data types for tracking results."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Sequence


class Handedness(str, Enum):
    LEFT = "Left"
    RIGHT = "Right"
    UNKNOWN = "Unknown"


@dataclass(frozen=True, slots=True)
class Landmark:
    """Normalized landmark: x/y in [0, 1], z relative depth."""

    x: float
    y: float
    z: float

    def distance_to(self, other: Landmark) -> float:
        dx = self.x - other.x
        dy = self.y - other.y
        dz = self.z - other.z
        return (dx * dx + dy * dy + dz * dz) ** 0.5

    def distance_2d(self, other: Landmark) -> float:
        dx = self.x - other.x
        dy = self.y - other.y
        return (dx * dx + dy * dy) ** 0.5


@dataclass(frozen=True, slots=True)
class FingerState:
    thumb: bool
    index: bool
    middle: bool
    ring: bool
    pinky: bool

    @property
    def extended_count(self) -> int:
        return sum((self.thumb, self.index, self.middle, self.ring, self.pinky))

    def as_dict(self) -> dict[str, bool]:
        return {
            "thumb": self.thumb,
            "index": self.index,
            "middle": self.middle,
            "ring": self.ring,
            "pinky": self.pinky,
        }


@dataclass(slots=True)
class Hand:
    """One detected hand with landmarks and derived state."""

    landmarks: tuple[Landmark, ...]
    handedness: Handedness
    score: float
    fingers: FingerState
    palm_center: Landmark


@dataclass(slots=True)
class DetectedAction:
    """A recognized gesture/action with confidence."""

    name: str
    confidence: float
    details: dict[str, float | int | str | bool] = field(default_factory=dict)


@dataclass(slots=True)
class FrameResult:
    """Everything detected for a single camera/video frame."""

    hands: list[Hand] = field(default_factory=list)
    actions: list[DetectedAction] = field(default_factory=list)
    timestamp_ms: int = 0

    @property
    def primary_action(self) -> DetectedAction | None:
        if not self.actions:
            return None
        return max(self.actions, key=lambda a: a.confidence)


def landmarks_from_mp(raw: Sequence[object]) -> tuple[Landmark, ...]:
    return tuple(Landmark(x=lm.x, y=lm.y, z=lm.z) for lm in raw)  # type: ignore[attr-defined]
