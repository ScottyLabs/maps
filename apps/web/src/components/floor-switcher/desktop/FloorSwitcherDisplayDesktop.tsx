import type { Building, Floor } from "@cmumaps/common";
import { useState } from "react";
import { DefaultView } from "@/components/floor-switcher/desktop/DefaultView.tsx";
import { FloorPicker } from "@/components/floor-switcher/desktop/FloorPicker.tsx";
import { LockedView } from "@/components/floor-switcher/desktop/LockedView.tsx";
import { RoundelButton } from "@/components/floor-switcher/desktop/RoundelButton.tsx";

interface Props {
  building: Building;
  floor: Floor;
}

const FloorSwitcherDisplayDesktop = ({ building, floor }: Props) => {
  const [showFloorPicker, setShowFloorPicker] = useState<boolean>(false);
  const hasFloorplan = building.floors.length > 0;

  return (
    <div className="btn-shadow flex rounded bg-white">
      <RoundelButton building={building} />
      {hasFloorplan ? (
        showFloorPicker ? (
          <FloorPicker building={building} floor={floor} setShowFloorPicker={setShowFloorPicker} />
        ) : (
          <DefaultView building={building} floor={floor} setShowFloorPicker={setShowFloorPicker} />
        )
      ) : (
        <LockedView building={building} />
      )}
    </div>
  );
};

export { FloorSwitcherDisplayDesktop };
