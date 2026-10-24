from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from clients.dataset import JsonSource, TableWriter

from clients import get_api_client_singleton, get_s3_client_singleton
from logger import get_app_logger


def populate_floor_table(
    *,
    source: JsonSource | None = None,
    writer: TableWriter | None = None,
) -> None:
    """Populate the Floor table using placements.json and buildings.json.

    Precondition: Building table must be populated.
    """
    # Get the logger and clients
    logger = get_app_logger()
    api_client = writer if writer is not None else get_api_client_singleton()
    s3_client = source if source is not None else get_s3_client_singleton()

    # Get the buildings data from S3
    buildings = s3_client.get_json_file("floorplans/buildings.json")
    if buildings is None:
        msg = "Failed to get buildings data from S3"
        logger.critical(msg)
        raise ValueError(msg)

    # Get the placements data from S3
    placements = s3_client.get_json_file("floorplans/placements.json")
    if placements is None:
        msg = "Failed to get placements data from S3"
        logger.critical(msg)
        raise ValueError(msg)

    # Iterate through all buildings and create a list of floors data
    # in the required format for the populate floor table api endpoint
    floors_data = []
    for building_code in placements:
        # skip outside
        if building_code == "outside":
            continue

        for floor_level in placements[building_code]:
            placement = placements[building_code][floor_level]
            center_latitude = placement["center"]["latitude"]
            center_longitude = placement["center"]["longitude"]
            scale = placement["scale"]
            angle = placement["angle"]
            pdf_center = placement["pdfCenter"]

            default_floor = buildings[building_code]["defaultFloor"]
            is_default = floor_level == default_floor

            floor = {
                "buildingCode": building_code,
                "floorLevel": floor_level,
                "isDefault": is_default,
                "centerX": pdf_center["x"],
                "centerY": pdf_center["y"],
                "centerLatitude": center_latitude,
                "centerLongitude": center_longitude,
                "scale": scale,
                "angle": angle,
            }

            floors_data.append(floor)

    # API call to populate the Floor table
    if not api_client.populate_table("Floor", floors_data):
        msg = "Failed to populate the Floor table"
        logger.critical(msg)
        raise RuntimeError(msg)
