import type { Graph, Mst, Rooms } from "@cmumaps/common";
import { PriorityQueue } from "@datastructures-js/priority-queue";
import type { useNavigate } from "@tanstack/react-router";
import { toast } from "react-toastify";
import { setMst } from "../store/features/dataSlice.ts";
import type { AppDispatch } from "../store/store.ts";
import { dist } from "./geometryUtils.ts";

// calculate mst for each connected components of the graph
export const calcMst = (
  graph: Graph,
  rooms: Rooms,
  navigate: ReturnType<typeof useNavigate>,
  dispatch: AppDispatch,
) => {
  // MST is a set of edges (inNodeId, outNodeId)
  const mst: Mst = {};
  const visited: Set<string> = new Set();
  const pq = new PriorityQueue<{ value: [string, string]; priority: number }>(
    (a, b) => a.priority - b.priority,
  );

  // Helper function to add edges to priority queue from a node
  const addEdgesToQueue = (nodeId: string) => {
    const edges = graph[nodeId].neighbors;
    for (const neighborId in edges) {
      if (!visited.has(neighborId)) {
        // don't add node belonging a different floor
        if (edges[neighborId].outFloorCode) {
          continue;
        }

        pq.enqueue({
          value: [nodeId, neighborId],
          priority: dist(graph[nodeId].pos, graph[neighborId].pos),
        });
      }
    }
  };

  // pick a random node to start Prim's
  const randomNode =
    Object.keys(graph)[Math.floor(Math.random() * Object.keys(graph).length)];
  addEdgesToQueue(randomNode);
  visited.add(randomNode);

  // Continue until the queue is empty or all nodes are visited
  while (!pq.isEmpty()) {
    const element = pq.dequeue();
    if (!element) {
      break;
    }

    const [inNodeId, outNodeId] = element.value;

    if (visited.has(outNodeId)) {
      continue;
    }

    // Add edge to MST
    if (!mst[inNodeId]) {
      mst[inNodeId] = {};
    }
    mst[inNodeId][outNodeId] = true;
    visited.add(outNodeId);

    // Add edges from the newly added node to the priority queue
    addEdgesToQueue(outNodeId);
  }

  // return the closest node to the MST
  let nodeNotInMst: string | null = null;
  let minDist = 0;
  for (const nodeId in graph) {
    if (!visited.has(nodeId)) {
      if (!graph[nodeId].roomId) {
        continue;
      }

      const room = rooms[graph[nodeId].roomId];
      if (room.type !== "Inaccessible") {
        const curDist = Array.from(visited).reduce(
          (min, visitedNodeId) =>
            Math.min(min, dist(graph[nodeId].pos, graph[visitedNodeId].pos)),
          Number.POSITIVE_INFINITY,
        );
        if (!nodeNotInMst || curDist < minDist) {
          nodeNotInMst = nodeId;
          minDist = curDist;
        }
      }
    }
  }

  if (nodeNotInMst) {
    toast.error("MST not complete!");
    navigate({ to: ".", search: { nodeId: nodeNotInMst } });
  } else {
    toast.success("Found MST!");
  }

  dispatch(setMst(mst));
};
