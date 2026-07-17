import type { GeoRoom } from "@cmumaps/common";
import { getRoomTypeDetails } from "@cmumaps/common";
import pinIcon from "@/assets/icons/search_results/pin.svg";
import { useLocationParams } from "@/hooks/useLocationParams.ts";
import type { Document } from "@/types/searchTypes.ts";
import { getIcon } from "@/utils/iconUtils.ts";

interface Props {
  room: (GeoRoom & { name: string }) | Document;
}

/**
 * The marker displayed for identifying the type of a room.
 * Visible on the map and in the search results.
 */
const RoomPin = ({ room }: Props) => {
  const { roomName } = useLocationParams();
  const isSelected = "name" in room && room.name === roomName;

  const icon = getIcon(room);
  const hasGraphic = Boolean(icon);

  const roomColors = getRoomTypeDetails(
    room.type === "Building" ? "Default" : room.type,
  );

  return (
    <div
      className={`flex items-center justify-center rounded ${isSelected ? "size-10" : "size-5"} `}
      style={{ background: roomColors.primary }}
    >
      <img
        alt="Room Pin"
        src={hasGraphic ? (icon ?? "") : pinIcon}
        className={`${isSelected ? "size-6" : "size-3"} pointer-events-none`}
      />
    </div>
  );
};

export { RoomPin };
