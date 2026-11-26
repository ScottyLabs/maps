import type { Building, Floor } from "@cmumaps/common";
import { INITIAL_REGION } from "@cmumaps/ui";
import type { CoordinateRegion } from "mapkit-react";
import type { RefObject } from "react";
import { useState } from "react";
import { $api } from "@/api/client";
import {
  THRESHOLD_DENSITY_TO_SHOW_FLOORS,
  THRESHOLD_DENSITY_TO_SHOW_ROOMS,
} from "@/components/map-display/mapConstants";
import { useMapPosition } from "@/hooks/useMapPosition.ts";
import { useBoundStore } from "@/store";
import { isPublicBuilding } from "@/utils/authUtils";
import {
  getFloorByOrdinal,
  getFloorLevelFromRoomName,
  getFloorOrdinal,
} from "@/utils/floorUtils";
import { isInPolygon } from "@/utils/geometry";
import { useNavPaths } from "./useNavigationParams.ts";
import { useUser } from "./useUser.ts";

const useMapRegionChange = (mapRef: RefObject<mapkit.Map | null>) => {
  // Query data
  const { data: buildings } = $api.useQuery("get", "/buildings");
  const user = useUser();

  // Global state
  const focusedFloor = useBoundStore((state) => state.focusedFloor);
  const focusFloor = useBoundStore((state) => state.focusFloor);
  const unfocusFloor = useBoundStore((state) => state.unfocusFloor);
  const showLogin = useBoundStore((state) => state.showLogin);
  const setShowRoomNames = useBoundStore((state) => state.setShowRoomNames);
  const instructionIndex = useBoundStore((state) => state.navInstructionIndex);
  const isNavigating = useBoundStore((state) => state.isNavigating);
  const selectedPath = useBoundStore((state) => state.selectedPath);

  // Local state
  const [showFloor, setShowFloor] = useState<boolean>(false);

  const { navPaths } = useNavPaths();
  const instructions = useBoundStore((state) => state.navInstructions) ?? [];

  // Calculates the focused floor based on the region
  const calcFocusedFloor = (region: CoordinateRegion): Floor | null => {
    if (!buildings) {
      return null;
    }

    const center = {
      latitude: region.centerLatitude,
      longitude: region.centerLongitude,
    };

    const centerBuilding =
      Object.values(buildings).find(
        (building: Building) =>
          building.shape && isInPolygon(center, building.shape.flat(2)),
      ) ?? null;

    if (!centerBuilding) {
      return null;
    }

    // If no floor is currently focused or the focused floor is not in the center building we need to find a new floor to focus on.
    if (!focusedFloor || focusedFloor.buildingCode !== centerBuilding.code) {
      // If actively navigating, focus on the floor corresponding to the current instruction if it is in the focused building
      if (isNavigating) {
        const node =
          instructionIndex === 0
            ? navPaths?.[selectedPath]?.path.path[0]
            : navPaths?.[selectedPath]?.path.path.find(
                (n) => n.id === instructions[instructionIndex - 1]?.nodeId,
              );
        if (node?.floor && node.floor.buildingCode === centerBuilding.code) {
          return node.floor;
        }
      }

      // If the focused floor is in the same building as the selected floor (given by the URL params),
      // then focus the selected floor
      const path = window.location.pathname;
      const [selectedBuildingCode, roomName] =
        path.split("/")?.[1]?.split("-") || [];
      const selectedFloor = getFloorLevelFromRoomName(roomName);

      if (
        selectedBuildingCode &&
        selectedBuildingCode === centerBuilding.code &&
        selectedFloor !== focusedFloor?.level
      ) {
        return {
          buildingCode: centerBuilding.code,
          level: selectedFloor ?? "",
        };
      }

      return {
        buildingCode: centerBuilding.code,
        // Fallback to the first known floor if default metadata is missing.
        level: centerBuilding.defaultFloor ?? centerBuilding.floors[0] ?? "",
      };
    }

    // if we are focusing on a different building,
    // then focus on the floor of the center building that is the same ordinal as the currently focused floor
    const focusedBuilding = buildings[focusedFloor.buildingCode];
    if (focusedBuilding && focusedBuilding.code !== centerBuilding.code) {
      const newFocusedFloor = getFloorByOrdinal(
        centerBuilding,
        getFloorOrdinal(focusedBuilding, focusedFloor),
      );

      if (newFocusedFloor) {
        return newFocusedFloor;
      }
    }

    return focusedFloor;
  };

  const { onRegionChangeStart, onRegionChangeEnd } = useMapPosition(
    (region, density) => {
      // dispatch(setInfoCardStatus(CardStates.COLLAPSED));

      const newShowFloor = density >= THRESHOLD_DENSITY_TO_SHOW_FLOORS;
      setShowFloor(newShowFloor);
      setShowRoomNames(density >= THRESHOLD_DENSITY_TO_SHOW_ROOMS);

      if (newShowFloor) {
        // Calculate the new focused floor
        const newFocusedFloor = calcFocusedFloor(region);

        // Show the login modal if the user is not signed in and we are showing a floor
        // Exception: we are allowed to show public building floors to all users
        const canSkipLogin =
          sessionStorage.getItem("showedLogin") ||
          user ||
          isPublicBuilding(newFocusedFloor?.buildingCode);
        if (!canSkipLogin) {
          sessionStorage.setItem("showedLogin", "true");
          showLogin();
          return;
        }

        // Focus the new floor if it is not the same as the currently focused floor
        if (newFocusedFloor !== focusedFloor && newFocusedFloor) {
          focusFloor(newFocusedFloor);
        }
      }
      // Unfocus the floor if we are not showing floors
      else unfocusFloor();
    },
    mapRef,
    INITIAL_REGION,
  );

  return { onRegionChangeStart, onRegionChangeEnd, showFloor };
};

export { useMapRegionChange };
