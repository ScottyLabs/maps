import { $api } from "@/api/client";
import { FloorSwitcherDisplayDesktop } from "@/components/floor-switcher/desktop/FloorSwitcherDisplayDesktop";
import { FloorSwitcherDisplayMobile } from "@/components/floor-switcher/mobile/FloorSwitcherDisplayMobile";
import { useIsMobile } from "@/hooks/useIsMobile.ts";
import { useUser } from "@/hooks/useUser.ts";
import { CardStates } from "@/store/cardSlice";
import { useBoundStore } from "@/store/index.ts";
import { isPublicBuilding } from "@/utils/authUtils";

/**
 * This component determines if the floor switcher should be shown.
 */
const FloorSwitcher = () => {
  // Library hooks
  const user = useUser();
  const isMobile = useIsMobile();

  // Global states
  const floor = useBoundStore((state) => state.focusedFloor);
  const isSearchOpen = useBoundStore((state) => state.isSearchOpen);
  const cardStatus = useBoundStore((state) => state.cardStatus);

  // Query data
  const { data: buildings } = $api.useQuery("get", "/buildings");

  // Don't show the floor switcher in mobile if either the card is open or the search is open
  if (isMobile && (isSearchOpen || cardStatus !== CardStates.COLLAPSED)) {
    return;
  }

  // Don't show the floor switcher if the user is not signed in unless the floor is a public building floor
  const canViewFloor = Boolean(user) || isPublicBuilding(floor?.buildingCode);
  if (!canViewFloor) {
    return;
  }

  // Don't show the floor switcher if there is no focused floor
  if (!floor) {
    return;
  }

  // Don't show the floor switcher if building data is not loaded
  if (!buildings) {
    return;
  }

  // Don't show the floor switcher if invalid building code
  const building = buildings[floor.buildingCode];
  if (!building) {
    return;
  }

  if (isMobile) {
    return (
      <FloorSwitcherDisplayMobile
        building={building}
        initialFloorLevel={floor.level}
      />
    );
  }

  return (
    <div className="fixed bottom-2 left-1/2 w-fit -translate-x-1/2 px-2">
      <FloorSwitcherDisplayDesktop building={building} floor={floor} />
    </div>
  );
};

export { FloorSwitcher };
