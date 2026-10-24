import type { Graph } from "@cmumaps/common";

import { useMemo } from "react";
import { Line } from "react-konva";

import useValidatedFloorParams from "../../hooks/useValidatedFloorParams";
import { selectEditPolygon } from "../../store/features/modeSlice";
import { useAppSelector } from "../../store/hooks";

interface Props {
  floorCode: string;
  graph: Graph;
  scale: number;
}

const EdgesDisplay = ({ floorCode, graph, scale }: Props) => {
  const nodeSize = useAppSelector((state) => state.ui.nodeSize);
  const nodeIdOnDrag = useAppSelector((state) => state.mouseEvent.dragNodeId);
  const dragNodePos = useAppSelector((state) => state.mouseEvent.dragNodePos);
  const showEdges = useAppSelector((state) => state.visibility.showEdges);
  const editPolygon = useAppSelector((state) => selectEditPolygon(state));
  const editRoomLabel = useAppSelector((state) => state.ui.editRoomLabel);
  const mst = useAppSelector((state) => state.data.mst);

  const { nodeId } = useValidatedFloorParams(floorCode);

  const edges: [number[], string][] = useMemo(() => {
    const includedNodes = new Set();
    const shouldRender = (_curId: string, neighborId: string) => {
      // don't display an edge twice
      if (includedNodes.has(neighborId)) {
        return false;
      }

      // don't display edge that connect to a different floor
      if (!graph[neighborId]) {
        return false;
      }

      // logic for displaying room specific edges
      // if (showRoomSpecific && nodes[curId].roomId !== roomIdSelected) {
      //   return false;
      // }

      return true;
    };

    const getStrokeColor = (curId: string, neighborId: string) => {
      // orange if selected
      if (curId === nodeId || neighborId === nodeId) {
        return "orange";
      }

      // blue if in the mst
      if (mst) {
        if (mst[curId]?.[neighborId] || mst[neighborId]?.[curId]) {
          return "blue";
        }
      }

      // default is green
      return "green";
    };

    const edges: [number[], string][] = [];
    for (const curId in graph) {
      for (const neighborId in graph[curId].neighbors) {
        if (shouldRender(curId, neighborId)) {
          const line = [
            graph[curId].pos.x,
            graph[curId].pos.y,
            graph[neighborId].pos.x,
            graph[neighborId].pos.y,
          ];

          // update with dragging information if needed
          if (curId === nodeIdOnDrag && dragNodePos) {
            line[0] = dragNodePos.x;
            line[1] = dragNodePos.y;
          }

          if (neighborId === nodeIdOnDrag && dragNodePos) {
            line[2] = dragNodePos.x;
            line[3] = dragNodePos.y;
          }

          edges.push([line, getStrokeColor(curId, neighborId)]);
        }
      }
      includedNodes.add(curId);
    }

    return edges;
  }, [dragNodePos, graph, mst, nodeId, nodeIdOnDrag]);

  if (!showEdges || editPolygon || editRoomLabel) {
    return;
  }

  return edges.map(([points, color], index: number) => {
    return (
      <Line
        key={index}
        points={points}
        stroke={color}
        strokeWidth={nodeSize / 2 / scale}
      />
    );
  });
};

export default EdgesDisplay;
