import type { CoordinateRegion } from "mapkit-react";
import { parseAsFloat, useQueryStates } from "nuqs";
import { type RefObject, useEffect } from "react";
import { useLocation } from "react-router";
import { prefersReducedMotion } from "@/utils/prefersReducedMotion.ts";

const DECIMALS = 6;
const EPSILON = 10 ** -DECIMALS;

const round = (n: number) => {
  const f = 10 ** DECIMALS;
  return Math.round(n * f) / f;
};

const useViewportParams = (mapRef: RefObject<mapkit.Map | null>) => {
  const location = useLocation();
  // path navigation (room/building/coordinate/event) takes precedence over viewport params
  const isTrivialPath = location.pathname === "/";

  const [params, setParams] = useQueryStates(
    {
      lat: parseAsFloat,
      lng: parseAsFloat,
      latd: parseAsFloat,
      lngd: parseAsFloat,
    },
    { history: "replace", throttleMs: 300 },
  );

  const initialRegion: CoordinateRegion | null =
    isTrivialPath &&
    params.lat !== null &&
    params.lng !== null &&
    params.latd !== null &&
    params.lngd !== null
      ? {
          centerLatitude: params.lat,
          centerLongitude: params.lng,
          latitudeDelta: params.latd,
          longitudeDelta: params.lngd,
        }
      : null;

  const writeViewport = () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    if (!isTrivialPath) {
      return;
    }
    const { region } = map;
    setParams({
      lat: round(region.center.latitude),
      lng: round(region.center.longitude),
      latd: round(region.span.latitudeDelta),
      lngd: round(region.span.longitudeDelta),
    });
  };

  // clear viewport params when a path-based selection takes over
  useEffect(() => {
    if (isTrivialPath) {
      return;
    }
    if (
      params.lat === null &&
      params.lng === null &&
      params.latd === null &&
      params.lngd === null
    ) {
      return;
    }
    setParams({ lat: null, lng: null, latd: null, lngd: null });
  }, [isTrivialPath, params, setParams]);

  // url -> map: react to external param changes after mount
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialRegion) {
      return;
    }
    const { region } = map;
    if (
      Math.abs(region.center.latitude - initialRegion.centerLatitude) < EPSILON &&
      Math.abs(region.center.longitude - initialRegion.centerLongitude) < EPSILON &&
      Math.abs(region.span.latitudeDelta - initialRegion.latitudeDelta) < EPSILON &&
      Math.abs(region.span.longitudeDelta - initialRegion.longitudeDelta) < EPSILON
    ) {
      return;
    }
    const target = new mapkit.CoordinateRegion(
      new mapkit.Coordinate(initialRegion.centerLatitude, initialRegion.centerLongitude),
      new mapkit.CoordinateSpan(initialRegion.latitudeDelta, initialRegion.longitudeDelta),
    );
    map.setRegionAnimated(target, !prefersReducedMotion());
  }, [mapRef, initialRegion]);

  return { initialRegion, writeViewport };
};

export { useViewportParams };
