import { getRoomTypeDetails, type Polygon, type Rooms } from "@cmumaps/common";
import { useNavigate } from "@tanstack/react-router";
import { Path } from "react-konva";
import { useAppSelector } from "../../store/hooks";

interface Props {
  rooms: Rooms;
  scale: number;
}

const PolygonsDisplay = ({ rooms, scale }: Props) => {
  const navigate = useNavigate({ from: "/floors/$floorCode" });
  const showPolygons = useAppSelector((state) => state.visibility.showPolygons);
  const nodeSize = useAppSelector((state) => state.ui.nodeSize);

  if (!showPolygons) {
    return;
  }

  // Convert GeoJSON polygon to SVG path string
  const geojsonToPath = (polygon: Polygon): string => {
    const [outerRing, ...holes] = polygon.coordinates;

    if (outerRing.length === 0) {
      return "";
    }

    // Convert outer ring to SVG path
    let pathString = `M ${outerRing[0][0]},${outerRing[0][1]}`;
    for (const [x, y] of outerRing.slice(1)) {
      pathString += ` L ${x},${y}`;
    }
    pathString += " Z"; // Close the outer path

    // Convert each hole (inner rings) to SVG path
    for (const hole of holes) {
      if (hole.length === 0) {
        continue;
      }

      pathString += ` M ${hole[0][0]},${hole[0][1]}`;
      for (const [x, y] of hole.slice(1)) {
        pathString += ` L ${x},${y}`;
      }
      pathString += " Z"; // Close the hole path
    }

    return pathString;
  };

  return Object.entries(rooms).map(([roomId, room]) => {
    const roomColor = getRoomTypeDetails(room.type);
    return (
      <Path
        key={roomId}
        data={geojsonToPath(room.polygon)}
        stroke={roomColor.border}
        strokeWidth={nodeSize / 2 / scale}
        closed
        fill={roomColor.background}
        onClick={() => navigate({ to: ".", search: { roomId } })}
      />
    );
  });
};

export default PolygonsDisplay;
