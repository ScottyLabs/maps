from pydantic import BaseModel, ConfigDict, Field


class GeoCoordinate(BaseModel):
    """Geographic coordinate with latitude and longitude."""

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class LocalPosition(BaseModel):
    """Local position with x and y coordinates."""

    model_config = ConfigDict(extra="forbid")

    x: float
    y: float


class Floor(BaseModel):
    """Floor reference with building code and level."""

    model_config = ConfigDict(extra="forbid")

    building_code: str = Field(alias="buildingCode")
    level: str
