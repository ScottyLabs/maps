"""Pipeline: Fetch CMU floor-plan SVGs for a set of buildings.

1. Save a buildings JSON file in the following format:
Input JSON format (buildings.json):
[
  {
    "building": "CFA",
    "floorid": {
      "1": "...",
      "2": "...",
      ...
    }
  }
]

2. Set CMU_FMS_COOKIE from the Cookie request header copied from an
  authenticated browser request. See docs/src/Data-Flow.md for Brave instructions.

3. Run this script to fetch all SVGs. It reads the cookie from the
  environment and never stores it here.

"""

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any

import requests

ENDPOINT = "https://fmsystems.cmu.edu/FMInteract/tools/getDefaultLayersData.ashx"
DEFAULT_PARAMS = {
    "isRevit": "false",
    "RoomBoundaryLayer": "A-AREA",
    "RoomTagLayer": "A-AREA-IDEN",
}


def slugify(name: str) -> str:
    """Convert a name to a URL-friendly slug."""
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "building"


def read_buildings(path: str) -> list[dict[str, Any]]:
    """Read buildings data from a JSON file."""
    p = Path(path)
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        msg = "buildings.json must be a JSON list of objects."
        raise ValueError(msg)  # noqa: TRY004
    for obj in data:
        if not isinstance(obj, dict) or "building" not in obj or "floorid" not in obj:
            msg = "Each item must be an object with 'building' and 'floorid'."
            raise ValueError(msg)
        if not isinstance(obj["floorid"], dict):
            msg = "'floorid' must be an object mapping floor labels to floor IDs."
            raise ValueError(msg)  # noqa: TRY004
    return data


def fetch_svg(  # noqa: PLR0913
    floor_id: str,
    svg_filename_param: str,
    out_file: Path,
    cookie_header: str,
    headers: dict[str, str] | None = None,
    timeout: float = 30.0,
    retries: int = 3,
    backoff: float = 1.5,
) -> bool:
    """Fetch an SVG file from the FMSystems API."""
    params = dict(DEFAULT_PARAMS)
    params["floorId"] = floor_id
    params["svgFile"] = svg_filename_param
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(
                ENDPOINT,
                params=params,
                headers={"Cookie": cookie_header, **(headers or {})},
                timeout=timeout,
                allow_redirects=False,
            )
            if resp.status_code == 200 and resp.text.strip():  # noqa: PLR2004
                out_file.parent.mkdir(parents=True, exist_ok=True)
                out_file.write_text(resp.text, encoding="utf-8")
                return True
            print(  # noqa: T201
                f"[warn] HTTP {resp.status_code} for floorId={floor_id}; "
                f"attempt {attempt}/{retries}",
            )
        except Exception as e:  # noqa: BLE001
            last_exc = e
            print(  # noqa: T201
                f"[warn] Exception on attempt {attempt}/{retries} "
                f"for floorId={floor_id}: {e}",
            )
        time.sleep(backoff ** (attempt - 1))
    if last_exc:
        print(f"[error] Failed for floorId={floor_id}: {last_exc}")  # noqa: T201
    return False


def main() -> None:
    """Fetch all SVG files for the given buildings."""
    ap = argparse.ArgumentParser(
        description="Fetch floor-plan SVGs for buildings/floorid.",
    )
    ap.add_argument(
        "--buildings",
        default="buildings.json",
        help="Path to buildings.json (list of {building, floorid})",
    )
    ap.add_argument("--out", default="floorplan_svg", help="Output root directory")
    ap.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="Seconds to sleep between requests (politeness)",
    )
    ap.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP timeout per request in seconds",
    )
    ap.add_argument("--retries", type=int, default=3, help="HTTP retries per request")
    ap.add_argument(
        "--backoff",
        type=float,
        default=1.5,
        help="Exponential backoff base between retries",
    )
    ap.add_argument(
        "--cookie-env",
        default="CMU_FMS_COOKIE",
        help="Environment variable containing the FMS Cookie request header "
        "(default: CMU_FMS_COOKIE). Never pass the cookie as a command-line value.",
    )

    args = ap.parse_args()

    cookie_header = os.environ.get(args.cookie_env, "").strip()
    if not cookie_header:
        ap.error(
            f"Missing FMS session cookie. Set the {args.cookie_env} environment "
            "variable; see docs/src/Data-Flow.md for Brave instructions.",
        )

    buildings = read_buildings(args.buildings)
    out_root = Path(args.out)

    total = 0
    ok = 0

    # Mapping of building names to special curl param names
    building_name_overrides = {
        "an": "ansys",
        "ph": "bp",
        "br": "brh",
        "dithridge-street-garage": "dithgarage",
        "east-campus-garage": "ecg",
        "eds": "edsh",
        "fm": "fms",
        "mc": "fifth4721",
        "fifth-ave-4802-wqed": "wqed",
        "forbes-ave-4615-gatf": "frbs4615",
        "ghc": "gates",
        "gesling-stadium": "gef",
        "ini": "hnry4616",
        "henry-st-4618": "hnry4618",
        "henry-st-4620": "hnry4620",
        "highmark-center-for-health-wellness-athletics": "hmc",
        "hl": "hunt",
        "mm": "mmch",
        "nsh": "ns",
        "pc": "posner",
        "pos": "ph",
        "cic": "frbs4720",
        "sc": "scotthall",
        "south-craig-st-203": "scrg203",
        "2sc": "scrg205",
        "3sc": "scrg300",
        "south-craig-st-311": "scrg311",
        "4sc": "scrg407",
        "cc": "scrg417",
        "south-neville-st-485": "snev485",
        "landscape-support-facility": "snev535",
        "tcs": "tcshall",
        "tep": "tsb",
        "ut": "utdc",
    }

    for building in buildings:
        building_name = building["building"]
        floorids: dict[str, str] = building["floorid"]
        folder = out_root / slugify(building_name)

        for floor_num, floor_id in floorids.items():
            total += 1
            out_file = folder / f"{floor_num}.svg"
            floor_label = str(floor_num).strip()

            building_name_slug = slugify(building_name)
            param_building_name = building_name_overrides.get(
                building_name_slug,
                building_name_slug,
            )

            # special cases: school's data is inconsistent in curl param
            suffix = (
                "fesim"
                if (building_name_slug == "an" and floor_label.lower() == "d")
                else "esim"
            )
            suffix = (
                "fmsystems"
                if (
                    building_name_slug == "fifth-ave-4802-wqed"
                    and floor_label.lower() == "1"
                )
                else suffix
            )
            suffix = "fmsystems" if (building_name_slug == "sc") else suffix
            suffix = (
                "fmsystems"
                if (
                    building_name_slug == "weh"
                    and floor_label.lower() not in ("5", "9", "4")
                )
                else suffix
            )

            floor_lower = floor_label.lower()
            svg_filename_param = f"{param_building_name}-{floor_lower}-{suffix}.svg"

            print(  # noqa: T201
                f"[fetch] {building_name} | floor {floor_num} "
                f"-> {out_file.name} (id={floor_id})",
            )

            success = fetch_svg(
                floor_id=floor_id,
                svg_filename_param=svg_filename_param,
                out_file=out_file,
                cookie_header=cookie_header,
                timeout=args.timeout,
                retries=args.retries,
                backoff=args.backoff,
            )
            if success:
                ok += 1
                print(f"[ok] Saved -> {out_file}")  # noqa: T201
            else:
                print(  # noqa: T201
                    f"[fail] Could not fetch floor {floor_num} "
                    f"(id={floor_id}) for {building_name}",
                )

            if args.delay > 0:
                time.sleep(args.delay)

    print(f"\nDone. {ok}/{total} SVGs saved under: {out_root.resolve()}")  # noqa: T201


if __name__ == "__main__":
    main()
