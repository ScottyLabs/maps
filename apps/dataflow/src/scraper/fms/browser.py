"""Interactive CMU login and FMS navigation discovery; credentials stay in memory."""

from __future__ import annotations

import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Literal
from urllib.parse import parse_qs, urlsplit

import requests
from requests.adapters import HTTPAdapter
from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from urllib3.util.retry import Retry

from scraper.fms.capture import BASE_URL, FloorSource, SourceError

if TYPE_CHECKING:
    from collections.abc import Iterator

    from selenium.webdriver.remote.webelement import WebElement


def _chrome_binary() -> str:
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome"):
        if binary := shutil.which(name):
            return binary
    mac = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if mac.is_file():
        return str(mac)
    msg = (
        "Install Google Chrome (inside Linux/WSL if applicable) "
        "for interactive CMU login"
    )
    raise SourceError(msg)


@contextmanager
def authenticated_browser() -> Iterator[webdriver.Chrome]:
    """Own an isolated login profile and remove it when capture finishes."""
    binary = _chrome_binary()
    with tempfile.TemporaryDirectory(prefix="cmumaps-fms-login-") as profile:
        options = webdriver.ChromeOptions()
        options.binary_location = binary
        options.add_argument("--user-data-dir=" + profile)
        options.add_argument("--no-first-run")
        try:
            driver = webdriver.Chrome(options=options)
        except WebDriverException as error:
            msg = (
                "Cannot start Chrome; check your graphical session "
                "and Chrome installation"
            )
            raise SourceError(msg) from error
        try:
            driver.set_page_load_timeout(45)
            driver.get(BASE_URL + "default.aspx")
            print(  # noqa: T201
                "Complete CMU login and Duo in the isolated Chrome window.", flush=True,
            )
            WebDriverWait(driver, 900, poll_frequency=1).until(_logged_in)
            yield driver
        except TimeoutException as error:
            msg = "CMU login or FMS navigation timed out; run capture again"
            raise SourceError(msg) from error
        finally:
            driver.quit()


def _logged_in(driver: webdriver.Chrome) -> bool:
    current = urlsplit(driver.current_url)
    if current.hostname != "fmsystems.cmu.edu":
        return False
    if "accessdenied" in current.path.lower():
        msg = "FMS denied this account access; request CMU ESIM permissions"
        raise SourceError(msg)
    return bool(driver.find_elements(By.CSS_SELECTOR, ".rtIn"))


def _nav_link(
    driver: webdriver.Chrome,
    file_code: str,
    key: str,
    value: str,
) -> WebElement | Literal[False]:
    for element in driver.find_elements(By.CSS_SELECTOR, "a.rtIn"):
        href = element.get_attribute("href") or ""
        query = parse_qs(urlsplit(href).query)
        if query.get("file_code") == [file_code] and query.get(key) == [value]:
            return element
    return False


def _expand(driver: webdriver.Chrome, link: WebElement) -> None:
    plus = link.find_elements(By.XPATH, "../span[contains(@class,'rtPlus')]")
    if plus:
        driver.execute_script("arguments[0].click()", plus[0])


def discover_floors(
    driver: webdriver.Chrome,
    buildings: dict[str, str],
    *,
    site: str = "MAIN",
    levels: set[str] | None = None,
) -> list[FloorSource]:
    """Discover source floor URLs, preserving IDs and filenames from FMS."""
    wait = WebDriverWait(driver, 30)
    menu = driver.find_elements(By.CSS_SELECTOR, "a.fmi-nav-2ndnav-show")
    if menu and menu[0].is_displayed():
        menu[0].click()
    campus = wait.until(lambda d: _nav_link(d, "_BLDGLIST", "sitecode", site))
    _expand(driver, campus)
    sources: list[FloorSource] = []
    for code, fms_id in buildings.items():
        sources.extend(_building_floors(driver, code, fms_id, levels))
    return sources


def _building_floors(
    driver: webdriver.Chrome, code: str, fms_id: str, levels: set[str] | None,
) -> list[FloorSource]:
    wait = WebDriverWait(driver, 30)
    building = wait.until(lambda d: _nav_link(d, "_FLRLIST", "bldgcode", fms_id))
    _expand(driver, building)
    node = building.find_element(By.XPATH, "ancestor::li[1]")
    links = wait.until(
        lambda _: node.find_elements(
            By.CSS_SELECTOR,
            ".fmi-nav-floorplan a.rtIn",
        ),
    )
    available = []
    for link in links:
        href = link.get_attribute("href") or ""
        url = urlsplit(href)
        query = parse_qs(url.query)
        if url.scheme != "https" or url.hostname != "fmsystems.cmu.edu":
            msg = "FMS returned an unexpected floor destination"
            raise SourceError(msg)
        level = query.get("floorcode", [""])[0].strip()
        available.append(
            FloorSource(
                building=code,
                fms_id=fms_id,
                level=level,
                url=href,
            ),
        )
    if levels and not levels.issubset({s.level for s in available}):
        msg = f"Requested floor selection is not available for {code}"
        raise SourceError(msg)
    return [s for s in available if not levels or s.level in levels]


def source_session(driver: webdriver.Chrome) -> requests.Session:
    """Transfer this FMS browser session into bounded verified HTTPS requests."""
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": str(driver.execute_script("return navigator.userAgent")),
            "Referer": BASE_URL + "DrawingView.aspx",
            "X-Requested-With": "XMLHttpRequest",
            "Cache-Control": "no-cache",
        },
    )
    retry = Retry(
        total=2,
        backoff_factor=0.5,
        allowed_methods=frozenset({"GET"}),
        status_forcelist=(429, 500, 502, 503, 504),
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    for cookie in driver.get_cookies():
        if cookie["domain"].lstrip(".") == "fmsystems.cmu.edu":
            session.cookies.set(
                cookie["name"],
                cookie["value"],
                domain=cookie["domain"],
                path=cookie["path"],
            )
    return session
