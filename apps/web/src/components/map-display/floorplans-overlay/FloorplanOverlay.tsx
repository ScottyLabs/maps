import type { Floor, GeoRoom } from "@cmumaps/common";
import { getRoomTypeDetails } from "@cmumaps/common";
import { Annotation, Polygon } from "mapkit-react";
import { $api } from "@/api/client";
import { RoomPin } from "@/components/shared/RoomPin.tsx";
import { useLocationParams } from "@/hooks/useLocationParams.ts";
import { useNavigateLocationParams } from "@/hooks/useNavigateLocationParams";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { CardStates } from "@/store/cardSlice";
import { useBoundStore } from "@/store/index.ts";
import { getFloorCode, getFloorLevelFromRoomName } from "@/utils/floorUtils";

interface Props {
  floor: Floor;
}

const FloorplanOverlay = ({ floor }: Props) => {
  // Library hooks
  const navigate = useNavigateLocationParams();

  // Global state
  const showRoomNames = useBoundStore((state) => state.showRoomNames);
  const setCardStatus = useBoundStore((state) => state.setCardStatus);

  // Query data
  const floorCode = getFloorCode(floor);
  const { data: rooms } = $api.useQuery(
    "get",
    "/floors/{floorCode}/floorplan",
    { params: { path: { floorCode: floorCode ?? "" } } },
    { enabled: Boolean(floorCode) },
  );
  const { data: buildings } = $api.useQuery("get", "/buildings");

  // Custom hooks
  const { roomName: selectedRoomName } = useLocationParams();
  const { isNavOpen, setSrc } = useNavPaths();

  if (!rooms) {
    return null;
  }

  const handleSelectRoom = (roomName: string, room: GeoRoom) => {
    if (roomName === room.id) return;
    // biome-ignore lint/nursery/noShadow: TODO: fix the shadow
    const { floor } = room;

    if (
      !buildings?.[floor.buildingCode]?.floors.includes(
        getFloorLevelFromRoomName(roomName) ?? "",
      )
    ) {
      return;
    }

    if (isNavOpen) {
      setSrc(`${floor.buildingCode}-${roomName}`);
    } else {
      navigate(`/${floor.buildingCode}-${roomName}`);
      setCardStatus(CardStates.HALF_OPEN);
    }
  };

  return Object.entries(rooms).map(([roomName, room]) => {
    const displayName = room.name ?? roomName;
    const navigable = roomName !== room.id;
    const isSelected = roomName === selectedRoomName;
    const roomColors = getRoomTypeDetails(room.type);
    const pinlessRoomTypes = ["Default", "Corridors"];
    const showPin =
      navigable && (!pinlessRoomTypes.includes(room.type) || isSelected);

    const renderRoomName = () => {
      if ((showRoomNames && displayName) || room.alias) {
        return (
          <div className="text-center text-sm leading-[1.1] tracking-wide">
            {showRoomNames && <p>{displayName}</p>}
            {/** biome-ignore lint/nursery/noLeakedRender: TODO: fix the leaked render */}
            {room.alias && (
              <p className="w-16 text-wrap italic">{room.alias}</p>
            )}
          </div>
        );
      }
    };

    return (
      <div key={roomName}>
        <Polygon
          points={room.points}
          selected={isSelected}
          enabled={navigable}
          fillColor={roomColors.background}
          fillOpacity={1}
          strokeColor={isSelected ? "#FFBD59" : roomColors.border}
          strokeOpacity={1}
          lineWidth={isSelected ? 5 : 1}
          onSelect={() => handleSelectRoom(roomName, room)}
          fillRule="nonzero"
        />
        {navigable && (
          <Annotation
            latitude={room.labelPosition.latitude}
            longitude={room.labelPosition.longitude}
            displayPriority="low"
          >
            <button
              type="button"
              tabIndex={0}
              className="flex flex-col items-center"
              onClick={(e) => {
                handleSelectRoom(roomName, room);
                e.stopPropagation();
              }}
            >
              {/** biome-ignore lint/nursery/noLeakedRender: TODO: fix the leaked render */}
              {showPin && <RoomPin room={{ ...room, name: roomName }} />}
              {renderRoomName()}
            </button>
          </Annotation>
        )}
      </div>
    );
  });
};

export { FloorplanOverlay };
