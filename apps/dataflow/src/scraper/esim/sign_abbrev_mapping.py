"""Create a mapping from CMU sign abbreviations to building identifiers.

This script processes ArcGIS query results to build a lookup table that maps
building sign abbreviations (e.g., "GHC", "WEH") to their numeric FMS IDs.

Input:
    - query.json: ArcGIS feature data with Sign_Abbrev and BuildingID_Numeric_2

Output:
    - sign_abbrev_mapping.json: Mapping of sign abbreviations to FMS building IDs
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import TYPE_CHECKING, Any

from logger import get_app_logger

if TYPE_CHECKING:
    from collections.abc import Iterable

MappingEntry = dict[str, int | str]
MappingResult = dict[str, MappingEntry]


def _normalize_label(sign_abbrev: str | None, short_name: str | None) -> str | None:
    """Return the preferred label for a building (Sign_Abbrev > Short_Name)."""
    if sign_abbrev:
        sign_abbrev = sign_abbrev.strip()
        if sign_abbrev:
            return sign_abbrev
    if short_name:
        short_name = short_name.strip()
        if short_name:
            return short_name
    return None


def _to_building_code(raw_value: object) -> str | None:
    """Return the Building_ID value while keeping any leading zeros."""
    if raw_value is None:
        return None
    value = str(raw_value).strip()
    return value or None


def _to_building_numeric(raw_value: object) -> int | None:
    """Convert BuildingID_Numeric_2 to an int."""
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _collect_conflicting_signs(
    features: Iterable[dict[str, Any]],
) -> set[str]:
    """Return sign labels that map to more than one numeric building ID."""
    sign_to_ids: dict[str, set[int]] = defaultdict(set)
    for feature in features:
        attributes = feature.get("attributes") or {}
        sign_label = _normalize_label(attributes.get("Sign_Abbrev"), None)
        if sign_label:
            building_id = _to_building_numeric(
                attributes.get("BuildingID_Numeric_2"),
            )
            if building_id is not None:
                sign_to_ids[sign_label].add(building_id)
    return {sign for sign, ids in sign_to_ids.items() if len(ids) > 1}


def _resolve_label(
    sign_label: str | None,
    short_label: str | None,
    conflict_signs: set[str],
) -> str | None:
    """Pick the best label, falling back to short_label for ambiguous signs."""
    if sign_label:
        if sign_label not in conflict_signs:
            return sign_label
        return short_label  # None when no fallback available
    return short_label


def _build_sign_mapping(features: Iterable[dict[str, Any]]) -> MappingResult:
    """Construct the sign abbreviation mapping."""
    mapping_logger = get_app_logger()
    grouped: MappingResult = {}

    conflict_signs = _collect_conflicting_signs(features)

    for feature in features:
        attributes = feature.get("attributes") or {}
        label = _resolve_label(
            _normalize_label(attributes.get("Sign_Abbrev"), None),
            _normalize_label(None, attributes.get("Short_Name")),
            conflict_signs,
        )
        if not label:
            continue

        building_id = _to_building_numeric(attributes.get("BuildingID_Numeric_2"))
        building_code = _to_building_code(attributes.get("Building_ID"))

        if building_id is None or building_code is None:
            continue

        entry: MappingEntry = {
            "BuildingID_Numeric_2": building_id,
            "building_code": building_code,
        }

        if label in grouped:
            existing = grouped[label]
            if (
                existing["BuildingID_Numeric_2"] != building_id
                or existing["building_code"] != building_code
            ):
                mapping_logger.warning(
                    "Conflicting mapping for '%s': existing=%s, new=%s; keeping first",
                    label,
                    existing,
                    entry,
                )
                continue

        grouped[label] = entry

    return {label: grouped[label] for label in sorted(grouped)}


def _load_query(path: Path) -> dict[str, Any]:
    """Load query JSON from file."""
    if not path.exists():
        msg = f"Could not find query JSON at {path}"
        raise FileNotFoundError(msg)
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        msg = f"Unexpected JSON shape in {path}; expected an object."
        raise TypeError(msg)
    return {str(key): value for key, value in data.items()}


def _parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Build mapping from signage abbreviations to building IDs.",
    )
    parser.add_argument(
        "--query",
        type=Path,
        default=Path("query.json"),
        help="Path to the ArcGIS export (default: query.json).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("sign_abbrev_mapping.json"),
        help="Path to write the resulting JSON mapping.",
    )
    return parser.parse_args()


def main() -> None:
    """Run the sign abbreviation mapping script."""
    args = _parse_args()
    data = _load_query(args.query)
    features: list[dict[str, Any]] = []
    raw_features = data.get("features")
    if isinstance(raw_features, list):
        features.extend(item for item in raw_features if isinstance(item, dict))

    mapping = _build_sign_mapping(features)
    output = json.dumps(mapping, indent=2, ensure_ascii=False)

    args.output.write_text(output + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
