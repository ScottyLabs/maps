import type { PdfCoordinate, Polygon } from "@cmumaps/common";

import { Line } from "react-konva";

import { selectEditPolygon } from "../../store/features/modeSlice.ts";
import { useAppSelector } from "../../store/hooks.ts";
import PolygonEditor from "./PolygonEditor.tsx";

interface Props {
  floorCode: string;
  roomId: string;
  polygon: Polygon;
  offset: PdfCoordinate;
  scale: number;
}

const SelectedPolygonDisplay = ({
  floorCode,
  roomId,
  polygon,
  offset,
  scale,
}: Props) => {
  const nodeSize = useAppSelector((state) => state.ui.nodeSize);
  const editPolygon = useAppSelector(selectEditPolygon);

  if (!polygon) {
    return;
  }

  if (!editPolygon) {
    return polygon.coordinates.map((coords, index) => (
      <Line
        key={index}
        points={coords.flat()}
        stroke="orange"
        strokeWidth={nodeSize / 2}
      />
    ));
  }

  return (
    <PolygonEditor
      floorCode={floorCode}
      roomId={roomId}
      polygon={polygon}
      nodeSize={nodeSize}
      offset={offset}
      scale={scale}
    />
  );
};

export default SelectedPolygonDisplay;
