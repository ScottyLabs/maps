from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from clients.dataset import JsonSource, TableWriter

import json

from clients import get_api_client_singleton, get_s3_client_singleton
from logger import get_app_logger


def populate_building_table(
    *,
    source: JsonSource | None = None,
    writer: TableWriter | None = None,
) -> None:
    """Populate the Building table using buildings.json."""
    # Get the logger and clients
    logger = get_app_logger()
    api_client = writer if writer is not None else get_api_client_singleton()
    s3_client = source if source is not None else get_s3_client_singleton()

    # Get buildings data from S3
    data = s3_client.get_json_file("floorplans/buildings.json")
    if data is None:
        msg = "Failed to get buildings data from S3"
        logger.critical(msg)
        raise ValueError(msg)

    # Iterate through all buildings and create a list of buildings data
    # in the required format for the populate building table api endpoint
    buildings_data = []
    for building_code in data:
        name = data[building_code]["name"]
        osm_id = data[building_code]["osmId"]
        default_ordinal = data[building_code].get("defaultOrdinal", None)
        label_latitude = data[building_code]["labelPosition"]["latitude"]
        label_longitude = data[building_code]["labelPosition"]["longitude"]
        shape = json.dumps(data[building_code]["shapes"])
        hitbox = json.dumps(data[building_code].get("hitbox"))
        building = {
            "buildingCode": building_code,
            "name": name,
            "osmId": osm_id,
            "defaultOrdinal": default_ordinal,
            "labelLatitude": label_latitude,
            "labelLongitude": label_longitude,
            "shape": shape,
            "hitbox": hitbox,
        }
        buildings_data.append(building)

    # API call to populate the Building table
    if not api_client.populate_table("Building", buildings_data):
        msg = "Failed to populate the Building table"
        logger.critical(msg)
        raise RuntimeError(msg)
