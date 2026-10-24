"""Normalize FMS SVG boundaries and text into the source's physical frame."""

from __future__ import annotations

import math
from itertools import pairwise
from typing import TYPE_CHECKING

import numpy as np
from defusedxml import ElementTree
from numpy.typing import NDArray
from shapely.geometry import LinearRing, MultiPolygon, Point, Polygon
from shapely.ops import polygonize, unary_union
from svgpathtools import Line, parse_path
from svgpathtools.parser import parse_transform

from scraper.fms.capture import CapturedFloor, SourceError

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path
    from xml.etree.ElementTree import Element

Matrix = NDArray[np.float64]
# FMS's own svgDistance2Real conversion: SF lengths are inches, not feet.
METRES = {"SF": 0.0254, "MM": 0.001, "M2": 1.0}
CURVE_STEP_METRES = 0.02
MAX_CURVE_STEPS = 100_000


def _elements(
    root: Element,
    parent: Matrix,
    fill_rule: str = "nonzero",
) -> Iterator[tuple[Element, Matrix]]:
    """Compose ancestors before descendants; definitions are not rendered spaces."""
    if root.tag.rsplit("}", 1)[-1] in {"defs", "clipPath", "mask"}:
        return
    styles = dict(
        item.split(":", 1) for item in root.get("style", "").split(";") if ":" in item
    )
    fill_rule = styles.get("fill-rule", root.get("fill-rule", fill_rule)).strip()
    root.set("fill-rule", fill_rule)
    matrix = parent @ parse_transform(root.get("transform"), strict=True)
    yield root, matrix
    for child in root:
        yield from _elements(child, matrix, fill_rule)


def drawing_elements(
    workspace: Path,
    floor: CapturedFloor,
) -> tuple[list[tuple[Element, Matrix]], str, str]:
    """Read a verified default drawing and compose SVG-to-metre normalization."""
    info, drawing, layers = floor.metadata, floor.drawing, floor.default_layers
    if info is None or drawing is None or layers is None:
        msg = "Missing source metadata; capture this floor first"
        raise SourceError(msg)
    if info.is_revit:
        msg = "Revit coordinates require a verified unit adapter; floor not normalized"
        raise SourceError(msg)
    unit = METRES.get(info.area_unit)
    if unit is None:
        msg = f"Unsupported FMS unit {info.area_unit}"
        raise SourceError(msg)
    values = [float(v) for v in drawing.view_box.replace(",", " ").split()]
    if len(values) != 4:  # noqa: PLR2004
        msg = "Invalid source view box"
        raise SourceError(msg)
    vx, vy, width, height = values
    if width <= 0 or height <= 0 or info.xmax <= info.xmin or info.ymax <= info.ymin:
        msg = "Source drawing has invalid physical/SVG bounds"
        raise SourceError(msg)
    sx = (info.xmax - info.xmin) / width
    sy = (info.ymax - info.ymin) / height
    normalization = unit * np.array(
        [
            [sx, 0, info.xmin - sx * vx],
            [0, -sy, info.ymin + sy * (vy + height)],
            [0, 0, 1 / unit],
        ],
    )
    source = floor.source
    root = ElementTree.parse(
        workspace / "raw/fms" / source.building / source.level / "default.svg",
    ).getroot()
    if root is None:
        msg = "Source drawing has no XML root"
        raise SourceError(msg)
    return list(_elements(root, normalization)), layers.boundary, layers.labels


def _point(value: complex, matrix: Matrix) -> tuple[float, float]:
    result = matrix @ np.array([value.real, value.imag, 1.0])
    return float(result[0]), float(result[1])


def boundary_geometry(element: Element, matrix: Matrix) -> Polygon | MultiPolygon:
    """Preserve closed subpaths and SVG fill rules, sampling curves in metres."""
    rings = _path_rings(element.get("d", ""), matrix)
    if not rings:
        msg = "Degenerate source boundary has no area"
        raise SourceError(msg)
    return _fill_rings(rings, evenodd=element.get("fill-rule") == "evenodd")


def _path_rings(data: str, matrix: Matrix) -> list[LinearRing]:
    """Flatten each continuous source subpath, keeping its original winding."""
    path = parse_path(data)
    rings: list[LinearRing] = []
    for subpath in path.continuous_subpaths():
        if not subpath.isclosed():
            msg = "Open source boundary requires review"
            raise SourceError(msg)
        points = [_point(subpath.start, matrix)]
        for segment in subpath:
            steps = 1
            if not isinstance(segment, Line):
                scale = float(np.linalg.norm(matrix[:2, :2], ord=2))
                steps = max(1, math.ceil(segment.length() * scale / CURVE_STEP_METRES))
                if steps > MAX_CURVE_STEPS:
                    msg = "Curve exceeds the normalization sampling limit"
                    raise SourceError(msg)
            points.extend(
                _point(segment.point(i / steps), matrix) for i in range(1, steps + 1)
            )
        if len(set(points)) < 3:  # noqa: PLR2004
            continue
        rings.append(LinearRing(points))
    return rings


def _fill_rings(rings: list[LinearRing], *, evenodd: bool) -> Polygon | MultiPolygon:
    """Combine nested subpaths according to the SVG's inherited fill rule."""
    faces = polygonize(unary_union(rings))
    filled = []
    for face in faces:
        test = face.representative_point()
        winding = sum(_winding(ring, test) for ring in rings)
        filled_face = winding % 2 != 0 if evenodd else winding != 0
        if filled_face:
            filled.append(face)
    result = unary_union(filled)
    if not isinstance(result, (Polygon, MultiPolygon)) or result.is_empty:
        msg = "Source boundary contains no filled polygon"
        raise SourceError(msg)
    return result.normalize()


def _winding(ring: LinearRing, point: Point) -> int:
    """Count signed ray crossings, including self-touching CAD contours."""
    winding = 0
    coordinates = list(ring.coords)
    for (ax, ay), (bx, by) in pairwise(coordinates):
        cross = (bx - ax) * (point.y - ay) - (point.x - ax) * (by - ay)
        if ay <= point.y < by and cross > 0:
            winding += 1
        elif by <= point.y < ay and cross < 0:
            winding -= 1
    return winding


def layer_elements(
    elements: list[tuple[Element, Matrix]],
    layer: str,
    tag: str,
) -> Iterator[tuple[Element, Matrix]]:
    """Return drawing elements in the configured layer role, with inherited fill."""
    members: set[Element] = set()
    for element, _matrix in elements:
        if element.get("id") == layer:
            members.update(element.iter())
    for element, matrix in elements:
        if element in members and element.tag.rsplit("}", 1)[-1] == tag:
            yield element, matrix


def label_point(element: Element, matrix: Matrix) -> Point:
    """Locate the source text anchor after its inherited transforms."""
    x = float(element.get("x", "0"))
    y = float(element.get("y", "0"))
    return Point(_point(complex(x, y), matrix))
