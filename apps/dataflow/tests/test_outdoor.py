# ruff: noqa: PT009, PT027, SLF001
"""Public source capture through the same canonical generation/import path."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

import requests

from deserializer.bundle import serialize_candidate
from processor.generate import build_workspace
from processor.store import WorkspaceStore
from processor.working import GeographicPoint, Point, ReferencePlacement, SourceBuilding
from scraper.fms.capture import SourceError, capture_floors
from scraper.outdoor import fetch_outdoor
from tests.test_fms_capture import SOURCE, source_session
from tests.test_workspace import DRAWING


class OutdoorTests(unittest.TestCase):
    """Keep public paths/POIs distinct from unavailable indoor evidence."""

    def test_public_paths_and_pois_export_without_private_or_unlocated_indoor_links(
        self,
    ) -> None:
        """A two-node public footway imports two edges; private/indoor ways do not."""
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory) / "outdoor-example"
            capture_floors(workspace, [SOURCE], source_session(DRAWING))
            store = WorkspaceStore(workspace.parent)
            view = store.normalize(workspace.name)
            view.working.anchors["AN"] = ReferencePlacement(
                reference_floor="1",
                origin=Point(x=0, y=0),
                latitude=40,
                longitude=-80,
            )
            view.working.buildings["AN"] = SourceBuilding(
                name="Example Hall",
                label_position=GeographicPoint(latitude=40, longitude=-80),
                shapes=[],
                source_url="https://example.test/buildings",
            )
            store.save(workspace.name, view.working, expected_revision=view.revision)
            session = Mock(spec=requests.Session)
            response = requests.Response()
            response.status_code = 200
            response._content = json.dumps(
                {
                    "elements": [
                        {"type": "node", "id": 1, "lat": 40, "lon": -80},
                        {"type": "node", "id": 2, "lat": 40, "lon": -79.9999},
                        {
                            "type": "node",
                            "id": 3,
                            "lat": 40.0001,
                            "lon": -80,
                            "tags": {"amenity": "bicycle_parking"},
                        },
                        {"type": "node", "id": 4, "lat": 40.0002, "lon": -80},
                        {
                            "type": "way",
                            "id": 10,
                            "nodes": [1, 2],
                            "tags": {"highway": "footway"},
                        },
                        {
                            "type": "way",
                            "id": 11,
                            "nodes": [2, 4],
                            "tags": {"highway": "footway", "access": "private"},
                        },
                        {
                            "type": "way",
                            "id": 13,
                            "nodes": [1, 2, 4, 1],
                            "tags": {"highway": "pedestrian", "area": "yes"},
                        },
                        {
                            "type": "way",
                            "id": 12,
                            "nodes": [1, 4],
                            "tags": {
                                "highway": "corridor",
                                "indoor": "yes",
                                "level": "2",
                            },
                        },
                    ],
                },
            ).encode()
            session.get.return_value = response
            fetch_outdoor(workspace, session)
            report = build_workspace(workspace)
            payload = serialize_candidate(workspace, report.revision)
            self.assertEqual(len(payload.tables["Edge"]), 2)
            self.assertEqual(len(payload.tables["Node"]), 3)
            self.assertEqual(payload.tables["Poi"][0]["type"], "Bike Rack")
            saved = (workspace / "working.json").read_bytes()
            offline = Mock(spec=requests.Session)
            offline.get.side_effect = requests.ConnectionError("Offline")
            fetch_outdoor(workspace, offline)
            offline.get.assert_not_called()
            response._content = (
                b'{"remark":"runtime error: Query timed out","elements":[]}'
            )
            with self.assertRaisesRegex(SourceError, "incomplete"):
                fetch_outdoor(workspace, session, refresh=True)
            self.assertEqual((workspace / "working.json").read_bytes(), saved)
