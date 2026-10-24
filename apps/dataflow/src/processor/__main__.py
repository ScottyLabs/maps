# ruff: noqa: T201
"""Run offline stages of the shared fresh-source pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import requests

from processor.bridge import main as bridge_main
from processor.generate import build_workspace
from processor.workspace import normalize_workspace
from scraper.public import fetch_buildings


def main() -> int:
    """Run a selected stage, keeping destructive re-extraction explicit."""
    parser = argparse.ArgumentParser(description=__doc__)
    stages = parser.add_subparsers(dest="stage", required=True)
    normalize = stages.add_parser(
        "normalize",
        help="Extract saved source into working JSON",
    )
    normalize.add_argument("--workspace", type=Path, required=True)
    normalize.add_argument(
        "--replace-working",
        action="store_true",
        help="Explicitly discard working edits and re-extract the saved source",
    )
    public = stages.add_parser("public", help="Fetch public building metadata")
    public.add_argument("--workspace", type=Path, required=True)
    public.add_argument("--refresh-source", action="store_true")
    build = stages.add_parser("build", help="Export one saved working revision")
    build.add_argument("--workspace", type=Path, required=True)
    stages.add_parser("bridge", help="Local API JSON transport")
    args = parser.parse_args()
    if args.stage == "bridge":
        return bridge_main()
    try:
        if args.stage == "build":
            report = build_workspace(args.workspace)
            print(report.model_dump_json(indent=2))
            return 0
        if args.stage == "public":
            with requests.Session() as session:
                working = fetch_buildings(
                    args.workspace,
                    session,
                    refresh=args.refresh_source,
                )
        else:
            working = normalize_workspace(args.workspace, replace=args.replace_working)
    except (OSError, ValueError, requests.RequestException) as error:
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
