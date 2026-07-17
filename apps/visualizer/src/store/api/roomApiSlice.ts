import type {
  CreateRoomPayload,
  DeleteRoomPayload,
  UpdateRoomPayload,
} from "@cmumaps/websocket";

import { toast } from "react-toastify";

import { getNodesInRoom } from "../features/history/historyGraphUtils.ts";
import {
  buildCreateRoomEditPair,
  buildDeleteRoomEditPair,
  buildUpdateRoomEditPair,
} from "../features/history/historyRoomUtils.ts";
import { addEditToHistory } from "../features/history/historySlice.ts";
import { getSocketId } from "../middleware/webSocketMiddleware.ts";
import type { AppDispatch, RootState } from "../store.ts";
import { apiSlice, type BaseMutationArg } from "./apiSlice.ts";
import { handleQueryError } from "./errorHandler.ts";
import { floorDataApiSlice } from "./floorDataApiSlice.ts";

export type CreateRoomArg = BaseMutationArg & CreateRoomPayload;
export type DeleteRoomArg = BaseMutationArg & DeleteRoomPayload;
export type UpdateRoomArg = BaseMutationArg & UpdateRoomPayload;

export const createRoom =
  (floorCode: string, { roomId, roomNodes, roomInfo }: CreateRoomPayload) =>
  (dispatch: AppDispatch) => {
    const { undo: roomUndo } = dispatch(
      floorDataApiSlice.util.updateQueryData(
        "getFloorRooms",
        floorCode,
        (draft) => {
          draft[roomId] = roomInfo;
        },
      ),
    );

    // also need to add back room id of every node in this room
    const { undo: nodesUndo } = dispatch(
      floorDataApiSlice.util.updateQueryData(
        "getFloorGraph",
        floorCode,
        (draft) => {
          if (roomNodes) {
            for (const nodeId of roomNodes) {
              draft[nodeId].roomId = roomId;
            }
          }
        },
      ),
    );

    return {
      undo: () => {
        roomUndo();
        nodesUndo();
      },
    };
  };

export const deleteRoom =
  (floorCode: string, { roomId }: DeleteRoomPayload) =>
  (dispatch: AppDispatch) => {
    const { undo: roomUndo } = dispatch(
      floorDataApiSlice.util.updateQueryData(
        "getFloorRooms",
        floorCode,
        (draft) => {
          delete draft[roomId];
        },
      ),
    );

    // also need to delete room id of every node in this room
    const { undo: nodesUndo } = dispatch(
      floorDataApiSlice.util.updateQueryData(
        "getFloorGraph",
        floorCode,
        (draft) => {
          for (const nodeId in draft) {
            if (draft[nodeId].roomId === roomId) {
              draft[nodeId].roomId = "";
            }
          }
        },
      ),
    );

    return {
      undo: () => {
        roomUndo();
        nodesUndo();
      },
    };
  };

export const updateRoom =
  (floorCode: string, { roomId, roomInfo }: UpdateRoomPayload) =>
  (dispatch: AppDispatch) =>
    dispatch(
      floorDataApiSlice.util.updateQueryData(
        "getFloorRooms",
        floorCode,
        (draft) => {
          draft[roomId] = { ...draft[roomId], ...roomInfo };
        },
      ),
    );

export const roomApiSlice = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    createRoom: builder.mutation<Response, CreateRoomArg>({
      query: ({ floorCode, roomId, roomNodes, roomInfo }) => ({
        url: `/rooms/${roomId}`,
        method: "POST",
        body: { floorCode, roomNodes, roomInfo },
        headers: {
          "X-Socket-ID": getSocketId(),
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { floorCode, roomId, roomNodes, roomInfo, batchId } = arg;
          // add to history
          if (batchId) {
            const editPair = buildCreateRoomEditPair(batchId, arg);
            dispatch(addEditToHistory(editPair));
          }
          // optimistic update
          const { undo } = dispatch(
            createRoom(floorCode, { roomId, roomNodes, roomInfo }),
          );
          handleQueryError(queryFulfilled, undo);
        } catch (e) {
          toast.error("Check the Console for detailed error.");
          console.error(e);
        }
      },
    }),
    deleteRoom: builder.mutation<Response, DeleteRoomArg>({
      query: ({ roomId }) => ({
        url: `/rooms/${roomId}`,
        method: "DELETE",
        headers: {
          "X-Socket-ID": getSocketId(),
        },
      }),
      async onQueryStarted(arg, { getState, dispatch, queryFulfilled }) {
        try {
          const { floorCode, roomId, batchId } = arg;
          // add to history
          if (batchId) {
            const getStore = getState as () => RootState;

            // delete all nodes in this room
            const roomNodes = await getNodesInRoom(
              floorCode,
              roomId,
              getStore,
              dispatch,
            );

            // update room
            const editPair = await buildDeleteRoomEditPair(
              batchId,
              arg,
              roomNodes,
              getStore,
              dispatch,
            );

            dispatch(addEditToHistory(editPair));
          }
          // optimistic update
          const { undo } = dispatch(deleteRoom(floorCode, { roomId }));
          handleQueryError(queryFulfilled, undo);
        } catch (e) {
          toast.error("Check the Console for detailed error.");
          console.error(e);
        }
      },
    }),
    updateRoom: builder.mutation<Response, UpdateRoomArg>({
      query: ({ floorCode, roomId, roomInfo }) => ({
        url: `/rooms/${roomId}`,
        method: "PATCH",
        body: { floorCode, roomInfo },
        headers: {
          "X-Socket-ID": getSocketId(),
        },
      }),
      async onQueryStarted(arg, { getState, dispatch, queryFulfilled }) {
        try {
          const { floorCode, roomId, roomInfo, batchId } = arg;
          // add to history
          if (batchId) {
            const getStore = getState as () => RootState;
            const editPair = await buildUpdateRoomEditPair(
              batchId,
              arg,
              getStore,
              dispatch,
            );
            dispatch(addEditToHistory(editPair));
          }
          // optimistic update
          const { undo } = dispatch(
            updateRoom(floorCode, { roomId, roomInfo }),
          );
          handleQueryError(queryFulfilled, undo);
        } catch (e) {
          toast.error("Check the Console for detailed error.");
          console.error(e);
        }
      },
    }),
  }),
});

export const {
  useCreateRoomMutation,
  useDeleteRoomMutation,
  useUpdateRoomMutation,
} = roomApiSlice;
