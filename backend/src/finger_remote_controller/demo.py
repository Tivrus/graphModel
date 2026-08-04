"""Webcam demo: finger tracking + action recognition."""

from __future__ import annotations

import argparse

from finger_remote_controller.camera import CameraSelector, print_cameras
from finger_remote_controller.controller import FingerRemote
from finger_remote_controller.settings import clear_saved_camera, get_saved_camera


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Finger tracking and action recognition (MediaPipe Hands)",
    )
    parser.add_argument(
        "--camera",
        type=int,
        default=None,
        help="Camera device index (saved after use)",
    )
    parser.add_argument(
        "--list-cameras",
        action="store_true",
        help="List available cameras and exit",
    )
    parser.add_argument(
        "--pick-camera",
        action="store_true",
        help="Force camera picker (choice is saved)",
    )
    parser.add_argument(
        "--clear-camera",
        action="store_true",
        help="Clear saved camera preference and exit",
    )
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--mirror", action="store_true", default=True)
    parser.add_argument("--no-mirror", action="store_false", dest="mirror")
    args = parser.parse_args(argv)

    selector = CameraSelector()

    if args.clear_camera:
        path = clear_saved_camera()
        print(f"Cleared saved camera ({path})")
        return 0

    if args.list_cameras:
        print_cameras(selector.list())
        saved = get_saved_camera()
        if saved is not None:
            print(f"Saved camera: {saved}")
        return 0

    remote = FingerRemote(
        camera=args.camera,
        width=args.width,
        height=args.height,
        mirror=args.mirror,
    )

    @remote.on("*")
    def _log(action, result) -> None:
        print(f"[{result.timestamp_ms:>6} ms] {action.name} ({action.confidence:.2f})")

    print("Controls: Q / Esc — quit | C — change camera")
    print(
        "Actions: fist, open_palm, point, victory, thumbs_up, pinch, "
        "rock, love, swipe_left/right/up/down, ..."
    )

    try:
        remote.run(
            show_preview=True,
            force_pick_camera=args.pick_camera,
        )
    except RuntimeError as exc:
        print(exc)
        return 1

    print(f"Last camera: {remote.active_camera}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
