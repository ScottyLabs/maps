/** biome-ignore-all lint/style/useNamingConvention: TODO: use the right naming convention */
import type { GeoNodes, PreciseRoute } from "@cmumaps/common";
import { requestRuntime } from "../lib/mapRuntime.ts";
import { prisma } from "../../prisma/index.ts";
import {
  getRoute,
  parseWaypoint,
  waypointToNodes,
} from "../utils/path/pathfinder.ts";

export type Buildings = Awaited<ReturnType<typeof prisma.building.findMany>>;

const OUTSIDE_MULTIPLIER = 100;
// Cache the graph
let graphCache: GeoNodes | null = null;

export async function prepareGraph(database = prisma): Promise<GeoNodes> {
  const dbNodes = await database.node.findMany({
    include: {
      outEdges: {
        include: {
          outNode: { select: { buildingCode: true, floorLevel: true } },
        },
      },
      floor: true,
    },
  });

  const graph: GeoNodes = {};
  for (const node of dbNodes) {
    const neighbors: Record<string, { outFloorCode?: string }> = {};
    for (const edge of node.outEdges) {
      const out = edge.outNode;
      const outFloorCode = `${out.buildingCode ?? "outside"}-${out.floorLevel ?? "outside"}`;
      neighbors[edge.outNodeId] = {};
      if (
        out.buildingCode !== node.buildingCode ||
        out.floorLevel !== node.floorLevel
      ) {
        neighbors[edge.outNodeId].outFloorCode = outFloorCode;
      }
    }

    graph[node.nodeId] = {
      id: node.nodeId,
      neighbors,
      roomId: node.roomId ?? null,
      pos: {
        latitude: node.latitude,
        longitude: node.longitude,
      },
      floor: node.floor
        ? {
            buildingCode: node.floor.buildingCode,
            level: node.floor.floorLevel,
            centerX: node.floor.centerX,
            centerY: node.floor.centerY,
            centerLatitude: node.floor.centerLatitude,
            centerLongitude: node.floor.centerLongitude,
            scale: node.floor.scale,
            angle: node.floor.angle,
          }
        : {
            buildingCode: "outside",
            level: "1",
          },
    } as GeoNodes[string];
  }

  return graph;
}

export function activateGraph(graph: GeoNodes) {
  graphCache = graph;
}

export function activeGraph(): GeoNodes {
  if (!graphCache) throw new Error("Graph cache is not ready");
  return graphCache;
}

async function getOrBuildGraph(): Promise<GeoNodes> {
  const context = requestRuntime();
  if (context) return context.graph;
  if (!graphCache) graphCache = await prepareGraph();
  return graphCache;
}

// Allowed building codes for public pathfinding (outside + CUC only)
const PUBLIC_ALLOWED_BUILDINGS = new Set(["outside", "CUC"]);

export const pathService = {
  async calculatePath(
    start: string,
    end: string,
  ): Promise<Record<string, PreciseRoute>> {
    if (!(start && end)) {
      throw new Error("Invalid start or end waypoint format");
    }

    // Get cached graph
    const graph = await getOrBuildGraph();

    // Parse waypoints
    const startWaypoint = parseWaypoint(start);
    const endWaypoint = parseWaypoint(end);

    const buildings = await prisma.building.findMany();
    const startNodes = waypointToNodes(startWaypoint, graph, buildings);
    const endNodes = waypointToNodes(endWaypoint, graph, buildings);

    if (startNodes.length === 0 || endNodes.length === 0) {
      let msg: string;
      if (startNodes.length === 0 && endNodes.length === 0) {
        msg = `Could not match start or end waypoint to any nodes: ${start}, ${JSON.stringify(startWaypoint)}, ${end}, ${JSON.stringify(endWaypoint)}`;
      } else if (startNodes.length === 0) {
        msg = `Could not match start waypoint to any nodes: ${start}, ${JSON.stringify(startWaypoint)}, ${end}, ${JSON.stringify(endWaypoint)}`;
      } else {
        msg = `Could not match end waypoint to any nodes: ${end}, ${JSON.stringify(endWaypoint)}`;
      }
      throw new Error(msg);
    }

    // Calculate the fastest route (no outside penalty)
    const fastestRoute = getRoute(startNodes, endNodes, graph, 1);

    // Calculate the inside route with a higher outside cost multiplier
    // to incentivize finding indoor paths
    const insideRoute = getRoute(
      startNodes,
      endNodes,
      graph,
      OUTSIDE_MULTIPLIER,
    );

    const result: Record<string, PreciseRoute> = {
      Fastest: fastestRoute,
      Inside: insideRoute,
    };
    return result;
  },

  async calculatePublicPath(
    start: string,
    end: string,
  ): Promise<Record<string, PreciseRoute>> {
    if (!(start && end)) {
      throw new Error("Invalid start or end waypoint format");
    }

    // Get cached graph
    const graph = await getOrBuildGraph();

    // Parse waypoints
    const startWaypoint = parseWaypoint(start);
    const endWaypoint = parseWaypoint(end);

    const buildings = await prisma.building.findMany();
    const startNodes = waypointToNodes(startWaypoint, graph, buildings);
    const endNodes = waypointToNodes(endWaypoint, graph, buildings);

    if (startNodes.length === 0 || endNodes.length === 0) {
      let msg: string;
      if (startNodes.length === 0 && endNodes.length === 0) {
        msg = `Could not match start or end waypoint to any nodes: ${start}, ${JSON.stringify(startWaypoint)}, ${end}, ${JSON.stringify(endWaypoint)}`;
      } else if (startNodes.length === 0) {
        msg = `Could not match start waypoint to any nodes: ${start}, ${JSON.stringify(startWaypoint)}, ${end}, ${JSON.stringify(endWaypoint)}`;
      } else {
        msg = `Could not match end waypoint to any nodes: ${end}, ${JSON.stringify(endWaypoint)}`;
      }
      throw new Error(msg);
    }

    // Calculate the fastest route with building restrictions (outside + CUC only)
    const fastestRoute = getRoute(
      startNodes,
      endNodes,
      graph,
      1,
      PUBLIC_ALLOWED_BUILDINGS,
    );

    // Calculate the inside route with building restrictions
    const insideRoute = getRoute(
      startNodes,
      endNodes,
      graph,
      OUTSIDE_MULTIPLIER,
      PUBLIC_ALLOWED_BUILDINGS,
    );

    const result: Record<string, PreciseRoute> = {
      Fastest: fastestRoute,
      Inside: insideRoute,
    };
    return result;
  },
};
