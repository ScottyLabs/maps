"""Scrape OSM POIs around CMU into a JSON file.

Queries the Overpass API for nodes whose tags match the cmumaps PoiType
catalog and writes them to ``osm-pois.json`` for the deserializer to ingest.
"""

import json
from pathlib import Path
from xml.etree.ElementTree import Element

import overpass
from defusedxml import ElementTree

from logger import get_app_logger
from models import OSM_TAG_TO_POI_TYPE, Poi

# bbox covers CMU campus and the surrounding walkable area
BBOX = (40.440278, -79.951806, 40.451722, -79.933778)
OUTPUT_FILE = Path("osm-pois.json")


def main() -> None:
    """Query Overpass and write recognized POIs to a JSON file."""
    logger = get_app_logger()

    logger.print("Querying Overpass for OSM POIs around CMU...")
    response = query_osm(max_attempt_count=10)
    if response is None:
        return

    root: Element = ElementTree.fromstring(response)

    pois: dict[str, dict[str, object]] = {}
    for child in root:
        if child.tag != "node":
            continue
        poi = node_to_poi(child)
        if poi is not None:
            pois[poi.poi_id] = poi.model_dump(by_alias=True, exclude_none=True)

    logger.print(f"Found {len(pois)} matching POIs")
    with OUTPUT_FILE.open("w") as file:
        json.dump(pois, file, indent=4)
    logger.print(f"Wrote {OUTPUT_FILE}")


def query_osm(max_attempt_count: int) -> str | None:
    """Query Overpass for nodes carrying any of the recognized POI tag keys."""
    logger = get_app_logger()
    keys = sorted({key for key, _ in OSM_TAG_TO_POI_TYPE})
    bbox = ",".join(str(c) for c in BBOX)
    selectors = "".join(f'node["{k}"]({bbox});' for k in keys)
    query = f"({selectors});"

    api = overpass.API()
    counter = 0
    while counter < max_attempt_count:
        try:
            response: str = api.get(query, responseformat="xml")
        except overpass.errors.ServerLoadError:
            logger.print("Query failed. Trying again...")
            counter += 1
        else:
            return response

    logger.error("Unable to get data from OSM. Please try again later.")
    return None


def node_to_poi(node: Element) -> Poi | None:
    """Build a Poi from an OSM ``<node>`` element if its tags map to a PoiType."""
    tags = {tag.attrib["k"]: tag.attrib["v"] for tag in node.findall("tag")}
    poi_type = next(
        (
            value
            for (key, val), value in OSM_TAG_TO_POI_TYPE.items()
            if tags.get(key) == val
        ),
        None,
    )
    if poi_type is None:
        return None

    return Poi(
        poiId=f"osm-{node.attrib['id']}",
        type=poi_type,
        latitude=float(node.attrib["lat"]),
        longitude=float(node.attrib["lon"]),
    )


if __name__ == "__main__":
    main()
