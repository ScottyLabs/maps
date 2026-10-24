"""Read the app API to verify that an activated candidate reaches its consumers."""

from __future__ import annotations

import json
import logging
import math
from typing import TYPE_CHECKING
from urllib.parse import quote

from deserializer.bundle import serialize_candidate
from logger import get_app_logger
from scraper.fms.capture import SourceError

if TYPE_CHECKING:
    from pathlib import Path

    from clients._api_client import ApiClient


def _require(condition: bool, message: str) -> None:  # noqa: FBT001
    if not condition:
        raise SourceError(message)


def verify_preview(workspace: Path, revision: str, client: ApiClient) -> dict[str, int]:
    """Compare generated records with the app's real floor, graph and POI APIs."""
    logger = get_app_logger()
    previous_level = logger.level
    logger.setLevel(logging.ERROR)
    try:
        payload = serialize_candidate(workspace, revision)
    finally:
        logger.setLevel(previous_level)
    selected = client.read_preview("/preview", revision)
    _require(
        bool(selected)
        and selected["revision"] == revision
        and selected["workspace"] == workspace.name,
        "The requested workspace/revision is not the active app preview",
    )
    buildings = client.read_preview("/buildings", revision)
    _require(
        set(buildings) == {row["buildingCode"] for row in payload.tables["Building"]},
        "App building coverage differs from the candidate",
    )
    counts = {"floors": 0, "rooms": 0, "nodes": 0, "edges": 0, "pois": 0}
    floors = [
        (row["buildingCode"], row["floorLevel"]) for row in payload.tables["Floor"]
    ]
    for building, level in [*floors, (None, None)]:
        floor_code = f"{building}-{level}" if building is not None else "outside"
        base = f"/floors/{quote(floor_code, safe='')}"
        if building is not None:
            expected = {
                row["roomId"]: row
                for row in payload.tables["Room"]
                if row["buildingCode"] == building and row["floorLevel"] == level
            }
            rooms = client.read_preview(base + "/floorplan", revision)
            actual = {room["id"]: room for room in rooms.values()}
            _require(
                set(actual) == set(expected),
                f"{floor_code}: room geometry was dropped",
            )
            for identity, row in expected.items():
                _require(
                    _same_polygon(
                        actual[identity]["points"], json.loads(row["polygon"]),
                    )
                    and actual[identity]["name"] == row["name"],
                    f"{floor_code}/{identity}: app polygon/label "
                    "differs from generated JSON",
                )
            counts["rooms"] += len(actual)
            counts["floors"] += 1
        expected_nodes = {
            row["nodeId"]
            for row in payload.tables["Node"]
            if row["buildingCode"] == building and row["floorLevel"] == level
        }
        nodes = client.read_preview(base + "/geonodes", revision)
        _require(set(nodes) == expected_nodes, f"{floor_code}: graph nodes differ")
        expected_edges = {
            (row["inNodeId"], row["outNodeId"])
            for row in payload.tables["Edge"]
            if row["inNodeId"] in expected_nodes
        }
        actual_edges = {
            (key, neighbor)
            for key, node in nodes.items()
            for neighbor in node["neighbors"]
        }
        _require(actual_edges == expected_edges, f"{floor_code}: graph links differ")
        expected_pois = {
            row["poiId"]: row
            for row in payload.tables["Poi"]
            if row.get("buildingCode") == building and row.get("floorLevel") == level
        }
        pois = client.read_preview(base + "/pois", revision)
        _require(set(pois) == set(expected_pois), f"{floor_code}: POIs were dropped")
        for identity, row in expected_pois.items():
            _require(
                pois[identity]["type"] == row["type"]
                and all(
                    math.isclose(
                        pois[identity][key], row[key], rel_tol=0, abs_tol=1e-10,
                    )
                    for key in ("latitude", "longitude")
                ),
                f"{floor_code}/{identity}: POI location/type differs",
            )
        counts["nodes"] += len(nodes)
        counts["edges"] += len(actual_edges)
        counts["pois"] += len(pois)
    return counts


def _same_polygon(
    actual: list[list[dict[str, float]]],
    expected: list[list[dict[str, float]]],
) -> bool:
    # JSON/JSONB round trips can differ by one floating-point ULP (~1e-14 degrees).
    return len(actual) == len(expected) and all(
        len(first) == len(second)
        and all(
            math.isclose(a[key], b[key], rel_tol=0, abs_tol=1e-10)
            for a, b in zip(first, second, strict=False)
            for key in ("latitude", "longitude")
        )
        for first, second in zip(actual, expected, strict=True)
    )
