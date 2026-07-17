import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { toast } from "react-toastify";

import type { AppStartListening } from "../middleware/listenerMiddleware.ts";

export type Mode =
  | "Graph Select"
  | "Graph Add Edge"
  | "Graph Delete Edge"
  | "Graph Add Node"
  | "Polygon Select"
  | "Polygon Add Vertex"
  | "Polygon Delete Vertex"
  | "Graph Add Door Node";

export const GRAPH_SELECT: Mode = "Graph Select";
export const ADD_EDGE: Mode = "Graph Add Edge";
export const DELETE_EDGE: Mode = "Graph Delete Edge";
export const ADD_NODE: Mode = "Graph Add Node";
export const ADD_DOOR_NODE: Mode = "Graph Add Door Node";

export const POLYGON_SELECT: Mode = "Polygon Select";
export const POLYGON_ADD_VERTEX: Mode = "Polygon Add Vertex";
export const POLYGON_DELETE_VERTEX: Mode = "Polygon Delete Vertex";

const isEditPolygon = (mode: string) => {
  return (
    mode === POLYGON_SELECT ||
    mode === POLYGON_ADD_VERTEX ||
    mode === POLYGON_DELETE_VERTEX
  );
};

interface ModeState {
  mode: Mode;
}

const initialState: ModeState = {
  mode: GRAPH_SELECT,
};

const modeSlice = createSlice({
  name: "mode",
  initialState,
  reducers: {
    setMode(state, action: PayloadAction<Mode>) {
      state.mode = action.payload;
    },
    toggleEditPolygon(state) {
      if (isEditPolygon(state.mode)) {
        state.mode = GRAPH_SELECT;
      } else {
        state.mode = POLYGON_SELECT;
      }
    },
  },
  selectors: {
    selectEditPolygon(state) {
      return isEditPolygon(state.mode);
    },
  },
});

export const setModeListener = (startAppListening: AppStartListening) => {
  startAppListening({
    actionCreator: modeSlice.actions.setMode,
    effect: (action) => {
      switch (action.payload) {
        case ADD_EDGE:
          toast.info("Click on another node to add an edge!");
          break;

        case DELETE_EDGE:
          toast.info("Click on another node to delete an edge!");
          break;

        case ADD_NODE:
          toast.info("Click to add a node!");
          break;

        case ADD_DOOR_NODE:
          toast.info("Click on a purple door to add a door node!");
          break;

        case POLYGON_DELETE_VERTEX:
          toast.info("Click on vertex to delete it!");
          break;

        case POLYGON_ADD_VERTEX:
          toast.info("Click to add a vertex!");
          break;
      }
    },
  });
};

export const { setMode, toggleEditPolygon } = modeSlice.actions;
export const { selectEditPolygon } = modeSlice.selectors;
export default modeSlice.reducer;
