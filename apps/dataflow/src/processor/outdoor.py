"""Generate outdoor links only from explicit OSM way-node relationships."""

from __future__ import annotations

import math
from itertools import pairwise
from typing import TYPE_CHECKING

from models._common import Floor, GeoCoordinate
from models.graph import GraphNode, NeighborConnection

if TYPE_CHECKING:
    from processor.working import OutdoorData

EARTH_RADIUS_METRES = 6371008.8


def _distance(a: GeoCoordinate, b: GeoCoordinate) -> float:
    lat_a, lat_b = math.radians(a.latitude), math.radians(b.latitude)
    value = (
        math.sin((lat_b - lat_a) / 2) ** 2
        + math.cos(lat_a)
        * math.cos(lat_b)
        * math.sin(math.radians(b.longitude - a.longitude) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METRES * math.asin(min(1.0, math.sqrt(value)))


def outdoor_graph(source: OutdoorData) -> tuple[dict[str, GraphNode], list[str]]:
    """Preserve source crossings and pedestrian direction without snapping."""
    graph: dict[str, GraphNode] = {}
    warnings = []
    for way in source.ways:
        if way.tags.get("area") == "yes":
            warnings.append(
                f"OSM way/{way.id}: pedestrian area needs a walkable-area graph; "
                "its perimeter is not a path",
            )
            continue
        identifiers = [f"osm-node-{node}" for node in way.nodes]
        for node, identity in zip(way.nodes, identifiers, strict=True):
            point = source.nodes[node]
            graph.setdefault(
                identity,
                GraphNode(
                    id=identity,
                    floor=Floor(buildingCode="outside", level="1"),
                    coordinate=GeoCoordinate(**point.model_dump()),
                    neighbors={},
                ),
            )
        for first, second in pairwise(identifiers):
            if first == second:
                continue
            distance = _distance(graph[first].coordinate, graph[second].coordinate)
            connection = NeighborConnection(dist=distance)
            if way.tags.get("oneway:foot") != "-1":
                graph[first].neighbors[second] = connection
            if way.tags.get("oneway:foot") not in {"yes", "1", "true"}:
                graph[second].neighbors[first] = connection
    return graph, warnings
