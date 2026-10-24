# ruff: noqa: T201
"""Run offline stages of the shared fresh-source pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from processor.workspace import normalize_workspace


def main() -> int:
    """Normalize a saved capture while protecting existing working edits."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["normalize"])
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument(
        "--replace-working",
        action="store_true",
        help="Explicitly discard working edits and re-extract the saved source",
    )
    args = parser.parse_args()
    try:
        working = normalize_workspace(args.workspace, replace=args.replace_working)
    except (OSError, ValueError) as error:
        print(f"Pipeline failed: {error}", file=sys.stderr)
        return 1
    for building, floors in working.floors.items():
        for level, floor in floors.items():
            named = sum(bool(s.name) for s in floor.spaces.values())
            print(
                f"{building}/{level}: {len(floor.spaces)} spaces, "
                f"{named} unambiguous names",
            )
            for warning in floor.warnings:
                print(f"  warning: {warning}")
    print(f"Working JSON: {args.workspace / 'working.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
