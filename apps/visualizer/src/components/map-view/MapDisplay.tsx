import type { Building, Placement } from "@cmumaps/common";
import { CAMERA_BOUNDARY, INITIAL_REGION } from "@cmumaps/ui";
import {
  FeatureVisibility,
  type MapInteractionEvent,
  Map as MapkitMap,
  MapType,
} from "mapkit-react";
import { useRef, useState } from "react";
import BuildingShape from "@/components/map-view/building-display/BuildingShape.tsx";
import CenterPin from "@/components/map-view/CenterPin.tsx";
import FloorplanOverlay from "@/components/map-view/FloorplanOverlay.tsx";
import { zoomOnBuilding } from "@/components/map-view/zoomUtils.ts";
import env from "@/env.ts";

interface Props {
  floorCode: string;
  building: Building;
  placement: Placement;
  setPlacement: (placement: Placement) => void;
}

const MapDisplay = ({ floorCode, building, placement, setPlacement }: Props) => {
  const mapRef = useRef<mapkit.Map | null>(null);
  const [usedPanning, setUsedPanning] = useState(false);

  // Need to keep track of usedPanning because the end of panning is a click and we don't want to trigger a click when the user is panning
  const handleLoad = () => {
    zoomOnBuilding(mapRef.current, building);
    if (mapRef.current) {
      mapRef.current.addEventListener("scroll-end", () => setUsedPanning(true));
    }
  };

  return (
    <div className="relative h-dvh">
      <MapkitMap
        ref={mapRef}
        token={env.mapkitToken || ""}
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
        onLoad={handleLoad}
        onClick={(e: MapInteractionEvent) => {
          if (!usedPanning) {
            setPlacement({
              ...placement,
              geoCenter: e.toCoordinates(),
            });
          }
          setUsedPanning(false);
        }}
      >
        <BuildingShape building={building} />
        <FloorplanOverlay floorCode={floorCode} placement={placement} />
        <CenterPin placement={placement} />
      </MapkitMap>
    </div>
  );
};

export default MapDisplay;
