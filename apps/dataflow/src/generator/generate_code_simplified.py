"""generate_code_simplified.py - Navigation Graph Builder (OOP version).

WHAT IT DOES
------------
Builds a navigation graph (nodes + edges) from CMU building floor plan polygons
using an object-oriented design.  For each room it either:
  - places a single centroid node (rooms below min_area_for_sampling), or
  - samples a uniform interior grid of nodes,
then detects shared door edges between neighboring rooms, creates inter-room
edges through detected doorways, and links intra-room nodes via adjacency.
Optionally merges nodes that are closer than max_merge_distance, then exports
the final graph to JSON.

HOW TO RUN
----------
    python generate_code_simplified.py

Tune the GraphBuilderConfig parameters in the main() function to control
node density and merge behaviour.

REQUIRED INPUT FILES
--------------------
  - data_source/Ansys-1-map.json                       (floor plan polygon data)
  - data_source/room_neighbor_analysis_with_names.json (room adjacency data -
                                                        produced by find_neighbors.py)

OUTPUT
------
  - Ansys-1-nodes-edges-simplified.json   (navigation graph with nodes and edges)

DEPENDENCIES
------------
  pip install shapely
  Internal module: sampler.py  (must be in the same directory)
"""

from __future__ import annotations

import heapq
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from shapely.geometry import LineString, Polygon

from generator.sampler import Triangulator, UniformSampler

# Minimum polygon vertices for a valid ring / room
MIN_POLYGON_POINTS = 3
MIN_CRUCIAL_IN_ROOM = 2
MIN_PATH_NODES_FOR_MERGE = 2
ADJ_TUPLE_LEN = 3


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


class RoomDataLoader:
    """Loads room polygons and neighbor data from JSON files."""

    @staticmethod
    def load(
        floor_path: str | Path,
        neighbor_path: str | Path,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Load rooms_data and neighbor_data from JSON.

        Returns (rooms_data, neighbor_data).
        """
        with Path(floor_path).open("r", encoding="utf-8") as f:
            rooms_data = json.load(f)
        with Path(neighbor_path).open("r", encoding="utf-8") as f:
            neighbor_data = json.load(f).get("room_neighbors_names", {})
        return rooms_data, neighbor_data

    @staticmethod
    def parse_polygon_coords(coords: list[Any]) -> list[tuple[float, float]]:
        """Parse polygon coords from JSON to list of (lon, lat) tuples."""
        out = []
        for coord_wrapper in coords:
            if isinstance(coord_wrapper, list) and len(coord_wrapper) > 0:
                c = coord_wrapper[0]
                out.append((c["longitude"], c["latitude"]))
        return out


# ---------------------------------------------------------------------------
# Graph builder configuration
# ---------------------------------------------------------------------------


@dataclass
class GraphBuilderConfig:
    """Configuration for node generation and pruning."""

    use_triangulation: bool = True
    max_area: float | None = 150000
    min_edge_distance: float | None = 0
    min_area_for_sampling: float | None = 50000
    max_merge_distance: float = 0.0
    grid_spacing: float = 100.0


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------


class GraphBuilder:
    """Build navigation graph (nodes and edges) from room polygons and neighbor data."""

    def __init__(
        self,
        rooms_data: dict[str, Any],
        neighbor_data: dict[str, Any],
        config: GraphBuilderConfig | None = None,
    ) -> None:
        """Initialize with room data, neighbor data, and optional config."""
        self.rooms_data = rooms_data
        self.neighbor_data = neighbor_data
        self.config = config or GraphBuilderConfig()
        if self.config.use_triangulation:
            self._sampler: Triangulator | UniformSampler = Triangulator()
        else:
            self._sampler = UniformSampler()

        self._nodes: list[dict[str, Any]] = []
        self._access_name_to_node_id: dict[str, Any] = {}
        self._crucial_points: list[dict[str, Any]] = []
        self._neighbor_edges: list[dict[str, Any]] = []
        self._intra_room_edges: list[dict[str, Any]] = []

    @property
    def nodes(self) -> list[dict[str, Any]]:
        """Return the current list of graph nodes."""
        return self._nodes

    @property
    def neighbor_edges(self) -> list[dict[str, Any]]:
        """Return the current list of neighbor edges."""
        return self._neighbor_edges

    @property
    def intra_room_edges(self) -> list[dict[str, Any]]:
        """Return the current list of intra-room edges."""
        return self._intra_room_edges

    def build(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Run full pipeline: nodes, neighbor edges, intra-room edges, prune.

        Returns (nodes, edges).
        """
        self._build_nodes()
        self._build_neighbor_edges()
        self._build_intra_room_edges_and_prune()
        all_edges = self._neighbor_edges + self._intra_room_edges
        return self._nodes, all_edges

    def export(self, output_path: str | Path) -> None:
        """Write nodes and edges to JSON and print summary. Call build() first."""
        edges = self._neighbor_edges + self._intra_room_edges
        nodes = self._nodes
        output_path = Path(output_path)
        data = {"nodes": nodes, "edges": edges}
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        intra = sum(1 for e in edges if e.get("kind") == "intra_room")
        neighbor = sum(1 for e in edges if e.get("kind") == "neighbor")
        print(  # noqa: T201
            f"Exported {len(nodes)} nodes and {len(edges)} edges to {output_path}",
        )
        print(f"  - Intra-room edges: {intra}")  # noqa: T201
        print(f"  - Neighbor edges: {neighbor}")  # noqa: T201

    # ---------- Node creation ----------

    def _build_nodes(self) -> None:
        """Create nodes from room polygons (triangulation or centroid)."""
        self._nodes = []
        self._access_name_to_node_id = {}
        global_node_id = 0

        for room_uuid, room_data in self.rooms_data.items():
            coords = room_data.get("coordinates", [])
            if not coords or len(coords) < MIN_POLYGON_POINTS:
                continue

            polygon_coords = RoomDataLoader.parse_polygon_coords(coords)
            if len(polygon_coords) < MIN_POLYGON_POINTS:
                room_label = room_data.get("name", room_uuid)
                msg = f"Room {room_label} has less than {MIN_POLYGON_POINTS} points"
                raise ValueError(msg)

            try:
                geom = Polygon(polygon_coords)
                if not geom.is_valid:
                    geom = geom.buffer(0)
            except (ValueError, TypeError) as e:
                room_label = room_data.get("name", room_uuid)
                msg = f"Room {room_label} has invalid coordinates: {e}"
                raise ValueError(msg) from e

            room_name = room_data.get("name", "")
            room_type = room_data.get("type", "")
            floor_level = room_data.get("floor", {}).get("level", "")
            building_code = room_data.get("floor", {}).get("buildingCode", "")
            access_name = f"{building_code}_{floor_level}_{room_name}"

            try:
                centroids, _ = self._sampler.sample(
                    geom,
                    spacing=self.config.grid_spacing,
                    max_area=self.config.max_area,
                    min_edge_distance=self.config.min_edge_distance,
                )
                room_node_ids = []
                for local_id, (x, y) in enumerate(centroids):
                    node = {
                        "id": global_node_id,
                        "x": float(x),
                        "y": float(y),
                        "room_id": room_uuid,
                        "room_name": room_name,
                        "room_type": room_type,
                        "floor": floor_level,
                        "local_id": local_id,
                    }
                    self._nodes.append(node)
                    room_node_ids.append(global_node_id)
                    global_node_id += 1
                self._access_name_to_node_id[access_name] = room_node_ids
            except (ValueError, TypeError, RuntimeError) as e:
                print(  # noqa: T201
                    f"Warning: Triangulation failed for room {room_name}, "
                    f"using single node: {e}",
                )
                centroid = geom.centroid
                node = {
                    "id": global_node_id,
                    "x": float(centroid.x),
                    "y": float(centroid.y),
                    "room_id": room_uuid,
                    "room_name": room_name,
                    "room_type": room_type,
                    "floor": floor_level,
                    "local_id": 0,
                }
                self._nodes.append(node)
                self._access_name_to_node_id[access_name] = global_node_id
                global_node_id += 1

    # ---------- Neighbor edges ----------

    def _build_neighbor_edges(self) -> None:  # noqa: C901, PLR0912, PLR0915
        """Create edges through doors (polygon intersections).

        Fallback to closest-node pair for neighbor_data entries that share no door.

        """
        self._neighbor_edges = []
        edge_set = set()  # deduplication by node-pair key
        room_pair_set = set()  # tracks which room pairs are already connected
        node_id_to_xy = {n["id"]: (n["x"], n["y"]) for n in self._nodes}

        room_to_node_ids: dict[str, list[int]] = defaultdict(list)
        for n in self._nodes:
            room_to_node_ids[n["room_id"]].append(n["id"])

        def closest_node(room_uuid: str, px: float, py: float) -> int | None:
            nids = room_to_node_ids.get(room_uuid, [])
            return (
                min(
                    nids,
                    key=lambda nid: (
                        (node_id_to_xy[nid][0] - px) ** 2
                        + (node_id_to_xy[nid][1] - py) ** 2
                    ),
                )
                if nids
                else None
            )

        def add_edge(sid: int, tid: int) -> None:
            key = tuple(sorted([sid, tid]))
            if key in edge_set:
                return
            edge_set.add(key)
            xa, ya = node_id_to_xy[sid]
            xb, yb = node_id_to_xy[tid]
            self._neighbor_edges.append(
                {
                    "source": sid,
                    "target": tid,
                    "kind": "neighbor",
                    "weight": ((xa - xb) ** 2 + (ya - yb) ** 2) ** 0.5,
                },
            )

        # Build geometry and access-name lookup for all rooms
        floor_to_rooms: dict[tuple[str, str], list[str]] = defaultdict(list)
        room_geoms: dict[str, Polygon] = {}
        access_name_to_uuid: dict[str, str] = {}
        for room_uuid, room_data in self.rooms_data.items():
            geom = self._get_room_geometry(room_uuid)
            if geom is None:
                continue
            room_geoms[room_uuid] = geom
            building_code = room_data.get("floor", {}).get("buildingCode", "")
            floor_level = room_data.get("floor", {}).get("level", "")
            room_name = room_data.get("name", "")
            floor_to_rooms[(building_code, floor_level)].append(room_uuid)
            access_name_to_uuid[f"{building_code}_{floor_level}_{room_name}"] = (
                room_uuid
            )

        # Pass 1: door edges from polygon intersections
        for room_uuids in floor_to_rooms.values():
            for i, uuid_a in enumerate(room_uuids):
                geom_a = room_geoms[uuid_a]
                for uuid_b in room_uuids[i + 1 :]:
                    intersection = geom_a.intersection(room_geoms[uuid_b])
                    if intersection.is_empty:
                        continue
                    door = intersection.centroid
                    sid = closest_node(uuid_a, door.x, door.y)
                    tid = closest_node(uuid_b, door.x, door.y)
                    if sid is None or tid is None or sid == tid:
                        continue
                    room_pair_set.add(tuple(sorted([uuid_a, uuid_b])))
                    add_edge(sid, tid)

        # Pass 2: neighbor_data fallback for pairs with no door intersection
        for access_name_a, neighbors in self.neighbor_data.items():
            room_uuid_a = access_name_to_uuid.get(access_name_a)
            if room_uuid_a is None:
                continue
            floor_level_a = (
                self.rooms_data[room_uuid_a].get("floor", {}).get("level", "")
            )
            for access_name_b in neighbors:
                room_uuid_b = access_name_to_uuid.get(access_name_b)
                if room_uuid_b is None:
                    continue
                floor_level_b = (
                    self.rooms_data[room_uuid_b].get("floor", {}).get("level", "")
                )
                if floor_level_a != floor_level_b:
                    continue
                if tuple(sorted([room_uuid_a, room_uuid_b])) in room_pair_set:
                    continue
                nids_a = room_to_node_ids.get(room_uuid_a, [])
                nids_b = room_to_node_ids.get(room_uuid_b, [])
                if not nids_a or not nids_b:
                    continue
                best_sid, best_tid = min(
                    ((s, t) for s in nids_a for t in nids_b),
                    key=lambda st: (
                        (node_id_to_xy[st[0]][0] - node_id_to_xy[st[1]][0]) ** 2
                        + (node_id_to_xy[st[0]][1] - node_id_to_xy[st[1]][1]) ** 2
                    ),
                )
                room_pair_set.add(tuple(sorted([room_uuid_a, room_uuid_b])))
                add_edge(best_sid, best_tid)

    # ---------- Intra-room edges and pruning ----------

    def _build_intra_room_edges_and_prune(self) -> None:  # noqa: C901
        """Build intra-room edges via shortest paths; prune non-crucial/path nodes.

        Optionally merge close path nodes.
        """
        crucial_ids = set()
        for e in self._neighbor_edges:
            crucial_ids.add(e["source"])
            crucial_ids.add(e["target"])

        node_id_to_xy = {n["id"]: (n["x"], n["y"]) for n in self._nodes}
        room_id_to_node_ids = defaultdict(list)
        for n in self._nodes:
            room_id_to_node_ids[n["room_id"]].append(n["id"])

        path_node_ids = set()
        intra_room_edges = []
        edge_keys_seen = set()

        def add_intra_edge(a: int, b: int) -> None:
            key = tuple(sorted([a, b]))
            if key in edge_keys_seen:
                return
            edge_keys_seen.add(key)
            xa, ya = node_id_to_xy[a]
            xb, yb = node_id_to_xy[b]
            w = ((xa - xb) ** 2 + (ya - yb) ** 2) ** 0.5
            intra_room_edges.append(
                {"source": a, "target": b, "kind": "intra_room", "weight": w},
            )

        for room_uuid, room_node_ids in room_id_to_node_ids.items():
            if len(room_node_ids) < MIN_CRUCIAL_IN_ROOM:
                continue
            crucial_in_room = crucial_ids & set(room_node_ids)
            if len(crucial_in_room) < MIN_CRUCIAL_IN_ROOM:
                continue

            geom = self._get_room_geometry(room_uuid)
            if geom is None:
                continue

            adj = self._build_cardinal_adj(room_node_ids, node_id_to_xy, geom)

            crucial_list = sorted(crucial_in_room)
            for i, a in enumerate(crucial_list):
                for b in crucial_list[i + 1 :]:
                    path = self._turn_minimized_path(adj, a, b)
                    if path is None:
                        continue
                    for nid in path:
                        path_node_ids.add(nid)
                    for idx in range(len(path) - 1):
                        add_intra_edge(path[idx], path[idx + 1])

        pruned_nodes, intra_room_edges = self._prune_nodes_and_intra_edges(
            self._nodes,
            intra_room_edges,
            crucial_ids,
            path_node_ids,
        )
        keep_set = crucial_ids | path_node_ids

        if self.config.max_merge_distance > 0:
            pruned_nodes, intra_room_edges = self._merge_close_path_nodes(
                pruned_nodes,
                intra_room_edges,
                crucial_ids,
                path_node_ids,
                keep_set,
                node_id_to_xy,
            )

        intra_room_edges = self._filter_intra_room_edges_inside_polygons(
            pruned_nodes,
            intra_room_edges,
        )

        self._nodes = pruned_nodes
        self._intra_room_edges = intra_room_edges
        node_ids = {n["id"] for n in self._nodes}
        self._neighbor_edges = [
            e
            for e in self._neighbor_edges
            if e["source"] in node_ids and e["target"] in node_ids
        ]

    def _get_room_geometry(self, room_uuid: str) -> Polygon | None:
        """Build Shapely Polygon for a room; return None if invalid."""
        room_data = self.rooms_data.get(room_uuid, {})
        coords = room_data.get("coordinates", [])
        if not coords or len(coords) < MIN_POLYGON_POINTS:
            return None
        polygon_coords = RoomDataLoader.parse_polygon_coords(coords)
        if len(polygon_coords) < MIN_POLYGON_POINTS:
            return None
        try:
            geom = Polygon(polygon_coords)
            if not geom.is_valid:
                geom = geom.buffer(0)
        except (ValueError, TypeError):
            return None
        else:
            return geom

    @staticmethod
    def _segment_inside_polygon(
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        geom: Polygon,
    ) -> bool:
        """Return whether segment (x1,y1)-(x2,y2) lies inside the polygon."""
        if (x1, y1) == (x2, y2):
            return True
        line = LineString([(x1, y1), (x2, y2)])
        return bool(geom.contains(line) or line.within(geom))

    def _build_cardinal_adj(  # noqa: C901
        self,
        node_ids: list[int],
        node_id_to_xy: dict[int, tuple[float, float]],
        geom: Polygon,
    ) -> dict[int, list[tuple[int, int, str]]]:
        """Build H/V-only adjacency.

        For each node find nearest neighbor in 4 cardinal directions (within
        tolerance), verify line-of-sight, tag edges as 'H' or 'V'.
        Returns adj[nid] = [(neighbor_id, weight, 'H'|'V'), ...].
        """
        tol = self.config.grid_spacing * 0.3
        adj: dict[int, list[tuple[int, int, str]]] = defaultdict(list)
        seen_pairs: set[tuple[int, int]] = set()

        def add(a: int, b: int, direction: str) -> None:
            key = (min(a, b), max(a, b))
            if key in seen_pairs:
                return
            seen_pairs.add(key)
            xa, ya = node_id_to_xy[a]
            xb, yb = node_id_to_xy[b]
            if not self._segment_inside_polygon(xa, ya, xb, yb, geom):
                return
            adj[a].append((b, 1, direction))
            adj[b].append((a, 1, direction))

        for nid in node_ids:
            x, y = node_id_to_xy[nid]
            right = left = up = down = None  # (dist, other_nid)
            for oid in node_ids:
                if oid == nid:
                    continue
                ox, oy = node_id_to_xy[oid]
                dx, dy = ox - x, oy - y
                if abs(dy) < tol:
                    if dx > 0 and (right is None or dx < right[0]):
                        right = (dx, oid)
                    elif dx < 0 and (left is None or -dx < left[0]):
                        left = (-dx, oid)
                elif abs(dx) < tol:
                    if dy > 0 and (up is None or dy < up[0]):
                        up = (dy, oid)
                    elif dy < 0 and (down is None or -dy < down[0]):
                        down = (-dy, oid)
            for item, direction in [(right, "H"), (left, "H"), (up, "V"), (down, "V")]:
                if item:
                    add(nid, item[1], direction)

        return adj

    @staticmethod
    def _turn_minimized_path(
        adj: dict[int, list[tuple[int, int, str]]],
        start: int,
        goal: int,
    ) -> list[int] | None:
        """Compute shortest path minimizing (distance, num_turns).

        adj[node] = [(neighbor_id, weight, 'H'|'V'), ...]. Returns path list or None.
        """
        if start == goal:
            return [start]
        heap: list[tuple[float, int, int, str, list[int]]] = [
            (0.0, 0, start, "", [start]),
        ]
        seen: set[tuple[int, str]] = set()
        while heap:
            dist, turns, u, direction, path = heapq.heappop(heap)
            state = (u, direction)
            if state in seen:
                continue
            seen.add(state)
            if u == goal:
                return path
            for v, w, edge_dir in adj[u]:
                new_turns = turns + (0 if direction in ("", edge_dir) else 1)
                if (v, edge_dir) not in seen:
                    item: tuple[float, int, int, str, list[int]] = (
                        dist + w,
                        new_turns,
                        v,
                        edge_dir,
                        [*path, v],
                    )
                    heapq.heappush(heap, item)
        return None

    @staticmethod
    def _dijkstra_path(
        adj: dict[int, list[tuple[int, float]]],
        start: int,
        goal: int,
    ) -> list[int] | None:
        """Shortest path from start to goal.

        adj[node] = [(neighbor_id, weight), ...]. Returns path list or None.
        """
        if start == goal:
            return [start]
        heap = [(0.0, start, [start])]
        seen = {start}
        while heap:
            d, u, path = heapq.heappop(heap)
            for v, w in adj[u]:
                if v in seen:
                    continue
                seen.add(v)
                new_path = [*path, v]
                if v == goal:
                    return new_path
                heapq.heappush(heap, (d + w, v, new_path))
        return None

    @staticmethod
    def _prune_nodes_and_intra_edges(
        nodes: list[dict[str, Any]],
        intra_room_edges: list[dict[str, Any]],
        crucial_ids: set[int],
        path_node_ids: set[int],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Keep crucial and path nodes; drop intra_room edges at removed nodes."""
        keep_set = crucial_ids | path_node_ids
        pruned = [n for n in nodes if n["id"] in keep_set]
        filtered = [
            e
            for e in intra_room_edges
            if e["source"] in keep_set and e["target"] in keep_set
        ]
        return pruned, filtered

    def _filter_intra_room_edges_inside_polygons(
        self,
        nodes: list[dict[str, Any]],
        intra_room_edges: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Keep only intra-room edges whose segment lies inside the room polygon."""
        node_by_id = {n["id"]: n for n in nodes}
        kept = []
        for e in intra_room_edges:
            if e.get("kind") != "intra_room":
                kept.append(e)
                continue
            a, b = e["source"], e["target"]
            na, nb = node_by_id.get(a), node_by_id.get(b)
            if not na or not nb or na["room_id"] != nb["room_id"]:
                continue
            geom = self._get_room_geometry(na["room_id"])
            if geom is None:
                continue
            if self._segment_inside_polygon(
                na["x"],
                na["y"],
                nb["x"],
                nb["y"],
                geom,
            ):
                kept.append(e)
        return kept

    def _merge_close_path_nodes(  # noqa: C901, PLR0912, PLR0915
        self,
        pruned_nodes: list[dict[str, Any]],
        intra_room_edges: list[dict[str, Any]],
        crucial_ids: set[int],
        path_node_ids: set[int],
        keep_set: set[int],
        _node_id_to_xy: dict[int, tuple[float, float]],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Merge path-only nodes within max_merge_distance; reconnect via midpoint."""
        path_only_ids = path_node_ids - crucial_ids
        if len(path_only_ids) < MIN_PATH_NODES_FOR_MERGE:
            return pruned_nodes, intra_room_edges

        node_by_id = {n["id"]: n for n in pruned_nodes}
        node_id_to_xy_cur = {n["id"]: (n["x"], n["y"]) for n in pruned_nodes}

        def dist(a_id: int, b_id: int) -> float:
            xa, ya = node_id_to_xy_cur.get(a_id, (0, 0))
            xb, yb = node_id_to_xy_cur.get(b_id, (0, 0))
            return float(((xa - xb) ** 2 + (ya - yb) ** 2) ** 0.5)

        neighbors = defaultdict(set)
        for e in intra_room_edges:
            u, v = e["source"], e["target"]
            neighbors[u].add(v)
            neighbors[v].add(u)
        for e in self._neighbor_edges:
            u, v = e["source"], e["target"]
            if u in keep_set and v in keep_set:
                neighbors[u].add(v)
                neighbors[v].add(u)

        room_to_path = defaultdict(set)
        for nid in path_only_ids:
            if nid in node_by_id:
                room_to_path[node_by_id[nid]["room_id"]].add(nid)

        pairs: list[tuple[float, int, int]] = []
        for nids in room_to_path.values():
            nid_list = sorted(nids)
            for i, a in enumerate(nid_list):
                pairs.extend(
                    (dist(a, b), a, b)
                    for b in nid_list[i + 1 :]
                    if dist(a, b) <= self.config.max_merge_distance
                )
        pairs.sort(key=lambda t: t[0])

        removed: set[int] = set()
        new_nodes: list[dict[str, Any]] = []
        next_id = max(n["id"] for n in pruned_nodes) + 1

        for _d, a, b in pairs:
            if a in removed or b in removed:
                continue
            na, nb = node_by_id[a], node_by_id[b]
            if na["room_id"] != nb["room_id"]:
                continue
            mid_x = (na["x"] + nb["x"]) / 2.0
            mid_y = (na["y"] + nb["y"]) / 2.0
            merged = {
                "id": next_id,
                "x": mid_x,
                "y": mid_y,
                "room_id": na["room_id"],
                "room_name": na.get("room_name", ""),
                "room_type": na.get("room_type", ""),
                "floor": na.get("floor", ""),
                "local_id": -1,
            }
            new_nodes.append(merged)
            node_by_id[next_id] = merged
            node_id_to_xy_cur[next_id] = (mid_x, mid_y)

            nbrs = (neighbors[a] | neighbors[b]) - {a, b}
            room_id = na["room_id"]
            room_geom = self._get_room_geometry(room_id)
            for nbr in nbrs:
                if nbr in removed:
                    continue
                nbr_node = node_by_id.get(nbr)
                kind = (
                    "intra_room"
                    if nbr_node and nbr_node.get("room_id") == room_id
                    else "neighbor"
                )
                xn, yn = node_id_to_xy_cur.get(nbr, (0, 0))
                if (
                    kind == "intra_room"
                    and room_geom is not None
                    and not self._segment_inside_polygon(
                        mid_x,
                        mid_y,
                        xn,
                        yn,
                        room_geom,
                    )
                ):
                    continue
                w = ((mid_x - xn) ** 2 + (mid_y - yn) ** 2) ** 0.5
                intra_room_edges.append(
                    {"source": next_id, "target": nbr, "kind": kind, "weight": w},
                )
            removed.add(a)
            removed.add(b)
            next_id += 1

        pruned_nodes = [n for n in pruned_nodes if n["id"] not in removed]
        pruned_nodes.extend(new_nodes)
        intra_room_edges = [
            e
            for e in intra_room_edges
            if e["source"] not in removed and e["target"] not in removed
        ]
        return pruned_nodes, intra_room_edges


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Load data, build graph, and export."""
    input_file = "data_source/Ansys-1-map.json"
    neighbor_file = "data_source/room_neighbor_analysis_with_names.json"
    output_file = "Ansys-1-nodes-edges-simplified.json"

    config = GraphBuilderConfig(
        grid_spacing=200.0,
        min_edge_distance=100.0,
        min_area_for_sampling=50000,
        max_merge_distance=0.0,
        use_triangulation=False,
    )

    print(f"Loading data from {input_file}...")  # noqa: T201
    rooms_data, neighbor_data = RoomDataLoader.load(input_file, neighbor_file)
    print(f"Loaded {len(rooms_data)} rooms")  # noqa: T201

    print("Creating nodes from room polygons...")  # noqa: T201
    if config.use_triangulation:
        print(f"  Using triangulation with max_area={config.max_area}")  # noqa: T201
        print(  # noqa: T201
            f"  Filtering nodes within {config.min_edge_distance} units of boundaries",
        )
        print(  # noqa: T201
            f"  Rooms smaller than {config.min_area_for_sampling} get single node",
        )

    builder = GraphBuilder(rooms_data, neighbor_data, config)
    builder.build()
    print(f"Created {len(builder.nodes)} nodes")  # noqa: T201
    print(f"Created {len(builder.neighbor_edges)} neighbor edges")  # noqa: T201
    print(  # noqa: T201
        f"Created {len(builder.intra_room_edges)} intra-room edges; "
        f"{len(builder.nodes)} nodes total",
    )

    print(f"Exporting to {output_file}...")  # noqa: T201
    builder.export(output_file)
    print("Done!")  # noqa: T201


if __name__ == "__main__":
    main()
