import type { Building, Floor } from "@cmumaps/common";

export const getFloorOrdinal = (building: Building, floor: Floor) => {
  if (!building.defaultFloor) {
    return 0;
  }

  const defaultIndex = building.floors.indexOf(building.defaultFloor);
  const focusedIndex = building.floors.indexOf(floor.level);
  return (building?.defaultOrdinal || 0) + focusedIndex - defaultIndex;
};

export const getFloorByOrdinal = (building: Building, ordinal: number): Floor | null => {
  if (!building.defaultFloor) {
    return null;
  }

  const ordinalDif = ordinal - (building.defaultOrdinal || 0);
  const defaultIndex = building.floors.indexOf(building.defaultFloor);
  const floorIndex = defaultIndex + ordinalDif;

  if (!building.floors[floorIndex]) {
    return null;
  }

  return {
    buildingCode: building.code,
    level: building.floors[floorIndex],
  };
};

export const buildFloorCode = (
  buildingCode: string | undefined,
  floorLevel: string | undefined,
): string | null => {
  if (!(buildingCode && floorLevel) || buildingCode === "outside") return null;
  return `${buildingCode}-${floorLevel}`;
};

export const getFloorCode = (floor: Floor | undefined): string | null => {
  if (!floor) return null;
  return buildFloorCode(floor.buildingCode, floor.level);
};

const FLOOR_REGEX = /^[A-F0-9]|LL|M|EV|PH/u; // matches A-F, 0-9, and LL at the start of a string
export const getFloorLevelFromRoomName = (roomName: string | undefined) => {
  if (!roomName) return;
  return roomName.match(FLOOR_REGEX)?.[0] || "";
};
