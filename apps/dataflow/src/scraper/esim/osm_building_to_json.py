"""Parse OpenStreetMap building geometries into CMU Maps format.

Reads an OSM XML export and combines it with existing building metadata
to produce structured building records with shapes, label positions,
and entrance locations.

Input:
    - buildings.json: Existing building data with osmId and name mappings
    - export.osm: OpenStreetMap XML export (from fetch_osm_data.py)

Output:
    - buildings.json: Building records with shapes, floors, entrances
"""

from __future__ import annotations

import heapq
import json
import math
import os
import sys
import tempfile
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import ParseError

import defusedxml.ElementTree as ET  # noqa: N817

from logger import get_app_logger

logger = get_app_logger()

# Type aliases
Point = tuple[float, float]
Ring = list[Point]
BuildingInfo = dict[str, Any]

# Input
OSM_FILE = os.environ.get("CMUMAPS_OSM_FILE", "export.osm")
DOWNLOADED_BUILDINGS_JSON = os.environ.get(
    "CMUMAPS_DOWNLOADED_BUILDINGS_JSON",
    "buildings.json",
)

# Output
PARSED_DATA_OUTPUT_JSON = os.environ.get(
    "CMUMAPS_PARSED_BUILDINGS_OUTPUT",
    "buildings.json",
)

# Module-level lookup tables (populated by _load_building_data)
osm_id_to_info: dict[str, BuildingInfo] = {}
fallback_name_lookup: dict[str, BuildingInfo] = {}

# Module-level data stores (populated by _parse_osm_elements)
nodes: dict[str, Point] = {}
node_tags: dict[str, dict[str, str]] = {}
ways_by_id: dict[str, dict[str, Any]] = {}
relations: list[dict[str, Any]] = []
entrance_nodes: set[str] = set()


def _load_building_data() -> None:
    """Load and index building data from the downloaded buildings JSON."""
    try:
        with Path(DOWNLOADED_BUILDINGS_JSON).open(encoding="utf-8") as f:
            downloaded_buildings = json.load(f)

        name_match_candidates: dict[str, list[BuildingInfo]] = {}

        for code, data in downloaded_buildings.items():
            raw_osm_id = data.get("osmId")
            floors = data.get("floors")
            if raw_osm_id is not None and str(raw_osm_id).strip():
                osm_id = str(raw_osm_id)
                osm_id_to_info[osm_id] = {
                    "code": code,
                    "name": data.get("name", "Unknown"),
                    "defaultFloor": data.get("defaultFloor", "1"),
                    "floors": floors,
                }
            else:
                name_value = (data.get("name") or "").strip()
                if name_value:
                    key = name_value.lower()
                    name_match_candidates.setdefault(key, []).append(
                        {
                            "code": code,
                            "name": name_value,
                            "defaultFloor": data.get("defaultFloor", "1"),
                            "floors": floors,
                        },
                    )

        for name_key, entries in name_match_candidates.items():
            if len(entries) == 1:
                fallback_name_lookup[name_key] = entries[0]

    except FileNotFoundError:
        logger.exception("Could not find %s", DOWNLOADED_BUILDINGS_JSON)
        sys.exit(1)
    except json.JSONDecodeError:
        logger.exception("Invalid JSON in %s", DOWNLOADED_BUILDINGS_JSON)
        sys.exit(1)
    except OSError:
        logger.exception("I/O error processing %s", DOWNLOADED_BUILDINGS_JSON)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Geometry utilities
# ---------------------------------------------------------------------------


def _close_ring(pts: list[Point]) -> list[Point]:
    """Ensure a polygon ring is closed (first point equals last point)."""
    if pts and pts[0] != pts[-1]:
        return [*pts, pts[0]]
    return pts


def _polygon_area_and_centroid(ring: Ring) -> tuple[float, float, float]:
    """Compute signed area and centroid of a closed polygon ring."""
    n = len(ring)
    min_points = 4
    if n < min_points:
        xs, ys = zip(*ring, strict=True) if ring else ([], [])
        return 0, (sum(xs) / len(xs) if xs else 0), (sum(ys) / len(ys) if ys else 0)

    area = cx = cy = 0.0
    for i in range(n - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area *= 0.5

    if area == 0:
        xs, ys = zip(*ring[:-1], strict=True) if ring[:-1] else ([], [])
        return 0, (sum(xs) / len(xs) if xs else 0), (sum(ys) / len(ys) if ys else 0)
    return area, cx / (6 * area), cy / (6 * area)


def _convex_hull(points: list[Point]) -> list[Point]:
    """Compute convex hull from a set of points."""

    def cross(o: Point, a: Point, b: Point) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    pts = sorted(set(points))
    if len(pts) <= 1:
        return _close_ring(pts)

    lower: list[Point] = []
    upper: list[Point] = []
    min_hull_points = 2

    for p in pts:
        while len(lower) >= min_hull_points and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    for p in reversed(pts):
        while len(upper) >= min_hull_points and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return _close_ring(lower[:-1] + upper[:-1])


def _point_in_ring(pt: Point, ring: Ring) -> bool:
    """Check if a point is inside a polygon ring using ray casting."""
    x, y = pt
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        if (y1 > y) != (y2 > y):
            x_int = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x_int > x:
                inside = not inside
    return inside


def _point_in_multipolygon(pt: Point, rings: list[Ring]) -> bool:
    """Check if a point is inside any exterior ring."""
    return any(_point_in_ring(pt, r) for r in rings)


def _match_building_by_name(
    tags: dict[str, str],
    assigned_codes: set[str],
) -> BuildingInfo | None:
    """Return building info for entries lacking osmId by matching OSM names."""
    for key in ("name", "alt_name", "short_name", "official_name"):
        label = tags.get(key)
        if not label:
            continue
        normalized = label.strip().lower()
        if not normalized:
            continue
        info = fallback_name_lookup.get(normalized)
        if info and info["code"] not in assigned_codes:
            fallback_name_lookup.pop(normalized, None)
            return info
    return None


def _point_segment_distance(  # noqa: PLR0913, PLR0917
    x: float,
    y: float,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
) -> float:
    """Compute distance from (x, y) to segment (x1, y1)-(x2, y2)."""
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    px, py = x1 + t * dx, y1 + t * dy
    return math.hypot(x - px, y - py)


def _point_to_polygon_distance(x: float, y: float, rings: list[Ring]) -> float:
    """Return positive distance if inside polygon, negative if outside."""
    min_d = min(
        _point_segment_distance(x, y, *r[i], *r[i + 1])
        for r in rings
        for i in range(len(r) - 1)
    )
    return min_d if _point_in_multipolygon((x, y), rings) else -min_d


class _Cell:
    """Cell used in polylabel refinement."""

    __slots__ = ("d", "h", "max", "x", "y")

    def __init__(self, x: float, y: float, h: float, d: float) -> None:
        """Initialize a cell."""
        self.x = x
        self.y = y
        self.h = h
        self.d = d
        self.max = d + h * math.sqrt(2)

    def __lt__(self, other: _Cell) -> bool:
        """Compare cells by max potential distance."""
        return self.max > other.max


def _polylabel_refine(
    pq: list[tuple[float, _Cell]],
    best: _Cell,
    rings: list[Ring],
    precision: float,
) -> _Cell:
    """Refine the best cell using priority queue."""
    while pq:
        _, c = heapq.heappop(pq)
        if c.max - best.d <= precision:
            continue
        h = c.h / 2
        for dx in (-h, h):
            for dy in (-h, h):
                cx, cy = c.x + dx, c.y + dy
                nc = _Cell(cx, cy, h, _point_to_polygon_distance(cx, cy, rings))
                if nc.d > best.d:
                    best = nc
                heapq.heappush(pq, (-nc.max, nc))
    return best


def _polylabel(
    rings: list[Ring],
    precision: float = 1e-6,
) -> tuple[float, float] | None:
    """Find visual center of polygon using Mapbox polylabel algorithm."""
    pts = [p for r in rings for p in r[:-1]]
    if not pts:
        return None

    minx, maxx = min(p[0] for p in pts), max(p[0] for p in pts)
    miny, maxy = min(p[1] for p in pts), max(p[1] for p in pts)
    cell_size = min(maxx - minx, maxy - miny)

    # Handle degenerate geometry (all x or y coordinates equal)
    if cell_size <= 0:
        return ((minx + maxx) / 2, (miny + maxy) / 2)

    h = cell_size / 2
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    best = _Cell(cx, cy, 0, _point_to_polygon_distance(cx, cy, rings))

    pq: list[tuple[float, _Cell]] = []
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            cx, cy = x + h, y + h
            c = _Cell(cx, cy, h, _point_to_polygon_distance(cx, cy, rings))
            if c.d > best.d:
                best = c
            heapq.heappush(pq, (-c.max, c))
            y += cell_size
        x += cell_size

    best = _polylabel_refine(pq, best, rings, precision)
    return (best.x, best.y)


# ---------------------------------------------------------------------------
# Floor helpers
# ---------------------------------------------------------------------------


def _parse_int(tags: dict[str, str], keys: list[str]) -> int | None:
    """Parse integer from tags."""
    for k in keys:
        if k in tags:
            try:
                return int(tags[k])
            except ValueError:
                pass
    return None


def _floors_from_levels(tags: dict[str, str]) -> list[str]:
    """Generate floor labels from building:levels and underground levels."""
    above = _parse_int(tags, ["building:levels", "levels"])
    below = _parse_int(
        tags,
        ["building:levels:underground", "levels:underground", "min_level"],
    )
    if below and below < 0:
        below = abs(below)

    floors: list[str] = []
    if below:
        floors += [chr(ord("A") + i) for i in range(below - 1, -1, -1)]
    if above:
        floors += [str(i) for i in range(1, above + 1)]
    return floors


# ---------------------------------------------------------------------------
# OSM parsing and building assembly
# ---------------------------------------------------------------------------


def _shape_from_way(
    wid: str,
) -> tuple[list[dict[str, float]] | None, Ring, list[str]]:
    """Convert a way into shape dict and coordinate ring."""
    w = ways_by_id.get(wid)
    if not w:
        return None, [], []

    coords: Ring = []
    node_ids: list[str] = []
    for nid in w["nodes"]:
        if nid in nodes:
            lat, lon = nodes[nid]
            coords.append((lon, lat))
            node_ids.append(nid)

    min_coords = 3
    if len(coords) < min_coords:
        return None, [], []

    ring = _close_ring(coords)
    shape = [{"latitude": y, "longitude": x} for x, y in ring]
    return shape, ring, node_ids


def _assemble_entry(  # noqa: PLR0913, PLR0917
    osm_id: str,
    info: BuildingInfo,
    tags: dict[str, str],
    shapes: list[list[dict[str, float]]],
    rings: list[Ring],
    way_nodesets: list[set[str]],
) -> dict[str, Any]:
    """Assemble one building entry with all fields."""
    label = _polylabel(rings) or _polygon_area_and_centroid(rings[0])[1:]
    cx, cy = label
    floors_override = info.get("floors")
    floors = _floors_from_levels(tags) if floors_override is None else floors_override
    default_floor = info.get("defaultFloor", "1")

    boundary: set[str] = set().union(*way_nodesets)
    entrances = {nid for nid in boundary if nid in entrance_nodes}
    for nid in entrance_nodes - boundary:
        if nid in nodes:
            lat, lon = nodes[nid]
            if _point_in_multipolygon((lon, lat), rings):
                entrances.add(nid)

    return {
        "name": info.get("name"),
        "osmId": str(osm_id),
        "floors": floors,
        "defaultFloor": str(default_floor),
        "labelPosition": {"latitude": cy, "longitude": cx},
        "shapes": shapes,
        "code": info.get("code"),
        "entrances": [str(e) for e in sorted(entrances)],
    }


def _parse_osm_elements(osm_file: str) -> None:
    """Parse OSM XML and populate nodes, ways, relations, and entrance data."""
    try:
        tree = ET.parse(osm_file)
        root = tree.getroot()
    except ParseError:
        logger.exception("Invalid XML in %s", osm_file)
        sys.exit(1)

    if root is None:
        msg = f"Empty XML document in {osm_file}"
        raise ValueError(msg)

    for n in root.findall("node"):
        nid = n.attrib.get("id")
        if nid and "lat" in n.attrib and "lon" in n.attrib:
            nodes[nid] = (float(n.attrib["lat"]), float(n.attrib["lon"]))
        tags = {
            t.attrib["k"]: t.attrib["v"] for t in n.findall("tag") if "k" in t.attrib
        }
        if tags and nid:
            node_tags[nid] = tags

    for w in root.findall("way"):
        wid = w.attrib.get("id")
        if not wid:
            continue
        nds = [nd.attrib["ref"] for nd in w.findall("nd") if "ref" in nd.attrib]
        tags = {
            t.attrib["k"]: t.attrib["v"] for t in w.findall("tag") if "k" in t.attrib
        }
        ways_by_id[wid] = {"nodes": nds, "tags": tags}

    for r in root.findall("relation"):
        rid = r.attrib.get("id")
        if not rid:
            continue
        tags = {
            t.attrib["k"]: t.attrib["v"] for t in r.findall("tag") if "k" in t.attrib
        }
        members = [
            {
                "type": m.attrib.get("type", ""),
                "ref": m.attrib.get("ref", ""),
                "role": m.attrib.get("role", ""),
            }
            for m in r.findall("member")
        ]
        relations.append({"id": rid, "tags": tags, "members": members})

    entrance_nodes.update(
        nid for nid, t in node_tags.items() if "entrance" in t or "door" in t
    )


def _collect_from_relations(
    buildings: dict[str, dict[str, Any]],
    assigned_codes: set[str],
) -> set[str]:
    """Process relations and return the set of outer way IDs used."""
    outer_ways_used: set[str] = set()
    for rel in relations:
        osm_id = rel["id"]
        tags = rel["tags"]
        info = osm_id_to_info.get(osm_id)
        if not info:
            if "building" not in tags:
                continue
            info = _match_building_by_name(tags, assigned_codes)
            if not info:
                continue

        outer = [
            m["ref"]
            for m in rel["members"]
            if m["type"] == "way" and m.get("role") == "outer"
        ]
        if not outer:
            outer = [m["ref"] for m in rel["members"] if m["type"] == "way"]

        shapes: list[list[dict[str, float]]] = []
        rings: list[Ring] = []
        nodesets: list[set[str]] = []

        for wid in outer:
            shape, ring, nids = _shape_from_way(wid)
            if shape:
                shapes.append(shape)
                rings.append(ring)
                nodesets.append(set(nids))
                outer_ways_used.add(wid)

        if shapes:
            entry = _assemble_entry(osm_id, info, tags, shapes, rings, nodesets)
            buildings[entry["code"]] = entry
            assigned_codes.add(entry["code"])

    return outer_ways_used


def _collect_from_ways(
    buildings: dict[str, dict[str, Any]],
    assigned_codes: set[str],
    outer_ways_used: set[str],
) -> None:
    """Process standalone ways not already consumed by relations."""
    for wid, way in ways_by_id.items():
        if wid in outer_ways_used:
            continue

        tags = way["tags"]
        info = osm_id_to_info.get(wid)
        if not info:
            info = _match_building_by_name(tags, assigned_codes)
            if not info and "building" not in tags:
                continue

        shape, ring, nids = _shape_from_way(wid)
        if shape and info:
            entry = _assemble_entry(wid, info, tags, [shape], [ring], [set(nids)])
            buildings[entry["code"]] = entry
            assigned_codes.add(entry["code"])


def _collect_buildings() -> dict[str, dict[str, Any]]:
    """Match OSM elements to known buildings and assemble entries."""
    buildings: dict[str, dict[str, Any]] = {}
    assigned_codes: set[str] = set()
    outer_ways_used = _collect_from_relations(buildings, assigned_codes)
    _collect_from_ways(buildings, assigned_codes, outer_ways_used)
    return buildings


def _write_json_atomic(data: dict[str, Any], output_path: Path) -> None:
    """Write JSON to a file atomically using temp file + rename."""
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=output_path.parent,
        suffix=".tmp",
        prefix=output_path.stem,
    )
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        Path(tmp_path).replace(output_path)
    except BaseException:
        Path(tmp_path).unlink(missing_ok=True)
        raise


def main() -> None:
    """Parse OSM data and produce updated buildings.json."""
    _load_building_data()
    _parse_osm_elements(OSM_FILE)
    buildings = _collect_buildings()
    _write_json_atomic(buildings, Path(PARSED_DATA_OUTPUT_JSON))


if __name__ == "__main__":
    main()
