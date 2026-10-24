from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from clients.dataset import JsonSource, TableWriter

import json

from clients import get_api_client_singleton, get_s3_client_singleton
from logger import get_app_logger


def populate_room_table(
    *,
    source: JsonSource | None = None,
    writer: TableWriter | None = None,
) -> None:
    """Populate the Room table using floorplans.json.

    Precondition: Floor table must be populated.
    """
    # Get the logger and clients
    logger = get_app_logger()
    api_client = writer if writer is not None else get_api_client_singleton()
    s3_client = source if source is not None else get_s3_client_singleton()

    # Get the floorplans data from S3
    floorplans = s3_client.get_json_file("floorplans/floorplans.json")
    if floorplans is None:
        msg = "Failed to get floorplans data from S3"
        logger.critical(msg)
        raise ValueError(msg)

    # Iterate through all buildings and create a list of rooms data
    # in the required format for the populate room table api endpoint
    for building in floorplans:
        # skip empty buildings
        if not floorplans[building]:
            continue

        # skip outside because we will be using OSM
        if building == "outside":
            continue

        # Make a request for every floor to bypass the request payload limit
        for floor in floorplans[building]:
            rooms_data = []
            for room_id in floorplans[building][floor]:
                room = floorplans[building][floor][room_id]
                label_latitude = room["labelPosition"]["latitude"]
                label_longitude = room["labelPosition"]["longitude"]
                room_type = room["type"]
                building_code = room["floor"]["buildingCode"]
                floor_level = room["floor"]["level"]
                name = room["name"]
                polygon = json.dumps(room["coordinates"])

                room = {
                    "roomId": room_id,
                    "name": name,
                    "type": room_type,
                    "labelLatitude": label_latitude,
                    "labelLongitude": label_longitude,
                    "polygon": polygon,
                    "buildingCode": building_code,
                    "floorLevel": floor_level,
                }

                rooms_data.append(room)

            # API call to populate the Room table
            if not api_client.populate_table("Room", rooms_data):
                msg = "Failed to populate the Room table"
                logger.critical(msg)
                raise RuntimeError(msg)

            # Log the progress
            logger.debug("Populated rooms for %s-%s", building, floor)
