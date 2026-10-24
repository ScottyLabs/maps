# ruff: noqa: PT009
"""Saved source and placement export the application's existing JSON contracts."""

import json
import tempfile
import unittest
from pathlib import Path

from models.buildings import Buildings
from processor.generate import build_workspace
from processor.store import WorkspaceStore
from processor.working import GeographicPoint, Point, ReferencePlacement, SourceBuilding
from scraper.fms.capture import capture_floors
from tests.test_fms_capture import SOURCE, source_session
from tests.test_workspace import DRAWING


class GenerationTests(unittest.TestCase):
    """Exercise the agreed source/placement-to-canonical-JSON seam."""

    def test_reference_placement_exports_geographic_rooms_and_current_file_shapes(
        self,
    ) -> None:
        """A known ten-inch square projects east/north without SVG crop offsets."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "example"
            capture_floors(workspace, [SOURCE], source_session(DRAWING))
            store = WorkspaceStore(root)
            view = store.normalize("example")
            view.working.anchors["AN"] = ReferencePlacement(
                reference_floor="1",
                origin=Point(x=0, y=0),
                latitude=40,
                longitude=-80,
            )
            view.working.buildings["AN"] = SourceBuilding(
                name="Example Hall",
                label_position=GeographicPoint(latitude=40, longitude=-80),
                shapes=[
                    [
                        GeographicPoint(latitude=40, longitude=-80),
                        GeographicPoint(latitude=40.001, longitude=-80),
                        GeographicPoint(latitude=40, longitude=-79.999),
                        GeographicPoint(latitude=40, longitude=-80),
                    ],
                ],
                source_url="https://example.test/public-buildings",
            )
            store.save("example", view.working, expected_revision=view.revision)
            report = build_workspace(workspace)
            target = workspace / report.directory / "floorplans"
            Buildings.model_validate_json((target / "buildings.json").read_bytes())
            rooms = json.loads((target / "floorplans.json").read_text())
            room = next(iter(rooms["AN"]["1"].values()))
            self.assertEqual(room["name"], "101")
            self.assertEqual(room["floor"], {"buildingCode": "AN", "level": "1"})
            self.assertAlmostEqual(
                max(p["longitude"] for p in room["coordinates"][0]),
                -79.9999970019,
                places=9,
            )
            self.assertAlmostEqual(
                max(p["latitude"] for p in room["coordinates"][0]),
                40.0000022817,
                places=9,
            )
            self.assertEqual(
                set(report.files),
                {
                    "buildings.json",
                    "placements.json",
                    "floorplans.json",
                    "all-graph.json",
                    "osm-pois.json",
                },
            )
            graph = json.loads((target / "all-graph.json").read_text())
            self.assertNotIn("nodes", graph)
            self.assertTrue(
                any("door" in warning.lower() for warning in report.warnings),
            )
