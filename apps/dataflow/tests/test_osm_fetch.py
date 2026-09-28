# ruff: noqa: S101
"""Offline checks for the public OSM source fetchers."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import requests

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from scraper.esim.fetch_osm_data import (
    CMU_OVERPASS_QUERY,
    fetch_osm_data,
)
from scraper.esim.fetch_osm_data import OVERPASS_URL as RAW_OVERPASS_URL
from scraper.esim.fetch_osm_data import USER_AGENT as RAW_USER_AGENT
from scraper.osm.osm_to_osm_outside_json import OVERPASS_URL as GRAPH_OVERPASS_URL
from scraper.osm.osm_to_osm_outside_json import USER_AGENT as GRAPH_USER_AGENT
from scraper.osm.osm_to_osm_outside_json import query_osm


def test_raw_osm_fetch_writes_nested_output_and_uses_overpass() -> None:
    """Fetch raw OSM XML over HTTPS and create the requested output directory."""
    response = Mock()
    response.text = "<osm version='0.6'/>"
    with tempfile.TemporaryDirectory() as temporary_directory:
        output_path = Path(temporary_directory) / "snapshots" / "campus.osm"
        with patch(
            "scraper.esim.fetch_osm_data.requests.post",
            return_value=response,
        ) as post:
            fetch_osm_data(output_path)

        assert output_path.read_text(encoding="utf-8") == response.text
        post.assert_called_once_with(
            RAW_OVERPASS_URL,
            data={
                "data": f"[out:xml][timeout:60];{CMU_OVERPASS_QUERY}"
                "out body;>;out skel qt;",
            },
            headers={"User-Agent": RAW_USER_AGENT},
            timeout=75,
        )


def test_outside_graph_fetch_uses_expected_query_and_returns_xml() -> None:
    """Fetch the campus graph query without making a real network request."""
    response = Mock()
    response.text = "<osm version='0.6'><node id='1'/></osm>"
    with patch(
        "scraper.osm.osm_to_osm_outside_json.requests.post",
        return_value=response,
    ) as post:
        xml = query_osm(max_attempt_count=1)

    assert xml == response.text
    post.assert_called_once_with(
        GRAPH_OVERPASS_URL,
        data={
            "data": "[out:xml][timeout:60];"
            "nwr(40.440278,-79.951806,40.451722,-79.933778);"
            "out body;>;out skel qt;",
        },
        headers={"User-Agent": GRAPH_USER_AGENT},
        timeout=75,
    )


def test_outside_graph_fetch_retries_request_errors() -> None:
    """Retry transient request errors and return the next successful response."""
    response = Mock()
    response.text = "<osm/>"
    attempts = 2
    with (
        patch(
            "scraper.osm.osm_to_osm_outside_json.requests.post",
            side_effect=[requests.ConnectionError(), response],
        ) as post,
    ):
        assert query_osm(max_attempt_count=attempts) == response.text

    assert post.call_count == attempts


if __name__ == "__main__":
    for test in (
        test_raw_osm_fetch_writes_nested_output_and_uses_overpass,
        test_outside_graph_fetch_uses_expected_query_and_returns_xml,
        test_outside_graph_fetch_retries_request_errors,
    ):
        test()
    print("3 OSM fetch checks passed")  # noqa: T201
