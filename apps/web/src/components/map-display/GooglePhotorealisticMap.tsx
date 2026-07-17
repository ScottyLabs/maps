/** biome-ignore-all lint/style/useNamingConvention: Google Maps 3D API naming */
import type { Building, GeoRoom } from "@cmumaps/common";
import { getRoomTypeDetails } from "@cmumaps/common";
import { CAMERA_BOUNDARY, INITIAL_REGION } from "@cmumaps/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { $api } from "@/api/client.ts";
import { env } from "@/env.ts";
import { useLocationParams } from "@/hooks/useLocationParams.ts";
import { useNavigateLocationParams } from "@/hooks/useNavigateLocationParams.ts";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useUser } from "@/hooks/useUser.ts";
import { loadGoogleMaps3D } from "@/lib/googleMaps3dLoader.ts";
import { CardStates } from "@/store/cardSlice.ts";
import { useBoundStore } from "@/store/index.ts";
import type { MapCoordinate } from "@/store/mapSlice.ts";
import type { Node } from "@/types/navTypes.ts";
import { isPublicBuilding } from "@/utils/authUtils.ts";
import { getBuildingShapeFillColor } from "@/utils/buildingColorUtils.ts";
import { buildFloorCode, getFloorLevelFromRoomName } from "@/utils/floorUtils.ts";
import { prefersReducedMotion } from "@/utils/prefersReducedMotion.ts";

interface GoogleLatLngAltitude {
  lat: number;
  lng: number;
  altitude?: number;
}

interface GoogleBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface Google3dElement extends HTMLElement {
  outerCoordinates?: GoogleLatLngAltitude[];
  path?: GoogleLatLngAltitude[];
  position?: GoogleLatLngAltitude;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  drawsOccludedSegments?: boolean;
  center?: GoogleLatLngAltitude;
  heading?: number;
  tilt?: number;
  range?: number;
  bounds?: GoogleBounds;
  mode?: string;
  flyCameraTo?: (options: Record<string, unknown>) => void;
}

type Google3dElementConstructor = new (
  options?: Record<string, unknown>,
) => Google3dElement;

interface GoogleMaps3dLibrary {
  Map3DElement?: Google3dElementConstructor;
  Polygon3DInteractiveElement?: Google3dElementConstructor;
  Polyline3DElement?: Google3dElementConstructor;
  Marker3DElement?: Google3dElementConstructor;
  MapMode?: {
    HYBRID?: string;
  };
}

interface GoogleMaps3dClickEvent extends Event {
  position?: GoogleLatLngAltitude;
  latLngAltitude?: GoogleLatLngAltitude;
  detail?: {
    position?: GoogleLatLngAltitude;
    latLngAltitude?: GoogleLatLngAltitude;
  };
}

const CMU_CAMERA_BOUNDS: GoogleBounds = {
  north: CAMERA_BOUNDARY.centerLatitude + CAMERA_BOUNDARY.latitudeDelta / 2,
  south: CAMERA_BOUNDARY.centerLatitude - CAMERA_BOUNDARY.latitudeDelta / 2,
  east: CAMERA_BOUNDARY.centerLongitude + CAMERA_BOUNDARY.longitudeDelta / 2,
  west: CAMERA_BOUNDARY.centerLongitude - CAMERA_BOUNDARY.longitudeDelta / 2,
};

const FLY_DURATION_MS = prefersReducedMotion() ? 0 : 900;

const toGoogleLatLng = (coordinate: MapCoordinate): GoogleLatLngAltitude => ({
  lat: coordinate.latitude,
  lng: coordinate.longitude,
  altitude: 0,
});

const getCameraRangeForPoints = (points: MapCoordinate[]): number => {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const maxSpan = Math.max(latitudeSpan, longitudeSpan);
  const metersPerDegree = 111_320;
  const inferredRange = maxSpan * metersPerDegree * 2.1;
  return Math.max(180, Math.min(2800, inferredRange));
};

const getCoordinateFrom3dClick = (
  event: GoogleMaps3dClickEvent,
): MapCoordinate | null => {
  const candidate =
    event.position ??
    event.latLngAltitude ??
    event.detail?.position ??
    event.detail?.latLngAltitude;
  if (!candidate) {
    return null;
  }

  const latitude = candidate.lat;
  const longitude = candidate.lng;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return { latitude, longitude };
};

const getBuildingFillColor = (building: Building): string => {
  const customColor = getBuildingShapeFillColor(building.code);
  if (customColor) {
    return customColor;
  }
  if (!building.isMapped) {
    return "#6b7280";
  }
  return "#9ca3af";
};

const GooglePhotorealisticMap = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapElementRef = useRef<Google3dElement | null>(null);
  const maps3dLibraryRef = useRef<GoogleMaps3dLibrary | null>(null);
  const buildingPolygonsRef = useRef<Map<string, Google3dElement>>(new Map());
  const navLinesRef = useRef<Google3dElement[]>([]);
  const roomPolygonsRef = useRef<Google3dElement[]>([]);
  const coordinateMarkerRef = useRef<Google3dElement | null>(null);
  const clickedBuildingRef = useRef(false);
  const zoomTimeoutRef = useRef<number | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [isLibraryReady, setIsLibraryReady] = useState(false);
  const [prevCoordinate, setPrevCoordinate] = useState<MapCoordinate | null>(
    null,
  );

  const navigate = useNavigateLocationParams();
  const user = useUser();

  const { data: buildings } = $api.useQuery("get", "/buildings");
  const {
    buildingCode,
    roomName,
    coordinate,
    error: locationParamError,
  } = useLocationParams();
  const { setSrc, setDst, isNavOpen, navPaths } = useNavPaths();

  const selectedBuilding = useBoundStore((state) => state.selectedBuilding);
  const selectBuilding = useBoundStore((state) => state.selectBuilding);
  const deselectBuilding = useBoundStore((state) => state.deselectBuilding);
  const setIsZooming = useBoundStore((state) => state.setIsZooming);
  const setMapController = useBoundStore((state) => state.setMapController);
  const isNavigating = useBoundStore((state) => state.isNavigating);
  const focusedFloor = useBoundStore((state) => state.focusedFloor);
  const focusFloor = useBoundStore((state) => state.focusFloor);
  const setCardStatus = useBoundStore((state) => state.setCardStatus);
  const selectedPath = useBoundStore((state) => state.selectedPath);
  const instructionIndex = useBoundStore((state) => state.navInstructionIndex);
  const instructions = useBoundStore((state) => state.navInstructions) ?? [];
  const hideSearch = useBoundStore((state) => state.hideSearch);

  const navPath = navPaths?.[selectedPath]?.path.path ?? [];

  const roomFocusFloorCode =
    buildingCode && roomName
      ? buildFloorCode(buildingCode, getFloorLevelFromRoomName(roomName) || "")
      : null;
  const { data: roomFocusRooms } = $api.useQuery(
    "get",
    "/floors/{floorCode}/floorplan",
    { params: { path: { floorCode: roomFocusFloorCode ?? "" } } },
    { enabled: Boolean(roomFocusFloorCode) },
  );

  const focusedFloorCode = focusedFloor
    ? buildFloorCode(focusedFloor.buildingCode, focusedFloor.level)
    : null;
  const { data: focusedFloorRooms } = $api.useQuery(
    "get",
    "/floors/{floorCode}/floorplan",
    { params: { path: { floorCode: focusedFloorCode ?? "" } } },
    { enabled: Boolean(focusedFloorCode) },
  );

  const canShowFloorplans =
    Boolean(user) || isPublicBuilding(focusedFloor?.buildingCode);

  const stopZoomingSoon = useCallback(() => {
    if (zoomTimeoutRef.current !== null) {
      window.clearTimeout(zoomTimeoutRef.current);
    }
    zoomTimeoutRef.current = window.setTimeout(() => {
      setIsZooming(false);
    }, FLY_DURATION_MS + 120);
  }, [setIsZooming]);

  const flyToCoordinate = useCallback(
    (target: MapCoordinate, range: number) => {
      const map = mapElementRef.current;
      if (!map) {
        return;
      }

      setIsZooming(true);
      const endCamera = {
        center: toGoogleLatLng(target),
        heading: map.heading ?? 0,
        tilt: map.tilt ?? 65,
        range,
      };

      if (typeof map.flyCameraTo === "function") {
        map.flyCameraTo({
          endCamera,
          durationMillis: FLY_DURATION_MS,
        });
      } else {
        map.center = endCamera.center;
        map.tilt = endCamera.tilt;
        map.range = endCamera.range;
      }
      stopZoomingSoon();
    },
    [setIsZooming, stopZoomingSoon],
  );

  const zoomToPoint = useCallback(
    (point: MapCoordinate, offset = 0.001) => {
      const range = Math.max(170, Math.min(2200, offset * 111_320 * 2));
      flyToCoordinate(point, range);
    },
    [flyToCoordinate],
  );

  const zoomToBounds = useCallback(
    (points: MapCoordinate[]) => {
      if (points.length === 0) {
        return;
      }
      const latitudes = points.map((point) => point.latitude);
      const longitudes = points.map((point) => point.longitude);
      const center = {
        latitude: (Math.max(...latitudes) + Math.min(...latitudes)) / 2,
        longitude: (Math.max(...longitudes) + Math.min(...longitudes)) / 2,
      };
      flyToCoordinate(center, getCameraRangeForPoints(points));
    },
    [flyToCoordinate],
  );

  const applyBuildingPolygonStyle = useCallback(
    (polygon: Google3dElement, building: Building, isSelected: boolean) => {
      polygon.strokeColor = isSelected ? "#FFBD59" : "#6b7280";
      polygon.fillColor = getBuildingFillColor(building);
      polygon.strokeWidth = isSelected ? 4 : 2;
      polygon.drawsOccludedSegments = false;
    },
    [],
  );

  useEffect(() => {
    if (!env.GOOGLE_MAPS_API_KEY) {
      return;
    }

    let isCancelled = false;
    const initialize = async () => {
      try {
        const googleMaps = await loadGoogleMaps3D(
          env.GOOGLE_MAPS_API_KEY ?? "",
        );
        const importLibrary = googleMaps.maps?.importLibrary;
        if (!importLibrary) {
          throw new Error("Google Maps importLibrary is unavailable.");
        }
        const imported = (await importLibrary("maps3d")) as GoogleMaps3dLibrary;
        if (isCancelled) {
          return;
        }
        maps3dLibraryRef.current = imported;
        setIsLibraryReady(true);
      } catch (error) {
        if (!isCancelled) {
          console.error(error);
          toast.error(
            "Failed to load Google Maps 3D. Check your API key and Maps 3D API enablement.",
          );
        }
      }
    };

    initialize().catch((error) => {
      console.error(error);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    const maps3dLibrary = maps3dLibraryRef.current;
    if (
      !(mapContainer && maps3dLibrary?.Map3DElement) ||
      mapElementRef.current
    ) {
      return;
    }

    const mapElement = new maps3dLibrary.Map3DElement({
      center: {
        lat: INITIAL_REGION.centerLatitude,
        lng: INITIAL_REGION.centerLongitude,
        altitude: 0,
      },
      heading: 330,
      tilt: 65,
      range: 1250,
      bounds: CMU_CAMERA_BOUNDS,
      mode: maps3dLibrary.MapMode?.HYBRID ?? "HYBRID",
      gestureHandling: "GREEDY",
    });

    mapElement.style.width = "100%";
    mapElement.style.height = "100%";
    mapElement.style.display = "block";

    mapContainer.replaceChildren(mapElement);
    mapElementRef.current = mapElement;
    setIsMapReady(true);

    setMapController({
      zoomToBounds,
      zoomToPoint,
    });

    return () => {
      if (zoomTimeoutRef.current !== null) {
        window.clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
      setMapController(null);
      mapElement.remove();
      mapElementRef.current = null;
      setIsMapReady(false);
    };
  }, [isLibraryReady, setMapController, zoomToBounds, zoomToPoint]);

  useEffect(() => {
    if (locationParamError) {
      toast.error(locationParamError);
    }
  }, [locationParamError]);

  useEffect(() => {
    setMapController({
      zoomToBounds,
      zoomToPoint,
    });
  }, [setMapController, zoomToBounds, zoomToPoint]);

  useEffect(() => {
    if (!(buildings && buildingCode)) {
      return;
    }
    const building = buildings[buildingCode];
    if (!building) {
      return;
    }
    selectBuilding(building);
    zoomToBounds(building.shape.flat());
  }, [buildingCode, buildings, selectBuilding, zoomToBounds]);

  useEffect(() => {
    if (!(roomFocusRooms && roomName)) {
      return;
    }
    const room = roomFocusRooms[roomName];
    if (!room) {
      return;
    }
    zoomToBounds(room.points.flat());
  }, [roomFocusRooms, roomName, zoomToBounds]);

  useEffect(() => {
    if (coordinate) {
      setPrevCoordinate(coordinate);
      if (!isNavOpen) {
        zoomToPoint(coordinate, 0.001);
      }
    }
  }, [coordinate, isNavOpen, zoomToPoint]);

  useEffect(() => {
    const map = mapElementRef.current;
    const maps3dLibrary = maps3dLibraryRef.current;
    const Polygon3dInteractiveElement =
      maps3dLibrary?.Polygon3DInteractiveElement;
    if (!(map && Polygon3dInteractiveElement && buildings)) {
      return;
    }

    for (const polygon of buildingPolygonsRef.current.values()) {
      polygon.remove();
    }
    buildingPolygonsRef.current.clear();

    for (const building of Object.values(buildings)) {
      const [firstRing] = building.shape;
      if (!firstRing || firstRing.length < 3) {
        continue;
      }

      const polygon = new Polygon3dInteractiveElement({
        outerCoordinates: firstRing.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
          altitude: 0,
        })),
      });
      polygon.outerCoordinates = firstRing.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
        altitude: 0,
      }));
      applyBuildingPolygonStyle(
        polygon,
        building,
        selectedBuilding?.code === building.code,
      );

      polygon.addEventListener("gmp-click", (event) => {
        event.stopPropagation();
        clickedBuildingRef.current = true;
        hideSearch();
        selectBuilding(building);

        const defaultLevel = building.defaultFloor ?? building.floors[0];
        if (defaultLevel) {
          focusFloor({ buildingCode: building.code, level: defaultLevel });
        }
        navigate(`/${building.code}`);
      });

      buildingPolygonsRef.current.set(building.code, polygon);
      map.append(polygon);
    }

    return () => {
      for (const polygon of buildingPolygonsRef.current.values()) {
        polygon.remove();
      }
      buildingPolygonsRef.current.clear();
    };
  }, [
    applyBuildingPolygonStyle,
    buildings,
    focusFloor,
    hideSearch,
    navigate,
    selectBuilding,
    selectedBuilding?.code,
  ]);

  useEffect(() => {
    if (!buildings) {
      return;
    }
    for (const [buildingCodeKey, polygon] of buildingPolygonsRef.current) {
      const building = buildings[buildingCodeKey];
      if (!building) {
        continue;
      }
      applyBuildingPolygonStyle(
        polygon,
        building,
        selectedBuilding?.code === building.code,
      );
    }
  }, [applyBuildingPolygonStyle, buildings, selectedBuilding?.code]);

  useEffect(() => {
    const map = mapElementRef.current;
    if (!map) {
      return;
    }

    const handleMapClick = (event: Event) => {
      if (clickedBuildingRef.current) {
        clickedBuildingRef.current = false;
        return;
      }

      hideSearch();

      if (isNavOpen && !isNavigating) {
        navigate(`/${buildingCode ?? ""}`);
        setSrc(null);
        setDst(null);
        return;
      }

      if (roomName && focusedFloor) {
        navigate(`/${buildingCode ?? ""}`);
        return;
      }

      deselectBuilding();

      const clickCoordinate = getCoordinateFrom3dClick(
        event as GoogleMaps3dClickEvent,
      );
      if (clickCoordinate && (event as MouseEvent).altKey && isNavOpen) {
        setDst(`${clickCoordinate.latitude},${clickCoordinate.longitude}`);
        navigate(`/${clickCoordinate.latitude},${clickCoordinate.longitude}`);
        return;
      }
      navigate("/");
    };

    const handleLongPress = (event: Event) => {
      const clickCoordinate = getCoordinateFrom3dClick(
        event as GoogleMaps3dClickEvent,
      );
      if (!clickCoordinate) {
        return;
      }
      event.preventDefault();
      if (isNavOpen) {
        setDst(`${clickCoordinate.latitude},${clickCoordinate.longitude}`);
      }
      navigate(`/${clickCoordinate.latitude},${clickCoordinate.longitude}`);
    };

    map.addEventListener("gmp-click", handleMapClick);
    map.addEventListener("gmp-longpress", handleLongPress);
    map.addEventListener("contextmenu", handleLongPress);

    return () => {
      map.removeEventListener("gmp-click", handleMapClick);
      map.removeEventListener("gmp-longpress", handleLongPress);
      map.removeEventListener("contextmenu", handleLongPress);
    };
  }, [
    buildingCode,
    deselectBuilding,
    focusedFloor,
    hideSearch,
    isNavOpen,
    isNavigating,
    navigate,
    roomName,
    setDst,
    setSrc,
  ]);

  useEffect(() => {
    const map = mapElementRef.current;
    const maps3dLibrary = maps3dLibraryRef.current;
    if (!(map && maps3dLibrary?.Marker3DElement)) {
      return;
    }

    if (coordinateMarkerRef.current) {
      coordinateMarkerRef.current.remove();
      coordinateMarkerRef.current = null;
    }

    if (!prevCoordinate) {
      return;
    }

    const marker = new maps3dLibrary.Marker3DElement({
      position: toGoogleLatLng(prevCoordinate),
      title: "Coordinate Pin",
    });
    marker.position = toGoogleLatLng(prevCoordinate);

    marker.addEventListener("gmp-click", (event) => {
      event.stopPropagation();
      if (isNavOpen) {
        setSrc(`${prevCoordinate.latitude},${prevCoordinate.longitude}`);
      } else if (
        coordinate?.latitude === prevCoordinate.latitude ||
        coordinate?.longitude === prevCoordinate.longitude
      ) {
        zoomToPoint(prevCoordinate, 0.001);
      }

      navigate(`/${prevCoordinate.latitude},${prevCoordinate.longitude}`);
    });

    coordinateMarkerRef.current = marker;
    map.append(marker);

    return () => {
      marker.remove();
      if (coordinateMarkerRef.current === marker) {
        coordinateMarkerRef.current = null;
      }
    };
  }, [coordinate, isNavOpen, navigate, prevCoordinate, setSrc, zoomToPoint]);

  useEffect(() => {
    const node =
      instructionIndex === 0
        ? navPath[0]
        : navPath.find(
            (navNode) =>
              navNode.id === instructions[instructionIndex - 1]?.nodeId,
          );

    if (!(isNavigating && node?.coordinate)) {
      return;
    }

    if (node.floor) {
      focusFloor(node.floor);
    }
    zoomToPoint(node.coordinate, 0.0004);
  }, [
    focusFloor,
    instructionIndex,
    instructions,
    isNavigating,
    navPath,
    zoomToPoint,
  ]);

  useEffect(() => {
    const map = mapElementRef.current;
    const maps3dLibrary = maps3dLibraryRef.current;
    const Polyline3dElement = maps3dLibrary?.Polyline3DElement;
    if (!(map && Polyline3dElement)) {
      return;
    }

    for (const line of navLinesRef.current) {
      line.remove();
    }
    navLinesRef.current = [];

    if (!(isNavOpen && navPath.length > 1)) {
      return;
    }

    const addLine = (
      nodes: Node[],
      strokeColor: string,
      strokeWidth: number,
    ) => {
      if (nodes.length < 2) {
        return;
      }
      const polyline = new Polyline3dElement({
        path: nodes.map((node) => ({
          lat: node.coordinate.latitude,
          lng: node.coordinate.longitude,
          altitude: 0,
        })),
        strokeColor,
        strokeWidth,
        drawsOccludedSegments: true,
      });
      polyline.path = nodes.map((node) => ({
        lat: node.coordinate.latitude,
        lng: node.coordinate.longitude,
        altitude: 0,
      }));
      polyline.strokeColor = strokeColor;
      polyline.strokeWidth = strokeWidth;
      polyline.drawsOccludedSegments = true;
      navLinesRef.current.push(polyline);
      map.append(polyline);
    };

    if (isNavigating) {
      const completedNodes: Node[] = [];
      const remainingNodes: Node[] = [];
      const currentNodeId =
        instructionIndex > 0
          ? instructions[instructionIndex - 1]?.nodeId
          : navPath[0]?.id;

      let reachedCurrentNode = false;
      for (const node of navPath) {
        if (reachedCurrentNode) {
          remainingNodes.push(node);
        } else {
          completedNodes.push(node);
        }

        if (node.id === currentNodeId) {
          reachedCurrentNode = true;
          remainingNodes.push(node);
        }
      }

      addLine(completedNodes, "#808080", 5);
      addLine(remainingNodes, "#3D83D3", 6);
    } else {
      addLine(navPath, "#3D83D3", 6);
    }

    return () => {
      for (const line of navLinesRef.current) {
        line.remove();
      }
      navLinesRef.current = [];
    };
  }, [instructionIndex, instructions, isNavigating, isNavOpen, navPath]);

  useEffect(() => {
    const map = mapElementRef.current;
    const maps3dLibrary = maps3dLibraryRef.current;
    const Polygon3dInteractiveElement =
      maps3dLibrary?.Polygon3DInteractiveElement;
    if (!(map && Polygon3dInteractiveElement)) {
      return;
    }

    for (const polygon of roomPolygonsRef.current) {
      polygon.remove();
    }
    roomPolygonsRef.current = [];

    if (!(focusedFloor && focusedFloorRooms && canShowFloorplans)) {
      return;
    }

    const handleSelectRoom = (selectedRoomName: string, room: GeoRoom) => {
      if (
        !buildings?.[room.floor.buildingCode]?.floors.includes(
          getFloorLevelFromRoomName(selectedRoomName) ?? "",
        )
      ) {
        return;
      }

      if (isNavOpen) {
        setSrc(`${room.floor.buildingCode}-${selectedRoomName}`);
      } else {
        navigate(`/${room.floor.buildingCode}-${selectedRoomName}`);
        setCardStatus(CardStates.HALF_OPEN);
      }
    };

    for (const [focusedRoomName, room] of Object.entries(focusedFloorRooms)) {
      const [ring] = room.points;
      if (!ring || ring.length < 3) {
        continue;
      }

      const roomColors = getRoomTypeDetails(room.type);
      const isSelected = focusedRoomName === roomName;

      const roomPolygon = new Polygon3dInteractiveElement({
        outerCoordinates: ring.map((coordinatePoint) => ({
          lat: coordinatePoint.latitude,
          lng: coordinatePoint.longitude,
          altitude: 0,
        })),
      });
      roomPolygon.outerCoordinates = ring.map((coordinatePoint) => ({
        lat: coordinatePoint.latitude,
        lng: coordinatePoint.longitude,
        altitude: 0,
      }));
      roomPolygon.fillColor = roomColors.background;
      roomPolygon.strokeColor = isSelected ? "#FFBD59" : roomColors.border;
      roomPolygon.strokeWidth = isSelected ? 5 : 1;
      roomPolygon.drawsOccludedSegments = false;

      roomPolygon.addEventListener("gmp-click", (event) => {
        event.stopPropagation();
        handleSelectRoom(focusedRoomName, room);
      });

      roomPolygonsRef.current.push(roomPolygon);
      map.append(roomPolygon);
    }

    return () => {
      for (const polygon of roomPolygonsRef.current) {
        polygon.remove();
      }
      roomPolygonsRef.current = [];
    };
  }, [
    buildings,
    canShowFloorplans,
    focusedFloor,
    focusedFloorRooms,
    isNavOpen,
    navigate,
    roomName,
    setCardStatus,
    setSrc,
  ]);

  if (!env.GOOGLE_MAPS_API_KEY) {
    return (
      <div className="relative h-full w-full bg-gray-100">
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-foreground-neutral-secondary">
          Google photorealistic 3D is unavailable. Set
          <span className="px-1 font-semibold">GOOGLE_MAPS_API_KEY</span>
          or
          <span className="px-1 font-semibold">VITE_GOOGLE_MAPS_API_KEY</span>.
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />
      {!isMapReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
          <div className="rounded-md bg-white px-4 py-2 text-foreground-neutral-secondary text-sm shadow">
            Loading Google photorealistic 3D...
          </div>
        </div>
      )}
    </div>
  );
};

export { GooglePhotorealisticMap };
