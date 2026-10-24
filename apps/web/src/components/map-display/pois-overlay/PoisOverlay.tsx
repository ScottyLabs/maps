import { PoiOverlay } from "@/components/map-display/pois-overlay/PoiOverlay.tsx";
import { useUser } from "@/hooks/useUser.ts";
import { useBoundStore } from "@/store/index.ts";
import { isPublicBuilding } from "@/utils/authUtils";

const PoisOverlay = () => {
  const user = useUser();
  const focusedFloor = useBoundStore((state) => state.focusedFloor);

  // mirrors floorplan overlay: auth users see all, anon sees public buildings
  const canShowPois = user || isPublicBuilding(focusedFloor?.buildingCode);

  return (
    <>
      {user && <PoiOverlay floor="outside" />}
      {focusedFloor && canShowPois && <PoiOverlay floor={focusedFloor} />}
    </>
  );
};

export { PoisOverlay };
