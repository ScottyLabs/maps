"""Convert downloaded one-page FMS PDFs into vector SVGs for the legacy SVG flow.

Poppler's pdftocairo preserves the vector linework. When enabled, pdftotext also
writes XHTML word bounding boxes beside each SVG to support later room-label
extraction. This does not synthesize floorplans.json or the indoor graph.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def is_valid_svg(path: Path) -> bool:
    """Return whether a file begins with plausible SVG markup."""
    if not path.is_file():
        return False
    root_tag = re.search(
        rb"<([a-z][a-z0-9:_-]*)\b",
        path.read_bytes()[:2048],
        re.IGNORECASE,
    )
    return root_tag is not None and root_tag.group(1).lower() == b"svg"


def build_conversion_manifest(
    source_manifest: Path,
    *,
    extract_text: bool,
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build the stable JSON structure written after PDF conversion."""
    return {
        "source_manifest": str(source_manifest),
        "converter": "Poppler pdftocairo -svg",
        "text_extractor": (
            None if not extract_text else "Poppler pdftotext -bbox-layout"
        ),
        "files": records,
    }


def convert_pdf(
    pdf_path: Path,
    output_dir: Path,
    building_slug: str,
    *,
    extract_text: bool,
) -> list[dict[str, Any]]:
    """Convert every page of one PDF to SVG and optional text bounding boxes."""
    if not pdf_path.is_file():
        return [{"source_pdf": str(pdf_path), "status": "missing-pdf"}]

    output_dir.mkdir(parents=True, exist_ok=True)
    prefix = output_dir / pdf_path.stem
    for stale_output in (prefix, *prefix.parent.glob(f"{prefix.name}-*.svg")):
        stale_output.unlink(missing_ok=True)
    result = subprocess.run(  # noqa: S603
        ["pdftocairo", "-svg", str(pdf_path), str(prefix)],  # noqa: S607
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode != 0:
        return [{
            "source_pdf": str(pdf_path),
            "status": "conversion-failed",
            "error": result.stderr.strip()[-500:],
        }]

    generated = (
        [prefix]
        if prefix.is_file()
        else sorted(prefix.parent.glob(f"{prefix.name}-*.svg"))
    )

    records: list[dict[str, Any]] = []
    for page_number, svg_path in enumerate(generated, start=1):
        is_single_page = len(generated) == 1
        suffix = ".svg" if is_single_page else f"-page-{page_number}.svg"
        target = output_dir / f"{pdf_path.stem}{suffix}"
        if svg_path != target:
            svg_path.replace(target)
        if not is_valid_svg(target):
            target.unlink(missing_ok=True)
            records.append({"source_pdf": str(pdf_path), "status": "invalid-svg"})
            continue

        record: dict[str, Any] = {
            "building_slug": building_slug,
            "source_pdf": str(pdf_path),
            "output_svg": str(target),
            "page": page_number,
            "svg_bytes": target.stat().st_size,
            "status": "converted",
        }
        if extract_text:
            text_path = target.with_suffix(".bbox.html")
            text_result = subprocess.run(  # noqa: S603
                [  # noqa: S607
                    "pdftotext",
                    "-bbox-layout",
                    "-f",
                    str(page_number),
                    "-l",
                    str(page_number),
                    str(pdf_path),
                    str(text_path),
                ],
                capture_output=True,
                check=False,
                text=True,
            )
            if text_result.returncode == 0 and text_path.is_file():
                record["text_boxes"] = str(text_path)
            else:
                record["text_status"] = "extraction-failed"
        records.append(record)
    if not records:
        records.append({"source_pdf": str(pdf_path), "status": "no-svg-output"})
    return records


def main() -> None:  # noqa: C901
    """Convert the downloaded PDF assets in an FMS discovery manifest."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("data/fms_assets.json"),
        help="Manifest produced by discover_assets.py",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/floorplan_svg_pdf"),
        help="Output tree compatible with upload_svg_to_s3.py",
    )
    parser.add_argument(
        "--conversion-manifest",
        type=Path,
        default=Path("data/fms_pdf_conversion.json"),
    )
    parser.add_argument(
        "--no-text",
        action="store_true",
        help="Skip pdftotext XHTML word boxes; only produce SVG files",
    )
    args = parser.parse_args()
    if not shutil.which("pdftocairo"):
        parser.error("pdftocairo is missing; install Poppler command-line tools.")
    if not args.no_text and not shutil.which("pdftotext"):
        parser.error("pdftotext is missing; install Poppler command-line tools.")

    try:
        source = json.loads(args.manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        parser.error(f"Could not read asset manifest: {exc}")
    if not isinstance(source, dict) or not isinstance(source.get("buildings"), list):
        parser.error("Asset manifest must contain a buildings list.")

    records: list[dict[str, Any]] = []
    for building in source["buildings"]:
        if not isinstance(building, dict):
            continue
        page_path = urlparse(str(building.get("page_url", ""))).path
        building_slug = Path(page_path).parent.name or "unknown"
        for asset in building.get("assets", []):
            if (
                not isinstance(asset, dict)
                or asset.get("kind") != "pdf"
                or not asset.get("downloaded")
                or not asset.get("local_path")
            ):
                continue
            pdf_path = Path(str(asset["local_path"]))
            if not pdf_path.is_absolute():
                pdf_path = Path.cwd() / pdf_path
            records.extend(
                convert_pdf(
                    pdf_path,
                    args.out / building_slug,
                    building_slug,
                    extract_text=not args.no_text,
                ),
            )
        print(  # noqa: T201
            f"[converted] {building.get('name', building_slug)}",
            flush=True,
        )

    args.conversion_manifest.parent.mkdir(parents=True, exist_ok=True)
    args.conversion_manifest.write_text(
        json.dumps(
            build_conversion_manifest(
                args.manifest,
                extract_text=not args.no_text,
                records=records,
            ),
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    converted = sum(item.get("status") == "converted" for item in records)
    failed = len(records) - converted
    print(  # noqa: T201
        f"Converted {converted} PDF pages; {failed} page conversions need review.",
    )
    print(  # noqa: T201
        f"SVG output: {args.out}; conversion manifest: {args.conversion_manifest}",
    )
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
