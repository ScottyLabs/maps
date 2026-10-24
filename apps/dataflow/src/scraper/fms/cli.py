"""Capture fresh FMS source data after an interactive CMU login."""

import argparse
import sys
from pathlib import Path

from pydantic import ValidationError
from selenium.common.exceptions import WebDriverException

from scraper.fms.browser import authenticated_browser, discover_floors, source_session
from scraper.fms.capture import (
    CaptureManifest,
    CaptureSelection,
    SourceError,
    capture_floors,
    verified_floor,
)


def _building(value: str) -> tuple[str, str]:
    code, separator, fms_id = value.partition("=")
    if not separator or not code or not fms_id.isdigit():
        msg = "Use APP_CODE=FMS_BUILDING_ID, for example AN=116"
        raise argparse.ArgumentTypeError(msg)
    return code.upper(), fms_id


def _saved_sources(
    workspace: Path,
    buildings: dict[str, str],
    site: str,
    levels: set[str],
) -> CaptureManifest | None:
    path = workspace / "capture.json"
    if not path.exists():
        return None
    manifest = CaptureManifest.model_validate_json(path.read_bytes())
    requested = CaptureSelection(
        buildings=buildings,
        site=site,
        levels=sorted(levels) if levels else None,
    )
    if requested != manifest.selection:
        msg = "Capture selection changed; use a new workspace for a fresh selection"
        raise SourceError(msg)
    return manifest


def main() -> None:
    """Run the same capture engine for live acquisition and verified resume."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workspace",
        type=Path,
        required=True,
        help="New or resumable local workspace directory",
    )
    parser.add_argument(
        "--building",
        type=_building,
        action="append",
        required=True,
        help="APP_CODE=FMS_BUILDING_ID; repeat for multiple buildings",
    )
    parser.add_argument("--site", default="MAIN", help="FMS site code")
    parser.add_argument(
        "--floor",
        action="append",
        default=[],
        help="Capture only this floor level; repeat as needed (default: all)",
    )
    args = parser.parse_args()
    buildings = dict(args.building)
    if len(buildings) != len(args.building):
        parser.error("Each application building code must be selected only once")
    try:
        report = _run_capture(args.workspace, buildings, args.site, set(args.floor))
        for floor in report.floors:
            print(f"{floor.source.building}/{floor.source.level}: {floor.status}")  # noqa: T201
            for warning in floor.warnings:
                print(f"  {warning}")  # noqa: T201
            if floor.error:
                print(f"  {floor.error}", file=sys.stderr)  # noqa: T201
        print(f"Capture manifest: {args.workspace / 'capture.json'}")  # noqa: T201
        if not report.complete:
            sys.exit(1)
    except KeyboardInterrupt:
        parser.exit(130, "Capture interrupted; rerun the same command to resume\n")
    except (OSError, SourceError) as error:
        parser.exit(1, f"Capture failed: {error}\n")
    except ValidationError:
        parser.exit(
            1,
            "Capture metadata is invalid; inspect the workspace or use a new one\n",
        )
    except WebDriverException:
        parser.exit(
            1,
            "The FMS browser session ended unexpectedly; rerun capture to resume\n",
        )


def _run_capture(
    workspace: Path,
    buildings: dict[str, str],
    site: str,
    levels: set[str],
) -> CaptureManifest:
    saved = _saved_sources(workspace, buildings, site, levels)
    if (
        saved
        and saved.complete
        and all(verified_floor(workspace, f) for f in saved.floors)
    ):
        return saved
    sources = [f.source for f in saved.floors] if saved else None
    with authenticated_browser() as driver:
        if sources is None:
            sources = discover_floors(driver, buildings, site=site, levels=levels)
        with source_session(driver) as session:
            return capture_floors(
                workspace,
                sources,
                session,
                selection=CaptureSelection(
                    buildings=buildings,
                    site=site,
                    levels=sorted(levels) if levels else None,
                ),
            )
