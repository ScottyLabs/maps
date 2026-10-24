"""Validate source data before clearing any database tables."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from clients import get_s3_client_singleton
from models import Poi

if TYPE_CHECKING:
    from clients.dataset import JsonSource


def validate_sources(*, skip_pois: bool, source: JsonSource | None = None) -> None:
    """Cache one validated revision and check every imported foreign key."""
    reader = source if source is not None else get_s3_client_singleton()
    buildings = reader.preload_json_file("floorplans/buildings.json")
    placements = reader.preload_json_file("floorplans/placements.json")
    floorplans = reader.preload_json_file("floorplans/floorplans.json")
    graph = reader.preload_json_file("floorplans/all-graph.json")
    floors = {(b, f) for b, fs in placements.items() if b != "outside" for f in fs}
    rooms = {
        key: room
        for b, fs in floorplans.items()
        if b != "outside"
        for rs in fs.values()
        for key, room in rs.items()
    }
    if any(b not in buildings for b, _ in floors):
        msg = "Placements reference a missing building"
        raise ValueError(msg)
    for key, room in rooms.items():
        floor = room["floor"]
        if key != room["id"] or (floor["buildingCode"], floor["level"]) not in floors:
            msg = f"Room {key} has an inconsistent ID or missing floor"
            raise ValueError(msg)
    _validate_graph(graph, floors, rooms)
    if not skip_pois:
        _validate_pois(reader.preload_json_file("floorplans/osm-pois.json"), floors)


def _validate_graph(
    graph: dict[str, Any],
    floors: set[tuple[str, str]],
    rooms: dict[str, Any],
) -> None:
    """Outside nodes have no floor FK, but all nodes/edges retain valid identities."""
    for key, node in graph.items():
        if key != node["id"]:
            msg = f"Node {key} has an inconsistent identifier"
            raise ValueError(msg)
        if any(neighbor not in graph for neighbor in node["neighbors"]):
            msg = f"Node {key} references a missing neighbor"
            raise ValueError(msg)
        floor = node["floor"]
        if floor["buildingCode"] == "outside":
            continue
        if (floor["buildingCode"], floor["level"]) not in floors:
            msg = f"Node {key} references a missing floor"
            raise ValueError(msg)
        if node.get("roomId") and node["roomId"] not in rooms:
            msg = f"Node {key} references a missing room"
            raise ValueError(msg)


def _validate_pois(pois: dict[str, Any], floors: set[tuple[str, str]]) -> None:
    """Validate references while permitting legitimate zero-result dictionaries."""
    for data in pois.values():
        poi = Poi.model_validate(data)
        if (
            poi.building_code
            and poi.floor_level
            and (
                poi.building_code,
                poi.floor_level,
            )
            not in floors
        ):
            msg = f"POI {poi.poi_id} references a missing floor"
            raise ValueError(msg)
