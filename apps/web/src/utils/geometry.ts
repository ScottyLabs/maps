// The number of meters in a degree.
import type { GeoCoordinate } from "@cmumaps/common";
import type { Coordinate } from "mapkit-react";

/**
 * Determines whether a point is in a polygon
 * (Assumes Euclidian geometry)
 * Based on https://stackoverflow.com/a/29915728/4652564
 * @param vertices The vertices of the polygon
 * @param point The point
 * @returns true if the point is in the polygon; false otherwise
 */
export function isInPolygon(point: Coordinate, vertices: GeoCoordinate[]) {
  const x = point.longitude;
  const y = point.latitude;

  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];

    // Flex your 15-122 knowledge and prove this never happens!
    if (vi === undefined || vj === undefined) {
      continue;
    }

    const xi = vi.longitude;
    const yi = vi.latitude;
    const xj = vj.longitude;
    const yj = vj.latitude;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
