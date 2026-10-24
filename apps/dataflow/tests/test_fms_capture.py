# ruff: noqa: PT009, PT027
"""FMS capture contract: only verified drawings become reusable source artifacts."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from urllib.parse import urlsplit

import requests

from scraper.fms.capture import (
    CaptureManifest,
    CaptureSelection,
    FloorSource,
    SourceError,
    capture_floors,
)

FLOOR_INFO = {
    "floorId": "floor-1",
    "svgFile": "drawing.svg",
    "drawingExist": "true",
    "allowed": "true",
    "isRevit": "false",
    "xmin": "0",
    "xmax": "10",
    "ymin": "0",
    "ymax": "10",
    "areaUnit": "SF",
}
DEFAULT_LAYERS = {"RoomBoundaryLayer": "A-AREA", "RoomTagLayer": "A-AREA-IDEN"}
DRAWING = (
    '<g id="fmsWrapper" viewBox="0 0 10 10"><g id="A-AREA">'
    '<path h="room-1" d="M0,0 L10,0 L10,10 L0,0"/></g></g>'
)
SOURCE = FloorSource(
    building="AN",
    fms_id="116",
    level="1",
    url="https://fmsystems.cmu.edu/FMInteract/ShowDrawing.aspx?bldgcode=116&floorcode=1",
)


def source_session(svg: str, *, interrupt_layer: bool = False) -> requests.Session:
    """Supply source responses at the external HTTP boundary."""
    session = Mock(spec=requests.Session)

    def respond(
        url: str,
        *,
        params: dict[str, str],
        **_kwargs: object,
    ) -> requests.Response:
        handler = urlsplit(url).path.rsplit("/", 1)[-1]
        bodies = {
            "getFloorInfo.ashx": FLOOR_INFO,
            "getDefaultLayers.ashx": DEFAULT_LAYERS,
            "getDefaultLayersData.ashx": svg,
            "getSvgInfo.ashx": {
                "viewBox": "0 0 10 10",
                "layers": [{"layerName": "A-AREA"}, {"layerName": "A-SPAC-IDEN-RMNO"}],
            },
            "getLayers.ashx": [{"layerName": "A-SPAC-IDEN-RMNO", "display": "visible"}],
            "getLayerDataFromSvg.ashx": (
                '<g id="A-SPAC-IDEN-RMNO"><text x="1" y="1">101</text></g>'
            ),
        }
        if handler == "getLayerDataFromSvg.ashx" and interrupt_layer:
            raise KeyboardInterrupt
        body = bodies[handler]
        if handler == "getSvgInfo.ashx" and (params.get("themeId") != ""):
            body = {}
        response = requests.Response()
        response.status_code = 200
        response._content = (  # noqa: SLF001
            body if isinstance(body, str) else json.dumps(body)
        ).encode()
        return response

    session.get.side_effect = respond
    return session


class CaptureTests(unittest.TestCase):
    """Exercise saved capture output with an external FMS response boundary."""

    def test_login_html_is_incomplete_and_is_never_saved_as_svg(self) -> None:
        """An HTTP 200 login response must not masquerade as a captured floor."""
        session = source_session("<html><body>Please sign in</body></html>")
        with tempfile.TemporaryDirectory() as directory:
            report = capture_floors(Path(directory), [SOURCE], session)
            self.assertFalse(report.complete)
            self.assertIn("drawing", report.floors[0].error or "")
            self.assertFalse(list(Path(directory).rglob("*.svg")))

    def test_verified_capture_can_be_reused_when_fms_is_offline(self) -> None:
        """Resume uses the saved source, so processing does not require login."""
        offline = Mock(spec=requests.Session)
        offline.get.side_effect = requests.ConnectionError("Source is offline")
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            first = capture_floors(workspace, [SOURCE], source_session(DRAWING))
            self.assertTrue(first.complete)
            resumed = capture_floors(workspace, [SOURCE], offline)
            self.assertTrue(resumed.complete)
            self.assertEqual(
                (workspace / "raw/fms/AN/1/default.svg").read_text(),
                DRAWING,
            )

    def test_capture_keeps_source_bounds_and_additional_label_layers(self) -> None:
        """Source-scale metadata and labels are available for offline generation."""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            report = capture_floors(workspace, [SOURCE], source_session(DRAWING))
            self.assertTrue(report.complete)
            artifacts = report.floors[0].artifacts
            self.assertIn("raw/fms/AN/1/svg-info.json", artifacts)
            self.assertIn("raw/fms/AN/1/layer-A-SPAC-IDEN-RMNO.svg", artifacts)
            metadata = report.floors[0].metadata
            self.assertIsNotNone(metadata)
            if metadata is not None:
                self.assertEqual(metadata.area_unit, "SF")
                self.assertEqual(metadata.xmax, 10)

    def test_interrupted_retry_does_not_leave_a_complete_manifest(self) -> None:
        """A partially replaced capture must be retried rather than reused."""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(workspace, [SOURCE], source_session(DRAWING))
            (workspace / "raw/fms/AN/1/default.svg").write_text("corrupt cache")
            with self.assertRaises(KeyboardInterrupt):
                capture_floors(
                    workspace,
                    [SOURCE],
                    source_session(DRAWING, interrupt_layer=True),
                )
            saved = CaptureManifest.model_validate_json(
                (workspace / "capture.json").read_bytes(),
            )
            self.assertFalse(saved.complete)

    def test_resuming_cannot_expand_a_bounded_selection_silently(self) -> None:
        """Dropping --floor must not make a one-floor capture look like all floors."""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(
                workspace,
                [SOURCE],
                source_session(DRAWING),
                selection=CaptureSelection(buildings={"AN": "116"}, levels=["1"]),
            )
            with self.assertRaisesRegex(SourceError, "selection changed"):
                capture_floors(
                    workspace,
                    [SOURCE],
                    source_session(DRAWING),
                    selection=CaptureSelection(buildings={"AN": "116"}),
                )
