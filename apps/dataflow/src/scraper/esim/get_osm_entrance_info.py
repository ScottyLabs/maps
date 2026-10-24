"""Extract OSM entrance coordinates for each building.

Reads buildings.json for building codes and their entrance node IDs,
fetches OSM data via the Overpass API, then looks up each entrance
node's lat/lon from the fetched data.

Inputs:
    - buildings.json: Building data with entrance node IDs per building

Output:
    - osm_entrances.json: Mapping from building code (e.g. "WEH", "NSH")
      to an array of entrance objects, each with osmNodeId, latitude,
      and longitude. Buildings with no entrances have an empty array.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import defusedxml.ElementTree as ET  # noqa: N817

from logger import get_app_logger
from scraper.esim.fetch_osm_data import fetch_osm_data

logger = get_app_logger()

# Input
BUILDINGS_JSON = os.environ.get(
    "CMUMAPS_DOWNLOADED_BUILDINGS_JSON",
    "buildings.json",
)
OSM_FILE = os.environ.get("CMUMAPS_OSM_FILE", "export.osm")

# Output
ENTRANCE_OUTPUT_JSON = os.environ.get(
    "CMUMAPS_ENTRANCE_OUTPUT",
    "osm_entrances.json",
)


def _parse_osm_nodes(osm_file: str) -> dict[str, tuple[float, float]]:
    """Parse OSM XML and return a mapping of node ID to (lat, lon)."""
    tree = ET.parse(osm_file)
    root = tree.getroot()

    if root is None:
        msg = f"Empty XML document in {osm_file}"
        raise ValueError(msg)

    nodes: dict[str, tuple[float, float]] = {}
    for node in root.findall("node"):
        nid = node.attrib.get("id")
        if nid and "lat" in node.attrib and "lon" in node.attrib:
            nodes[nid] = (float(node.attrib["lat"]), float(node.attrib["lon"]))

    return nodes


def main() -> None:
    """Build a mapping from building code to entrance info using buildings.json."""
    # Read buildings.json
    buildings_path = Path(BUILDINGS_JSON)
    if not buildings_path.is_file():
        logger.error("Buildings file not found: %s", buildings_path)
        sys.exit(1)

    with buildings_path.open(encoding="utf-8") as f:
        buildings = json.load(f)

    # Fetch OSM data if not already present
    osm_path = Path(OSM_FILE)
    if not osm_path.is_file():
        logger.info("OSM file not found, fetching from Overpass API...")
        fetch_osm_data(osm_path)

    osm_nodes = _parse_osm_nodes(str(osm_path))

    # Build entrance mapping from buildings.json
    entrance_map: dict[str, list[dict[str, object]]] = {}
    for code, data in buildings.items():
        entrance_ids = data.get("entrances", [])
        entrances: list[dict[str, object]] = []

        for node_id in entrance_ids:
            node_id_str = str(node_id)
            if node_id_str in osm_nodes:
                lat, lon = osm_nodes[node_id_str]
                entrances.append(
                    {
                        "osmNodeId": node_id_str,
                        "latitude": lat,
                        "longitude": lon,
                    }
                )
            else:
                logger.warning(
                    "Entrance node %s for building %s not found in OSM data",
                    node_id_str,
                    code,
                )

        entrance_map[code] = entrances

    # Write output
    output_path = Path(ENTRANCE_OUTPUT_JSON)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(entrance_map, f, indent=2)

    logger.info(
        "Wrote entrance info for %d buildings to %s",
        len(entrance_map),
        output_path,
    )


if __name__ == "__main__":
    main()
