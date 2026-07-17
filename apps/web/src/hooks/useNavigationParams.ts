import { useQueryState } from "nuqs";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { $api } from "@/api/client.ts";
import { useUser } from "@/hooks/useUser.ts";
import { useBoundStore } from "@/store/index.ts";
import type { NavPaths, NavWaypointType } from "@/types/navTypes.ts";
import { buildFloorCode, getFloorLevelFromRoomName } from "@/utils/floorUtils.ts";

interface Params {
  navPaths?: NavPaths;
  isNavOpen: boolean;
  srcName?: string;
  dstName?: string;
  srcShortName?: string;
  dstShortName?: string;
  srcType?: NavWaypointType;
  dstType?: NavWaypointType;
  srcBuildingCode?: string;
  dstBuildingCode?: string;
  setSrc: (src: string | null) => void;
  setDst: (dst: string | null) => void;
  swap: () => void;
}

const FLOOR_WAYPOINT_PREFIX = "floor:";

const getPathFromWaypointParam = (point: string) =>
  point.startsWith(FLOOR_WAYPOINT_PREFIX)
    ? point.slice(FLOOR_WAYPOINT_PREFIX.length)
    : point;

const getWaypointParams = (
  point: string,
): {
  query?: string;
  label?: string;
  labelShort?: string;
  urlParam?: string;
  type?: NavWaypointType;
  buildingCode?: string;
  error?: string;
} => {
  const normalizedPoint = getPathFromWaypointParam(point);
  const { data: buildings } = $api.useQuery("get", "/buildings");
  const pointSplit = normalizedPoint.split("-");
  const [buildingCode] = pointSplit;
  const roomName = pointSplit.slice(1).join("-");
  const floorName = point.startsWith(FLOOR_WAYPOINT_PREFIX)
    ? roomName
    : getFloorLevelFromRoomName(roomName);
  const userPosition = useBoundStore((state) => state.userPosition);

  const floorCode = buildFloorCode(buildingCode, floorName);
  const { data: rooms } = $api.useQuery(
    "get",
    "/floors/{floorCode}/floorplan",
    { params: { path: { floorCode: floorCode ?? "" } } },
    { enabled: Boolean(floorCode) },
  );

  if (point === "user") {
    if (!userPosition) {
      return { label: "Your Location (unavailable)" };
    }
    return {
      query: `${userPosition.coords.latitude},${userPosition.coords.longitude}`,
      label: "Your Location",
      labelShort: "You",
      type: "User",
    };
  }

  if (point === "") {
    return {};
  }

  if (point.includes(",")) {
    return {
      query: point,
      label: "Coordinate",
      labelShort: "Pin",
      type: "Coordinate",
    };
  }

  if (normalizedPoint.includes("-")) {
    if (!buildings) {
      return {
        type: point.startsWith(FLOOR_WAYPOINT_PREFIX) ? "Floor" : "Room",
        buildingCode,
      };
    }

    const building = buildingCode ? buildings[buildingCode] : undefined;
    if (!(buildingCode && building)) {
      return { error: `Invalid Building ${buildingCode}` };
    }

    const isFloorWaypoint =
      point.startsWith(FLOOR_WAYPOINT_PREFIX) ||
      building.floors.includes(roomName);
    if (isFloorWaypoint) {
      if (!building.floors.includes(roomName)) {
        return { error: `Invalid Floor Waypoint ${roomName}` };
      }

      const floorPathParam = `${buildingCode}-${roomName}`;
      return {
        query: `${FLOOR_WAYPOINT_PREFIX}${floorPathParam}`,
        label: `${building.name} Floor ${roomName}`,
        labelShort: `${buildingCode} ${roomName}`,
        urlParam: floorPathParam,
        type: "Floor",
        buildingCode,
      };
    }

    if (!rooms) return { type: "Room", buildingCode };

    const room = rooms[roomName];
    if (!room) return { error: `Invalid Room Waypoint ${roomName}` };

    const label =
      room.alias ||
      `${buildings[room.floor?.buildingCode ?? buildingCode]?.name} ${roomName}`;
    const labelShort = `${buildingCode} ${roomName}`;
    return {
      query: room.id,
      label,
      labelShort,
      urlParam: normalizedPoint,
      type: "Room",
      buildingCode,
    };
  }

  // If point is not a coordinate, user position, or room name, we treat it as a building code
  if (!buildings) {
    return { type: "Building" };
  }

  if (!(point && buildings?.[point])) {
    return { error: `Invalid Building ${point}` };
  }

  return {
    query: point,
    label: buildings[point]?.name,
    labelShort: point,
    type: "Building",
  };
};

const useNavPaths = (): Params => {
  const [src, setSrc] = useQueryState("src");
  const [dst, setDst] = useQueryState("dst");
  const user = useUser();

  const navigate = useNavigate();

  const {
    query: srcQuery,
    label: srcName,
    labelShort: srcShortName,
    urlParam: srcUrlParam,
    type: srcType,
    buildingCode: srcBuildingCode,
    error: srcError,
  } = getWaypointParams(src ?? "");

  const {
    query: dstQuery,
    label: dstName,
    labelShort: dstShortName,
    type: dstType,
    buildingCode: dstBuildingCode,
    error: dstError,
  } = getWaypointParams(dst ?? "");

  const hasValidQuery = Boolean(
    srcQuery && dstQuery && srcQuery !== "" && dstQuery !== "",
  );

  // Use authenticated endpoint when user is logged in
  const { data: authNavPaths } = $api.useQuery(
    "get",
    "/path",
    {
      params: {
        query: {
          start: srcQuery ?? "",
          end: dstQuery ?? "",
        },
      },
    },
    {
      enabled: hasValidQuery && Boolean(user),
    },
  ) as { data: NavPaths | undefined };

  // Use public endpoint when user is not logged in (only allows CUC + outside)
  const { data: publicNavPaths } = $api.useQuery(
    "get",
    "/path/public",
    {
      params: {
        query: {
          start: srcQuery ?? "",
          end: dstQuery ?? "",
        },
      },
    },
    {
      enabled: hasValidQuery && !user,
    },
  ) as { data: NavPaths | undefined };

  // Use the appropriate path data based on auth status
  const navPaths = user ? authNavPaths : publicNavPaths;

  const swap = async () => {
    const temp = src;
    if (srcUrlParam) {
      await navigate(`/${srcUrlParam}`);
    }
    setSrc(dst);
    setDst(temp);
  };

  const setDstAndUrlParam = async (newDst: string | null) => {
    if (newDst) {
      await navigate(`/${getPathFromWaypointParam(newDst)}`);
    }
    setDst(newDst);
    setSrc(src);
  };

  if (!(src && dst) || src === "" || dst === "") {
    if (src) setSrc(null);
    if (dst) setDst(null);
    return { setSrc, setDst, swap, isNavOpen: false };
  }

  if (srcError || dstError) {
    toast.error(srcError ?? dstError);
    if (src) setSrc(null);
    if (dst) setDst(null);
    return { setSrc, setDst, swap, isNavOpen: false };
  }

  return {
    navPaths,
    isNavOpen: Boolean(dstName),
    srcName,
    dstName,
    srcShortName,
    dstShortName,
    srcType,
    dstType,
    srcBuildingCode,
    dstBuildingCode,
    setSrc,
    setDst: setDstAndUrlParam,
    swap,
  };
};

export { useNavPaths, getWaypointParams };
