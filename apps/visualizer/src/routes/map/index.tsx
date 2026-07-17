import { CAMERA_BOUNDARY, INITIAL_REGION } from "@cmumaps/ui";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { FeatureVisibility, Map as MapkitMap, MapType } from "mapkit-react";
import { useEffect, useRef } from "react";
import z from "zod";
import BuildingsDisplay from "@/components/map-view/building-display/BuildingsDisplay.tsx";
import OutsideNodes from "@/components/map-view/OutsideNodes.tsx";
import { zoomOnPoint } from "@/components/map-view/zoomUtils.ts";
import MyToastContainer from "@/components/shared/MyToastContainer.tsx";
import NavBar from "@/components/ui-layout/NavBar.tsx";
import env from "@/env.ts";
import { useGetFloorNodesQuery } from "@/store/api/floorDataApiSlice.ts";

const mapSearchSchema = z.object({
  nodeId: z.string().optional(),
});

export const Route = createFileRoute("/map/")({
  component: OutsideMap,
  validateSearch: zodValidator(mapSearchSchema),
});

function OutsideMap() {
  const navigate = useNavigate();
  const mapRef = useRef<mapkit.Map | null>(null);
  const { data: nodes } = useGetFloorNodesQuery("outside");
  const { nodeId } = Route.useSearch();

  useEffect(() => {
    if (nodeId && nodes) {
      const node = nodes[nodeId];
      if (mapRef.current) {
        zoomOnPoint(mapRef.current, node.pos);
      }
    }
  }, [nodeId, nodes]);

  return (
    <>
      <NavBar floorCode="Outside" />
      <div className="relative h-dvh">
        <MapkitMap
          ref={mapRef}
          token={env.VITE_MAPKIT_TOKEN || ""}
          initialRegion={INITIAL_REGION}
          includedPOICategories={[]}
          cameraBoundary={CAMERA_BOUNDARY}
          minCameraDistance={5}
          maxCameraDistance={1500}
          showsUserLocationControl
          showsUserLocation={true}
          mapType={MapType.MutedStandard}
          paddingBottom={0}
          paddingLeft={4}
          paddingRight={4}
          paddingTop={10}
          showsZoomControl={true}
          showsCompass={FeatureVisibility.Visible}
          allowWheelToZoom
          onClick={() => navigate({ to: ".", search: {} })}
        >
          <BuildingsDisplay />
          <OutsideNodes mapRef={mapRef} nodes={nodes} />
        </MapkitMap>
      </div>
      <MyToastContainer />
    </>
  );
}
