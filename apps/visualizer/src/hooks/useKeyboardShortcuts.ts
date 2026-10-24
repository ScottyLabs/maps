import type { Graph, Rooms } from "@cmumaps/common";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { useInvalidateCacheMutation } from "../store/api/floorDataApiSlice";
import { useDeleteNodeMutation } from "../store/api/nodeApiSlice";
import { redo, undo } from "../store/features/history/historyThunks";
import {
  ADD_DOOR_NODE,
  ADD_EDGE,
  ADD_NODE,
  DELETE_EDGE,
  GRAPH_SELECT,
  POLYGON_ADD_VERTEX,
  POLYGON_DELETE_VERTEX,
  selectEditPolygon,
  setMode,
} from "../store/features/modeSlice";
import {
  toggleShowEdges,
  toggleShowLabels,
  toggleShowNodes,
  toggleShowPolygons,
} from "../store/features/visibilitySlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { calcMst } from "../utils/graphUtils";
import useValidatedFloorParams from "./useValidatedFloorParams";

const useKeyboardShortcuts = (
  floorCode: string,
  graph: Graph,
  rooms: Rooms,
) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate({ from: "/floors/$floorCode" });

  const [invalidateCache] = useInvalidateCacheMutation();
  const [deleteNode] = useDeleteNodeMutation();

  const { nodeId: selectedNodeId } = useValidatedFloorParams(floorCode);

  const editPolygon = useAppSelector(selectEditPolygon);
  const shortcutsDisabled = useAppSelector(
    (state) => state.status.shortcutsDisabled,
  );

  useEffect(() => {
    if (shortcutsDisabled) {
      return;
    }

    const toastNodeNotSelectedErr = () => toast.error("Select a node first!");

    const handleKeyDown = async (event: KeyboardEvent) => {
      // general keyboard shortcuts
      switch (event.key) {
        // visibility
        case "g":
          dispatch(toggleShowNodes());
          dispatch(toggleShowEdges());
          break;
        case "l":
          dispatch(toggleShowLabels());
          break;
        case "p":
          dispatch(toggleShowPolygons());
          break;

        // quit
        case "q":
          dispatch(setMode(GRAPH_SELECT));
          break;

        // refetch data
        case "r":
          invalidateCache();
          break;

        // edit history
        case "z":
          if (event.metaKey || event.ctrlKey) {
            if (event.shiftKey) {
              const action = await dispatch(redo());
              if (action.payload) {
                navigate(action.payload);
              }
            } else {
              const action = await dispatch(undo());
              if (action.payload) {
                navigate(action.payload);
              }
            }
          }
          break;
      }

      if (editPolygon) {
        // polygon keyboard shortcuts
        switch (event.key) {
          case "d":
            dispatch(setMode(POLYGON_DELETE_VERTEX));
            break;
          case "v":
            dispatch(setMode(POLYGON_ADD_VERTEX));
            break;
        }
      } else {
        // graph keyboard shortcuts
        switch (event.key) {
          // graph
          case "n":
            dispatch(setMode(ADD_NODE));
            break;
          case "e":
            if (selectedNodeId) {
              dispatch(setMode(ADD_EDGE));
            } else {
              toastNodeNotSelectedErr();
            }
            break;
          case "d":
            if (selectedNodeId) {
              dispatch(setMode(DELETE_EDGE));
            } else {
              toastNodeNotSelectedErr();
            }
            break;

          // delete or backspace to delete a node
          case "Backspace":
          case "Delete": {
            if (selectedNodeId) {
              navigate({ to: ".", search: {}, replace: true });
              deleteNode({
                floorCode,
                batchId: uuidv4(),
                nodeId: selectedNodeId,
              });
            } else {
              toastNodeNotSelectedErr();
            }
            break;
          }

          case "w":
            dispatch(setMode(ADD_DOOR_NODE));
            break;

          // enters polygon editing mode
          case "v":
            if (selectedNodeId) {
              dispatch(setMode(POLYGON_ADD_VERTEX));
            }
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    dispatch,
    deleteNode,
    editPolygon,
    floorCode,
    selectedNodeId,
    shortcutsDisabled,
    invalidateCache,
    navigate,
  ]);

  // mst calculation as a separate effect to avoid re-calculating on every graph/rooms edit
  useEffect(() => {
    if (shortcutsDisabled) {
      return;
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      switch (event.key) {
        case "m":
          calcMst(graph, rooms, navigate, dispatch);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [graph, rooms, navigate, dispatch, shortcutsDisabled]);
};

export default useKeyboardShortcuts;
