import type { Rooms } from "@cmumaps/common";

import { floorDataApiSlice } from "../../api/floorDataApiSlice.ts";
import type {
  CreateRoomArg,
  DeleteRoomArg,
  UpdateRoomArg,
} from "../../api/roomApiSlice.ts";
import type { AppDispatch, RootState } from "../../store.ts";
import type { Edit, EditPair } from "./historyTypes.ts";

const getRooms = async (
  floorCode: string,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<Rooms> => {
  let rooms = floorDataApiSlice.endpoints.getFloorRooms.select(floorCode)(
    getStore(),
  ).data;

  if (!rooms) {
    rooms = await dispatch(
      floorDataApiSlice.endpoints.getFloorRooms.initiate(floorCode),
    ).unwrap();
  }

  return rooms;
};

export const buildCreateRoomEditPair = (
  batchId: string,
  arg: CreateRoomArg,
): EditPair => {
  const { floorCode, roomId } = arg;
  const edit: Edit = {
    endpoint: "createRoom",
    arg: { ...arg, batchId: null },
  };
  const reverseEdit: Edit = {
    endpoint: "deleteRoom",
    arg: { floorCode, roomId, batchId: null },
  };
  return { batchId, edit, reverseEdit };
};

export const buildDeleteRoomEditPair = async (
  batchId: string,
  arg: DeleteRoomArg,
  roomNodes: string[],
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<EditPair> => {
  const { floorCode, roomId } = arg;
  const edit: Edit = {
    endpoint: "deleteRoom",
    arg: { ...arg, batchId: null },
  };

  const rooms = await getRooms(floorCode, getStore, dispatch);
  const reverseEdit: Edit = {
    endpoint: "createRoom",
    arg: {
      floorCode,
      roomId,
      roomNodes,
      roomInfo: rooms[roomId],
      batchId: null,
    },
  };

  return { batchId, edit, reverseEdit };
};

export const buildUpdateRoomEditPair = async (
  batchId: string,
  arg: UpdateRoomArg,
  getStore: () => RootState,
  dispatch: AppDispatch,
): Promise<EditPair> => {
  const { floorCode, roomId } = arg;
  const edit: Edit = {
    endpoint: "updateRoom",
    arg: { ...arg, batchId: null },
  };

  const rooms = await getRooms(floorCode, getStore, dispatch);
  const reverseEdit: Edit = {
    endpoint: "updateRoom",
    arg: { floorCode, roomId, roomInfo: rooms[roomId], batchId: null },
  };

  return { batchId, edit, reverseEdit };
};
