"""OSM to OSM outside nodes.

Queries overpass API and converts the OSM XML file
into a JSON that contains all nodes that are outside.
"""

import json
import os
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import Element

# requires python <= 3.12
import requests
from defusedxml import ElementTree
from geopy import distance

from logger import get_app_logger

logger = get_app_logger()
OUTPUT_FILE = Path(os.environ.get("CMUMAPS_OSM_OUTSIDE_FILE", "osm-outside.json"))
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "CMUMaps-dataflow/1.0 (https://github.com/ScottyLabs/cmumaps)"

# all of the tags of ways that should not be used
excluded_tags: list[str] = [
    "building",
    "leisure",
    "barrier",
    "railway",
    "natural",
    "indoor",
    "landuse",
]
# ways that have no tags and need to be cut
# first (27591285) is the skibo gym
excluded_ways: list[str] = ["27591285"]

# holds all of the nodes
# will be converted to a JSON at the end
nodes: dict[str, Any] = {}

# stores nodes that we will need to remove later
nodes_to_pop: list[str] = []
# stores nodes that are part of ways that we want to keep
safe_nodes: list[str] = []


def main() -> None:
    """Query OSM and process results.

    Returns:
        None, but saves a file with the outside nodes in a JSON

    """
    logger.print("\nAttempting to get data from OSM...\n")

    response: str | None = query_osm(10)
    if response is None:
        return

    root: Element = ElementTree.fromstring(response)

    logger.print("Converting nodes and ways to JSON...")
    for child in root:
        # create a json node for each node in the export
        if child.tag == "node":
            create_node(child)
        # all nodes are earlier in the file than the ways
        # so treating ways like this is fine
        elif child.tag == "way":
            process_way(child)

    # only pop nodes that are in buildings that are not used otherwise
    for n in nodes_to_pop:
        if n not in safe_nodes:
            nodes.pop(n)

    logger.print(f"Saving to file {OUTPUT_FILE}...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(nodes, file, indent=4)

    logger.print(f"File saved to {OUTPUT_FILE}")


def query_osm(max_attempt_count: int) -> str | None:
    """Query OSM.

    Args:
        max_attempt_count: The number of times to try querying osm before giving up

    Returns:
        The response to the overpass query OR None if the API calls failed

    """
    counter = 0
    response = None
    while counter < max_attempt_count:
        try:
            result = requests.post(
                OVERPASS_URL,
                data={
                    "data": "[out:xml][timeout:60];"
                    "nwr(40.440278,-79.951806,40.451722,-79.933778);"
                    "out body;>;out skel qt;",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=75,
            )
            result.raise_for_status()
            response = result.text
            break
        except requests.RequestException:
            logger.print("Query failed. Trying again...")
            counter += 1

    if counter == max_attempt_count:
        logger.exception("Unable to get data from OSM. Please try again later.")
        return None
    logger.print("\nRecieved OSM Data\n")
    return response


def create_node(child: Element) -> None:
    """Create a node and add it to the nodes list.

    Args:
        child: the node being added

    """
    node_attributes: dict[str, str] = child.attrib
    current_node: dict[str, Any] = {
        "neighbors": {},
        "coordinate": {
            "latitude": float(node_attributes["lat"]),
            "longitude": float(node_attributes["lon"]),
        },
        "id": node_attributes["id"],
        "tags": {},
        "way_tags": {},
    }
    # adds all nodes, including ones that define bounds of buildings/parks
    # these should be removed
    nodes[node_attributes["id"]] = current_node
    for tag in child:
        current_node["tags"][tag.attrib["k"]] = tag.attrib["v"]


def process_way(child: Element) -> None:
    """Create a node and add it to the nodes list.

    Args:
        child: the node being added

    """
    way: Element = child
    way_tags: list[Element] = way.findall("tag")
    exclude: bool = is_excluded(way)
    way_nodes: list[Element] = way.findall("nd")
    for i in range(len(way_nodes)):
        current_node = nodes.get(way_nodes[i].attrib["ref"], False)

        if current_node:
            for tag in way_tags:
                current_node["way_tags"][tag.attrib["k"]] = tag.attrib["v"]
            if not exclude:
                add_neighbors_from_way(way_nodes, i)
            elif exclude and current_node["tags"].get("entrance", False):
                safe_nodes.append(way_nodes[i].attrib["ref"])
                for tag in way_tags:
                    if tag.attrib["k"] == "name":
                        current_node["entrance"] = tag.attrib["v"]
            elif exclude:
                # add nodes that should be popped if unused to list
                node: str = way_nodes[i].attrib["ref"]
                if node not in nodes_to_pop:
                    nodes_to_pop.append(node)


def add_neighbors_from_way(way_nodes: list[Element], i: int) -> None:
    """Add nodes in a way as neighbors.

    Args:
        way_nodes: the nodes in the current way.
        i: index of the current node.

    """
    current_node = nodes.get(way_nodes[i].attrib["ref"], False)

    safe_nodes.append(way_nodes[i].attrib["ref"])
    if i > 0:
        compare_node = nodes.get(
            way_nodes[i - 1].attrib["ref"],
            False,
        )
        if compare_node:
            dist = distance.distance(
                (
                    compare_node["coordinate"]["latitude"],
                    compare_node["coordinate"]["longitude"],
                ),
                (
                    current_node["coordinate"]["latitude"],
                    current_node["coordinate"]["longitude"],
                ),
            )
            # distance is stored in meters
            current_node["neighbors"][compare_node["id"]] = {
                "dist": dist.m,
            }
    if i < len(way_nodes) - 1:
        compare_node = nodes.get(
            way_nodes[i + 1].attrib["ref"],
            False,
        )
        if compare_node:
            dist = distance.distance(
                (
                    compare_node["coordinate"]["latitude"],
                    compare_node["coordinate"]["longitude"],
                ),
                (
                    current_node["coordinate"]["latitude"],
                    current_node["coordinate"]["longitude"],
                ),
            )
            # distance is stored in meters
            current_node["neighbors"][compare_node["id"]] = {
                "dist": dist.m,
            }


def is_excluded(way: Element) -> bool:
    """Check whether a way should be excluded.

    Args:
        way: the way to be checked.

    """
    # if specifically an excluded way
    if way.attrib["id"] in excluded_ways:
        way_nodes = way.findall("nd")
        for i in range(len(way_nodes)):
            node = way_nodes[i].attrib["ref"]
            if node not in nodes_to_pop:
                nodes_to_pop.append(node)
        return True
    way_tags: list[Element] = way.findall("tag")
    for tag in way_tags:
        if tag.attrib["k"] in excluded_tags:
            return True
        # special case to remove the relation for CMU
        if (
            tag.attrib["k"] == "name"
            and tag.attrib["v"] == "Carnegie Mellon University"
        ):
            return True
        if tag.attrib["k"] == "foot" and tag.attrib["v"] == "no":
            return True
    return False


if __name__ == "__main__":
    main()
