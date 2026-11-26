"""Orchestrate the full ESIM building data pipeline.

This script runs all pipeline stages in sequence to generate complete
building data for CMU Maps from ArcGIS and OpenStreetMap sources.

Pipeline stages:
    1. arc_gis_query.py: Fetch building metadata from ArcGIS
    2. fetch_osm_data.py: Fetch OSM data from Overpass API into export.osm
    3. generate_building_info_map.py: Create building code-to-info mapping
    4. osm_building_to_json.py: Parse OSM geometries into buildings.json
    5. sign_abbrev_mapping.py: Create sign abbreviation to ID mapping
    6. add_fms_id.py: Enrich buildings with FMS identifiers

Input:
    - buildings.json: Existing building data with osmId mappings

Output:
    - export.osm: OpenStreetMap XML export
    - building_info_map.json: Simplified code-to-info mapping
    - query.json: Raw ArcGIS building data
    - sign_abbrev_mapping.json: Sign abbreviation to FMS ID mapping
    - buildings.json: Final building data with geometries and FMS IDs
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from logger import get_app_logger

logger = get_app_logger()


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Run the building pipeline from ArcGIS/OSM to buildings.json",
    )
    script_dir = Path(__file__).parent
    parser.add_argument("--osm-file", type=Path, default=script_dir / "export.osm")
    parser.add_argument(
        "--downloaded-buildings",
        type=Path,
        default=script_dir / "buildings.json",
    )
    parser.add_argument("--output", type=Path, default=script_dir / "buildings.json")
    parser.add_argument(
        "--skip-arcgis",
        action="store_true",
        help="Skip ArcGIS fetch (use existing query.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Write parsed buildings to a temp file and skip FMS ID writes",
    )
    return parser.parse_args()


def _run(cmd: list[str], env: dict[str, str] | None = None) -> None:
    """Run a subprocess command."""
    subprocess.run(cmd, check=True, env=env)  # noqa: S603


def main() -> None:
    """Run the building pipeline."""
    args = parse_args()
    python = sys.executable
    script_dir = Path(__file__).parent

    # Resolve all paths to absolute
    osm_file = Path(args.osm_file).resolve()
    downloaded_buildings = Path(args.downloaded_buildings).resolve()
    output_file = Path(args.output).resolve()

    # Intermediate files stored in output directory
    work_dir = output_file.parent
    work_dir.mkdir(parents=True, exist_ok=True)
    query_json = (work_dir / "query.json").resolve()
    sign_mapping_json = (work_dir / "sign_abbrev_mapping.json").resolve()

    # Step 1: Fetch from ArcGIS
    if not args.skip_arcgis:
        _run(
            [python, str(script_dir / "arc_gis_query.py"), "--output", str(query_json)],
        )
    elif not query_json.is_file():
        logger.error(
            "--skip-arcgis requires %s to exist, but the file was not found.",
            query_json,
        )
        sys.exit(1)

    # In dry-run mode, write parsed buildings to a temp file so we never overwrite the real output.
    if args.dry_run:
        tmp_fd, tmp_path = tempfile.mkstemp(
            dir=work_dir,
            suffix=".json",
            prefix="buildings_dry_",
        )
        os.close(tmp_fd)
        parsed_output = Path(tmp_path)
    else:
        parsed_output = output_file

    try:
        # Step 2: Fetch OSM data
        env = os.environ.copy()
        env["CMUMAPS_OSM_FILE"] = str(osm_file)
        _run([python, str(script_dir / "fetch_osm_data.py")], env=env)

        # Step 3: Generate building info map
        env_map = os.environ.copy()
        env_map["CMUMAPS_DOWNLOADED_BUILDINGS_JSON"] = str(downloaded_buildings)
        env_map["CMUMAPS_BUILDING_MAPPING_OUTPUT"] = str(
            work_dir / "building_info_map.json",
        )
        _run([python, str(script_dir / "generate_building_info_map.py")], env=env_map)

        # Step 4: Parse OSM buildings
        env_parse = os.environ.copy()
        env_parse["CMUMAPS_OSM_FILE"] = str(osm_file)
        env_parse["CMUMAPS_DOWNLOADED_BUILDINGS_JSON"] = str(downloaded_buildings)
        env_parse["CMUMAPS_PARSED_BUILDINGS_OUTPUT"] = str(parsed_output)
        _run([python, str(script_dir / "osm_building_to_json.py")], env=env_parse)

        # Step 5: Build sign mapping
        _run(
            [
                python,
                str(script_dir / "sign_abbrev_mapping.py"),
                "--query",
                str(query_json),
                "--output",
                str(sign_mapping_json),
            ],
        )

        # Step 6: Add FMS IDs
        cmd = [
            python,
            str(script_dir / "add_fms_id.py"),
            "--buildings",
            str(parsed_output),
            "--mapping",
            str(sign_mapping_json),
        ]
        if args.dry_run:
            cmd.append("--dry-run")
        _run(cmd)
    finally:
        if args.dry_run:
            parsed_output.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
