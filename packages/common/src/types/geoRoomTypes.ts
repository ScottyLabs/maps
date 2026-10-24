import type { GeoCoordinate } from "./coordTypes.ts";
import type { Floor } from "./floorTypes.ts";
import type { RoomType } from "./roomTypes.ts";

export interface GeoRoom {
  /** Source label; empty when a captured space still needs a name. */
  name?: string;
  /**
   * The coordinates of the label of the room
   */
  labelPosition: GeoCoordinate;

  /**
   * the floor that the room is on
   */
  floor: Floor;

  /**
   * The type of the room
   */
  type: RoomType;

  /**
   * The name under which the room is known (e.g. 'McConomy Auditorium')
   * The one that will be displayed.
   */
  alias?: string;

  /**
   * Points to display on map
   */
  points: GeoCoordinate[][];

  /**
   * The uuid of the room
   */
  id: string;
}

// maps from name to room
export type GeoRooms = Record<string, GeoRoom>;
