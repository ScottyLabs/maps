import { BuildingRoundel } from "@/components/map-view/building-display/BuildingRoundel.tsx";
import BuildingShape from "@/components/map-view/building-display/BuildingShape.tsx";
import { useGetBuildingsQuery } from "@/store/api/buildingApiSlice.ts";

const BuildingsDisplay = () => {
  const { data: buildings } = useGetBuildingsQuery();

  if (!buildings) {
    return;
  }

  return Object.values(buildings).map((building) => (
    <div key={building.code}>
      <BuildingShape building={building} />
      <BuildingRoundel building={building} />
    </div>
  ));
};

export default BuildingsDisplay;
