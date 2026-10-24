import type { StateCreator } from "zustand";

export type MapViewMode = "standard" | "hybrid" | "satellite" | "photorealistic3d";

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapController {
  zoomToBounds: (points: MapCoordinate[]) => void;
  zoomToPoint: (point: MapCoordinate, offset?: number) => void;
}

export interface MapSlice {
  mapViewMode: MapViewMode;
  setMapViewMode: (mapViewMode: MapViewMode) => void;
  mapController: MapController | null;
  setMapController: (mapController: MapController | null) => void;
}

export const createMapSlice: StateCreator<MapSlice> = (set) => ({
  mapViewMode: "standard",
  setMapViewMode: (mapViewMode: MapViewMode) => set({ mapViewMode }),
  mapController: null,
  setMapController: (mapController: MapController | null) => set({ mapController }),
});
