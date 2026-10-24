from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from clients.dataset import JsonSource, TableWriter

from clients import get_api_client_singleton, get_s3_client_singleton
from logger import get_app_logger

MAX_NODES_PER_REQUEST = 5000  # Tested to work with 1MB request payload limit


def populate_node_table(
    *,
    source: JsonSource | None = None,
    writer: TableWriter | None = None,
) -> None:
    """Populate the Node table using all-graph.json.

    Precondition: Room table must be populated.
    """
    # Get the logger and clients
    logger = get_app_logger()
    api_client = writer if writer is not None else get_api_client_singleton()
    s3_client = source if source is not None else get_s3_client_singleton()

    # Get the all-graph data from S3
    graph = s3_client.get_json_file("floorplans/all-graph.json")
    if graph is None:
        msg = "Failed to get all-graph data from S3"
        logger.critical(msg)
        raise ValueError(msg)

    # Iterate through all nodes and create a list of nodes data
    # in the required format for the populate node table api endpoint
    node_data = []
    batch_count = 0  # Count of batches of nodes processed
    for node_id in graph:
        node = graph[node_id]
        latitude = node["coordinate"]["latitude"]
        longitude = node["coordinate"]["longitude"]
        building_code = node["floor"]["buildingCode"]
        floor_level = node["floor"]["level"]
        room_id = node.get("roomId") if building_code != "outside" else ""

        node = {
            "nodeId": node_id,
            "latitude": latitude,
            "longitude": longitude,
            "buildingCode": building_code if building_code != "outside" else None,
            "floorLevel": floor_level if building_code != "outside" else None,
            "roomId": room_id if room_id else None,
        }

        node_data.append(node)

        # If the number of nodes is greater than the limit, populate the Node table
        # so we don't exceed the request payload limit
        if len(node_data) >= MAX_NODES_PER_REQUEST:
            # API call to populate the Node table
            if not api_client.populate_table("Node", node_data):
                msg = "Failed to populate the Node table"
                logger.critical(msg)
                raise RuntimeError(msg)

            # Log the progress
            logger.debug("Populated %d nodes", batch_count * MAX_NODES_PER_REQUEST)
            batch_count += 1
            node_data = []

    # API call to populate the rest of the nodes
    if not api_client.populate_table("Node", node_data):
        msg = "Failed to populate the Node table"
        logger.critical(msg)
        raise RuntimeError(msg)

    # Log the progress
    total_nodes = batch_count * MAX_NODES_PER_REQUEST + len(node_data)
    logger.debug("Populated %d nodes", total_nodes)
