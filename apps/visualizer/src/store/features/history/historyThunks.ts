import { toast } from "react-toastify";

import { edgeApiSlice } from "../../api/edgeApiSlice.ts";
import { nodeApiSlice } from "../../api/nodeApiSlice.ts";
import { poiApiSlice } from "../../api/poiApiSlice.ts";
import { roomApiSlice } from "../../api/roomApiSlice.ts";
import type { AppDispatch } from "../../store.ts";
import { createAppAsyncThunk } from "../../withTypes.ts";
import { setEditIndex } from "./historySlice.ts";
import type { Edit } from "./historyTypes.ts";

const applyEdit = async (
  edit: Edit,
  dispatch: AppDispatch,
): Promise<string> => {
  switch (edit.endpoint) {
    case "createNode":
      await dispatch(
        nodeApiSlice.endpoints.createNode.initiate(edit.arg),
      ).unwrap();
      return `?nodeId=${edit.arg.nodeId}`;
    case "deleteNode":
      await dispatch(
        nodeApiSlice.endpoints.deleteNode.initiate(edit.arg),
      ).unwrap();
      break;
    case "updateNode":
      await dispatch(
        nodeApiSlice.endpoints.updateNode.initiate(edit.arg),
      ).unwrap();
      return `?nodeId=${edit.arg.nodeId}`;
    case "createEdge":
      await dispatch(
        edgeApiSlice.endpoints.createEdge.initiate(edit.arg),
      ).unwrap();
      return `?nodeId=${edit.arg.inNodeId}`;
    case "deleteEdge":
      await dispatch(
        edgeApiSlice.endpoints.deleteEdge.initiate(edit.arg),
      ).unwrap();
      return `?nodeId=${edit.arg.inNodeId}`;
    case "createEdgeAcrossFloors":
      await dispatch(
        edgeApiSlice.endpoints.createEdgeAcrossFloors.initiate(edit.arg),
      ).unwrap();
      return `?nodeId=${edit.arg.inNodeId}`;
    case "deleteEdgeAcrossFloors":
      await dispatch(
        edgeApiSlice.endpoints.deleteEdgeAcrossFloors.initiate(edit.arg),
      ).unwrap();
      return `?nodeId=${edit.arg.inNodeId}`;
    case "createRoom":
      await dispatch(
        roomApiSlice.endpoints.createRoom.initiate(edit.arg),
      ).unwrap();
      return `?roomId=${edit.arg.roomId}`;
    case "deleteRoom":
      await dispatch(
        roomApiSlice.endpoints.deleteRoom.initiate(edit.arg),
      ).unwrap();
      break;
    case "updateRoom":
      await dispatch(
        roomApiSlice.endpoints.updateRoom.initiate(edit.arg),
      ).unwrap();
      return `?roomId=${edit.arg.roomId}`;
    case "createPoi":
      await dispatch(
        poiApiSlice.endpoints.createPoi.initiate(edit.arg),
      ).unwrap();
      return `?poiId=${edit.arg.poiId}`;
    case "deletePoi":
      await dispatch(
        poiApiSlice.endpoints.deletePoi.initiate(edit.arg),
      ).unwrap();
      break;
    case "updatePoi":
      await dispatch(
        poiApiSlice.endpoints.updatePoi.initiate(edit.arg),
      ).unwrap();
      return `?poiId=${edit.arg.poiId}`;
    default:
      toast.error("Unimplemented edit type!");
  }
  return "?";
};

export const undo = createAppAsyncThunk(
  "history/undo",
  async (_, { dispatch, getState }) => {
    try {
      const historyState = getState().history;
      let editIndex = historyState.editIndex;
      if (editIndex === -1) {
        toast.warn("Can't undo anymore!");
        return Promise.reject();
      }

      // keep appling reverse edits in the same batch
      let url = "?";
      const batchId = historyState.batchIds[editIndex];
      while (
        editIndex < historyState.reversedEditHistory.length &&
        historyState.batchIds[editIndex] === batchId
      ) {
        const edit = historyState.reversedEditHistory[editIndex];
        url = await applyEdit(edit, dispatch);
        editIndex--;
      }

      dispatch(setEditIndex(editIndex));
      return url;
    } catch (error) {
      toast.error("Failed to undo change!");
      console.error("Error undoing:", error);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      console.error("Error details:", error.data.details);
      return Promise.reject();
    }
  },
);

export const redo = createAppAsyncThunk(
  "history/redo",
  async (_, { dispatch, getState }) => {
    try {
      const historyState = getState().history;
      let editIndex = historyState.editIndex + 1;

      if (editIndex === historyState.editHistory.length) {
        toast.warn("Can't redo anymore!");
        return Promise.reject();
      }

      // keep applying edits in the same batch
      let url = "?";
      const batchId = historyState.batchIds[editIndex];
      while (
        editIndex < historyState.editHistory.length &&
        historyState.batchIds[editIndex] === batchId
      ) {
        const edit = historyState.editHistory[editIndex];
        url = await applyEdit(edit, dispatch);
        editIndex++;
      }

      dispatch(setEditIndex(editIndex - 1));
      return url;
    } catch (error) {
      toast.error("Failed to redo change!");
      console.error("Error redoing:", error);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      console.error("Error details:", error.data.details);
      return Promise.reject();
    }
  },
);
