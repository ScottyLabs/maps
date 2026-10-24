"""Editable source-frame data, before geographic export to application schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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


class WorkingDataset(WorkingModel):
    """The saved editable state, shared by every pipeline entry point."""

    version: Literal[1] = 1
    capture_digest: str
    floors: dict[str, dict[str, WorkingFloor]]
