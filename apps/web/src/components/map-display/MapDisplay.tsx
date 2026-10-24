import { CAMERA_BOUNDARY, INITIAL_REGION } from "@cmumaps/ui";
import type { MapInteractionEvent } from "mapkit-react";
import { FeatureVisibility, Map as MapkitMap, MapType } from "mapkit-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { $api } from "@/api/client.ts";
import { BuildingsDisplay } from "@/components/map-display/buildings-display/BuildingsDisplay.tsx";
import { FloorplansOverlay } from "@/components/map-display/floorplans-overlay/FloorplansOverlay.tsx";
import { PoisOverlay } from "@/components/map-display/pois-overlay/PoisOverlay.tsx";
import { env } from "@/env.ts";
import { useIsMobile } from "@/hooks/useIsMobile.ts";
import { useLocationParams } from "@/hooks/useLocationParams.ts";
import { useMapRegionChange } from "@/hooks/useMapRegionChange.ts";
import { useNavigateLocationParams } from "@/hooks/useNavigateLocationParams.ts";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useFocusedFloorParam } from "@/hooks/useFocusedFloorParam.ts";
import { useViewportParams } from "@/hooks/useViewportParams.ts";
import { CardStates } from "@/store/cardSlice.ts";
import { useBoundStore } from "@/store/index.ts";
import { buildFloorCode, getFloorLevelFromRoomName } from "@/utils/floorUtils.ts";
import { isInPolygon } from "@/utils/geometry.ts";
import { prefersReducedMotion } from "@/utils/prefersReducedMotion.ts";
import { zoomOnObject, zoomOnPoint } from "@/utils/zoomUtils.ts";
import { NavLine } from "../nav/NavLine.tsx";
import { GooglePhotorealisticMap } from "./GooglePhotorealisticMap.tsx";
import { CoordinatePin } from "./coordinate-pin/CoordinatePin.tsx";
import { MAPKIT_MAP_TYPE_BY_MODE } from "./mapViewModes.ts";

interface Props {
  mapRef: React.RefObject<mapkit.Map | null>;
}

const MapDisplay = ({ mapRef }: Props) => {
  // Query data
  const { data: buildings } = $api.useQuery("get", "/api/buildings");

  // Global state
  const hideSearch = useBoundStore((state) => state.hideSearch);
  const selectBuilding = useBoundStore((state) => state.selectBuilding);
  const deselectBuilding = useBoundStore((state) => state.deselectBuilding);
  const setCardStatus = useBoundStore((state) => state.setCardStatus);
  const setIsZooming = useBoundStore((state) => state.setIsZooming);
  const queuedZoomRegion = useBoundStore((state) => state.queuedZoomRegion);
  const setQueuedZoomRegion = useBoundStore((state) => state.setQueuedZoomRegion);
  const isNavigating = useBoundStore((state) => state.isNavigating);
  const focusedFloor = useBoundStore((state) => state.focusedFloor);
  const mapViewMode = useBoundStore((state) => state.mapViewMode);
  const setMapController = useBoundStore((state) => state.setMapController);

  // Local state
  const isMobile = useIsMobile();
  const [usedPanning, setUsedPanning] = useState<boolean>(false);

  // Custom hooks
  const { onRegionChangeStart, onRegionChangeEnd, showFloor } = useMapRegionChange(mapRef);
  const { initialRegion, writeViewport } = useViewportParams(mapRef);
  useFocusedFloorParam();
  const navigate = useNavigateLocationParams();
  const { setSrc, setDst, isNavOpen } = useNavPaths();
  const { buildingCode, roomName, error } = useLocationParams();
  const floorCode =
    buildingCode && roomName
      ? buildFloorCode(buildingCode, getFloorLevelFromRoomName(roomName) || "")
      : null;
  const { data: rooms } = $api.useQuery(
    "get",
    "/api/floors/{floorCode}/floorplan",
    { params: { path: { floorCode: floorCode ?? "" } } },
    { enabled: Boolean(floorCode) },
  );

  // Toast initial error when location params are invalid
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  //Zoom on url param building/room location
  // biome-ignore lint/correctness/useExhaustiveDependencies: Should only fire on page load
  useEffect(() => {
    if (!mapRef.current) return;
    if (buildingCode) {
      const building = buildings?.[buildingCode];
      if (!building?.shape) return;
      zoomOnObject(mapRef.current, building?.shape.flat(), setIsZooming);
    }
  }, [Boolean(mapRef.current)]);

  // Zoom on a specific room if provided in the URL
  useEffect(() => {
    if (!(mapRef.current && rooms && roomName)) return;
    const room = rooms[roomName];
    if (!room) return;
    zoomOnObject(mapRef.current, room.points.flat(), setIsZooming);
  }, [mapRef.current, rooms, roomName, setIsZooming]);

  // Need to keep track of usedPanning because the end of panning is a click and we don't want to trigger a click when the user is panning
  const handleLoad = () => {
    if (mapRef.current) {
      mapRef.current.addEventListener("scroll-end", () => setUsedPanning(true));
      setMapController({
        zoomToBounds: (points) => {
          if (!mapRef.current) {
            return;
          }
          zoomOnObject(mapRef.current, points, setIsZooming);
        },
        zoomToPoint: (point, offset = 0.001) => {
          if (!mapRef.current) {
            return;
          }
          zoomOnPoint(mapRef.current, point, offset, setIsZooming, setQueuedZoomRegion);
        },
      });
    }
  };

  useEffect(() => {
    if (mapViewMode === "photorealistic3d") {
      setMapController(null);
    }
  }, [mapViewMode, setMapController]);

  useEffect(
    () => () => {
      setMapController(null);
    },
    [setMapController],
  );

  if (mapViewMode === "photorealistic3d") {
    return <GooglePhotorealisticMap />;
  }

  const handleClick = (e: MapInteractionEvent) => {
    if (!buildings) {
      return;
    }

    // skip if usedPanning is true since end of panning is a click
    if (usedPanning) {
      setUsedPanning(false);
      return;
    }

    // close search when clicking on the map
    hideSearch();

    // check if a building is clicked
    let clickedBuilding = false;
    if (!showFloor) {
      const coords = e.toCoordinates();

      // biome-ignore lint/nursery/noForIn: TODO
      // biome-ignore lint/suspicious/useGuardForIn: TODO
      for (const code in buildings) {
        const building = buildings[code];
        if (building?.shape[0] && isInPolygon(coords, building.shape[0])) {
          if (building) {
            selectBuilding(building);
            clickedBuilding = true;
          }
          break;
        }
      }
    }

    // If no building is clicked,
    // If there is a sleceted room: navigate to the building containing the room
    // Otherwise: deselect the building and navigate to the home page
    if (!clickedBuilding) {
      if (isNavOpen && !isNavigating) {
        navigate(`/${buildingCode}`);
        setSrc(null);
        setDst(null);
      } else if (roomName && focusedFloor) {
        navigate(`/${buildingCode}`);
      } else {
        deselectBuilding();
        navigate("/");
      }
    }
  };

  const handleLongPress = (e: MapInteractionEvent) => {
    const coord = e.toCoordinates();
    if (isNavOpen) {
      setDst(`${coord.latitude},${coord.longitude}`);
    }
    navigate(`/${coord.latitude},${coord.longitude}`);
  };

  return (
    <MapkitMap
      ref={mapRef}
      token={env.mapkitToken || ""}
      initialRegion={initialRegion ?? INITIAL_REGION}
      includedPOICategories={[]}
      cameraBoundary={CAMERA_BOUNDARY}
      minCameraDistance={5}
      maxCameraDistance={1500}
      showsUserLocationControl={true}
      showsUserLocation={true}
      mapType={MAPKIT_MAP_TYPE_BY_MODE[mapViewMode] ?? MapType.Standard}
      // paddingBottom={isMobile ? 72 : 0}
      paddingBottom={0}
      paddingLeft={4}
      paddingRight={4}
      paddingTop={10}
      showsZoomControl={!isMobile}
      showsCompass={FeatureVisibility.Visible}
      allowWheelToZoom={true}
      onLoad={handleLoad}
      onClick={handleClick}
      onLongPress={handleLongPress}
      onRegionChangeStart={() => {
        setCardStatus(CardStates.COLLAPSED);
        onRegionChangeStart();
      }}
      onRegionChangeEnd={() => {
        if (queuedZoomRegion) {
          mapRef.current?.setRegionAnimated(queuedZoomRegion, !prefersReducedMotion());
          setQueuedZoomRegion(null);
          setIsZooming(true);
        } else {
          setIsZooming(false);
        }
        onRegionChangeEnd();
        writeViewport();
      }}
    >
      <BuildingsDisplay map={mapRef.current} buildings={buildings} />
      <FloorplansOverlay />
      <PoisOverlay />
      <NavLine map={mapRef.current} />
      <CoordinatePin map={mapRef.current} />
    </MapkitMap>
  );
};

export { MapDisplay };
