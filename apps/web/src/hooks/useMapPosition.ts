import type { CoordinateRegion } from "mapkit-react";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

export interface UseMapPositionHandlers {
  onRegionChangeStart: () => void;
  onRegionChangeEnd: () => void;
}

const UPDATE_PERIOD_MS = 150;
const MAX_UPDATE_TIME_MS = 5000;

/**
 * Hook that can be used to know when the map's panning position/zoom changes
 * @param callback Function called on a change
 * @param mapRef The reference to the MapKit JS map object
 * @param initialRegion The initial region of the map
 * @returns Handlers that need to be added to the map.
 */
const useMapPosition = (
  callback: (region: CoordinateRegion, density: number) => void,
  mapRef: RefObject<mapkit.Map | null>,
  initialRegion: CoordinateRegion,
): UseMapPositionHandlers => {
  const timeout = useRef<number | null>(null);
  const iterations = useRef(0);
  const isUpdating = useRef(false);

  const update = () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const width = window.innerWidth ?? 0;
    if (!width) {
      return;
    }

    const { region } = map;
    const dist = region.span.longitudeDelta;
    const density = width / dist;

    callback(
      {
        centerLatitude: region.center.latitude,
        centerLongitude: region.center.longitude,
        latitudeDelta: region.span.latitudeDelta,
        longitudeDelta: region.span.longitudeDelta,
      },
      density,
    );
  };

  const updateAndTimeout = () => {
    update();
    iterations.current += 1;

    const maxConsecutiveIterations = MAX_UPDATE_TIME_MS / UPDATE_PERIOD_MS;
    if (isUpdating.current && iterations.current < maxConsecutiveIterations) {
      timeout.current = window.setTimeout(updateAndTimeout, UPDATE_PERIOD_MS);
    }
  };

  const onRegionChangeStart = () => {
    if (!mapRef.current) {
      return;
    }

    const { region } = mapRef.current;
    if (
      Math.abs(region.center.latitude - initialRegion.centerLatitude) < 1e-8 &&
      Math.abs(region.center.longitude - initialRegion.centerLongitude) < 1e-8 &&
      Math.abs(region.span.latitudeDelta - initialRegion.latitudeDelta) < 1e-8
    ) {
      return;
    }

    if (timeout.current !== null) {
      window.clearTimeout(timeout.current);
    }

    // Start auto-update
    iterations.current = 0;
    isUpdating.current = true;
    timeout.current = window.setTimeout(updateAndTimeout, UPDATE_PERIOD_MS);
  };

  const onRegionChangeEnd = () => {
    isUpdating.current = false;
  };

  // Clear the timeout
  useEffect(
    () => () => {
      if (timeout.current !== null) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
    },
    [],
  );

  return { onRegionChangeStart, onRegionChangeEnd };
};

export { useMapPosition };
