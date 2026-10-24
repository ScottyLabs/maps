# ruff: noqa: PT009, PT027
"""Captured source to editable working data, without legacy processed JSONs."""

import tempfile
import unittest
from pathlib import Path

from shapely.geometry import Polygon

from processor.store import EditConflictError, WorkspaceStore
from processor.workspace import normalize_workspace, save_working
from scraper.fms.capture import capture_floors
from tests.test_fms_capture import SOURCE, source_session

DRAWING = """<g id="fmsWrapper" transform="translate(0,10)">
<g id="A-AREA"><path d="M0,0 H10 V-10 H0 Z"/>
<path h="boundary-1" d="M0,0 H10 V-10 H0 Z"/></g>
<g id="A-AREA-IDEN"><text h="tag-1" x="5" y="-5">101</text></g>
</g>"""


class WorkingDataTests(unittest.TestCase):
    """Exercise the saved-source/working-JSON seam used by CLI and visualizer."""

    def test_normalize_removes_rendering_duplicates_and_uses_physical_units(
        self,
    ) -> None:
        """A ten-inch source area stays 0.254 metres wide after SVG transforms."""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(workspace, [SOURCE], source_session(DRAWING))
            working = normalize_workspace(workspace)
            floor = working.floors["AN"]["1"]
            self.assertEqual(len(floor.spaces), 1)
            room = next(iter(floor.spaces.values()))
            self.assertEqual(room.name, "101")
            self.assertEqual(room.source_handles, ["boundary-1"])
            self.assertAlmostEqual(max(p.x for p in room.rings[0]), 0.254)
            self.assertAlmostEqual(max(p.y for p in room.rings[0]), 0.254)
            self.assertTrue((workspace / "working.json").is_file())

    def test_hole_labels_are_not_assigned_and_ambiguous_rooms_stay_unnamed(
        self,
    ) -> None:
        """Containment respects holes and never picks one of several room tags."""
        drawing = """<g id="fmsWrapper" transform="translate(0,10)">
        <g id="A-AREA" fill-rule="evenodd"><path h="hollow"
          d="M0,0 H10 V-10 H0 Z M4,-4 H6 V-6 H4 Z"/></g>
        <g id="A-AREA-IDEN">
          <text x="1" y="-1">101</text><text x="2" y="-2">102</text>
          <text x="5" y="-5">COURTYARD</text></g></g>"""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(workspace, [SOURCE], source_session(drawing))
            floor = normalize_workspace(workspace).floors["AN"]["1"]
            room = next(iter(floor.spaces.values()))
            self.assertEqual(len(room.rings), 2)
            self.assertEqual(room.name, "")
            self.assertTrue(room.warnings)
            courtyard = next(
                label for label in floor.labels if label.text == "COURTYARD"
            )
            self.assertEqual(courtyard.candidates, [])

    def test_self_crossing_svg_uses_fill_rule_instead_of_dropping_the_space(
        self,
    ) -> None:
        """The two filled faces of a bow-tie are retained as source-linked pieces."""
        drawing = """<g id="fmsWrapper"><g id="A-AREA">
        <path h="crossing" d="M0,0 L10,10 L0,10 L10,0 Z"/>
        </g><g id="A-AREA-IDEN"/></g>"""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(workspace, [SOURCE], source_session(drawing))
            floor = normalize_workspace(workspace).floors["AN"]["1"]
            self.assertEqual(len(floor.spaces), 2)
            self.assertTrue(
                all(s.source_handles == ["crossing"] for s in floor.spaces.values()),
            )

    def test_normalization_preserves_saved_room_corrections(self) -> None:
        """Reopening a workspace does not re-extract over an operator's edits."""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(workspace, [SOURCE], source_session(DRAWING))
            working = normalize_workspace(workspace)
            room = next(iter(working.floors["AN"]["1"].spaces.values()))
            room.name = "Reviewed room"
            save_working(workspace, working)
            reopened = normalize_workspace(workspace)
            self.assertEqual(
                reopened.floors["AN"]["1"].spaces[room.id].name,
                "Reviewed room",
            )

    def test_curved_room_boundary_preserves_its_area(self) -> None:
        """A quarter circle of ten-inch radius keeps its physical footprint."""
        drawing = """<g id="fmsWrapper"><g id="A-AREA">
          <path h="curved" d="M0,0 L10,0 A10,10 0 0,1 0,10 Z"/>
          </g><g id="A-AREA-IDEN"/></g>"""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(workspace, [SOURCE], source_session(drawing))
            floor = normalize_workspace(workspace).floors["AN"]["1"]
            room = next(iter(floor.spaces.values()))
            footprint = Polygon([(p.x, p.y) for p in room.rings[0]])
            self.assertAlmostEqual(footprint.area, 0.050671, delta=0.001)

    def test_stale_editor_cannot_overwrite_newer_saved_corrections(self) -> None:
        """Conflicting saves preserve the already saved working JSON."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "example"
            capture_floors(workspace, [SOURCE], source_session(DRAWING))
            store = WorkspaceStore(root)
            first = store.normalize("example")
            stale = store.read("example")
            room_id = next(iter(first.working.floors["AN"]["1"].spaces))
            first.working.floors["AN"]["1"].spaces[room_id].name = "Saved correction"
            store.save("example", first.working, expected_revision=first.revision)
            with self.assertRaises(EditConflictError):
                store.save("example", stale.working, expected_revision=stale.revision)
            self.assertEqual(
                store.read("example").working.floors["AN"]["1"].spaces[room_id].name,
                "Saved correction",
            )
