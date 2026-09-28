"""Download CMU FMS floor plan PDFs listed in a local manifest.

The manifest contains one object per floor, with ``building``, ``floor``, and
the direct PDF ``url`` copied from an authenticated FMS browser request. If a
Cookie header is needed, provide its source host as well so it is only sent to
that exact host. Cookie values are never written to disk or logged.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from http import HTTPStatus
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests


def slugify(value: str) -> str:
    """Return a filesystem-safe slug for a building or floor label."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return re.sub(r"-+", "-", slug).strip("-") or "unknown"


def read_manifest(path: Path) -> list[dict[str, str]]:
    """Load and validate the PDF manifest."""
    data: Any = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        msg = "Manifest must be a JSON list."
        raise TypeError(msg)
    floors: list[dict[str, str]] = []
    for index, item in enumerate(data):
        if not isinstance(item, dict) or not all(
            isinstance(item.get(key), str) and item[key].strip()
            for key in ("building", "floor", "url")
        ):
            msg = (
                f"Manifest entry {index} needs non-empty building, floor, "
                "and url strings."
            )
            raise ValueError(msg)
        parsed = urlparse(item["url"])
        hostname = (parsed.hostname or "").lower()
        if (
            parsed.scheme != "https"
            or parsed.username
            or parsed.password
            or not (hostname == "cmu.edu" or hostname.endswith(".cmu.edu"))
        ):
            msg = f"Manifest entry {index} URL must use HTTPS on a cmu.edu host."
            raise ValueError(msg)
        floors.append(item)
    return floors


def read_request_headers(path: Path) -> dict[str, str]:
    """Read copied headers and track the host the Cookie came from."""
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    headers: dict[str, str] = {}
    allowed = {"cookie", "referer", "host"}
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line:
            index += 1
            continue
        if ":" in line:
            name, value = line.split(":", 1)
            name = name.strip().lower()
            if name in allowed and value.strip():
                headers[name] = value.strip()
            index += 1
            continue
        name = line.rstrip(":").lower()
        if name in allowed and index + 1 < len(lines) and lines[index + 1]:
            headers[name] = lines[index + 1]
            index += 2
        else:
            # Other copied headers are unnecessary; requests derives Host itself.
            index += 1
    return headers


def normalize_host(value: str) -> str:
    """Return a lowercase hostname from a URL or a copied Host header."""
    candidate = value.strip()
    if not candidate:
        return ""
    parsed = urlparse(candidate if "://" in candidate else f"//{candidate}")
    return (parsed.hostname or "").lower()


def request_headers_for_url(
    url: str,
    cookie_header: str,
    cookie_host: str,
    referer: str,
) -> dict[str, str]:
    """Build headers without forwarding copied credentials across hosts."""
    request_host = normalize_host(url)
    source_host = normalize_host(cookie_host)
    headers = {"User-Agent": "CMUMaps-dataflow/1.0"}
    if cookie_header and request_host and source_host == request_host:
        headers["Cookie"] = cookie_header
    if referer and request_host and normalize_host(referer) == request_host:
        headers["Referer"] = referer
    return headers


def load_request_credentials(
    cookie_env: str,
    cookie_host: str,
    headers_file: Path | None,
) -> tuple[str, str, str]:
    """Load optional Cookie and Referer values with an exact source host."""
    cookie_header = os.environ.get(cookie_env, "").strip()
    referer = ""
    source_host = normalize_host(cookie_host)
    if headers_file:
        copied_headers = read_request_headers(headers_file)
        copied_cookie = copied_headers.get("cookie", "")
        if copied_cookie:
            source_host = normalize_host(copied_headers.get("host", ""))
            if not source_host:
                msg = "--headers-file must include the Host header for its Cookie."
                raise ValueError(msg)
            cookie_header = copied_cookie
            referer = copied_headers.get("referer", "")
    if cookie_header and not source_host:
        msg = (
            "A Cookie header requires --cookie-host or CMU_FMS_COOKIE_HOST; "
            "cookies are only sent to that exact host."
        )
        raise ValueError(msg)
    if source_host and not (
        source_host == "cmu.edu" or source_host.endswith(".cmu.edu")
    ):
        msg = "--cookie-host must be a hostname on cmu.edu."
        raise ValueError(msg)
    return cookie_header, source_host, referer


def download_pdf(  # noqa: PLR0913
    url: str,
    output_path: Path,
    cookie_header: str,
    cookie_host: str,
    referer: str,
    timeout: float,
    retries: int,
) -> bool:
    """Download one PDF, rejecting redirects and non-PDF response bodies."""
    headers = request_headers_for_url(url, cookie_header, cookie_host, referer)

    for attempt in range(retries):
        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=timeout,
                allow_redirects=False,
            )
            if (
                response.status_code == requests.codes.ok
                and response.content.startswith(b"%PDF-")
            ):
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_bytes(response.content)
                return True
            retryable_statuses = {
                HTTPStatus.REQUEST_TIMEOUT,
                HTTPStatus.TOO_MANY_REQUESTS,
            }
            if (
                response.status_code < HTTPStatus.INTERNAL_SERVER_ERROR
                and response.status_code not in retryable_statuses
            ):
                break
        except requests.RequestException:
            pass
        if attempt + 1 < retries:
            time.sleep(2**attempt)
    return False


def main() -> None:
    """Download every PDF in the supplied manifest."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("fms-pdfs.json"))
    parser.add_argument("--out", type=Path, default=Path("floorplan_pdf"))
    parser.add_argument("--timeout", type=float, default=45.0)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--cookie-env", default="CMU_FMS_COOKIE")
    parser.add_argument(
        "--cookie-host",
        default=os.environ.get("CMU_FMS_COOKIE_HOST", ""),
        help="Exact CMU hostname where the cookie originated. Also reads "
        "CMU_FMS_COOKIE_HOST; required whenever a Cookie header is supplied.",
    )
    parser.add_argument(
        "--headers-file",
        type=Path,
        help="Optional browser-copied header file; Cookie and Referer are used, "
        "and Host scopes where the Cookie is sent.",
    )
    args = parser.parse_args()

    if args.retries < 1:
        parser.error("--retries must be at least 1")
    try:
        floors = read_manifest(args.manifest)
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        parser.error(str(exc))

    try:
        cookie_header, cookie_host, referer = load_request_credentials(
            args.cookie_env,
            args.cookie_host,
            args.headers_file,
        )
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    success_count = 0
    for item in floors:
        output_path = (
            args.out
            / slugify(item["building"])
            / f"{slugify(item['floor'])}.pdf"
        )
        success = download_pdf(
            item["url"],
            output_path,
            cookie_header,
            cookie_host,
            referer,
            args.timeout,
            args.retries,
        )
        if success:
            success_count += 1
            print(f"[ok] {item['building']} / {item['floor']} -> {output_path}")  # noqa: T201
        else:
            print(f"[fail] {item['building']} / {item['floor']}: no PDF downloaded")  # noqa: T201

    print(f"Downloaded {success_count}/{len(floors)} PDFs to {args.out}")  # noqa: T201
    if success_count != len(floors):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
