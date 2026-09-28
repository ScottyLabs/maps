# ruff: noqa: S101
"""Offline checks for FMS asset discovery and conversion helpers."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from scraper.fms.convert_pdf_to_svg import (
    build_conversion_manifest,
    is_valid_svg,
)
from scraper.fms.discover_assets import (
    AssetLinkParser,
    is_allowed_asset_url,
    is_valid_asset_body,
)
from scraper.fms.get_all_pdf import (
    load_request_credentials,
    read_manifest,
    request_headers_for_url,
)


def test_discovers_only_supported_cmu_asset_links() -> None:
    """Discover PDF, SVG, and legacy API links while rejecting off-site links."""
    parser = AssetLinkParser("https://www.cmu.edu/building/index.html")
    parser.feed(
        '<a href="/plans/one.pdf" title="Base">PDF</a>'
        '<img src="https://fmsystems.cmu.edu/floor.svg">'
        '<a href="https://example.com/leak.pdf">external</a>'
        '<a href="http://www.cmu.edu/insecure.pdf">http</a>'
        '<a href="/api/getDefaultLayersData.ashx?id=1">layers</a>',
    )

    assert [asset["kind"] for asset in parser.links] == ["pdf", "svg", "ashx"]
    assert parser.links[0]["url"] == "https://www.cmu.edu/plans/one.pdf"
    assert parser.links[0]["label"] == "Base"


def test_asset_url_validation_requires_https_and_cmu_host() -> None:
    """Limit URLs to HTTPS CMU hosts."""
    assert is_allowed_asset_url("https://fmsystems.cmu.edu/a.pdf")
    assert not is_allowed_asset_url("http://fmsystems.cmu.edu/a.pdf")
    assert not is_allowed_asset_url("https://cmu.edu.example.net/a.pdf")
    assert not is_allowed_asset_url("https://example.net/a.pdf")


def test_validates_pdf_and_svg_response_bodies() -> None:
    """Reject login HTML and unsupported asset types."""
    assert is_valid_asset_body(b"%PDF-1.7\n...", "pdf")
    assert not is_valid_asset_body(b"<html>login</html>", "pdf")
    assert is_valid_asset_body(
        b"<?xml?><svg xmlns='http://www.w3.org/2000/svg'/>",
        "svg",
    )
    assert not is_valid_asset_body(b"<html><svg>not an SVG document", "svg")
    assert not is_valid_asset_body(b"%PDF-1.7", "ashx")


def test_direct_pdf_manifest_rejects_external_urls() -> None:
    """Allow direct PDF manifests only when every URL is on HTTPS CMU hosts."""
    with tempfile.TemporaryDirectory() as temporary_directory:
        path = Path(temporary_directory) / "manifest.json"
        entry = {"building": "ANSYS Hall", "floor": "1"}
        path.write_text(
            json.dumps([{**entry, "url": "https://cmu.edu/floor.pdf"}]),
            encoding="utf-8",
        )
        assert len(read_manifest(path)) == 1
        path.write_text(
            json.dumps([{**entry, "url": "https://example.net/floor.pdf"}]),
            encoding="utf-8",
        )
        rejected = False
        try:
            read_manifest(path)
        except ValueError:
            rejected = True
        assert rejected
        path.write_text(
            json.dumps([{
                **entry,
                "url": "https://user:pass@fmsystems.cmu.edu/floor.pdf",
            }]),
            encoding="utf-8",
        )
        rejected = False
        try:
            read_manifest(path)
        except ValueError:
            rejected = True
        assert rejected


def test_direct_pdf_cookie_and_referer_are_host_scoped() -> None:
    """Send copied headers only to the exact CMU host they came from."""
    same_host = request_headers_for_url(
        "https://fmsystems.cmu.edu/floor.pdf",
        "session=secret",
        "fmsystems.cmu.edu:443",
        "https://fmsystems.cmu.edu/floor-plan",
    )
    assert same_host["Cookie"] == "session=secret"
    assert same_host["Referer"] == "https://fmsystems.cmu.edu/floor-plan"

    other_host = request_headers_for_url(
        "https://www.cmu.edu/floor.pdf",
        "session=secret",
        "fmsystems.cmu.edu",
        "https://fmsystems.cmu.edu/floor-plan",
    )
    assert "Cookie" not in other_host
    assert "Referer" not in other_host
    assert "Cookie" not in request_headers_for_url(
        "https://fmsystems.cmu.edu/floor.pdf",
        "session=secret",
        "",
        "",
    )


def test_direct_pdf_cookie_requires_a_source_host() -> None:
    """Require host metadata for cookies from environment or copied headers."""
    with patch.dict(os.environ, {"FMS_TEST_COOKIE": "session=secret"}):
        rejected = False
        try:
            load_request_credentials("FMS_TEST_COOKIE", "", None)
        except ValueError:
            rejected = True
        assert rejected

    with tempfile.TemporaryDirectory() as temporary_directory:
        headers_path = Path(temporary_directory) / "headers.txt"
        headers_path.write_text("Cookie: session=secret\n", encoding="utf-8")
        rejected = False
        try:
            load_request_credentials("FMS_TEST_COOKIE", "", headers_path)
        except ValueError:
            rejected = True
        assert rejected
        headers_path.write_text(
            "Host: fmsystems.cmu.edu:443\n"
            "Cookie: session=secret\n"
            "Referer: https://fmsystems.cmu.edu/floor\n",
            encoding="utf-8",
        )
        assert load_request_credentials("FMS_TEST_COOKIE", "", headers_path) == (
            "session=secret",
            "fmsystems.cmu.edu",
            "https://fmsystems.cmu.edu/floor",
        )


def test_svg_file_check_and_conversion_manifest() -> None:
    """Check the SVG file root and conversion manifest fields."""
    with tempfile.TemporaryDirectory() as temporary_directory:
        svg_path = Path(temporary_directory) / "floor.svg"
        svg_path.write_text(
            "<svg xmlns='http://www.w3.org/2000/svg' />",
            encoding="utf-8",
        )
        assert is_valid_svg(svg_path)
        svg_path.write_text("<html>not svg</html>", encoding="utf-8")
        assert not is_valid_svg(svg_path)

    record = {
        "source_pdf": "input.pdf",
        "output_svg": "floor.svg",
        "status": "converted",
    }
    manifest = build_conversion_manifest(
        Path("assets.json"),
        extract_text=True,
        records=[record],
    )
    assert manifest["source_manifest"] == "assets.json"
    assert manifest["converter"] == "Poppler pdftocairo -svg"
    assert manifest["text_extractor"] == "Poppler pdftotext -bbox-layout"
    assert manifest["files"] == [record]
    no_text = build_conversion_manifest(
        Path("assets.json"),
        extract_text=False,
        records=[],
    )
    assert no_text["text_extractor"] is None


if __name__ == "__main__":
    for test in (
        test_discovers_only_supported_cmu_asset_links,
        test_asset_url_validation_requires_https_and_cmu_host,
        test_validates_pdf_and_svg_response_bodies,
        test_direct_pdf_manifest_rejects_external_urls,
        test_direct_pdf_cookie_and_referer_are_host_scoped,
        test_direct_pdf_cookie_requires_a_source_host,
        test_svg_file_check_and_conversion_manifest,
    ):
        test()
    print("7 FMS fetch checks passed")  # noqa: T201
