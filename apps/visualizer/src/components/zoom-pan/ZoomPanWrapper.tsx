import type { Graph, PdfCoordinate, Rooms } from "@cmumaps/common";
import type Konva from "konva";

import { useRef, useState } from "react";

import { LOADED } from "../../store/features/statusSlice.ts";
import { useAppSelector } from "../../store/hooks.ts";
import FloorDisplay from "../floor-display/FloorDisplay.tsx";
import LoadingText from "../ui-layout/LoadingText.tsx";

interface Props {
  floorCode: string;
  graph: Graph;
  rooms: Rooms;
}

const SCALE_BY = 1.05;
const MIN_SCALE = 1;
const MAX_SCALE = 20;

/**
 * Handles zooming and panning for PDF and Canvas
 */
const ZoomPanWrapper = ({ floorCode, graph, rooms }: Props) => {
  const loadingStatus = useAppSelector((state) => state.status.loadingStatus);

  const [canPan, setCanPan] = useState<boolean>(true);

  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<PdfCoordinate>({ x: 0, y: 0 });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    // only scale if stage and pointer are defined
    const stage = stageRef.current;
    if (stage == null) {
      return;
    }

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (pointer == null) {
      return;
    }

    // calculate the new scale
    let newScale = e.evt.deltaY < 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY;

    // clamp the scale
    newScale = Math.max(newScale, MIN_SCALE);
    newScale = Math.min(newScale, MAX_SCALE);
    setScale(newScale);

    // calculate the offset
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    setOffset({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (canPan) {
      setOffset({
        x: e.target.x(),
        y: e.target.y(),
      });
    }
  };

  if (loadingStatus !== LOADED) {
    return <LoadingText />;
  }

  return (
    <div className="absolute inset-0 z-10 mt-24 ml-52 overflow-hidden">
      <FloorDisplay
        floorCode={floorCode}
        graph={graph}
        rooms={rooms}
        setCanPan={setCanPan}
        handleWheel={handleWheel}
        handleDragMove={handleDragMove}
        scale={scale}
        offset={offset}
        stageRef={stageRef}
      />
    </div>
  );
};

export default ZoomPanWrapper;
