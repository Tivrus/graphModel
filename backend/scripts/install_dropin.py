"""Copy this library into the active venv site-packages (drop-in install)."""

from __future__ import annotations

import argparse
import shutil
import site
import sys
from pathlib import Path

PACKAGE_NAME = "finger_remote_controller"
ROOT = Path(__file__).resolve().parents[1]
SRC_PACKAGE = ROOT / "src" / PACKAGE_NAME


def target_dir() -> Path:
    if sys.prefix != sys.base_prefix:
        for path in (Path(p) for p in site.getsitepackages()):
            if path.name == "site-packages" and path.is_dir():
                return path / PACKAGE_NAME
    return Path(site.getusersitepackages()) / PACKAGE_NAME


def ensure_model_file(package_dir: Path) -> None:
    model = package_dir / "models" / "hand_landmarker.task"
    if model.is_file() and model.stat().st_size > 0:
        return
    sys.path.insert(0, str(ROOT / "src"))
    from finger_remote_controller.model import ensure_model

    ensure_model(model)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Install finger_remote_controller as a drop-in folder")
    parser.add_argument(
        "--dest",
        type=Path,
        default=None,
        help="Destination package folder (default: active venv site-packages/finger_remote_controller)",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite existing folder")
    args = parser.parse_args(argv)

    if not SRC_PACKAGE.is_dir():
        print(f"Source package not found: {SRC_PACKAGE}")
        return 1

    ensure_model_file(SRC_PACKAGE)

    dest = args.dest if args.dest is not None else target_dir()
    if dest.exists():
        if not args.force:
            print(f"Already exists: {dest}")
            print("Use --force to overwrite")
            return 1
        shutil.rmtree(dest)

    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        SRC_PACKAGE,
        dest,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache"),
    )
    print(f"Installed drop-in library to:\n  {dest}")
    print(f'Dependencies: pip install -r "{dest / "requirements.txt"}"')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
