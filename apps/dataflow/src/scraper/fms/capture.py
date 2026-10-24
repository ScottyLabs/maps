"""Capture authenticated FMS responses as reusable source files, never sessions."""

from __future__ import annotations

import hashlib
import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from urllib.parse import quote
from xml.etree.ElementTree import ParseError

import requests
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    TypeAdapter,
    ValidationError,
)

BASE_URL = "https://fmsystems.cmu.edu/FMInteract/"
JSON: TypeAdapter[JsonValue] = TypeAdapter(JsonValue)


class SourceError(ValueError):
    """An actionable source failure safe to record without response bodies."""


class CaptureSelection(BaseModel):
    """The operator's declared scope, including an explicit all-floor selection."""

    model_config = ConfigDict(extra="forbid")

    buildings: dict[str, str]
    site: str = "MAIN"
    levels: list[str] | None = None


class FloorSource(BaseModel):
    """A floor discovered from the source navigation, with an application code."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    building: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    fms_id: str = Field(min_length=1)
    level: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
    url: str


class FloorInfo(BaseModel):
    """Drawing identity and physical bounds returned by FMS's floor-info API."""

    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)

    floor_id: str = Field(alias="floorId")
    svg_file: str = Field(alias="svgFile")
    is_revit: bool = Field(alias="isRevit")
    area_unit: str = Field(alias="areaUnit")
    xmin: float
    xmax: float
    ymin: float
    ymax: float


class DefaultLayers(BaseModel):
    """The drawing's room-boundary and room-tag layer roles."""

    boundary: str = Field(alias="RoomBoundaryLayer", min_length=1)
    labels: str = Field(alias="RoomTagLayer", min_length=1)


class DrawingLayer(BaseModel):
    """A source layer identified by the drawing API."""

    name: str = Field(alias="layerName")


class SvgInfo(BaseModel):
    """SVG extents and layer names needed to normalize the saved drawing."""

    view_box: str = Field(alias="viewBox")
    layers: list[DrawingLayer]


class CapturedFloor(BaseModel):
    """Verified source artifacts or a concrete failure for a selected floor."""

    source: FloorSource
    status: Literal["pending", "captured", "missing", "failed"] = "pending"
    metadata: FloorInfo | None = None
    drawing: SvgInfo | None = None
    default_layers: DefaultLayers | None = None
    captured_at: datetime | None = None
    artifacts: dict[str, str] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None


class CaptureManifest(BaseModel):
    """The saved acquisition result, independent of a logged-in browser."""

    version: Literal[1] = 1
    selection: CaptureSelection
    floors: list[CapturedFloor]

    @property
    def complete(self) -> bool:
        """A selection is complete only when every floor was captured."""
        return bool(self.floors) and all(f.status == "captured" for f in self.floors)


def _save_manifest(workspace: Path, manifest: CaptureManifest) -> None:
    """Replace the source manifest atomically after each floor."""
    workspace.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=workspace,
            delete=False,
        ) as output:
            temporary = Path(output.name)
            output.write(manifest.model_dump_json(indent=2, by_alias=True) + "\n")
        temporary.replace(workspace / "capture.json")
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _get_json(
    session: requests.Session,
    handler: str,
    params: dict[str, str],
) -> JsonValue:
    """Read a bounded source response and reject HTML masquerading as JSON."""
    response = session.get(BASE_URL + "tools/" + handler, params=params, timeout=30)
    response.raise_for_status()
    try:
        return JSON.validate_python(response.json())
    except ValueError as error:
        msg = "FMS did not return source metadata; sign in again"
        raise SourceError(msg) from error


def _validate_svg(content: bytes, group_id: str = "fmsWrapper") -> None:
    """Accept FMS SVG fragments/documents; reject HTML and unsafe XML."""
    try:
        root = ElementTree.fromstring(content)
    except (ParseError, DefusedXmlException) as error:
        msg = "FMS did not return a valid SVG drawing"
        raise SourceError(msg) from error
    tag = root.tag.rsplit("}", 1)[-1]
    if tag != "svg" and not (tag == "g" and root.get("id") == group_id):
        msg = "FMS returned a login/error page instead of a drawing; sign in again"
        raise SourceError(msg)
    shapes = {"path", "polygon", "polyline", "line"}
    if group_id != "fmsWrapper":
        shapes.add("text")
    if not any(e.tag.rsplit("}", 1)[-1] in shapes for e in root.iter()):
        msg = "FMS drawing contains no geometry"
        raise SourceError(msg)


def verified_floor(workspace: Path, floor: CapturedFloor) -> bool:
    """Check cached source bytes before treating a floor as reusable."""
    if (
        floor.status != "captured"
        or not floor.artifacts
        or floor.metadata is None
        or floor.drawing is None
        or floor.default_layers is None
    ):
        return False
    prefix = f"raw/fms/{floor.source.building}/{floor.source.level}/"
    required = {
        prefix + name for name in ("default.svg", "svg-info.json", "layer-catalog.json")
    }
    if not required.issubset(floor.artifacts):
        return False
    try:
        for name, digest in floor.artifacts.items():
            path = (workspace / name).resolve()
            if not path.is_relative_to(workspace.resolve()):
                return False
            content = path.read_bytes()
            if hashlib.sha256(content).hexdigest() != digest:
                return False
            if path.name == "default.svg":
                _validate_svg(content)
    except (OSError, ValueError):
        return False
    return True


def capture_floors(
    workspace: Path,
    sources: list[FloorSource],
    session: requests.Session,
    *,
    selection: CaptureSelection | None = None,
) -> CaptureManifest:
    """Capture a selection with explicit failures and verified drawing output."""
    if selection is None:
        selection = CaptureSelection(buildings={s.building: s.fms_id for s in sources})
    workspace.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = workspace / "capture.json"
    if path.exists():
        manifest = CaptureManifest.model_validate_json(path.read_bytes())
        if manifest.selection != selection or sorted(
            s.model_dump_json() for s in sources
        ) != sorted(f.source.model_dump_json() for f in manifest.floors):
            msg = "Capture selection changed; choose a new workspace"
            raise SourceError(msg)
    else:
        manifest = CaptureManifest(
            selection=selection, floors=[CapturedFloor(source=s) for s in sources],
        )
    for index, previous in enumerate(manifest.floors):
        if verified_floor(workspace, previous):
            continue
        floor = CapturedFloor(source=previous.source)
        manifest.floors[index] = floor
        try:
            _capture_floor(workspace, floor, session)
        except (requests.RequestException, SourceError, ValidationError) as error:
            floor.status = "failed"
            # Exception bodies from remote responses are deliberately never saved.
            floor.error = (
                str(error)
                if isinstance(error, SourceError)
                else "Invalid FMS floor metadata"
                if isinstance(error, ValidationError)
                else "FMS request failed; check connectivity/login and retry"
            )
        finally:
            _save_manifest(workspace, manifest)
    return manifest


def _capture_floor(
    workspace: Path,
    floor: CapturedFloor,
    session: requests.Session,
) -> None:
    """Read one source drawing and keep source errors separate from cache state."""
    data = _get_json(
        session,
        "getFloorInfo.ashx",
        {
            "Bldgcode": floor.source.fms_id,
            "Floorcode": floor.source.level,
            "QueryId": "_INITIAL",
            "rmid": "",
            "isReload": "true",
        },
    )
    if not isinstance(data, dict):
        msg = "FMS floor metadata is not an object"
        raise SourceError(msg)
    if data.get("allowed") not in (True, "true"):
        msg = "FMS denied access to the selected floor"
        raise SourceError(msg)
    if data.get("drawingExist") not in (True, "true"):
        floor.status = "missing"
        floor.error = "FMS reports no drawing for this floor"
        return
    info = FloorInfo.model_validate(data)
    params = {
        "floorId": info.floor_id,
        "svgFile": info.svg_file,
        "isRevit": str(info.is_revit).lower(),
    }
    layers = DefaultLayers.model_validate(
        _get_json(session, "getDefaultLayers.ashx", params),
    )
    response = session.get(
        BASE_URL + "tools/getDefaultLayersData.ashx",
        params={
            **params,
            "RoomBoundaryLayer": layers.boundary,
            "RoomTagLayer": layers.labels,
        },
        timeout=30,
    )
    response.raise_for_status()
    _validate_svg(response.content)
    _write_artifact(workspace, floor, "default.svg", response.content)
    floor.metadata = info
    floor.default_layers = layers
    _capture_layers(workspace, floor, session, params, layers)
    floor.captured_at = datetime.now(UTC)
    floor.status = "captured"


def _write_artifact(
    workspace: Path,
    floor: CapturedFloor,
    name: str,
    content: bytes,
) -> None:
    """Keep verified source bytes and their checksum together in the manifest."""
    relative = Path("raw/fms") / floor.source.building / floor.source.level / name
    target = workspace / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    floor.artifacts[relative.as_posix()] = hashlib.sha256(content).hexdigest()


def _capture_layers(
    workspace: Path,
    floor: CapturedFloor,
    session: requests.Session,
    params: dict[str, str],
    defaults: DefaultLayers,
) -> None:
    """Save actual SVG layers separately from the broad configured layer catalog."""
    # FMS returns {} if themeId is omitted, even for the initial drawing.
    data = _get_json(
        session,
        "getSvgInfo.ashx",
        {
            **params,
            "themeId": "",
            "RoomBoundaryLayer": defaults.boundary,
        },
    )
    drawing = SvgInfo.model_validate(data)
    _write_artifact(workspace, floor, "svg-info.json", json.dumps(data).encode())
    catalog = _get_json(session, "getLayers.ashx", {**params, "queryid": "_INITIAL"})
    if not isinstance(catalog, list):
        msg = "FMS did not return its layer catalog"
        raise SourceError(msg)
    _write_artifact(
        workspace,
        floor,
        "layer-catalog.json",
        json.dumps(catalog).encode(),
    )
    for layer in drawing.layers:
        if layer.name in (defaults.boundary, defaults.labels) or layer.name.startswith(
            "FMS",
        ):
            continue
        response = session.get(
            BASE_URL + "tools/getLayerDataFromSvg.ashx",
            params={
                **params,
                "layer": layer.name,
                "isExportPdfMode": "false",
                "isMergeToImage": "false",
                "layersNamesMergeToImage": "",
            },
            headers={"FMSHeader": "Built-in handler"},
            timeout=30,
        )
        response.raise_for_status()
        if not response.content.strip():
            floor.warnings.append(f"Source layer {layer.name} returned no geometry")
            continue
        _validate_svg(response.content, layer.name)
        _write_artifact(
            workspace,
            floor,
            "layer-" + quote(layer.name, safe="") + ".svg",
            response.content,
        )
    floor.drawing = drawing
