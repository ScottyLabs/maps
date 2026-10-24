"""Pydantic model for the Poi table."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel

# Mirror of @cmumaps/common PoiTypes
PoiType = Literal[
    "Vending Machine",
    "Water Fountain",
    "Printer",
    "AED",
    "Bike Rack",
    "Restroom",
    "Emergency Phone",
    "",
]


class Poi(BaseModel):
    """A POI on campus with coordinates and optional building/floor."""

    model_config = ConfigDict(
        extra="forbid", populate_by_name=True, allow_inf_nan=False,
    )

    poi_id: str = Field(alias="poiId")
    type: PoiType
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    building_code: str | None = Field(default=None, alias="buildingCode")
    floor_level: str | None = Field(default=None, alias="floorLevel")


# Mapping from OSM (key, value) tags to PoiType
OSM_TAG_TO_POI_TYPE: dict[tuple[str, str], PoiType] = {
    ("amenity", "vending_machine"): "Vending Machine",
    ("amenity", "drinking_water"): "Water Fountain",
    ("amenity", "printer"): "Printer",
    ("emergency", "defibrillator"): "AED",
    ("amenity", "bicycle_parking"): "Bike Rack",
    ("amenity", "toilets"): "Restroom",
    ("emergency", "phone"): "Emergency Phone",
}


class Pois(RootModel[dict[str, Poi]]):
    """Root POI dictionary; an empty dictionary is a valid zero-result dataset."""
