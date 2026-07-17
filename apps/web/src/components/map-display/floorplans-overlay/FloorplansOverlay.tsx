import { FloorplanOverlay } from "@/components/map-display/floorplans-overlay/FloorplanOverlay.tsx";
import { useUser } from "@/hooks/useUser.ts";
import { useBoundStore } from "@/store/index.ts";
import { isPublicBuilding } from "@/utils/authUtils.ts";

const FloorplansOverlay = () => {
  const user = useUser();
  const focusedFloor = useBoundStore((state) => state.focusedFloor);

  // Authenticated users can see all floorplans.
  // Unauthenticated users can only see public building floorplans.
  const canShowFloorplans =
    user || isPublicBuilding(focusedFloor?.buildingCode);

  // Only show floorplans if a floor is focused
  if (!(focusedFloor && canShowFloorplans)) {
    return;
  }

  return <FloorplanOverlay floor={focusedFloor} />;
};

export { FloorplansOverlay };
