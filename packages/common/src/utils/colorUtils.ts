import type { RoomType } from "../types/index.ts";

/**
 * The attributes of a room type.
 */
interface RoomTypeDetails {
  /**
   * A CSS color used for the marker of the room
   */
  primary: string;

  /**
   * A CSS color used for the background of the room's shape
   */
  background: string;

  /**
   * A CSS color used for the border of the room's shape
   */
  border: string;
}

/**
 * Returns the attributes of a room type
 * @param type The type of the room
 * @returns See RoomTypeDetails
 */
export function getRoomTypeDetails(type: RoomType): RoomTypeDetails {
  switch (type) {
    case "Default":
      return { primary: "#b5b3b2", background: "#eeeeee", border: "#cccccc" };
    case "Corridor":
      return { primary: "#cecece", background: "#fefefe", border: "#cccccc" };
    case "Office":
      return { primary: "#b5b3b2", background: "#eeeeee", border: "#cccccc" };
    case "Auditorium":
    case "Classroom":
    case "Conference":
      return { primary: "#7082b3", background: "#e6ecfe", border: "#9eabcd" };
    case "Operational":
    case "Storage":
      return { primary: "#808080", background: "#ece3d5", border: "#b9b9b9" };
    case "Laboratory":
    case "Computer Lab":
    case "Studio":
    case "Workshop":
      return { primary: "#ff7e81", background: "#ffdbdc", border: "#ff7e81" };
    case "Vestibule":
      return { primary: "#cecece", background: "#fefefe", border: "#cccccc" };
    case "Restroom":
      return { primary: "#c39dff", background: "#e7dfed", border: "#d6d0db" };
    case "Stairs":
    case "Elevator":
    case "Ramp":
      return { primary: "#3b92f0", background: "#c4dadf", border: "#9bacb0" };
    case "Dining":
      return { primary: "#ff961c", background: "#ffdcb2", border: "#f8992a" };
    case "Food":
      return { primary: "#ff961c", background: "#ffdcb2", border: "#f8992a" };
    case "Store":
      return { primary: "#ffc855", background: "#fff0d0", border: "#ffc855" };
    case "Library":
    case "Study":
      return { primary: "#d18e63", background: "#f5dbc8", border: "#d18e63" };
    case "Sport":
      return { primary: "#6bc139", background: "#e1fcd1", border: "#9ac382" };
    case "Parking":
      return { primary: "#51a2f7", background: "#d4e9ff", border: "#51a2f7" };
    default:
      return { primary: "#b5b3b2", background: "#eeeeee", border: "#cccccc" };
  }
}
