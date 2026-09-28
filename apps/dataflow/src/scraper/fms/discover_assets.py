"""Discover and download CMU FMS PDF/SVG assets through a signed-in browser.

The browser handles CMU SSO and Duo. Session cookies are copied from WebDriver
to an in-memory requests session only; they are never written or logged.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

ACADEMIC_INDEX = (
    "https://www.cmu.edu/enterprise-space/esim/services/floor-plans/"
    "acad-admin/index.html"
)
ACADEMIC_PATH = "/enterprise-space/esim/services/floor-plans/acad-admin/"
USER_AGENT = "CMUMaps-dataflow/1.0 (FMS floor-plan source fetcher)"


def is_allowed_asset_url(url: str) -> bool:
    """Accept only HTTPS asset URLs hosted on CMU domains."""
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (
        hostname == "cmu.edu" or hostname.endswith(".cmu.edu")
    )


def is_valid_asset_body(body: bytes, kind: str) -> bool:
    """Check the file signature/markup before saving a downloaded asset."""
    if kind == "pdf":
        return body.startswith(b"%PDF-")
    if kind == "svg":
        root_tag = re.search(rb"<([a-z][a-z0-9:_-]*)\b", body[:2048], re.IGNORECASE)
        return root_tag is not None and root_tag.group(1).lower() == b"svg"
    return False


class AssetLinkParser(HTMLParser):
    """Collect likely asset links and embeds from one FMS page."""

    def __init__(self, page_url: str) -> None:
        """Initialize a parser for links relative to one page."""
        super().__init__(convert_charrefs=True)
        self.page_url = page_url
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        """Record supported CMU asset links from an HTML start tag."""
        attributes = dict(attrs)
        raw_url = attributes.get("href") if tag in {"a", "link"} else None
        raw_url = raw_url or attributes.get("src") or attributes.get("data")
        if not raw_url:
            return
        url = urljoin(self.page_url, raw_url.strip())
        parsed = urlparse(url)
        if not is_allowed_asset_url(url):
            return
        path = parsed.path.lower()
        if not path.endswith((".pdf", ".svg", "getdefaultlayersdata.ashx")):
            return
        label = " ".join(
            part for part in (attributes.get("title"), attributes.get("alt")) if part
        ).strip()
        self.links.append({"url": url, "label": label, "kind": path.rsplit(".", 1)[-1]})


def slugify(value: str) -> str:
    """Make a filesystem-safe label."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return re.sub(r"-+", "-", slug).strip("-") or "unknown"


def make_driver(browser: str, *, headless: bool) -> webdriver.Chrome:
    """Start Chrome or Brave under Selenium WebDriver."""
    options = Options()
    options.binary_location = {
        "chrome": "/usr/bin/google-chrome-stable",
        "brave": "/usr/bin/brave-browser-stable",
    }[browser]
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    if headless:
        options.add_argument("--headless=new")
    return webdriver.Chrome(options=options)


def add_browser_cookies(session: requests.Session, driver: webdriver.Chrome) -> None:
    """Copy current CMU cookies into a scoped, in-memory requests jar."""
    for cookie in driver.get_cookies():
        domain = str(cookie.get("domain", "")).lstrip(".").lower()
        if domain != "cmu.edu" and not domain.endswith(".cmu.edu"):
            continue
        session.cookies.set(
            name=cookie["name"],
            value=cookie["value"],
            domain=cookie.get("domain"),
            path=cookie.get("path", "/"),
            secure=bool(cookie.get("secure", True)),
            expires=cookie.get("expiry"),
        )


def browser_is_on_index(driver: webdriver.Chrome) -> bool:
    """Check that SSO returned to a rendered academic floor-plan index."""
    parsed = urlparse(driver.current_url)
    if parsed.hostname != "www.cmu.edu" or ACADEMIC_PATH not in parsed.path:
        return False
    return bool(
        driver.execute_script(
            "return [...document.querySelectorAll('a[href]')].some(a => "
            "a.href.includes('/acad-admin/') && a.href.endsWith('/index.html'));",
        ),
    )


def get_building_pages(driver: webdriver.Chrome) -> list[dict[str, str]]:
    """Read academic building names and index URLs from the loaded page."""
    rows: list[dict[str, str]] = driver.execute_script(
        "return [...document.querySelectorAll('a[href]')].map(a => ({"
        "name: (a.innerText || a.textContent || '').trim(), url: a.href"
        "})).filter(a => a.name && a.url.includes('/acad-admin/') && "
        "a.url.endsWith('/index.html'));",
    )
    unique: dict[str, dict[str, str]] = {}
    for row in rows:
        index_path = ACADEMIC_PATH.rstrip("/") + "/index.html"
        if urlparse(row["url"]).path.rstrip("/") == index_path:
            continue
        unique[row["url"]] = row
    return list(unique.values())


def request_page(
    session: requests.Session,
    driver: webdriver.Chrome,
    url: str,
    timeout: float,
) -> tuple[str, str, int]:
    """Fetch a building page, falling back to browser navigation for SSO."""
    response = session.get(url, timeout=timeout, allow_redirects=True)
    final_host = (urlparse(response.url).hostname or "").lower()
    if final_host == "www.cmu.edu" and ACADEMIC_PATH in urlparse(response.url).path:
        return response.text, response.url, response.status_code

    driver.get(url)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        final_url = driver.current_url
        final_host = (urlparse(final_url).hostname or "").lower()
        if final_host == "www.cmu.edu" and ACADEMIC_PATH in urlparse(final_url).path:
            add_browser_cookies(session, driver)
            return driver.page_source, final_url, 200
        time.sleep(0.5)
    return response.text, response.url, response.status_code


def download_asset(
    session: requests.Session,
    asset: dict[str, str],
    out_dir: Path,
    building: str,
    timeout: float,
) -> dict[str, Any]:
    """Download and validate one direct PDF or SVG asset."""
    parsed = urlparse(asset["url"])
    kind = asset.get("kind", "")
    if not is_allowed_asset_url(asset["url"]) or kind not in {"pdf", "svg"}:
        return {**asset, "downloaded": False, "error": "invalid-asset-url-or-kind"}
    suffix = f".{kind}"
    basename = Path(parsed.path).name
    if not basename or not basename.lower().endswith(suffix):
        basename = slugify(asset.get("label", "floor-plan")) + suffix
    target = out_dir / slugify(building) / basename
    try:
        response = session.get(asset["url"], timeout=timeout, allow_redirects=True)
        body = response.content
        valid = response.status_code == requests.codes.ok and (
            is_allowed_asset_url(response.url)
            and is_valid_asset_body(body, kind)
        )
        if valid:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(body)
        return {
            **asset,
            "status": response.status_code,
            "downloaded": valid,
            "local_path": str(target) if valid else None,
            "content_type": response.headers.get("content-type", ""),
        }
    except requests.RequestException as exc:
        return {**asset, "downloaded": False, "error": type(exc).__name__}


def main() -> None:
    """Discover PDF/SVG links and download assets visible to the signed-in user."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", choices=("chrome", "brave"), default="brave")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Hide the browser window",
    )
    parser.add_argument("--login-timeout", type=float, default=900)
    parser.add_argument("--timeout", type=float, default=45)
    parser.add_argument("--delay", type=float, default=0.3)
    parser.add_argument("--out", type=Path, default=Path("fms_floorplans"))
    parser.add_argument("--manifest", type=Path, default=Path("fms_assets.json"))
    args = parser.parse_args()

    driver = make_driver(args.browser, headless=args.headless)
    try:
        driver.get(ACADEMIC_INDEX)
        print(  # noqa: T201
            "Sign in to CMU in the opened browser and complete Duo if prompted. "
            "The crawl will start when the academic building list appears.",
            flush=True,
        )
        deadline = time.monotonic() + args.login_timeout
        while time.monotonic() < deadline and not browser_is_on_index(driver):
            time.sleep(1)
        if not browser_is_on_index(driver):
            parser.error(
                "Timed out waiting for the academic building index after sign-in.",
            )

        pages = get_building_pages(driver)
        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})
        add_browser_cookies(session, driver)
        results: list[dict[str, Any]] = []
        seen_assets: set[str] = set()
        for page in pages:
            html, final_url, status = request_page(
                session,
                driver,
                page["url"],
                args.timeout,
            )
            if ACADEMIC_PATH not in urlparse(final_url).path:
                results.append({**page, "page_status": status, "assets": []})
                continue
            links = AssetLinkParser(final_url)
            links.feed(html)
            assets: list[dict[str, Any]] = []
            for asset in links.links:
                if asset["url"] in seen_assets:
                    continue
                seen_assets.add(asset["url"])
                if asset["kind"] in {"pdf", "svg"}:
                    assets.append(
                        download_asset(
                            session,
                            asset,
                            args.out,
                            page["name"],
                            args.timeout,
                        ),
                    )
                else:
                    assets.append(
                        {**asset, "downloaded": False, "status": "api-link"},
                    )
            results.append(
                {
                    **page,
                    "page_url": final_url,
                    "page_status": status,
                    "assets": assets,
                },
            )
            print(  # noqa: T201
                f"[page] {page['name']}: {len(assets)} PDF/SVG asset links",
                flush=True,
            )
            time.sleep(max(args.delay, 0))

        output = {
            "source": ACADEMIC_INDEX,
            "browser": args.browser,
            "fetched_at": datetime.now(UTC).isoformat(),
            "buildings": results,
        }
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(
            json.dumps(output, indent=2) + "\n",
            encoding="utf-8",
        )
        downloaded = sum(
            bool(asset.get("downloaded"))
            for building in results
            for asset in building["assets"]
        )
        print(  # noqa: T201
            f"Saved {args.manifest}; downloaded {downloaded} PDF/SVG assets "
            f"to {args.out}",
        )
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
