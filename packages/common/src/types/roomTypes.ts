import type { PdfCoordinate } from "./coordTypes.ts";
import type { Polygon } from "./geojson.ts";

export const RoomTypes = [
  "Default",
  "Corridor",
  "Auditorium",
  "Office",
  "Classroom",
  "Operational", // Used for storage or maintenance, not publicly accessible
  "Conference",
  "Study",
  "Laboratory",
  "Computer Lab",
  "Studio",
  "Workshop",
  "Vestibule",
  "Storage",
  "Restroom",
  "Stairs",
  "Elevator",
  "Ramp",
  "Dining",
  "Food",
  "Store",
  "Library",
  "Sport",
  "Parking",
  "Inaccessible",
  "", // not assigned
] as const;

export type RoomType = (typeof RoomTypes)[number];

export const WalkwayTypeList = ["Corridor", "Ramp", "Library"];

/**
 * OSM Simple Indoor Tagging tags for each RoomType, used for export and contribution
 * https://wiki.openstreetmap.org/wiki/Simple_Indoor_Tagging
 */
export const RoomOsmTags: Record<Exclude<RoomType, "">, { key: string; value: string }[]> = {
  Default: [{ key: "indoor", value: "room" }],
  Corridor: [{ key: "indoor", value: "corridor" }],
  Auditorium: [
    { key: "indoor", value: "room" },
    { key: "amenity", value: "theatre" },
  ],
  Office: [
    { key: "indoor", value: "room" },
    { key: "room", value: "office" },
  ],
  Classroom: [
    { key: "indoor", value: "room" },
    { key: "room", value: "classroom" },
  ],
  Operational: [
    { key: "indoor", value: "room" },
    { key: "access", value: "staff" },
  ],
  Conference: [
    { key: "indoor", value: "room" },
    { key: "room", value: "conference" },
  ],
  Study: [
    { key: "indoor", value: "room" },
    { key: "room", value: "study" },
  ],
  Laboratory: [
    { key: "indoor", value: "room" },
    { key: "room", value: "laboratory" },
  ],
  "Computer Lab": [
    { key: "indoor", value: "room" },
    { key: "room", value: "computer_lab" },
  ],
  Studio: [
    { key: "indoor", value: "room" },
    { key: "room", value: "studio" },
  ],
  Workshop: [
    { key: "indoor", value: "room" },
    { key: "room", value: "workshop" },
  ],
  Vestibule: [
    { key: "indoor", value: "area" },
    { key: "room", value: "entrance" },
  ],
  Storage: [
    { key: "indoor", value: "room" },
    { key: "room", value: "storage" },
  ],
  Restroom: [
    { key: "indoor", value: "room" },
    { key: "amenity", value: "toilets" },
  ],
  Stairs: [
    { key: "indoor", value: "room" },
    { key: "stairs", value: "yes" },
  ],
  Elevator: [
    { key: "indoor", value: "room" },
    { key: "highway", value: "elevator" },
  ],
  Ramp: [
    { key: "indoor", value: "corridor" },
    { key: "ramp", value: "yes" },
  ],
  Dining: [
    { key: "indoor", value: "room" },
    { key: "amenity", value: "restaurant" },
  ],
  Food: [
    { key: "indoor", value: "room" },
    { key: "amenity", value: "fast_food" },
  ],
  Store: [
    { key: "indoor", value: "room" },
    { key: "shop", value: "yes" },
  ],
  Library: [
    { key: "indoor", value: "room" },
    { key: "amenity", value: "library" },
  ],
  Sport: [
    { key: "indoor", value: "room" },
    { key: "leisure", value: "fitness_centre" },
  ],
  Parking: [
    { key: "indoor", value: "area" },
    { key: "amenity", value: "parking" },
  ],
  Inaccessible: [
    { key: "indoor", value: "room" },
    { key: "access", value: "no" },
  ],
};

export interface RoomInfo {
  /**
   * The short name of the room, without the building name but including the
   * floor level (e.g. '121' for CUC 121)
   */
  name: string;

  /**
   * The coordinates of the label of the room
   */
  labelPosition: PdfCoordinate;

  /**
   * The type of the room
   */
  type: RoomType;

  /**
   * The name under which the room is known (e.g. 'McConomy Auditorium')
   * The one that will be displayed.
   */
  displayAlias?: string;

  /**
   * List of names under which the room is known (e.g. 'McConomy Auditorium')
   * Used for searching
   */
  aliases: string[];

  /**
   * Geojson polygon that outlines the room
   */
  polygon: Polygon;
}

export type Rooms = Record<string, RoomInfo>;
