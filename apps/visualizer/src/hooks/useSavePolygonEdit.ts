import type { Polygon, RoomInfo } from "@cmumaps/common";
import { v4 as uuidv4 } from "uuid";

import { useUpdateRoomMutation } from "../store/api/roomApiSlice.ts";

const useSavePolygonEdit = (floorCode: string, roomId?: string | null) => {
  const [updateRoom] = useUpdateRoomMutation();

  const savePolygonEdit = async (polygon: Polygon) => {
    const roomInfo: Partial<RoomInfo> = { polygon };
    if (roomId) {
      await updateRoom({ floorCode, roomId, roomInfo, batchId: uuidv4() });
    }
  };

  return savePolygonEdit;
};

export default useSavePolygonEdit;
