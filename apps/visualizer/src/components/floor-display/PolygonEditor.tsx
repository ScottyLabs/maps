import type { PdfCoordinate, Polygon, Position } from "@cmumaps/common";
import type Konva from "konva";
import { throttle } from "lodash";

import { useMemo } from "react";
import { Circle, Line } from "react-konva";

import { CURSOR_UPDATE_RATE } from "../../hooks/useCursorTracker";
import useSavePolygonEdit from "../../hooks/useSavePolygonEdit";
import { pushCursorInfo } from "../../store/features/liveCursor/liveCursorSlice";
import type { CursorInfoOnDragVertex } from "../../store/features/liveCursor/liveCursorTypes";
import {
  POLYGON_DELETE_VERTEX,
  POLYGON_SELECT,
  setMode,
} from "../../store/features/modeSlice";
import {
  releaseVertex,
  setDragVertexInfo,
} from "../../store/features/mouseEventSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  getCursorPos,
  getDragObjectPos,
  setCursor,
} from "../../utils/canvasUtils";

interface Props {
  floorCode: string;
  roomId: string;
  polygon: Polygon;
  nodeSize: number;
  offset: PdfCoordinate;
  scale: number;
}

const PolygonEditor = ({
  floorCode,
  roomId,
  polygon,
  nodeSize,
  offset,
  scale,
}: Props) => {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((state) => state.mode.mode);
  const ringIndex = useAppSelector((state) => state.polygon.ringIndex);
  const savePolygonEdit = useSavePolygonEdit(floorCode, roomId);
  const dragVertexInfo = useAppSelector(
    (state) => state.mouseEvent.dragVertexInfo,
  );

  const lines = useMemo(() => {
    const lines: Position[][] = [];
    for (let i = 0; i < polygon.coordinates[ringIndex].length - 1; i++) {
      // use the dragged vertex info for display
      if (dragVertexInfo && dragVertexInfo.ringIndex === ringIndex) {
        if (dragVertexInfo.vertexIndex === i) {
          lines.push([
            dragVertexInfo.vertexPos,
            polygon.coordinates[ringIndex][i + 1],
          ]);
          continue;
        }
        if (dragVertexInfo.vertexIndex === i + 1) {
          lines.push([
            polygon.coordinates[ringIndex][i],
            dragVertexInfo.vertexPos,
          ]);
          continue;
        }
      }

      lines.push([
        polygon.coordinates[ringIndex][i],
        polygon.coordinates[ringIndex][i + 1],
      ]);
    }
    return lines;
  }, [dragVertexInfo, polygon.coordinates, ringIndex]);

  const handleOnDragEnd = async (
    e: Konva.KonvaEventObject<DragEvent>,
    index: number,
  ) => {
    const newPolygon: Polygon = JSON.parse(JSON.stringify(polygon));
    const coords = newPolygon.coordinates[ringIndex];
    const newPos = [
      Number(e.target.x().toFixed(2)),
      Number(e.target.y().toFixed(2)),
    ];
    coords[index] = newPos;
    // first and last point need to stay the same
    if (index === 0) {
      coords[coords.length - 1] = newPos;
    }

    await savePolygonEdit(newPolygon);
    dispatch(releaseVertex());
  };

  const handleClick = (index: number) => {
    if (mode === POLYGON_DELETE_VERTEX) {
      const newPolygon: Polygon = JSON.parse(JSON.stringify(polygon));
      const coords = newPolygon.coordinates[ringIndex];
      coords.splice(index, 1);

      // when deleting the first index
      if (index === 0) {
        // keep the start and end the same if there are more vertices
        if (coords.length !== 1) {
          coords.push(coords[0]);
        }
        // delete the duplicate vertex if there is no more vertex
        else {
          coords.pop();
        }
      }

      savePolygonEdit(newPolygon);
      dispatch(setMode(POLYGON_SELECT));
    }
  };

  const handleOnDragStart = (
    e: Konva.KonvaEventObject<DragEvent>,
    vertexIndex: number,
  ) => {
    const vertexPdfCoords = getDragObjectPos(e);
    const vertexPos = [vertexPdfCoords.x, vertexPdfCoords.y];
    dispatch(setDragVertexInfo({ roomId, ringIndex, vertexIndex, vertexPos }));
  };

  const handleDragMove = (vertexIndex: number) =>
    throttle((e: Konva.KonvaEventObject<DragEvent>) => {
      const vertexPdfCoords = getDragObjectPos(e);
      const dragVertexInfo = {
        roomId,
        ringIndex,
        vertexIndex,
        vertexPos: [vertexPdfCoords.x, vertexPdfCoords.y],
      };

      getCursorPos(e, offset, scale, (cursorPos) => {
        const cursorInfo: CursorInfoOnDragVertex = {
          cursorPos,
          dragVertexInfo,
        };

        dispatch(setDragVertexInfo(dragVertexInfo));
        dispatch(pushCursorInfo(cursorInfo));
      });
    }, CURSOR_UPDATE_RATE);

  const renderLines = () => {
    return lines.map((line, index) => (
      <Line
        key={index}
        points={[...line[0], ...line[1]]}
        stroke="orange"
        strokeWidth={nodeSize / 2 / scale}
      />
    ));
  };

  return (
    <>
      {renderLines()}
      {/* first and last point are the same */}
      {polygon.coordinates[ringIndex].map(
        (point, index) =>
          index !== polygon.coordinates[ringIndex].length - 1 && (
            <Circle
              key={index}
              x={point[0]}
              y={point[1]}
              radius={nodeSize / scale}
              fill="cyan"
              strokeWidth={nodeSize / 2 / scale}
              stroke="black"
              draggable
              onMouseEnter={(e) => setCursor(e, "pointer")}
              onMouseLeave={(e) => setCursor(e, "default")}
              onDragStart={(e) => handleOnDragStart(e, index)}
              onDragMove={handleDragMove(index)}
              onDragEnd={(e) => handleOnDragEnd(e, index)}
              onClick={() => handleClick(index)}
            />
          ),
      )}
    </>
  );
};

export default PolygonEditor;
