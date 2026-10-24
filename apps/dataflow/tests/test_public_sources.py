# ruff: noqa: PT009
"""Fresh public building metadata is joined by source ID, never legacy codes."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

import requests

from processor.workspace import normalize_workspace
from scraper.fms.capture import capture_floors
from scraper.public import fetch_buildings
from tests.test_fms_capture import DRAWING, SOURCE, source_session


class PublicSourcesTests(unittest.TestCase):
    """Exercise public HTTP acquisition through the saved workspace result."""

    def test_fms_id_selects_official_footprint_without_changing_app_code(self) -> None:
        """The GIS abbreviation AH must not silently replace the requested AN."""
        session = Mock(spec=requests.Session)
        responses = []
        for data in [
            {"url": "https://services.arcgis.com/public/FeatureServer"},
            {
                "layers": [
                    {
                        "id": 2,
                        "name": "Buildings",
                        "geometryType": "esriGeometryPolygon",
                    },
                ],
            },
            {
                "features": [
                    {
                        "properties": {
                            "BuildingID_Numeric_2": 116,
                            "Long_Name": "ANSYS Hall",
                            "Sign_Abbrev": "AH",
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [[-80, 40], [-79.99, 40], [-79.99, 40.01], [-80, 40]],
                            ],
                        },
                    },
                ],
            },
        ]:
            response = Mock(spec=requests.Response)
            response.json.return_value = data
            responses.append(response)
        session.get.side_effect = responses
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            capture_floors(workspace, [SOURCE], source_session(DRAWING))
            normalize_workspace(workspace)
            working = fetch_buildings(workspace, session)
            self.assertEqual(working.buildings["AN"].name, "ANSYS Hall")
            self.assertEqual(
                working.buildings["AN"].label_position.latitude, 40.00333333333333,
            )
            self.assertTrue(
                (workspace / "raw/public/arcgis-buildings.geojson").exists(),
            )
