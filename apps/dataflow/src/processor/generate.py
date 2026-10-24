"""Export one saved working revision to the application's canonical JSON files."""

from __future__ import annotations

import hashlib
import json
import math
import tempfile
from dataclasses import dataclass
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from pydantic import BaseModel, Field
from shapely.geometry import Polygon

from models._common import Floor, GeoCoordinate, LocalPosition
from models.buildings import Building, Buildings
from models.floorplans import Floorplans, Room
from models.graph import Graph, GraphNode
from models.placements import Placement, Placements
from models.pois import Poi
from processor.frames import FrameEvidence, verified_frames
from processor.outdoor import outdoor_graph
from processor.store import WorkspaceStore
from processor.working import Point, ReferencePlacement, WorkingDataset, WorkingFloor
from scraper.fms.capture import SourceError

# The application's Pittsburgh projection constants in packages/common coordinates.
LATITUDE_RATIO = 111318.8450631976
LONGITUDE_RATIO = 84719.3945182816
MIN_CLOSED_RING_POINTS = 4


class BuildReport(BaseModel):
    """An immutable candidate and the exact saved working revision it represents."""

    revision: str
    working_revision: str
    directory: str
    files: dict[str, str]
    warnings: list[str]
    counts: dict[str, int]
    alignment: dict[str, FrameEvidence] = Field(default_factory=dict)


class Dataset(BaseModel):
    """All five application contracts are exported and validated together."""

    buildings: Buildings
    placements: Placements
    floorplans: Floorplans
    graph: Graph
    pois: dict[str, Poi]

    def files(self) -> dict[str, bytes]:
        """Serialize each existing consumer format, without wrapper structures."""
        models: dict[str, BaseModel] = {
            "buildings.json": self.buildings,
            "placements.json": self.placements,
            "floorplans.json": self.floorplans,
            "all-graph.json": self.graph,
        }
        contents = {
            name: model.model_dump(mode="json", by_alias=True)
            for name, model in models.items()
        }
        contents["osm-pois.json"] = {
            key: poi.model_dump(mode="json", by_alias=True)
            for key, poi in self.pois.items()
        }
        return {
            name: (json.dumps(value, sort_keys=True, allow_nan=False) + "\n").encode()
            for name, value in contents.items()
        }


def project(point: Point, anchor: ReferencePlacement) -> GeoCoordinate:
    """Map source-frame metres east/north through one operator placement."""
    dx = point.x - anchor.origin.x
    dy = point.y - anchor.origin.y
    angle = math.radians(anchor.angle)
    east = (dx * math.cos(angle) - dy * math.sin(angle)) * anchor.scale
    north = (dx * math.sin(angle) + dy * math.cos(angle)) * anchor.scale
    latitude = anchor.latitude + north / LATITUDE_RATIO
    longitude = anchor.longitude + east / LONGITUDE_RATIO
    return GeoCoordinate(latitude=latitude, longitude=longitude)


def build_workspace(workspace: Path) -> BuildReport:
    """Build a candidate without importing, publishing, or mutating working edits."""
    view = WorkspaceStore(workspace.resolve().parent).read(workspace.name)
    dataset, warnings, alignment = _generate(view.working)
    contents = dataset.files()
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}
    identity = json.dumps(
        [workspace.name, view.revision, hashes, warnings, alignment],
        sort_keys=True,
    ).encode()
    revision = hashlib.sha256(identity).hexdigest()
    directory = f"generated/{revision}"
    target = workspace / directory / "floorplans"
    target.mkdir(parents=True, exist_ok=True)
    for name, data in contents.items():
        path = target / name
        if path.exists() and path.read_bytes() != data:
            msg = f"Generated revision is corrupt: {name}; rebuild in a clean workspace"
            raise SourceError(msg)
        if not path.exists():
            path.write_bytes(data)
    report = BuildReport(
        revision=revision,
        working_revision=view.revision,
        directory=directory,
        files=hashes,
        warnings=warnings,
        alignment={
            key: FrameEvidence.model_validate(value) for key, value in alignment.items()
        },
        counts={
            "captured_floors": sum(
                len(floors) for floors in view.working.floors.values()
            ),
            "buildings": len(dataset.buildings.root),
            "floors": sum(len(floors) for floors in dataset.placements.root.values()),
            "rooms": sum(
                len(rooms)
                for floors in dataset.floorplans.root.values()
                for rooms in floors.values()
            ),
            "nodes": len(dataset.graph.root),
            "edges": sum(len(node.neighbors) for node in dataset.graph.root.values()),
            "pois": len(dataset.pois),
        },
    )
    content = report.model_dump_json(indent=2) + "\n"
    (workspace / directory / "report.json").write_text(content)
    _save_report(workspace, content)
    return report


def _save_report(workspace: Path, content: str) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=workspace,
            delete=False,
        ) as output:
            temporary = Path(output.name)
            output.write(content)
        temporary.replace(workspace / "generated.json")
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _generate(
    working: WorkingDataset,
) -> tuple[Dataset, list[str], dict[str, dict[str, object]]]:
    buildings: dict[str, Building] = {}
    placements: dict[str, dict[str, Placement]] = {}
    floorplans: dict[str, dict[str, dict[str, Room]]] = {}
    graph: dict[str, GraphNode] = {}
    pois: dict[str, Poi] = {}
    warnings: list[str] = []
    alignment: dict[str, dict[str, object]] = {}
    for code, floors in working.floors.items():
        anchor = working.anchors.get(code)
        metadata = working.buildings.get(code)
        if anchor is None or metadata is None:
            msg = f"{code} needs building metadata and a saved reference placement"
            raise SourceError(msg)
        if anchor.reference_floor not in floors:
            msg = f"Reference floor for {code} is missing from working data"
            raise SourceError(msg)
        verified = verified_frames(floors, anchor.reference_floor)
        alignment.update(
            {
                f"{code}/{level}": evidence.model_dump()
                for level, evidence in verified.items()
            },
        )
        levels = [
            level
            for level in floors
            if level == anchor.reference_floor or level in verified
        ]
        warnings.extend(
            f"{code}/{level}: excluded until shared-frame alignment is verified"
            for level in floors
            if level not in levels
        )
        buildings[code] = Building(
            name=metadata.name,
            osmId=None,
            floors=levels,
            defaultFloor=anchor.reference_floor,
            labelPosition=GeoCoordinate(**metadata.label_position.model_dump()),
            shapes=[
                [GeoCoordinate(**point.model_dump()) for point in ring]
                for ring in metadata.shapes
            ],
            code=code,
        )
        buildings[code].fms_id = float(floors[anchor.reference_floor].fms_id)
        buildings[code].default_ordinal = 0
        placements[code] = {}
        floorplans[code] = {}
        for level in levels:
            floor = Floor(buildingCode=code, level=level)
            placements[code][level] = Placement(
                center=GeoCoordinate(
                    latitude=anchor.latitude,
                    longitude=anchor.longitude,
                ),
                pdfCenter=LocalPosition(x=anchor.origin.x, y=-anchor.origin.y),
                scale=anchor.scale,
                angle=(anchor.angle - 90) % 360,
            )
            floorplans[code][level] = {}
            generated = _generate_floor(floor, anchor, floors[level])
            existing_ids = {node.room_id for node in graph.values()}
            if existing_ids.intersection(generated.rooms):
                msg = "Room identifiers must be unique across generated floors"
                raise SourceError(msg)
            floorplans[code][level] = generated.rooms
            graph.update(generated.graph)
            pois.update(generated.pois)
            warnings.extend(generated.warnings)
    warnings.append(
        "Door/connector evidence has not been supplied; "
        "room nodes have no fabricated connections",
    )
    if working.outdoor:
        outside, outdoor_warnings = outdoor_graph(working.outdoor)
        graph.update(outside)
        warnings.extend(outdoor_warnings)
        pois.update(working.outdoor.pois)
        warnings.extend(working.outdoor.warnings)
        warnings.append(
            "Outdoor paths are not connected to indoor rooms "
            "until entrances are verified",
        )
    else:
        warnings.append(
            "Outdoor paths and POI source coverage are not captured in this candidate",
        )
    return (
        Dataset(
            buildings=Buildings(buildings),
            placements=Placements(placements),
            floorplans=Floorplans(floorplans),
            graph=Graph(graph),
            pois=pois,
        ),
        warnings,
        alignment,
    )


@dataclass
class GeneratedFloor:
    """A floor's rooms, preview nodes and supported POIs, with evidence warnings."""

    rooms: dict[str, Room]
    graph: dict[str, GraphNode]
    pois: dict[str, Poi]
    warnings: list[str]


def _generate_floor(
    floor: Floor,
    anchor: ReferencePlacement,
    source: WorkingFloor,
) -> GeneratedFloor:
    rooms: dict[str, Room] = {}
    graph: dict[str, GraphNode] = {}
    pois: dict[str, Poi] = {}
    warnings: list[str] = []
    for space in source.spaces.values():
        if not space.rings or any(
            len(ring) < MIN_CLOSED_RING_POINTS or ring[0] != ring[-1]
            for ring in space.rings
        ):
            msg = (
                f"{space.id}: edited polygon needs closed rings of at least four points"
            )
            raise SourceError(msg)
        polygon = Polygon(
            [(p.x, p.y) for p in space.rings[0]],
            [[(p.x, p.y) for p in ring] for ring in space.rings[1:]],
        )
        if polygon.is_empty or not polygon.is_valid:
            msg = f"{space.id}: invalid edited polygon; correct it before building"
            raise SourceError(msg)
        room = Room(
            id=space.id,
            name=space.name,
            type=space.type,
            aliases=space.aliases,
            floor=floor,
            labelPosition=project(space.label_position, anchor),
            coordinates=[
                [project(point, anchor) for point in ring] for ring in space.rings
            ],
        )
        rooms[room.id] = room
        point = polygon.representative_point()
        local = Point(x=point.x, y=point.y)
        node_id = str(uuid5(NAMESPACE_URL, f"room-node/{room.id}"))
        graph[node_id] = GraphNode(
            id=node_id,
            floor=floor,
            coordinate=project(local, anchor),
            pos=LocalPosition(x=local.x, y=-local.y),
            neighbors={},
        )
        graph[node_id].room_id = room.id
        if room.type == "Restroom":
            poi_id = str(uuid5(NAMESPACE_URL, f"restroom/{room.id}"))
            pois[poi_id] = Poi(
                poiId=poi_id,
                type="Restroom",
                latitude=room.label_position.latitude,
                longitude=room.label_position.longitude,
            )
            pois[poi_id].building_code = floor.building_code
            pois[poi_id].floor_level = floor.level
        if not space.name or not space.type or space.warnings:
            warnings.append(
                f"{floor.building_code}/{floor.level}/{space.id}: "
                "room classification/label/source review pending",
            )
    warnings.extend(
        f"{floor.building_code}/{floor.level}: {warning}" for warning in source.warnings
    )
    return GeneratedFloor(rooms, graph, pois, warnings)
