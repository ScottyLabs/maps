from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from clients.dataset import JsonSource, TableWriter

from typing import Any

from clients import get_api_client_singleton, get_s3_client_singleton
from logger import get_app_logger


def populate_alias_table(
    *,
    source: JsonSource | None = None,
    writer: TableWriter | None = None,
) -> None:
    """Populate the Alias table using floorplans.json.

    Precondition: Room table must be populated.
    """
    # Get the logger and clients
    logger = get_app_logger()
    api_client = writer if writer is not None else get_api_client_singleton()
    s3_client = source if source is not None else get_s3_client_singleton()

    # Get the floorplans data from S3
    data = s3_client.get_json_file("floorplans/floorplans.json")
    if data is None:
        msg = "Failed to get floorplans data from S3"
        logger.critical(msg)
        raise ValueError(msg)

    # Iterate through all buildings and create a list of alias data
    # in the required format for the populate alias table api endpoint
    alias_data = []
    for building in data:
        # skip empty buildings
        if not data[building]:
            continue

        # skip outside because we will be using OSM
        if building == "outside":
            continue

        for floor in data[building]:
            for room_id in data[building][floor]:
                room = data[building][floor][room_id]
                aliases = create_aliases(room)
                alias_data.extend(aliases)

    # API call to populate the Alias table
    response = api_client.populate_table("Alias", alias_data)
    if not response:
        msg = "Failed to populate the Alias table"
        logger.critical(msg)
        raise RuntimeError(msg)


def create_aliases(room: dict[str, Any]) -> list[dict[str, Any]]:
    """Create a list of aliases for a room."""
    # skip rooms without aliases
    if not room.get("aliases"):
        return []

    display_alias = room["aliases"][0]

    return [
        {
            "alias": alias,
            "roomId": room["id"],
            "isDisplayAlias": alias == display_alias,
        }
        for alias in room["aliases"]
        if alias  # skip empty aliases
    ]
