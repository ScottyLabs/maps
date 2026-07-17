import type { Building } from "@cmumaps/common";
import { extractBuildingCode } from "@cmumaps/common";
import { Annotation } from "mapkit-react";
import { useQueryState } from "nuqs";
import { useLocation } from "react-router";
import { Roundel } from "@/components/shared/Roundel.tsx";
import { useNavigateLocationParams } from "@/hooks/useNavigateLocationParams.ts";
import { CardStates } from "@/store/cardSlice.ts";
import { useBoundStore } from "@/store/index.ts";
import { zoomOnObject } from "@/utils/zoomUtils.ts";

interface Props {
  map: mapkit.Map | null;
  building: Building;
}

const BuildingRoundel = ({ map, building }: Props) => {
  const navigate = useNavigateLocationParams();

  const location = useLocation();
  const [, floorCode] = location.pathname.split("/");
  const selectBuilding = useBoundStore((state) => state.selectBuilding);
  const setCardStatus = useBoundStore((state) => state.setCardStatus);

  const [src, setSrc] = useQueryState("src");

  const isNavigating = useBoundStore((state) => state.isNavigating);

  const focusedFloor = useBoundStore((state) => state.focusedFloor);
  if (focusedFloor || !map) {
    return null;
  }

  const handleClick = () => {
    // zoom on building if it's already selected
    if (floorCode) {
      const buildingCode = extractBuildingCode(floorCode);
      if (buildingCode === building.code) {
        zoomOnObject(map, building.shape.flat());
      }
    }

    if (!src || src === "") {
      navigate(`/${building.code}`);
      selectBuilding(building);
      setCardStatus(CardStates.HALF_OPEN);
    } else if (!isNavigating) {
      setSrc(building.code);
    }
  };

  return (
    <div className="translate-y-1/2 cursor-pointer">
      <Annotation
        latitude={building.labelLatitude}
        longitude={building.labelLongitude}
        displayPriority="required"
      >
        <button
          type="button"
          className="translate-y-1/2 cursor-pointer"
          onClick={(e) => {
            handleClick();
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleClick();
              e.stopPropagation();
            }
          }}
        >
          <Roundel code={building.code} />
        </button>
      </Annotation>
    </div>
  );
};

export { BuildingRoundel };
