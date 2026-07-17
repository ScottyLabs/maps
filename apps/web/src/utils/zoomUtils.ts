import type { Buildings, Floor } from "@cmumaps/common";
import type { Coordinate } from "mapkit-react";
import { prefersReducedMotion } from "@/utils/prefersReducedMotion.ts";

const setIsZoomingAsync =
  (setIsZooming: (isZooming: boolean) => void) => (isZooming: boolean) =>
    new Promise<void>((resolve) => {
      setIsZooming(isZooming);
      resolve();
    });

export const zoomOnFloor = async (
  map: mapkit.Map,
  buildings: Buildings,
  floor: Floor,
  setIsZooming: (isZooming: boolean) => void,
) => {
  // zoom after finish setting the floor
  await setIsZoomingAsync(setIsZooming)(true).then(() => {
    const shape = buildings[floor.buildingCode]?.shape;
    if (shape) {
      zoomOnObject(map, shape.flat());
    }
  });
};

export const zoomOnObject = (
  map: mapkit.Map,
  points: Coordinate[],
  setIsZooming?: (_: boolean) => void,
) => {
  const allLat = points.map((p) => p.latitude);
  const allLon = points.map((p) => p.longitude);

  setIsZooming?.(true);

  map.setRegionAnimated(
    new mapkit.BoundingRegion(
      Math.max(...allLat),
      Math.max(...allLon),
      Math.min(...allLat),
      Math.min(...allLon),
    ).toCoordinateRegion(),
    !prefersReducedMotion(),
  );
};

export const zoomOnPoint = (
  map: mapkit.Map,
  point: Coordinate,
  offset = 0.001,
  setIsZooming?: (_: boolean) => void,
  setQueuedZoomRegion?: (region: mapkit.CoordinateRegion | null) => void,
) => {
  const region = new mapkit.BoundingRegion(
    point.latitude + offset,
    point.longitude + offset,
    point.latitude - offset,
    point.longitude - offset,
  ).toCoordinateRegion();

  setIsZooming?.(true);
  setQueuedZoomRegion?.(region);

  map.setRegionAnimated(region, !prefersReducedMotion());
};
