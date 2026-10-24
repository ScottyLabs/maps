"""Editable source-frame data, before geographic export to application schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from models.pois import Poi  # noqa: TC001


class WorkingModel(BaseModel):
    """Reject unknown fields and non-finite coordinates in saved edits."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Point(WorkingModel):
    """A point in the physical drawing frame: metres, x right and y up."""

    x: float
    y: float


class SourceLabel(WorkingModel):
    """A source label retained even when its room association is uncertain."""

    text: str
    position: Point
    source_handle: str | None = None
    candidates: list[str] = Field(default_factory=list)


class Space(WorkingModel):
    """Editable source space; a polygon alone does not prove physical walls."""

    id: str
    source_handles: list[str]
    rings: list[list[Point]]
    name: str = ""
    type: str = ""
    aliases: list[str] = Field(default_factory=list)
    label_position: Point
    warnings: list[str] = Field(default_factory=list)


class WorkingFloor(WorkingModel):
    """Spaces and unresolved labels in one floor's physical frame."""

    fms_id: str
    source_unit: str
    spaces: dict[str, Space]
    labels: list[SourceLabel]
    warnings: list[str] = Field(default_factory=list)


class ReferencePlacement(WorkingModel):
    """One manual geographic anchor for a building's physical drawing frame."""

    reference_floor: str
    origin: Point
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    angle: float = 0
    scale: float = Field(default=1, gt=0)


class GeographicPoint(WorkingModel):
    """Geographic location in degrees, distinct from drawing-frame metres."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class SourceBuilding(WorkingModel):
    """Fresh public name and footprint associated through the FMS identifier."""

    name: str
    label_position: GeographicPoint
    shapes: list[list[GeographicPoint]]
    source_url: str
    source_abbreviation: str | None = None


class OutdoorWay(WorkingModel):
    """An OSM path with source tags retained for access/connector review."""

    id: str
    nodes: list[str]
    tags: dict[str, str]


class OutdoorData(WorkingModel):
    """A verified public snapshot, retained alongside editable indoor source data."""

    source_url: str
    query: str
    artifact_sha256: str
    artifact_path: str
    nodes: dict[str, GeographicPoint]
    ways: list[OutdoorWay]
    pois: dict[str, Poi]
    warnings: list[str] = Field(default_factory=list)


class WorkingDataset(WorkingModel):
    """The saved editable state, shared by every pipeline entry point."""

    version: Literal[1] = 1
    capture_digest: str
    floors: dict[str, dict[str, WorkingFloor]]
    anchors: dict[str, ReferencePlacement] = Field(default_factory=dict)
    buildings: dict[str, SourceBuilding] = Field(default_factory=dict)
    outdoor: OutdoorData | None = None
