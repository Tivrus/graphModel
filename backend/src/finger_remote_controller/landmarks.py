"""MediaPipe hand landmark indices (21 points per hand)."""

from __future__ import annotations

from enum import IntEnum


class LandmarkIndex(IntEnum):
    WRIST = 0

    THUMB_CMC = 1
    THUMB_MCP = 2
    THUMB_IP = 3
    THUMB_TIP = 4

    INDEX_MCP = 5
    INDEX_PIP = 6
    INDEX_DIP = 7
    INDEX_TIP = 8

    MIDDLE_MCP = 9
    MIDDLE_PIP = 10
    MIDDLE_DIP = 11
    MIDDLE_TIP = 12

    RING_MCP = 13
    RING_PIP = 14
    RING_DIP = 15
    RING_TIP = 16

    PINKY_MCP = 17
    PINKY_PIP = 18
    PINKY_DIP = 19
    PINKY_TIP = 20


# Tip / PIP pairs used to decide whether a finger is extended.
FINGER_TIP_PIP: dict[str, tuple[LandmarkIndex, LandmarkIndex]] = {
    "index": (LandmarkIndex.INDEX_TIP, LandmarkIndex.INDEX_PIP),
    "middle": (LandmarkIndex.MIDDLE_TIP, LandmarkIndex.MIDDLE_PIP),
    "ring": (LandmarkIndex.RING_TIP, LandmarkIndex.RING_PIP),
    "pinky": (LandmarkIndex.PINKY_TIP, LandmarkIndex.PINKY_PIP),
}

FINGER_NAMES = ("thumb", "index", "middle", "ring", "pinky")

# Connections for drawing the hand skeleton.
HAND_CONNECTIONS: tuple[tuple[int, int], ...] = (
    (0, 1),
    (1, 2),
    (2, 3),
    (3, 4),
    (0, 5),
    (5, 6),
    (6, 7),
    (7, 8),
    (5, 9),
    (9, 10),
    (10, 11),
    (11, 12),
    (9, 13),
    (13, 14),
    (14, 15),
    (15, 16),
    (13, 17),
    (0, 17),
    (17, 18),
    (18, 19),
    (19, 20),
)
