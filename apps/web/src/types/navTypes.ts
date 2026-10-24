/** biome-ignore-all lint/style/useNamingConvention: TODO: use right naming convention */
import type { Floor } from "@cmumaps/common";
import type { Coordinate } from "mapkit-react";

export interface Edge {
  dist: number;
  toFloorInfo: { toFloor: string; type: string };
}

export interface Node {
  neighbors: {
    [neighborId: string]: Edge;
  };
  roomId: string;
  floor: Floor;
  coordinate: Coordinate;
  id: string;
}

export interface Instruction {
  action: string;
  distance: number;
  nodeId: string;
}

export interface NavPath {
  instructions: Instruction[];
  path: { path: Node[]; distance: number };
}

export type NavWaypointType = "User" | "Room" | "Building" | "Coordinate" | "Floor";

export type NavPathType = "Fastest" | "Accessible" | "Inside" | "Outside";

export interface NavPaths {
  Fastest?: NavPath;
  Accessible?: NavPath;
  Inside?: NavPath;
  Outside?: NavPath;
}
