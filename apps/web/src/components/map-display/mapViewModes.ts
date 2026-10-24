import { MapType } from "mapkit-react";
import type { MapViewMode } from "@/store/mapSlice.ts";

export interface MapViewOption {
  mode: MapViewMode;
  label: string;
}

export const MAP_VIEW_OPTIONS: MapViewOption[] = [
  { mode: "standard", label: "Standard" },
  { mode: "hybrid", label: "Hybrid" },
  { mode: "satellite", label: "Satellite" },
  { mode: "photorealistic3d", label: "Photorealistic 3D" },
];

export const MAPKIT_MAP_TYPE_BY_MODE: Record<Exclude<MapViewMode, "photorealistic3d">, MapType> = {
  standard: MapType.Standard,
  hybrid: MapType.Hybrid,
  satellite: MapType.Satellite,
};
