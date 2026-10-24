from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from clients.dataset import JsonSource, TableWriter

# Script to populate Edge table of the database using all_graph.json
# excludes outside, neighbors who are missing in node or out node,
# edges whose in node or out node are missing a roomId
# python scripts/json-to-database/edge.py
from clients import get_api_client_singleton, get_s3_client_singleton
from logger import get_app_logger

MAX_EDGES_PER_REQUEST = 5000  # Tested to work with 1MB request payload limit


def populate_edge_table(
    *,
    source: JsonSource | None = None,
    writer: TableWriter | None = None,
) -> None:
    """Populate the Edge table using all-graph.json.

    Precondition: Node table must be populated.
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

    # Iterate through all nodes and create a list of edges data
    # in the required format for the populate edge table api endpoint
    edge_data = []
    batch_count = 0  # Count of batches of edges processed
    for node_id in graph:
        if "neighbors" not in graph[node_id]:
            continue

        neighbors = graph[node_id]["neighbors"]
        for neighbor_id in neighbors:
            in_node_id = node_id
            out_node_id = neighbor_id

            edge_node = {"inNodeId": in_node_id, "outNodeId": out_node_id}

            if out_node_id not in graph:
                continue

            edge_data.append(edge_node)

            # If the number of edges is greater than the limit, populate the Edge table
            # so we don't exceed the request payload limit
            if len(edge_data) >= MAX_EDGES_PER_REQUEST:
                # API call to populate the Edge table
                if not api_client.populate_table("Edge", edge_data):
                    msg = "Failed to populate the Edge table"
                    logger.critical(msg)
                    raise RuntimeError(msg)

                # Log the progress
                logger.debug("Populated %d edges", batch_count * MAX_EDGES_PER_REQUEST)
                batch_count += 1
                edge_data = []

    # API call to populate the rest of the edges
    if not api_client.populate_table("Edge", edge_data):
        msg = "Failed to populate the Edge table"
        logger.critical(msg)
        raise RuntimeError(msg)

    # Log the progress
    total_edges = batch_count * MAX_EDGES_PER_REQUEST + len(edge_data)
    logger.debug("Populated %d edges", total_edges)
