import type { PdfCoordinate } from "@cmumaps/common";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { DragVertexInfo } from "./liveCursor/liveCursorTypes.ts";

interface MouseEventState {
  dragNodeId: string | null;
  dragNodePos: PdfCoordinate | null;
  dragVertexInfo: DragVertexInfo | null;
}

const initialState: MouseEventState = {
  dragNodeId: null,
  dragNodePos: null,
  dragVertexInfo: null,
};

const mouseEventSlice = createSlice({
  name: "mouseEvent",
  initialState,
  reducers: {
    dragNode(state, action: PayloadAction<string>) {
      state.dragNodeId = action.payload;
    },
    releaseNode(state) {
      state.dragNodeId = null;
    },

    setDragNodePos(state, action: PayloadAction<PdfCoordinate>) {
      state.dragNodePos = action.payload;
    },
    setDragVertexInfo(state, action: PayloadAction<DragVertexInfo>) {
      state.dragVertexInfo = action.payload;
    },
    releaseVertex(state) {
      state.dragVertexInfo = null;
    },
  },
});

export const {
  dragNode,
  releaseNode,
  setDragNodePos,
  setDragVertexInfo,
  releaseVertex,
} = mouseEventSlice.actions;
export default mouseEventSlice.reducer;
