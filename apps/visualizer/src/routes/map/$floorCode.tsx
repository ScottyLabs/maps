import { extractBuildingCode, type Placement } from "@cmumaps/common";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import MapDisplay from "@/components/map-view/MapDisplay.tsx";
import MyToastContainer from "@/components/shared/MyToastContainer.tsx";
import NavBar from "@/components/ui-layout/NavBar.tsx";
import PlacementPanel from "../../components/map-view/PlacementPanel.tsx";
import ViewSwitch from "../../components/ui-layout/ViewSwitch.tsx";
import { useGetBuildingQuery } from "../../store/api/buildingApiSlice.ts";
import { useGetFloorPlacementQuery } from "../../store/api/floorDataApiSlice.ts";

export const Route = createFileRoute("/map/$floorCode")({
  component: MapView,
});

function MapView() {
  const { floorCode } = Route.useParams();
  const buildingCode = extractBuildingCode(floorCode);
  const { data: building } = useGetBuildingQuery(buildingCode);
  const { data: initialPlacement } = useGetFloorPlacementQuery(floorCode);
  const [placement, setPlacement] = useState<Placement | undefined>(initialPlacement);

  useEffect(() => {
    setPlacement(initialPlacement);
  }, [initialPlacement]);

  if (!placement || !building) {
    return null;
  }

  return (
    <>
      <NavBar floorCode={floorCode} />
      <ViewSwitch floorCode={floorCode} />
      <PlacementPanel floorCode={floorCode} placement={placement} setPlacement={setPlacement} />
      <MapDisplay
        floorCode={floorCode}
        building={building}
        placement={placement}
        setPlacement={setPlacement}
      />
      <MyToastContainer />
    </>
  );
}
