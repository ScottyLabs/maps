import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export enum InfoDisplayTabIndex {
  ROOM = 0,
  POI = 1,
  NODE = 2,
}

export const SidePanelTabIndex = {
  VISIBILITY: 0,
  GRAPH: 1,
  POLYGON: 1,
};

interface UIState {
  infoDisplayActiveTabIndex: InfoDisplayTabIndex;
  sidePanelActiveTabIndex: (typeof SidePanelTabIndex)[keyof typeof SidePanelTabIndex];
  showRoomSpecific: boolean;
  editRoomLabel: boolean;
  nodeSize: number;
}

const initialState: UIState = {
  infoDisplayActiveTabIndex: InfoDisplayTabIndex.ROOM,
  sidePanelActiveTabIndex: SidePanelTabIndex.VISIBILITY,
  showRoomSpecific: false,
  editRoomLabel: false,
  // Radius in screen pixels, independent of zoom
  nodeSize: 4,
};

const UISlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setInfoDisplayActiveTabIndex(state, action: PayloadAction<number>) {
      state.infoDisplayActiveTabIndex = action.payload;
    },
    setSidePanelActiveTabIndex(state, action: PayloadAction<number>) {
      state.sidePanelActiveTabIndex = action.payload;
    },

    setShowRoomSpecific(state, action: PayloadAction<boolean>) {
      state.showRoomSpecific = action.payload;
    },
    toggleShowRoomSpecific(state) {
      state.showRoomSpecific = !state.showRoomSpecific;
    },

    setEditRoomLabel(state, action: PayloadAction<boolean>) {
      state.editRoomLabel = action.payload;
    },
    toggleEditRoomLabel(state) {
      state.editRoomLabel = !state.editRoomLabel;
    },

    setNodeSize(state, action: PayloadAction<number>) {
      state.nodeSize = action.payload;
    },
  },
});

export const {
  setInfoDisplayActiveTabIndex,
  setSidePanelActiveTabIndex,
  setShowRoomSpecific,
  toggleShowRoomSpecific,
  setEditRoomLabel,
  toggleEditRoomLabel,
  setNodeSize,
} = UISlice.actions;
export default UISlice.reducer;
