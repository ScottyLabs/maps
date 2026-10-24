"""Verify a shared physical frame from separated, overlapping source footprints."""

from __future__ import annotations

from itertools import combinations
from typing import TYPE_CHECKING

from pydantic import BaseModel
from shapely.geometry import Polygon

if TYPE_CHECKING:
    from processor.working import WorkingFloor

# In metres after source normalization. A single repeated shaft is insufficient.
MIN_AREA = 0.25
MAX_DISTANCE = 0.25
MIN_OVERLAP = 0.85
MIN_SPAN = 3.0
MIN_MATCHES = 2


class LandmarkMatch(BaseModel):
    """Source-linked footprints and measured agreement, without room-type guesses."""

    reference_space: str
    candidate_space: str
    overlap: float
    boundary_error_metres: float


class FrameEvidence(BaseModel):
    """Evidence that one floor can reuse an already anchored physical frame."""

    reference_floor: str
    matches: list[LandmarkMatch]
    span_metres: float


def verified_frames(
    floors: dict[str, WorkingFloor],
    reference: str,
) -> dict[str, FrameEvidence]:
    """Propagate only verified frame relationships; never fit a guessed offset."""
    aligned: dict[str, FrameEvidence] = {}
    remaining = [level for level in floors if level != reference]
    checked: set[tuple[str, str]] = set()
    while remaining:
        progress = False
        for level in remaining[:]:
            for known in [reference, *aligned]:
                pair = (known, level)
                if pair in checked:
                    continue
                checked.add(pair)
                evidence = _compare(floors[known], floors[level], known)
                if evidence:
                    aligned[level] = evidence
                    remaining.remove(level)
                    progress = True
                    break
        if not progress:
            break
    return aligned


def _polygons(floor: WorkingFloor) -> dict[str, Polygon]:
    """Ignore unusable shapes as alignment evidence; generation validates rooms."""
    polygons = {}
    for key, space in floor.spaces.items():
        if not space.rings:
            continue
        polygon = Polygon(
            [(p.x, p.y) for p in space.rings[0]],
            [[(p.x, p.y) for p in ring] for ring in space.rings[1:]],
        )
        if polygon.is_valid and polygon.area >= MIN_AREA:
            polygons[key] = polygon
    return polygons


def _compare(
    reference: WorkingFloor,
    candidate: WorkingFloor,
    level: str,
) -> FrameEvidence | None:
    if (
        reference.fms_id != candidate.fms_id
        or reference.source_unit != candidate.source_unit
    ):
        return None
    left, right = _polygons(reference), _polygons(candidate)
    matches: list[LandmarkMatch] = []
    for first, polygon in left.items():
        possible = []
        for second, other in right.items():
            if polygon.centroid.distance(other.centroid) > MAX_DISTANCE:
                continue
            overlap = polygon.intersection(other).area / polygon.union(other).area
            error = polygon.hausdorff_distance(other)
            if overlap >= MIN_OVERLAP and error <= MAX_DISTANCE:
                possible.append(
                    LandmarkMatch(
                        reference_space=first,
                        candidate_space=second,
                        overlap=overlap,
                        boundary_error_metres=error,
                    ),
                )
        if len(possible) == 1:
            matches.extend(possible)
    # Require one-to-one matches, rather than count repeated/ambiguous pieces.
    matches = [
        match
        for match in matches
        if sum(other.candidate_space == match.candidate_space for other in matches) == 1
    ]
    if len(matches) < MIN_MATCHES:
        return None
    span = max(
        left[a.reference_space].centroid.distance(left[b.reference_space].centroid)
        for a, b in combinations(matches, 2)
    )
    if span < MIN_SPAN:
        return None
    return FrameEvidence(reference_floor=level, matches=matches, span_metres=span)
