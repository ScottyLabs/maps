import { PoiOverlay } from "@/components/map-display/pois-overlay/PoiOverlay.tsx";
import { useUser } from "@/hooks/useUser.ts";
import { useBoundStore } from "@/store/index.ts";
import { isPublicBuilding } from "@/utils/authUtils.ts";

const PoisOverlay = () => {
  const user = useUser();
  const focusedFloor = useBoundStore((state) => state.focusedFloor);

  // mirrors floorplan overlay: auth users see all, anon sees public buildings
  const canShowPois = user || isPublicBuilding(focusedFloor?.buildingCode);

  if (!(focusedFloor && canShowPois)) {
    return;
  }

  return <PoiOverlay floor={focusedFloor} />;
};

export { PoisOverlay };
