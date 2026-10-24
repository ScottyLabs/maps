# ruff: noqa: T201
"""Run offline stages of the shared fresh-source pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import requests

from clients import get_api_client_singleton
from deserializer.main import configure_local
from processor.bridge import main as bridge_main
from processor.generate import build_workspace
from processor.verify import verify_preview
from processor.workspace import normalize_workspace
from scraper.outdoor import fetch_outdoor
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
    outdoor = stages.add_parser("outdoor", help="Capture public outdoor paths and POIs")
    outdoor.add_argument("--workspace", type=Path, required=True)
    outdoor.add_argument("--refresh-source", action="store_true")
    build = stages.add_parser("build", help="Export one saved working revision")
    build.add_argument("--workspace", type=Path, required=True)
    load = stages.add_parser("load", help="Stage and activate a native app preview")
    load.add_argument("--workspace", type=Path, required=True)
    load.add_argument("--revision", required=True)
    verify = stages.add_parser(
        "verify", help="Check candidate coverage through the app API",
    )
    verify.add_argument("--workspace", type=Path, required=True)
    verify.add_argument("--revision", required=True)
    stages.add_parser("baseline", help="Return to the preserved shared-source import")
    stages.add_parser("bridge", help="Local API JSON transport")
    args = parser.parse_args()
    if args.stage == "bridge":
        return bridge_main()
    try:
        if args.stage == "verify":
            configure_local()
            counts = verify_preview(
                args.workspace, args.revision, get_api_client_singleton(),
            )
            print(
                "App API matches generated candidate: "
                + ", ".join(f"{count} {name}" for name, count in counts.items()),
            )
            return 0
        if args.stage in {"load", "baseline"}:
            configure_local()
            client = get_api_client_singleton()
            selected = (
                client.restore_baseline()
                if args.stage == "baseline"
                else client.load_preview(args.workspace.name, args.revision)
            )
            print(selected["appUrl"])
            return 0
        if args.stage == "build":
            report = build_workspace(args.workspace)
            print(report.model_dump_json(indent=2))
            return 0
        if args.stage in {"public", "outdoor"}:
            with requests.Session() as session:
                fetch = fetch_buildings if args.stage == "public" else fetch_outdoor
                working = fetch(
                    args.workspace,
                    session,
                    refresh=args.refresh_source,
                )
        else:
            working = normalize_workspace(args.workspace, replace=args.replace_working)
    except (OSError, ValueError, RuntimeError, requests.RequestException) as error:
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
