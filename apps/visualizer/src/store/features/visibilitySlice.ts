import { createSlice } from "@reduxjs/toolkit";

interface VisibilityState {
  showNodes: boolean;
  showEdges: boolean;
  showLabels: boolean;
  showPolygons: boolean;
}

const initialState: VisibilityState = {
  showNodes: true,
  showEdges: true,
  showLabels: false,
  showPolygons: true,
};

const visibilitySlice = createSlice({
  name: "visibility",
  initialState,
  reducers: {
    toggleShowNodes(state) {
      state.showNodes = !state.showNodes;
    },
    toggleShowEdges(state) {
      state.showEdges = !state.showEdges;
    },
    toggleShowLabels(state) {
      state.showLabels = !state.showLabels;
    },
    toggleShowPolygons(state) {
      state.showPolygons = !state.showPolygons;
    },

    toggleShowGraph(state) {
      state.showNodes = !state.showNodes;
      state.showEdges = !state.showEdges;
    },
  },
});

export const {
  toggleShowNodes,
  toggleShowEdges,
  toggleShowLabels,
  toggleShowPolygons,
  toggleShowGraph,
} = visibilitySlice.actions;
export default visibilitySlice.reducer;
