import { floorDataApiSlice } from "../../api/floorDataApiSlice.ts";
import { broadcastWebSocket } from "../../middleware/webSocketActions.ts";
import { getSocketId } from "../../middleware/webSocketMiddleware.ts";
import { createAppAsyncThunk } from "../../withTypes.ts";
import { setCursorInfos } from "./liveCursorSlice.ts";
import type { CursorInfoOnDragNode, CursorInfoOnDragVertex } from "./liveCursorTypes.ts";

export const syncCursors = createAppAsyncThunk(
  "liveCursor/syncCursors",
  (_, { dispatch, getState }) => {
    const socketId = getSocketId();
    if (!socketId) {
      return;
    }

    const cursorInfos = getState().liveCursor.liveCursors[socketId];
    if (cursorInfos && cursorInfos.length > 0) {
      const event = "sync-cursors";
      const payload = { socketId, cursorInfos };
      dispatch(broadcastWebSocket({ event, payload }));
      dispatch(setCursorInfos({ socketId, cursorInfos: [] }));
    }
  },
);

interface MoveNodeWithCursorArgType {
  cursorInfo: CursorInfoOnDragNode;
  floorCode: string;
}

// only changes the cache; used for syncing with cursor position
export const moveNodeWithCursor = createAppAsyncThunk(
  "liveCursor/moveNodeWithCursor",
  ({ cursorInfo, floorCode }: MoveNodeWithCursorArgType, { dispatch }) => {
    dispatch(
      floorDataApiSlice.util.updateQueryData("getFloorGraph", floorCode, (draft) => {
        draft[cursorInfo.nodeId].pos = cursorInfo.nodePos;
      }),
    );
  },
);

interface MoveVertexWithCursorArgType {
  cursorInfo: CursorInfoOnDragVertex;
  floorCode: string;
}

// only changes the cache; used for syncing with cursor position
export const moveVertexWithCursor = createAppAsyncThunk(
  "liveCursor/moveVertexWithCursor",
  ({ cursorInfo, floorCode }: MoveVertexWithCursorArgType, { dispatch }) => {
    dispatch(
      floorDataApiSlice.util.updateQueryData("getFloorRooms", floorCode, (draft) => {
        const { roomId, ringIndex, vertexIndex, vertexPos } = cursorInfo.dragVertexInfo;
        draft[roomId].polygon.coordinates[ringIndex][vertexIndex] = vertexPos;
      }),
    );
  },
);
