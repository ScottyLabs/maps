"""Bounded, cached public OSM capture for the shared fresh-source pipeline."""

from __future__ import annotations

import hashlib
import json
import tempfile
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from models.pois import OSM_TAG_TO_POI_TYPE, Poi
from processor.store import WorkspaceStore
from processor.working import GeographicPoint, OutdoorData, OutdoorWay
from scraper.fms.capture import SourceError

if TYPE_CHECKING:
    from pathlib import Path

    import requests

    from processor.working import WorkingDataset

SOURCE_URL = "https://overpass-api.de/api/interpreter"
BUFFER_DEGREES = 0.003
MIN_PATH_NODES = 2


class Element(BaseModel):
    """Only public geometry/tag fields; contributor metadata is not requested."""

    type: Literal["node", "way", "relation"]
    id: int
    lat: float | None = None
    lon: float | None = None
    nodes: list[int] = Field(default_factory=list)
    tags: dict[str, str] = Field(default_factory=dict)


class Response(BaseModel):
    """A runtime error with partial elements must never look like zero results."""

    elements: list[Element]
    remark: str | None = None


def _query(working: WorkingDataset) -> str:
    points = [
        point
        for building in working.buildings.values()
        for ring in building.shapes
        for point in ring
    ] or [building.label_position for building in working.buildings.values()]
    if not points:
        msg = "Fetch public building metadata before outdoor sources"
        raise SourceError(msg)
    bounds = (
        min(point.latitude for point in points) - BUFFER_DEGREES,
        min(point.longitude for point in points) - BUFFER_DEGREES,
        max(point.latitude for point in points) + BUFFER_DEGREES,
        max(point.longitude for point in points) + BUFFER_DEGREES,
    )
    bbox = ",".join(f"{value:.7f}" for value in bounds)
    selectors = [f'way[highway~"footway|path|pedestrian|steps|corridor"]({bbox});']
    for key, value in sorted(OSM_TAG_TO_POI_TYPE):
        selectors.append(f'nwr["{key}"="{value}"]({bbox});')
    return "[out:json][timeout:25];(" + "".join(selectors) + ");out body;>;out skel qt;"


def fetch_outdoor(
    workspace: Path,
    session: requests.Session,
    *,
    refresh: bool = False,
) -> WorkingDataset:
    """Save a complete public result or preserve the last successful working state."""
    store = WorkspaceStore(workspace.resolve().parent)
    view = store.read(workspace.name)
    query = _query(view.working)
    existing = view.working.outdoor
    if existing and not refresh:
        if existing.query != query:
            msg = "Outdoor bounds changed; explicitly refresh the public source"
            raise SourceError(msg)
        target = (workspace / existing.artifact_path).resolve()
        if (
            not target.is_relative_to(workspace.resolve())
            or not target.exists()
            or hashlib.sha256(target.read_bytes()).hexdigest()
            != existing.artifact_sha256
        ):
            msg = "Cached outdoor source changed; explicitly refresh it before reuse"
            raise SourceError(msg)
        return view.working
    session.mount(
        "https://",
        HTTPAdapter(
            max_retries=Retry(
                total=2,
                backoff_factor=0.5,
                allowed_methods=frozenset({"GET"}),
                status_forcelist=(429, 500, 502, 503, 504),
            ),
        ),
    )
    result = session.get(
        SOURCE_URL,
        params={"data": query},
        timeout=45,
        headers={"User-Agent": "CMUMaps-development-pipeline/1.0"},
    )
    result.raise_for_status()
    response = Response.model_validate(result.json())
    if response.remark:
        msg = "Overpass returned an incomplete query; previous source is unchanged"
        raise SourceError(msg)
    content = (json.dumps(result.json(), sort_keys=True) + "\n").encode()
    snapshot = _snapshot(response.elements)
    snapshot.source_url = SOURCE_URL
    snapshot.query = query
    snapshot.artifact_sha256 = hashlib.sha256(content).hexdigest()
    snapshot.artifact_path = f"raw/public/osm-{snapshot.artifact_sha256}.json"
    view.working.outdoor = snapshot
    target = workspace / snapshot.artifact_path
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
            temporary = target.parent / output.name
            output.write(content)
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    # Content-addressed raw files cannot replace a concurrent editor's source.
    return store.save(
        workspace.name,
        view.working,
        expected_revision=view.revision,
    ).working


def _public(tags: dict[str, str]) -> bool:
    foot = tags.get("foot")
    return (
        foot not in {"no", "private"}
        and (
            foot in {"yes", "designated", "permissive"}
            or tags.get("access") not in {"no", "private"}
        )
        and tags.get("locked") != "yes"
    )


def _indoor(tags: dict[str, str]) -> bool:
    return (
        tags.get("indoor") == "yes"
        or tags.get("highway") == "corridor"
        or "level" in tags
    )


def _snapshot(elements: list[Element]) -> OutdoorData:
    # The second skeleton output can repeat a tagged node: keep the tagged record.
    unique: dict[tuple[str, int], Element] = {}
    for element in elements:
        key = (element.type, element.id)
        if key not in unique or element.tags:
            unique[key] = element
    nodes = {
        str(element.id): GeographicPoint(latitude=element.lat, longitude=element.lon)
        for element in unique.values()
        if element.type == "node"
        and element.lat is not None
        and element.lon is not None
    }
    blocked = {
        str(element.id)
        for element in unique.values()
        if element.type == "node" and not _public(element.tags)
    }
    ways = []
    pois = {}
    warnings = []
    for element in unique.values():
        tags = element.tags
        if not _public(tags):
            continue
        if _indoor(tags):
            warnings.append(
                f"OSM {element.type}/{element.id}: indoor/level data "
                "needs a verified FMS floor association",
            )
            continue
        way = _way(element, nodes, blocked, warnings)
        if way:
            ways.append(way)
        poi = _poi(element, nodes, warnings)
        if poi:
            pois[poi.poi_id] = poi
    if not ways:
        warnings.append("OSM query succeeded with zero eligible outdoor paths")
    if not pois:
        warnings.append("OSM query succeeded with zero eligible point POIs")
    return OutdoorData(
        source_url=SOURCE_URL,
        query="",
        artifact_sha256="",
        artifact_path="",
        nodes=nodes,
        ways=ways,
        pois=pois,
        warnings=warnings,
    )


def _way(
    element: Element,
    nodes: dict[str, GeographicPoint],
    blocked: set[str],
    warnings: list[str],
) -> OutdoorWay | None:
    if element.type != "way" or "highway" not in element.tags:
        return None
    if len(element.nodes) < MIN_PATH_NODES or any(
        str(node) not in nodes for node in element.nodes
    ):
        msg = f"OSM way/{element.id} is incomplete; referenced nodes are missing"
        raise SourceError(msg)
    if any(str(node) in blocked for node in element.nodes):
        warnings.append(
            f"OSM way/{element.id}: excluded because a path node "
            "restricts pedestrian access",
        )
        return None
    return OutdoorWay(
        id=str(element.id),
        nodes=[str(node) for node in element.nodes],
        tags=element.tags,
    )


def _poi(
    element: Element,
    nodes: dict[str, GeographicPoint],
    warnings: list[str],
) -> Poi | None:
    poi_type = next(
        (
            value
            for key, value in OSM_TAG_TO_POI_TYPE.items()
            if element.tags.get(key[0]) == key[1]
        ),
        None,
    )
    if not poi_type:
        return None
    if element.type != "node" or str(element.id) not in nodes:
        warnings.append(
            f"OSM {element.type}/{element.id}: area POI "
            "needs a reviewed point location",
        )
        return None
    location = nodes[str(element.id)]
    return Poi(poiId=f"osm-node-{element.id}", type=poi_type, **location.model_dump())
