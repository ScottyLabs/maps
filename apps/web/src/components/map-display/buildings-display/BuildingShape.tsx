import type { Building } from "@cmumaps/common";
import { Polygon } from "mapkit-react";

import { useBoundStore } from "@/store/index.ts";
import { getBuildingShapeFillColor } from "@/utils/buildingColorUtils.ts";

interface Props {
  building: Building;
}

const BuildingShape = ({ building }: Props) => {
  const selectedBuilding = useBoundStore((state) => state.selectedBuilding);
  const isSelected = selectedBuilding?.code === building.code;

  const getStrokeColor = () => {
    const selectedStrokeColor = "#FFBD59";
    const notSelectedColor = "#6b7280";

    if (isSelected) {
      return selectedStrokeColor;
    }
    return notSelectedColor;
  };

  const getFillColor = () => {
    const fillColor = getBuildingShapeFillColor(building.code);
    if (fillColor) {
      return fillColor;
    }
    if (!building.isMapped) {
      // fill color for unmapped buildings
      return "#6b7280";
    }
    // default fill color
    return "#9ca3af";
  };

  const getFillOpacity = () => {
    const fillColor = getBuildingShapeFillColor(building.code);
    // TODO: need a lighter opacity for those buildings ???
    if (fillColor) {
      if (isSelected) {
        return 1;
      }
      return 0.8;
    }
    if (isSelected) {
      return 1;
    }
    return 0.6;
  };

  return (
    <Polygon
      points={building.shape}
      enabled={false}
      strokeColor={getStrokeColor()}
      fillColor={getFillColor()}
      fillOpacity={getFillOpacity()}
      lineWidth={isSelected ? 3 : 1}
    />
  );
};

export { BuildingShape };
