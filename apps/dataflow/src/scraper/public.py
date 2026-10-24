"""Selected CMU public building records, without the platform-specific GIS SDK."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, JsonValue
from shapely.geometry import Polygon

from processor.store import WorkspaceStore
from processor.working import GeographicPoint, SourceBuilding
from scraper.fms.capture import CaptureManifest, SourceError

if TYPE_CHECKING:
    from pathlib import Path

    import requests

    from processor.working import WorkingDataset

ITEM_URL = (
    "https://www.arcgis.com/sharing/rest/content/items/0a8e645dc06d43f1b197b2ea2c2b876e"
)


class Geometry(BaseModel):
    """The selected public layer's geographic polygon contract."""

    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]


class Properties(BaseModel):
    """The identifier is authoritative; abbreviations are metadata, not joins."""

    BuildingID_Numeric_2: int
    Long_Name: str
    Sign_Abbrev: str | None = None


class Feature(BaseModel):
    """One public footprint with non-personal campus metadata."""

    geometry: Geometry
    properties: Properties


class FeatureCollection(BaseModel):
    """A bounded public query; a partial page cannot count as complete."""

    features: list[Feature]


def _json_get(
    session: requests.Session,
    url: str,
    params: dict[str, str],
) -> dict[str, JsonValue]:
    response = session.get(url, params=params, timeout=30)
    response.raise_for_status()
    result = response.json()
    if not isinstance(result, dict) or "error" in result:
        msg = "Public ArcGIS request failed; no source data replaced"
        raise SourceError(msg)
    return result


def fetch_buildings(
    workspace: Path,
    session: requests.Session,
    *,
    refresh: bool = False,
) -> WorkingDataset:
    """Fetch/cache official source records and add them to the selected working JSON."""
    store = WorkspaceStore(workspace.resolve().parent)
    view = store.read(workspace.name)
    capture = CaptureManifest.model_validate_json(
        (workspace / "capture.json").read_bytes(),
    )
    if not refresh and set(capture.selection.buildings).issubset(
        view.working.buildings,
    ):
        return view.working
    target = workspace / "raw/public/arcgis-buildings.geojson"
    item = _json_get(session, ITEM_URL, {"f": "json"})
    url = str(item.get("url", ""))
    if urlsplit(url).scheme != "https" or not (urlsplit(url).hostname or "").endswith(
        ".arcgis.com",
    ):
        msg = "Unexpected public ArcGIS service location"
        raise SourceError(msg)
    service = _json_get(session, url, {"f": "json"})
    layer_id = _building_layer(service)
    query = url.rstrip("/") + f"/{layer_id}/query"
    if target.exists() and not refresh:
        data = json.loads(target.read_bytes())
    else:
        ids = list(capture.selection.buildings.values())
        if not ids or not all(identity.isdecimal() for identity in ids):
            msg = "Public building lookup requires numeric FMS building identifiers"
            raise SourceError(msg)
        data = _json_get(
            session,
            query,
            {
                "f": "geojson",
                "outSR": "4326",
                "outFields": "*",
                "where": "BuildingID_Numeric_2 IN (" + ",".join(ids) + ")",
            },
        )
    if data.get("exceededTransferLimit"):
        msg = "Public building query is incomplete; reduce the capture selection"
        raise SourceError(msg)
    collection = FeatureCollection.model_validate(data)
    for code, identity in capture.selection.buildings.items():
        matching = [
            f
            for f in collection.features
            if f.properties.BuildingID_Numeric_2 == int(identity)
        ]
        if len(matching) != 1:
            msg = (
                f"Expected one public footprint for {code}/FMS {identity}; "
                f"found {len(matching)}"
            )
            raise SourceError(msg)
        feature = matching[0]
        rings = feature.geometry.coordinates
        polygon = Polygon(rings[0], rings[1:])
        if polygon.is_empty or not polygon.is_valid:
            msg = f"Invalid public building footprint for {code}"
            raise SourceError(msg)
        anchor = polygon.centroid
        view.working.buildings[code] = SourceBuilding(
            name=feature.properties.Long_Name.strip(),
            label_position=GeographicPoint(latitude=anchor.y, longitude=anchor.x),
            shapes=[
                [GeographicPoint(latitude=y, longitude=x) for x, y in ring]
                for ring in rings
            ],
            source_url=query,
            source_abbreviation=feature.properties.Sign_Abbrev,
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, indent=2) + "\n")
    return store.save(
        workspace.name, view.working, expected_revision=view.revision,
    ).working


def _building_layer(service: dict[str, JsonValue]) -> int:
    """Discover the advertised layer; the service currently uses ID 2, not 0."""
    layers = service.get("layers")
    if isinstance(layers, list):
        for layer in layers:
            if isinstance(layer, dict) and layer.get("name") == "Buildings":
                identity = layer.get("id")
                if isinstance(identity, int):
                    return identity
    msg = "The public CMU service has no advertised Buildings layer"
    raise SourceError(msg)
