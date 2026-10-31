/** biome-ignore-all lint/style/useNamingConvention: TODO: use right naming convention */
import { useMemo } from "react";
import { $api } from "@/api/client";
import buildingIcon from "@/assets/icons/search_results/building.svg";
import classroomIcon from "@/assets/icons/search_results/classroom.svg";
import defaultIcon from "@/assets/icons/search_results/default.svg";
import libraryIcon from "@/assets/icons/search_results/library.svg";
import userIcon from "@/assets/icons/search_results/mark.svg";
import restaurantIcon from "@/assets/icons/search_results/restaurant.svg";
import stairsIcon from "@/assets/icons/search_results/stairs.svg";
import { useNavigateLocationParams } from "@/hooks/useNavigateLocationParams.ts";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useUser } from "@/hooks/useUser.ts";
import { track } from "@/lib/analytics.ts";
import { setPostLoginCallbackUrl } from "@/lib/authClient.ts";
import { CardStates } from "@/store/cardSlice";
import { useBoundStore } from "@/store/index.ts";
import { isPublicBuilding } from "@/utils/authUtils";
import { getFloorLevelFromRoomName } from "@/utils/floorUtils";
import { zoomOnObject, zoomOnPoint } from "@/utils/zoomUtils";

interface SearchResultProps {
  id: string;
  nameWithSpace?: string;
  fullNameWithSpace?: string;
  alias?: string;
  type?: string;
  roomType?: string;
  labelPosition?: { latitude?: number; longitude?: number } | null;
  floor?: { buildingCode?: string; level?: string };
}

interface Props {
  mapRef: React.RefObject<mapkit.Map | null>;
  searchQuery: string;
}

const SearchResults = ({ searchQuery, mapRef }: Props) => {
  // Global state
  const isSearchOpen = useBoundStore((state) => state.isSearchOpen);
  const hideSearch = useBoundStore((state) => state.hideSearch);
  const setIsZooming = useBoundStore((state) => state.setIsZooming);
  const setCardStatus = useBoundStore((state) => state.setCardStatus);
  const searchTarget = useBoundStore((state) => state.searchTarget);
  const setSearchTarget = useBoundStore((state) => state.setSearchTarget);
  const focusFloor = useBoundStore((state) => state.focusFloor);
  const showLogin = useBoundStore((state) => state.showLogin);
  const userPosition = useBoundStore((state) => state.userPosition);
  const mapController = useBoundStore((state) => state.mapController);

  const navigate = useNavigateLocationParams();
  const { setSrc, setDst } = useNavPaths();
  const user = useUser();

  const { data: searchResults } = $api.useQuery(
    "get",
    "/search",
    {
      params: { query: { query: searchQuery } },
    },
    {
      enabled: (isSearchOpen || searchTarget) && searchQuery.length > 0,
    },
  );

  const { data: buildings } = $api.useQuery("get", "/buildings");

  const organizedResults = useMemo(() => {
    if (!searchResults) return [];

    // biome-ignore lint/nursery/noShadow: TODO: fix the shadowing
    const buildings = searchResults.filter(
      (result) => result.type === "building",
    );
    const floors = searchResults.filter((result) => result.type === "floor");
    const rooms = searchResults.filter((result) => result.type === "room");

    const userLocationResult: SearchResultProps = {
      id: "user",
      fullNameWithSpace: "User Position",
      type: "user",
      nameWithSpace: "user",
    };

    if (searchTarget && userPosition) {
      return [userLocationResult, ...buildings, ...floors, ...rooms];
    }

    return [...buildings, ...floors, ...rooms];
  }, [searchResults, userPosition, searchTarget]);

  // Don't render if the search is not open or the search query is empty
  if (searchQuery.length === 0 || !(isSearchOpen || searchTarget)) {
    return;
  }

  const renderBuildingResult = (result: SearchResultProps) => (
    <>
      <div className="mr-2 ml-4 flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md text-white">
        <img width={24} src={buildingIcon} alt="classroom" />
      </div>
      <span className="flex flex-col overflow-hidden whitespace-nowrap font-foreground-neutral-primary text-[0.875rem]">
        {result.fullNameWithSpace}
      </span>
    </>
  );

  const renderRoomResult = (result: SearchResultProps) => {
    const icons = {
      Food: restaurantIcon,
      Dining: restaurantIcon,
      Library: libraryIcon,
      Classroom: classroomIcon,
    };

    const icon = icons[result.roomType as keyof typeof icons] ?? defaultIcon;

    return (
      <>
        <div className="mr-2 ml-4 flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md text-white">
          <img width={24} src={icon} alt="classroom" />
        </div>
        <div className="flex flex-col overflow-hidden whitespace-nowrap font-foreground-neutral-primary text-[0.875rem]">
          {result.alias && result.alias !== ""
            ? result.alias
            : result.nameWithSpace}
        </div>
      </>
    );
  };

  const renderFloorResult = (result: SearchResultProps) => (
    <>
      <div className="mr-2 ml-4 flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md text-white">
        <img width={24} src={stairsIcon} alt="floor" />
      </div>
      <div className="flex flex-col overflow-hidden whitespace-nowrap font-foreground-neutral-primary text-[0.875rem]">
        {result.fullNameWithSpace}
      </div>
    </>
  );

  const renderUserLocationResult = () => (
    <>
      <div className="mr-2 ml-4 flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md text-white">
        <img width={24} src={userIcon} alt="classroom" />
      </div>
      <div className="flex flex-col overflow-hidden whitespace-nowrap font-foreground-neutral-primary text-[0.875rem]">
        User Position
      </div>
    </>
  );

  const renderResultByType = (result: SearchResultProps) => {
    switch (result.type) {
      case "user":
        return renderUserLocationResult();
      case "building":
        return renderBuildingResult(result);
      case "floor":
        return renderFloorResult(result);
      default:
        return renderRoomResult(result);
    }
  };

  const getFloorFromResult = (result: SearchResultProps) => {
    if (result.floor?.buildingCode && result.floor?.level) {
      return {
        buildingCode: result.floor.buildingCode,
        level: result.floor.level,
      };
    }

    const [buildingCode, ...levelParts] = result.id.split("-");
    const level = levelParts.join("-");
    if (!(buildingCode && level)) {
      return null;
    }
    return { buildingCode, level };
  };

  const handleSelectRoom = (result: SearchResultProps) => {
    const roomName = result.nameWithSpace?.split(" ")[1];
    const buildingName = result.nameWithSpace?.split(" ")[0];
    const floor = getFloorLevelFromRoomName(roomName);
    if (
      buildingName &&
      floor &&
      buildings?.[buildingName]?.floors.includes(floor)
    ) {
      switch (searchTarget) {
        case "nav-src":
          setSrc(`${buildingName}-${roomName}`);
          break;
        case "nav-dst":
          navigate(`/${buildingName}-${roomName}`);
          setDst(`${buildingName}-${roomName}`);
          break;
        default:
          navigate(`/${buildingName}-${roomName}`);
          setCardStatus(CardStates.COLLAPSED);
          break;
      }
      focusFloor({ buildingCode: buildingName, level: floor });
    } else {
      switch (searchTarget) {
        case "nav-src":
          if (!result.labelPosition) break;
          setSrc(
            `${result.labelPosition?.latitude},${result.labelPosition?.longitude}`,
          );
          break;
        case "nav-dst":
          if (!result.labelPosition) break;
          navigate(
            `/${result.labelPosition?.latitude},${result.labelPosition?.longitude}`,
          );
          setDst(
            `${result.labelPosition?.latitude},${result.labelPosition?.longitude}`,
          );
          break;
        default:
          navigate("/");
          break;
      }
    }

    const latitude = result.labelPosition?.latitude;
    const longitude = result.labelPosition?.longitude;
    if (latitude && longitude) {
      const point = { latitude, longitude };
      if (mapController) {
        mapController.zoomToPoint(point, 0.0005);
      } else if (mapRef.current) {
        const newRegionSize = 0.0005;
        zoomOnPoint(mapRef.current, point, newRegionSize, setIsZooming);
      }
    }
  };

  const handleSelectBuilding = (result: SearchResultProps) => {
    switch (searchTarget) {
      case "nav-src":
        setSrc(result.id);
        break;
      case "nav-dst":
        navigate(`/${result.id}`);
        setDst(result.id);
        break;
      default:
        navigate(`/${result.id}`);
        break;
    }
    const building = buildings?.[result.id];
    if (building) {
      if (mapController) {
        mapController.zoomToBounds(building.shape.flat());
      } else if (mapRef.current) {
        zoomOnObject(mapRef.current, building.shape.flat(), setIsZooming);
      }
    }
  };

  const handleSelectFloor = (result: SearchResultProps) => {
    const floor = getFloorFromResult(result);
    if (!floor) {
      return;
    }

    const floorCode = `${floor.buildingCode}-${floor.level}`;
    const floorWaypoint = `floor:${floorCode}`;

    switch (searchTarget) {
      case "nav-src":
        setSrc(floorWaypoint);
        break;
      case "nav-dst":
        navigate(`/${floorCode}`);
        setDst(floorWaypoint);
        break;
      default:
        navigate(`/${floorCode}`);
        setCardStatus(CardStates.COLLAPSED);
        break;
    }

    focusFloor(floor);

    const latitude = result.labelPosition?.latitude;
    const longitude = result.labelPosition?.longitude;
    if (latitude && longitude && mapRef.current) {
      const newRegionSize = 0.0008;
      zoomOnPoint(
        mapRef.current,
        new mapkit.Coordinate(latitude, longitude),
        newRegionSize,
        setIsZooming,
      );
    }
  };

  const handleSelectUserLocation = (result: SearchResultProps) => {
    switch (searchTarget) {
      case "nav-src":
        setSrc(result.id);
        break;
      case "nav-dst":
        navigate(`/${result.id}`);
        setDst(result.id);
        break;
      default:
        navigate(`/${result.id}`);
        break;
    }
  };

  const handleClick = (result: SearchResultProps, rank: number) => {
    track("search_result_selected", {
      query: searchQuery,
      type: result.type ?? "room",
      id: result.id,
      rank,
      target: searchTarget ?? "none",
    });

    if (result.type === "room" || result.type === "floor") {
      // Public buildings are accessible to unauthenticated users via the public pathfinding API
      // Other indoor destinations require authentication
      const [nameBuildingCode, roomName] =
        result.nameWithSpace?.split(" ") ?? [];
      const buildingCode =
        result.type === "floor"
          ? (result.floor?.buildingCode ?? result.id.split("-")[0])
          : nameBuildingCode;
      const canAccess = Boolean(user) || isPublicBuilding(buildingCode);
      if (!canAccess) {
        const callbackPath =
          result.type === "floor"
            ? `/${result.id}`
            : buildingCode && roomName
              ? `/${buildingCode}-${roomName}`
              : null;
        if (callbackPath) {
          const callbackUrl = new URL(window.location.href);
          callbackUrl.pathname = callbackPath;
          setPostLoginCallbackUrl(callbackUrl.toString());
        }
        track("login_prompted", { source: "search" });
        showLogin();
        return;
      }
      if (result.type === "floor") {
        handleSelectFloor(result);
      } else {
        handleSelectRoom(result);
      }
    } else if (result.type === "user") {
      handleSelectUserLocation(result);
    } else {
      handleSelectBuilding(result);
    }
    hideSearch();
    setSearchTarget(undefined);
  };

  return (
    <div className="z-50 flex-col overflow-hidden overflow-y-scroll rounded-lg bg-white py-2">
      {organizedResults?.map((result, rank) => (
        <button
          type="button"
          key={result.id}
          className="flex h-9 w-full items-center bg-white text-lg active:bg-[#F5F5F5]"
          onClick={() => handleClick(result, rank)}
        >
          {renderResultByType(result)}
        </button>
      ))}
    </div>
  );
};

export { SearchResults };
