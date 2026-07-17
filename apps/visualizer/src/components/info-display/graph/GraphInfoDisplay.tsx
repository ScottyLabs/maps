import type { EdgeInfo, Graph } from "@cmumaps/common";

import { useMemo } from "react";

import CrossFloorEdgeSection from "./CrossFloorEdgeSection.tsx";
import CrossFloorNeighborTable from "./CrossFloorNeighborTable.tsx";
import GraphInfoButtons from "./GraphInfoButtons.tsx";

interface Props {
  floorCode: string;
  nodeId: string;
  graph: Graph;
}

const GraphInfoDisplay = ({ nodeId, floorCode, graph }: Props) => {
  const neighbors = graph[nodeId].neighbors;

  // calculate the same floor neighbors and different floor neighbors
  const differentFloorNeighbors = useMemo(() => {
    const differentFloorNeighbors: Record<string, EdgeInfo> = {};
    for (const neighborId in neighbors) {
      if (neighbors[neighborId].outFloorCode) {
        differentFloorNeighbors[neighborId] = neighbors[neighborId];
      }
    }

    return differentFloorNeighbors;
  }, [neighbors]);

  return (
    <div className="mb-2 space-y-4">
      <GraphInfoButtons floorCode={floorCode} nodeId={nodeId} />
      <CrossFloorNeighborTable
        floorCode={floorCode}
        nodeId={nodeId}
        neighbors={neighbors}
        differentFloorNeighbors={differentFloorNeighbors}
      />
      <CrossFloorEdgeSection
        floorCode={floorCode}
        nodeId={nodeId}
        graph={graph}
      />
    </div>
  );
};

export default GraphInfoDisplay;
