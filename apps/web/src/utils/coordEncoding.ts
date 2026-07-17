interface Coordinate {
  latitude: number;
  longitude: number;
}

export function encodeCoord(coord: Coordinate): string {
  const s = `${coord.latitude},${coord.longitude}`;
  return btoa(s);
}

export function decodeCoord(s: string): Coordinate {
  const decoded = atob(s);
  const [latitude, longitude] = decoded.split(",").map(Number);
  if (latitude === undefined || longitude === undefined) {
    throw new Error("Invalid coordinate string");
  }
  return { latitude, longitude };
}
