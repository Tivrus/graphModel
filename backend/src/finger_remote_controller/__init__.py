"""Finger tracking and system control via MediaPipe Hands.

Drop this folder into ``venv/Lib/site-packages/`` of any project.
See README.md inside this package for usage.
"""

from finger_remote_controller.actions import ActionRecognizer, recognize_static_actions
from finger_remote_controller.camera import (
    CameraInfo,
    CameraSelector,
    list_cameras,
    open_camera,
    pick_camera_interactive,
    print_cameras,
    resolve_camera,
)
from finger_remote_controller.controller import FingerRemote, GestureEvent
from finger_remote_controller.landmarks import LandmarkIndex
from finger_remote_controller.settings import (
    clear_saved_camera,
    get_saved_camera,
    load_settings,
    save_camera,
    save_settings,
)
from finger_remote_controller.tracker import HandTracker
from finger_remote_controller.types import (
    DetectedAction,
    FingerState,
    FrameResult,
    Hand,
    Handedness,
    Landmark,
)

__version__ = "0.3.0"

__all__ = [
    "ActionRecognizer",
    "CameraInfo",
    "CameraSelector",
    "DetectedAction",
    "FingerRemote",
    "FingerState",
    "FrameResult",
    "GestureEvent",
    "Hand",
    "HandTracker",
    "Handedness",
    "Landmark",
    "LandmarkIndex",
    "clear_saved_camera",
    "get_saved_camera",
    "list_cameras",
    "load_settings",
    "open_camera",
    "pick_camera_interactive",
    "print_cameras",
    "recognize_static_actions",
    "resolve_camera",
    "save_camera",
    "save_settings",
    "__version__",
]
