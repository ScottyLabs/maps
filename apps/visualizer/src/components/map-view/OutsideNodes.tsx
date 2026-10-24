import type { GeoNode, GeoNodes } from "@cmumaps/common";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "react-toastify";

interface Props {
  mapRef: React.RefObject<mapkit.Map | null>;
  nodes: GeoNodes | undefined;
}

const OutsideNodes = ({ mapRef, nodes }: Props) => {
  const navigate = useNavigate();

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !nodes) {
      return;
    }

    // Add nodes as circle overlays to the map
    const overlays: mapkit.Overlay[] = [];
    const visitedNodes: Set<string> = new Set();
    Object.entries(nodes).forEach(([nodeId, node]: [string, GeoNode]) => {
      // Draw edges as lineoverlays
      let hasCrossFloorEdge = false;
      for (const neighborId in node.neighbors) {
        const neighbor = nodes[neighborId];
        if (!neighbor) {
          hasCrossFloorEdge = true;
          continue;
        }
        if (visitedNodes.has(neighborId)) {
          continue;
        }
        const lineOverlay = new mapkit.PolylineOverlay(
          [
            new mapkit.Coordinate(node.pos.latitude, node.pos.longitude),
            new mapkit.Coordinate(neighbor.pos.latitude, neighbor.pos.longitude),
          ],
          { style: new mapkit.Style({ strokeColor: "black" }) },
        );

        visitedNodes.add(neighborId);
        overlays.push(lineOverlay);
        map.addOverlay(lineOverlay);
      }

      // Add circle overlay last so it is on top of the line overlays
      const circleOverlay = new mapkit.CircleOverlay(
        new mapkit.Coordinate(node.pos.latitude, node.pos.longitude),
        1,
        {
          style: new mapkit.Style({
            fillOpacity: 1.0,
            fillColor: hasCrossFloorEdge ? "lime" : "blue",
          }),
        },
      );
      circleOverlay.data = { nodeId };

      //Copy nodeId to clipboard when user clicks on the node
      circleOverlay.addEventListener("select", () => {
        navigator.clipboard.writeText(nodeId);
        toast.success("Copied nodeId!");
        navigate({ to: ".", search: { nodeId } });
      });
      overlays.push(circleOverlay);
      map.addOverlay(circleOverlay);
    });

    return () => {
      map.removeOverlays(overlays);
    };
  }, [mapRef, nodes, navigate]);

  return null;
};

export default OutsideNodes;
