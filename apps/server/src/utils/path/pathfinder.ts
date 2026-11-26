import type {
  GeoNode,
  GeoNodes,
  GraphPath,
  PreciseRoute,
  Route,
  WayPoint,
} from "@cmumaps/common";
import { dist, geoNodeToNavPathNode } from "@cmumaps/common";
import TinyQueue from "tinyqueue";
import type { Buildings } from "../../services/pathService.ts";
import { generateInstructions } from "./instructions.ts";

const findClosestNeighbors = (
  targetCoord: { latitude: number; longitude: number },
  graph: GeoNodes,
  count: number,
): Record<string, { outFloorCode?: string }> => {
  const distances: Array<{ nodeId: string; distance: number }> = [];

  for (const node of Object.values(graph)) {
    const d = dist(targetCoord, node.pos);
    distances.push({ nodeId: node.id, distance: d });
  }

  // Sort by distance and take the closest 'count' nodes
  distances.sort((a, b) => a.distance - b.distance);
  const closestNodes = distances.slice(0, count);

  // Convert to neighbors object format (EdgeInfo with empty objects)
  const neighbors: Record<string, { outFloorCode?: string }> = {};
  for (const { nodeId } of closestNodes) {
    neighbors[nodeId] = {};
  }

  return neighbors;
};

export const parseWaypoint = (s: string): WayPoint => {
  const waypoint = s.trim();

  if (waypoint.startsWith("floor:")) {
    return { type: "Floor", floorCode: waypoint.slice("floor:".length) };
  }

  if (waypoint.includes(",")) {
    const [latStr, lonStr] = waypoint.split(",");
    const latitude = Number(latStr);
    const longitude = Number(lonStr);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { type: "Coordinate", coordinate: { latitude, longitude } };
    }
  }
  if (waypoint.length < 5) {
    return { type: "Building", buildingCode: waypoint };
  }
  if (waypoint.length === 36 && !waypoint.includes(",")) {
    return { type: "Room", roomId: waypoint };
  }
  // For now, treat unknown as room
  return { type: "Room", roomId: waypoint };
};

export const waypointToNodes = (
  waypoint: WayPoint,
  graph: GeoNodes,
  buildings: Buildings,
) => {
  const nodes: string[] = [];
  switch (waypoint.type) {
    case "Room": {
      for (const node of Object.values(graph)) {
        if (node.roomId === waypoint.roomId) {
          nodes.push(node.id);
        }
      }
      break;
    }
    case "Floor": {
      const [buildingCode, ...floorParts] = waypoint.floorCode.split("-");
      const level = floorParts.join("-");
      if (!(buildingCode && level)) {
        throw new Error(`Invalid floor code: ${waypoint.floorCode}`);
      }

      for (const node of Object.values(graph)) {
        if (
          node.floor?.buildingCode === buildingCode &&
          node.floor?.level === level
        ) {
          nodes.push(node.id);
        }
      }
      break;
    }
    case "Coordinate": {
      const coord = waypoint.coordinate;
      let bestDist: number | null = null;
      let bestNode: string | null = null;
      for (const node of Object.values(graph)) {
        const d = dist(node.pos, coord);
        if (bestDist === null || d < bestDist) {
          bestDist = d;
          bestNode = node.id;
        }
      }
      if (bestNode === null) {
        throw new Error("Graph should not be empty!");
      }
      nodes.push(bestNode);
      break;
    }
    case "Building": {
      for (const node of Object.values(graph)) {
        if (node.floor?.buildingCode === waypoint.buildingCode) {
          nodes.push(node.id);
        }
      }
      if (nodes.length === 0) {
        const building = buildings.find(
          (x) => x.buildingCode === waypoint.buildingCode,
        );
        if (building) {
          // If a node with the building code as its ID already exists in the graph (e.g., from a previous dummy node creation), reuse it instead of creating a new one
          if (graph[building.buildingCode]) {
            nodes.push(building.buildingCode);
            return nodes;
          }
          const dummyCoord = {
            latitude: building.labelLatitude,
            longitude: building.labelLongitude,
          };

          // Find 3 closest neighbors before creating the dummy node
          const neighbors = findClosestNeighbors(dummyCoord, graph, 3);

          const dummyNode: GeoNode = {
            id: building.buildingCode,
            pos: {
              latitude: dummyCoord.latitude,
              longitude: dummyCoord.longitude,
            },
            neighbors,
            roomId: null,
          };
          graph[dummyNode.id] = dummyNode;

          // Add the dummy node as a neighbor to each of the found neighbors (bidirectional)
          for (const neighborId of Object.keys(neighbors)) {
            const neighbor = graph[neighborId];
            if (neighbor) {
              neighbor.neighbors[dummyNode.id] = {};
            }
          }

          nodes.push(dummyNode.id);
        } else {
          console.error("Graph", JSON.stringify(graph));
          console.error(`No nodes found for building ${waypoint.buildingCode}`);
        }
      }
      break;
    }
    default: {
      throw new Error(`Unknown waypoint type: ${JSON.stringify(waypoint)}`);
    }
  }
  return nodes;
};

interface GeoNodeRoute {
  path: GeoNode[];
  distance: number;
}

export const findPath = (
  startNodes: string[],
  endNodes: string[],
  graph: GeoNodes,
  outsideCostMul = 1,
  allowedBuildingCodes?: Set<string>,
): Route | null => {
  interface QueueItem {
    path: string[];
    distance: number;
    addCost: number;
  }

  // Init work list and empty explored set (shared across all start nodes)
  const pq = new TinyQueue<QueueItem>([], (a, b) => a.distance - b.distance);
  const exploredSet = new Set<string>();

  const isGoal = new Set(endNodes);

  const getGeoCoordForNode = (nodeId: string) => {
    const node = graph[nodeId];
    return node.pos;
  };

  // Push all start nodes into the priority queue
  for (const nodeId of startNodes) {
    const node = graph[nodeId];
    if (!node) continue;
    pq.push({ path: [node.id], distance: 0, addCost: 0 });
  }

  // Loop until pq is empty or shortest path is found, always explore lower-cost paths first
  while (pq.length > 0) {
    const current = pq.pop();
    if (!current) break;

    // Extract the node path and the outside penalty (add_cost)
    const curPath = current.path;
    const curAddCost = current.addCost;
    // number of nodes in path
    const pathLen = curPath.length;

    // Extracting neighbors from the most recently added node to the path
    const lastNodeId = curPath[pathLen - 1];
    const lastNode = graph[lastNodeId];
    if (!lastNode) continue;

    if (exploredSet.has(lastNodeId)) {
      continue;
    }
    exploredSet.add(lastNodeId);

    // Check if the popped off node is in the goal set
    // Since we're using a min-heap priority queue sorted by distance,
    // the first goal node we pop is guaranteed to be the shortest path overall
    if (isGoal.has(lastNodeId)) {
      return {
        distance: current.distance,
        path: {
          path: curPath,
          addCost: curAddCost.toString(),
        } as GraphPath,
      } as Route;
    }

    // Add neighbors
    const neighbors = lastNode.neighbors ?? {};
    for (const [neighborId] of Object.entries(neighbors)) {
      const currentNode = graph[lastNodeId];
      const nextNode = graph[neighborId];
      if (!nextNode) continue;

      // Skip nodes that are not in allowed buildings (if restriction is set)
      if (allowedBuildingCodes) {
        const nextBuildingCode = nextNode.floor?.buildingCode ?? "outside";
        if (!allowedBuildingCodes.has(nextBuildingCode)) {
          continue;
        }
      }

      const lastGeo = getGeoCoordForNode(lastNodeId);
      const nextGeo = getGeoCoordForNode(neighborId);

      let outsideAdd = 0;
      const stepDist = (() => {
        if (!(lastGeo && nextGeo)) {
          // Fallback distance if placement missing (mirrors Rust's 25.0 default when dist < 0)
          return 25;
        }
        if (
          currentNode.floor &&
          nextNode.floor &&
          currentNode.floor.buildingCode === nextNode.floor.buildingCode &&
          currentNode.floor.level !== nextNode.floor.level
        ) {
          // Traveling between floors
          return 25;
        }
        const rawDist = dist(lastGeo, nextGeo);
        const lastIsOutside = currentNode.floor?.buildingCode === "outside";
        const nextIsOutside = nextNode.floor?.buildingCode === "outside";
        if (lastIsOutside && nextIsOutside) {
          // Calculate and track penalty cost, must be mult to penalize distance not nodes.
          outsideAdd = rawDist * (outsideCostMul - 1);
          return rawDist * outsideCostMul;
        }
        return rawDist;
      })();

      pq.push({
        path: [...curPath, neighborId],
        distance: current.distance + stepDist,
        addCost: curAddCost + outsideAdd,
      });
    }
  }

  return null;
};

export const getPreciseRoute = (route: GeoNodeRoute): PreciseRoute => {
  // Convert nodes and calculate distances to next node in path
  const pathNodes = route.path.map((node, index) => {
    const navNode = geoNodeToNavPathNode(node);
    // Calculate distance to next node in path
    if (index < route.path.length - 1) {
      const nextNode = route.path[index + 1];
      if (nextNode) {
        const edgeDist = dist(node.pos, nextNode.pos);
        navNode.neighbors[nextNode.id] = {
          ...navNode.neighbors[nextNode.id],
          dist: edgeDist,
        };
      }
    }
    return navNode;
  });

  return {
    path: {
      path: pathNodes,
      distance: route.distance,
    },
    instructions: generateInstructions(route.path),
  };
};

export const getRoute = (
  startNodes: string[],
  endNodes: string[],
  graph: GeoNodes,
  outsideCostMul = 1,
  allowedBuildingCodes?: Set<string>,
): PreciseRoute => {
  const found = findPath(
    startNodes,
    endNodes,
    graph,
    outsideCostMul,
    allowedBuildingCodes,
  );
  if (!found) {
    throw new Error("No path found");
  }

  const nodePath = found.path.path
    .map((nodeId) => graph[nodeId])
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  const trueDistance = found.distance - Number(found.path.addCost);

  const nodesRoute = {
    path: nodePath,
    distance: trueDistance,
  };

  return getPreciseRoute(nodesRoute);
};
