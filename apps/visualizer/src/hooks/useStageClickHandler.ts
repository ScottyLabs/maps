import type { NodeInfo, PdfCoordinate, Polygon, Rooms } from "@cmumaps/common";
import { useNavigate } from "@tanstack/react-router";
import type Konva from "konva";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { useCreateEdgeMutation } from "../store/api/edgeApiSlice.ts";
import { useCreateNodeMutation } from "../store/api/nodeApiSlice.ts";
import {
  ADD_EDGE,
  ADD_NODE,
  DELETE_EDGE,
  GRAPH_SELECT,
  POLYGON_ADD_VERTEX,
  POLYGON_SELECT,
  setMode,
} from "../store/features/modeSlice.ts";
import { setEditRoomLabel, setShowRoomSpecific } from "../store/features/uiSlice.ts";
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { getCursorPos } from "../utils/canvasUtils.ts";
import { distPointToLine } from "../utils/geometryUtils.ts";
import { posToRoomId } from "../utils/roomUtils.ts";
import useSavePolygonEdit from "./useSavePolygonEdit.ts";
import useValidatedFloorParams from "./useValidatedFloorParams.ts";

const useStageClickHandler = (
  floorCode: string,
  rooms: Rooms,
  scale: number,
  offset: PdfCoordinate,
) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate({ from: "/floors/$floorCode" });

  const [createNode] = useCreateNodeMutation();
  const [createEdge] = useCreateEdgeMutation();

  const ringIndex = useAppSelector((state) => state.polygon.ringIndex);
  const mode = useAppSelector((state) => state.mode.mode);

  const { nodeId: selectedNodeId, roomId } = useValidatedFloorParams(floorCode);
  const savePolygonEdit = useSavePolygonEdit(floorCode, roomId);

  const handleCreateNode = (e: Konva.KonvaEventObject<MouseEvent>) => {
    getCursorPos(e, offset, scale, async (pos) => {
      const nodeId = uuidv4();
      const nodeInfo: NodeInfo = {
        pos,
        neighbors: {},
        roomId: posToRoomId(pos, rooms),
      };

      const batchId = uuidv4();
      await createNode({ floorCode, nodeId, nodeInfo, batchId });

      // create an edge to the selected node if there is one
      if (selectedNodeId) {
        createEdge({
          floorCode,
          batchId,
          inNodeId: nodeId,
          outNodeId: selectedNodeId,
        });
      }

      dispatch(setMode(GRAPH_SELECT));
      navigate({ to: ".", search: { nodeId } });
    });
  };

  const handleAddVertex = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // this condition should never occur since we check roomId is not null before setting to POLYGON_ADD_VERTEX mode
    if (!roomId) {
      return;
    }

    getCursorPos(e, offset, scale, async (pos) => {
      const newVertex = [Number(pos.x.toFixed(2)), Number(pos.y.toFixed(2))];

      const polygon = rooms[roomId].polygon;
      const coords = polygon.coordinates[ringIndex];
      const newPolygon: Polygon = JSON.parse(JSON.stringify(polygon));
      // empty polygon case
      if (coords.length === 0) {
        // first and last coordinate need to be the same
        newPolygon.coordinates[ringIndex].push(newVertex);
        newPolygon.coordinates[ringIndex].push(newVertex);
      }
      // insert to the closest vertices
      else {
        let minDist = distPointToLine(newVertex, coords[0], coords[1]);
        let indexToInsert = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          const curDist = distPointToLine(newVertex, coords[i], coords[i + 1]);
          if (curDist < minDist) {
            indexToInsert = i;
            minDist = curDist;
          }
        }
        const index = indexToInsert + 1;
        newPolygon.coordinates[ringIndex].splice(index, 0, newVertex);
      }

      savePolygonEdit(newPolygon);
      dispatch(setMode(POLYGON_SELECT));
    });
  };

  const handleDeselect = () => {
    navigate({ to: ".", search: {} });
    dispatch(setShowRoomSpecific(false));
    dispatch(setEditRoomLabel(false));
    dispatch(setMode(GRAPH_SELECT));
  };

  return (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnStage = e.target === e.target.getStage();

    // create node
    if (mode === ADD_NODE) {
      handleCreateNode(e);
    }

    // add vertex to polygon
    else if (mode === POLYGON_ADD_VERTEX) {
      handleAddVertex(e);
    }

    // error for edge edits
    else if (mode === ADD_EDGE || mode === DELETE_EDGE) {
      if (clickedOnStage) {
        toast.error("Click on another node!");
      }
    }

    // click to unselect a room or exit polygon editing or room label editing
    else if (clickedOnStage) {
      handleDeselect();
    }
  };
};

export default useStageClickHandler;
