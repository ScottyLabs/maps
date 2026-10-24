import type { Graph, PdfCoordinate, Rooms } from "@cmumaps/common";
import type Konva from "konva";

import { useEffect, useRef, useState } from "react";

import { LOADED } from "../../store/features/statusSlice";
import { useAppSelector } from "../../store/hooks";
import { fitBoundsToView, getFloorBounds } from "../../utils/canvasUtils";
import FloorDisplay from "../floor-display/FloorDisplay";
import LoadingText from "../ui-layout/LoadingText";

interface Props {
  floorCode: string;
  graph: Graph;
  rooms: Rooms;
}

const SCALE_BY = 1.05;
// Fraction of the view the floor fills when it first opens
const FIT_PADDING = 0.9;
// Zoom limits relative to the fitted scale, since drawing units vary by dataset
const MIN_ZOOM_OUT = 0.25;
const MAX_ZOOM_IN = 40;

/**
 * Handles zooming and panning for PDF and Canvas
 */
const ZoomPanWrapper = ({ floorCode, graph, rooms }: Props) => {
  const loadingStatus = useAppSelector((state) => state.status.loadingStatus);

  const [canPan, setCanPan] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState<number>(1);
  const [fitScale, setFitScale] = useState<number>(1);
  const [offset, setOffset] = useState<PdfCoordinate>({ x: 0, y: 0 });

  // Fit the floor to the view once per floor, after its data loads
  const fittedFloorCode = useRef<string | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (
      loadingStatus !== LOADED ||
      container == null ||
      fittedFloorCode.current === floorCode
    ) {
      return;
    }

    const bounds = getFloorBounds(graph, rooms);
    if (bounds == null) {
      return;
    }

    const { width, height } = container.getBoundingClientRect();
    const fit = fitBoundsToView(bounds, width, height, FIT_PADDING);
    setScale(fit.scale);
    setFitScale(fit.scale);
    setOffset(fit.offset);
    fittedFloorCode.current = floorCode;
  }, [loadingStatus, floorCode, graph, rooms]);

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
    newScale = Math.max(newScale, fitScale * MIN_ZOOM_OUT);
    newScale = Math.min(newScale, fitScale * MAX_ZOOM_IN);
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
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 mt-24 ml-52 overflow-hidden"
    >
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
