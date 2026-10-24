import type { LiveUser } from "@cmumaps/websocket";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { getSocketId } from "../../middleware/webSocketMiddleware.ts";
import type { CursorInfo } from "./liveCursorTypes.ts";

interface LiveCursorState {
  liveUsers: Record<string, LiveUser>;
  liveCursors: Record<string, CursorInfo[]>;
}

const initialState: LiveCursorState = {
  liveUsers: {},
  liveCursors: {},
};

// need socketId for settting other users' cursor infos but don't need it when updating own cursor info
interface SetCursorInfosPayload {
  socketId: string;
  cursorInfos: CursorInfo[];
}

const liveCursorSlice = createSlice({
  name: "liveCursor",
  initialState,
  reducers: {
    setLiveUsers(state, action: PayloadAction<Record<string, LiveUser>>) {
      state.liveUsers = action.payload;
    },

    pushCursorInfo(state, action: PayloadAction<CursorInfo>) {
      const socketId = getSocketId();
      if (socketId) {
        if (!state.liveCursors[socketId]) {
          state.liveCursors[socketId] = [];
        }
        state.liveCursors[socketId].push(action.payload);
      }
    },
    setCursorInfos(state, action: PayloadAction<SetCursorInfosPayload>) {
      const { socketId, cursorInfos } = action.payload;
      state.liveCursors[socketId] = cursorInfos;
    },
  },
  selectors: {
    selectCursorInfos(state, socketId: string | undefined) {
      if (!socketId) {
        return null;
      }
      return state.liveCursors[socketId];
    },
  },
});

export const { selectCursorInfos } = liveCursorSlice.selectors;
export const { setLiveUsers, pushCursorInfo, setCursorInfos } = liveCursorSlice.actions;
export default liveCursorSlice.reducer;
