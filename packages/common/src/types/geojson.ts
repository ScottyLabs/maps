// Minimal copy of @types/geojson, which pulls in a DOM-dependent global.

export type Position = number[];

export interface Polygon {
  type: "Polygon";
  coordinates: Position[][];
}
