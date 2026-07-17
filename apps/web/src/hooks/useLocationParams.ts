/** biome-ignore-all lint/nursery/noFloatingPromises: TODO: fix the floating promises */
import { useQueryState } from "nuqs";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { $api } from "@/api/client.ts";
import { buildFloorCode, getFloorLevelFromRoomName } from "@/utils/floorUtils.ts";

interface Params {
  buildingCode?: string;
  floor?: string;
  roomName?: string;
  eventId?: string;
  coordinate?: { latitude: number; longitude: number };
  isCardOpen?: boolean;
  error?: string;
}

const useLocationParams = (): Params => {
  const [dst, setDst] = useQueryState("dst");
  const [src, setSrc] = useQueryState("src");

  const path = window.location.pathname;
  const pathParts = path.split("/");
  const [, rootSegment, secondarySegment] = pathParts;
  const pathSuffix = pathParts.slice(1).join("/") || "";
  const suffix: string = dst && dst !== pathSuffix ? dst : pathSuffix;

  const navigate = useNavigate();

  const { data: buildings } = $api.useQuery("get", "/buildings");

  const [buildingCode, roomName] = suffix.split("-") || [];
  const floor = getFloorLevelFromRoomName(roomName) || "";

  const floorCode = buildFloorCode(buildingCode, floor);
  const { data: rooms } = $api.useQuery(
    "get",
    "/floors/{floorCode}/floorplan",
    { params: { path: { floorCode: floorCode ?? "" } } },
    { enabled: Boolean(floorCode) },
  );

  const building = buildings && buildingCode && buildings[buildingCode];

  if (suffix !== pathSuffix) {
    navigate(`/${dst}`);
    setSrc(src);
    setDst(dst);
  }

  if (suffix === "") {
    return {};
  }

  if (suffix === "user") {
    if (!dst) {
      navigate("");
    }
    return {};
  }

  if (suffix.includes(",")) {
    const [latitude, longitude] = suffix.split(",").map(Number.parseFloat);
    if (
      !(latitude && longitude) ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      navigate("/");
      return { error: "Invalid coordinate" };
    }
    return { coordinate: { latitude, longitude }, isCardOpen: !dst };
  }

  if (rootSegment === "events") {
    return {
      eventId: secondarySegment,
      isCardOpen: true,
    };
  }

  if (!buildings) {
    return {};
  }

  if (!building) {
    navigate("/");
    toast.error("Invalid building code");
    return { error: "Invalid building code" };
  }

  if (!roomName || roomName === "") {
    return { buildingCode, isCardOpen: Boolean(buildingCode && !dst) };
  }

  if (!floor || (building && !building.floors.includes(floor))) {
    navigate(`/${String(buildingCode)}`);
    toast.error("Invalid floor code");
    return { error: "Invalid floor level" };
  }

  if (roomName === floor) {
    return { buildingCode, floor, isCardOpen: Boolean(buildingCode && !dst) };
  }

  if (!rooms) {
    return { buildingCode, floor, isCardOpen: Boolean(buildingCode && !dst) };
  }

  if (!rooms[roomName]) {
    navigate(`/${String(buildingCode)}-${String(floor)}`);
    toast.error("Invalid room code");
    return { error: "Invalid room name" };
  }

  return {
    buildingCode,
    floor,
    roomName,
    isCardOpen: Boolean(buildingCode && !dst),
  };
};

export { useLocationParams };
