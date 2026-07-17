export type SearchIndex = Record<string, [string, number][]>;

import type { Floor, GeoCoordinate, RoomType } from "../../../../../packages/common/src/index.ts";

export interface Document {
  id: string;
  nameWithSpace: string;
  fullNameWithSpace: string;
  labelPosition: GeoCoordinate | null;
  type: "room" | "building" | "floor";
  roomType?: RoomType;
  floor?: Floor;
  alias: string;
  numTerms: number;
}

export type FloorPlans = Record<string, BuildingPlan>;
export type BuildingPlan = Record<string, RoomPlan>;
export type RoomPlan = Record<string, Room>;

export interface Room {
  name: string;
  labelPosition: GeoCoordinate;
  type: RoomType;
  id: string;
  floor: Floor;
  alias: string[];
}
