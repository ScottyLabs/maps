import { $api } from "@/api/client.ts";
import { ButtonsRow } from "@/components/info-cards/shared/buttons-row/ButtonsRow.tsx";
import { InfoCardImage } from "@/components/info-cards/shared/media/InfoCardImage.tsx";
import { useIsMobile } from "@/hooks/useIsMobile.ts";
import { useLocationParams } from "@/hooks/useLocationParams.ts";
import { useBoundStore } from "@/store/index.ts";

const RoomCard = () => {
  const isMobile = useIsMobile();
  const isCardCollapsed = useBoundStore((state) => state.isCardCollapsed());
  const { buildingCode, roomName, floor } = useLocationParams();

  // Query data
  const floorCode = buildingCode && floor ? `${buildingCode}-${floor}` : null;
  const { data: buildings } = $api.useQuery("get", "/buildings");
  const { data: rooms } = $api.useQuery(
    "get",
    "/floors/{floorCode}/floorplan",
    { params: { path: { floorCode: floorCode ?? "" } } },
    { enabled: Boolean(floorCode) },
  );

  if (!(roomName && rooms && buildings)) {
    return;
  }

  const room = rooms[roomName];
  if (!room) {
    return;
  }

  const renderRoomImage = () => {
    // the default image is the building image
    const url = `/location_images/building_room_images/${buildingCode}/${buildingCode}.jpg`;
    // TODO: but get the room image if it exists if (
    //   availableRoomImages &&
    //   availableRoomImages[buildingCode].includes(room.name + ".jpg")
    // ) {
    //   url = `/location_images/building_room_images/${buildingCode}/${room.name}.jpg`;
    // }
    return <InfoCardImage url={url} alt={roomName} />;
  };

  const renderTitle = () => {
    if (room.alias) {
      return <h2>{room.alias}</h2>;
    }

    if (
      room.type === "Restroom" ||
      room.type === "Stairs" ||
      room.type === "Elevator"
    ) {
      return <h2>{room.type}</h2>;
    }

    return (
      <div className="flex items-center justify-between">
        <h2>
          {buildings[room.floor?.buildingCode ?? buildingCode]?.name} {roomName}
        </h2>
        <p className="italic">{room.type}</p>
      </div>
    );
  };

  const renderSchedule = () => (
    <p className="text-gray-500">No Room Schedule Available</p>
  );

  return (
    <>
      {!(isCardCollapsed && isMobile) && renderRoomImage()}
      <div className="mx-3 mt-2">
        {renderTitle()}
        {renderSchedule()}
      </div>
      <ButtonsRow />
    </>
  );
};

export { RoomCard };
