"""Fetch OpenStreetMap data for the CMU campus area.

Queries the Overpass API for all nodes, ways, and relations within
the CMU campus bounding box and saves the result as an OSM XML file.

Input:
    - None (queries Overpass API directly)

Output:
    - export.osm: OpenStreetMap XML export for the CMU campus area
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import requests

from logger import get_app_logger

logger = get_app_logger()

CMU_OVERPASS_QUERY = "nwr(40.440278, -79.951806, 40.451722, -79.933778);"

# Output
OSM_FILE = os.environ.get("CMUMAPS_OSM_FILE", "export.osm")

# Retry configuration
_MAX_RETRIES = 5
_INITIAL_DELAY = 2
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "CMUMaps-dataflow/1.0 (https://github.com/ScottyLabs/cmumaps)"


def fetch_osm_data(
    osm_file: Path,
    max_retries: int = _MAX_RETRIES,
    initial_delay: int = _INITIAL_DELAY,
) -> None:
    """Fetch OSM data from Overpass API with retry/backoff.

    Raises
    ------
    Exception
        If all retry attempts are exhausted.

    """
    for attempt in range(max_retries):
        try:
            response = requests.post(
                OVERPASS_URL,
                data={
                    "data": f"[out:xml][timeout:60];{CMU_OVERPASS_QUERY}"
                    "out body;>;out skel qt;",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=75,
            )
            response.raise_for_status()
            osm_xml = response.text
        except Exception:
            if attempt == max_retries - 1:
                logger.exception(
                    "Failed to fetch OSM data after %d attempts",
                    max_retries,
                )
                raise
            delay = initial_delay * (2**attempt)
            logger.warning(
                "Overpass API request failed (attempt %d/%d), retrying in %ds...",
                attempt + 1,
                max_retries,
                delay,
            )
            time.sleep(delay)
        else:
            osm_file.parent.mkdir(parents=True, exist_ok=True)
            osm_file.write_text(osm_xml, encoding="utf-8")
            return


def main() -> None:
    """Fetch OSM data and write to export.osm."""
    osm_path = Path(OSM_FILE)
    logger.info("Fetching OSM data to %s", osm_path)
    fetch_osm_data(osm_path)
    logger.info("OSM data written to %s", osm_path)


if __name__ == "__main__":
    main()
