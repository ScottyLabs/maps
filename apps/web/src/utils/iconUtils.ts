/** biome-ignore-all lint/style/useNamingConvention: TODO: use right naming convention */
import type { GeoRoom, RoomType } from "@cmumaps/common";
import restroomIcon from "@/assets/icons/quick_search/restroom.svg";
import corridorIcon from "@/assets/icons/search_results/corridor.svg";
import diningIcon from "@/assets/icons/search_results/dining.svg";
import elevatorIcon from "@/assets/icons/search_results/elevator.svg";
import foodIcon from "@/assets/icons/search_results/food.svg";
import pinIcon from "@/assets/icons/search_results/pin.svg";
import stairsIcon from "@/assets/icons/search_results/stairs.svg";
import studyIcon from "@/assets/icons/search_results/study.svg";
import type { Document } from "@/types/searchTypes.ts";

const icons: Partial<Record<RoomType, string>> = {
  Elevator: elevatorIcon,
  Corridor: corridorIcon,
  Dining: diningIcon,
  Food: foodIcon,
  Stairs: stairsIcon,
  Library: studyIcon,
  Restroom: restroomIcon,
  Classroom: studyIcon,
  Parking: pinIcon,
  Studio: pinIcon,
  Vestibule: pinIcon,
  Auditorium: pinIcon,
  Sport: pinIcon,
  Workshop: pinIcon,
  Store: pinIcon,
};

export function getIcon(room: GeoRoom | Document) {
  if (room.type === "Building") {
    return null;
  }

  return icons[room.type];
}
