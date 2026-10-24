import type { Building, Placement, Rooms } from "@cmumaps/common";
import { CAMERA_BOUNDARY, INITIAL_REGION } from "@cmumaps/ui";
import {
  FeatureVisibility,
  type MapInteractionEvent,
  Map as MapkitMap,
  MapType,
} from "mapkit-react";
import { useRef, useState } from "react";
import BuildingShape from "@/components/map-view/building-display/BuildingShape";
import CenterPin from "@/components/map-view/CenterPin";
import FloorplanOverlay from "@/components/map-view/FloorplanOverlay";
import { zoomOnBuilding } from "@/components/map-view/zoomUtils";
import env from "@/env";

interface Props {
  floorCode: string;
  rooms?: Rooms;
  building: Building;
  placement: Placement;
  setPlacement: (placement: Placement) => void;
}

const MapDisplay = ({
  floorCode,
  rooms,
  building,
  placement,
  setPlacement,
}: Props) => {
  const mapRef = useRef<mapkit.Map | null>(null);
  const [usedPanning, setUsedPanning] = useState(false);

  // Need to keep track of usedPanning because the end of panning is a click
  // and we don't want to trigger a click when the user is panning
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
        token={env.VITE_MAPKIT_TOKEN || ""}
        initialRegion={INITIAL_REGION}
        includedPOICategories={[]}
        cameraBoundary={CAMERA_BOUNDARY}
        minCameraDistance={5}
        maxCameraDistance={1500}
        showsUserLocationControl={false}
        showsUserLocation={false}
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
        <FloorplanOverlay
          floorCode={floorCode}
          placement={placement}
          rooms={rooms}
        />
        <CenterPin placement={placement} />
      </MapkitMap>
    </div>
  );
};

export default MapDisplay;
