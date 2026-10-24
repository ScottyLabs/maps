"""One saved-source to editable-JSON workflow for the CLI and visualizer."""

from __future__ import annotations

import hashlib
import tempfile
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from shapely.geometry import MultiPolygon, Polygon

from processor.svg import (
    boundary_geometry,
    drawing_elements,
    label_point,
    layer_elements,
)
from processor.working import Point as WorkingPoint
from processor.working import SourceLabel, Space, WorkingDataset, WorkingFloor
from scraper.fms.capture import (
    CapturedFloor,
    CaptureManifest,
    SourceError,
    verified_floor,
)


def save_working(workspace: Path, working: WorkingDataset) -> None:
    """Save edited working JSON atomically; never mutate the derived database."""
    target = workspace / "working.json"
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            dir=workspace,
            encoding="utf-8",
            delete=False,
        ) as output:
            temporary = Path(output.name)
            output.write(working.model_dump_json(indent=2) + "\n")
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def normalize_workspace(workspace: Path, *, replace: bool = False) -> WorkingDataset:
    """Normalize verified captures once; preserve saved edits on ordinary reruns."""
    raw = (workspace / "capture.json").read_bytes()
    capture = CaptureManifest.model_validate_json(raw)
    digest = hashlib.sha256(raw).hexdigest()
    saved = workspace / "working.json"
    if saved.exists() and not replace:
        working = WorkingDataset.model_validate_json(saved.read_bytes())
        if working.capture_digest != digest:
            msg = "Capture changed; explicitly replace working data to re-extract"
            raise SourceError(msg)
        return working
    floors: dict[str, dict[str, WorkingFloor]] = {}
    for floor in capture.floors:
        if not verified_floor(workspace, floor):
            msg = (
                f"Unverified source {floor.source.building}/{floor.source.level}; "
                "resume capture first"
            )
            raise SourceError(msg)
        floors.setdefault(floor.source.building, {})[floor.source.level] = (
            _normalize_floor(workspace, floor)
        )
    if not floors:
        msg = "No captured floors to normalize"
        raise SourceError(msg)
    working = WorkingDataset(capture_digest=digest, floors=floors)
    save_working(workspace, working)
    return working


def _normalize_floor(workspace: Path, floor: CapturedFloor) -> WorkingFloor:
    elements, boundary, labels = drawing_elements(workspace, floor)
    # Rendering copies may lack handles; merge geometry before selecting identities.
    geometries: dict[str, tuple[Polygon | MultiPolygon, set[str]]] = {}
    warnings = []
    for element, matrix in layer_elements(elements, boundary, "path"):
        try:
            geometry = boundary_geometry(element, matrix)
        except SourceError as error:
            warnings.append(f"Boundary {element.get('h', '(unidentified)')}: {error}")
            continue
        signature = geometry.wkb_hex
        if signature not in geometries:
            geometries[signature] = (geometry, set())
        handle = element.get("h")
        if handle:
            geometries[signature][1].add(handle)
    spaces, shapes = _spaces(floor, geometries)
    source_labels = []
    for element, matrix in layer_elements(elements, labels, "text"):
        text = " ".join("".join(element.itertext()).split())
        if not text:
            continue
        position = label_point(element, matrix)
        candidates = [
            room_id for room_id, polygon in shapes.items() if polygon.covers(position)
        ]
        source_labels.append(
            SourceLabel(
                text=text,
                position=WorkingPoint(x=position.x, y=position.y),
                source_handle=element.get("h"),
                candidates=candidates,
            ),
        )
    _associate_labels(spaces, source_labels)
    unmatched = sum(not label.candidates for label in source_labels)
    if unmatched:
        warnings.append(f"{unmatched} source labels outside all boundary candidates")
    warnings.append("Space boundaries are not verified walls or door connections")
    return WorkingFloor(
        fms_id=floor.source.fms_id,
        source_unit=floor.metadata.area_unit if floor.metadata else "",
        spaces=spaces,
        labels=source_labels,
        warnings=warnings,
    )


def _spaces(
    floor: CapturedFloor,
    geometries: dict[str, tuple[Polygon | MultiPolygon, set[str]]],
) -> tuple[dict[str, Space], dict[str, Polygon]]:
    """Assign source-linked identities after rendering duplicates are removed."""
    spaces: dict[str, Space] = {}
    shapes: dict[str, Polygon] = {}
    for signature, (geometry, handles) in geometries.items():
        parts = (
            list(geometry.geoms) if isinstance(geometry, MultiPolygon) else [geometry]
        )
        for index, polygon in enumerate(parts):
            identity = (
                ",".join(sorted(handles))
                or hashlib.sha256(signature.encode()).hexdigest()
            )
            room_id = str(
                uuid5(
                    NAMESPACE_URL,
                    f"fms/{floor.source.fms_id}/{floor.source.level}/{identity}/{index}",
                ),
            )
            anchor = polygon.representative_point()
            issues = []
            if len(parts) > 1:
                issues.append("Source boundary has disconnected filled pieces; review")
            if not handles:
                issues.append("Source boundary has no entity handle; review")
            spaces[room_id] = Space(
                id=room_id,
                warnings=issues,
                source_handles=sorted(handles),
                rings=[
                    [WorkingPoint(x=x, y=y) for x, y in ring.coords]
                    for ring in [polygon.exterior, *polygon.interiors]
                ],
                label_position=WorkingPoint(x=anchor.x, y=anchor.y),
            )
            shapes[room_id] = polygon
    return spaces, shapes


def _associate_labels(spaces: dict[str, Space], labels: list[SourceLabel]) -> None:
    """Only a one-to-one containment match supplies an automatic name."""
    for room_id, space in spaces.items():
        matches = [label for label in labels if room_id in label.candidates]
        if len(matches) == 1 and matches[0].candidates == [room_id]:
            space.name = matches[0].text
            space.label_position = matches[0].position
        else:
            space.warnings.append(
                "Ambiguous or missing source label; review in visualizer",
            )
