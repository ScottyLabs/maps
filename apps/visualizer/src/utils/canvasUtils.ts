import type { Graph, PdfCoordinate, Rooms } from "@cmumaps/common";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { toast } from "react-toastify";

export const setCursor = (e: KonvaEventObject<MouseEvent>, cursor: string) => {
  const curStage = e.target.getStage();
  if (curStage != null) {
    const container = curStage.container();
    container.style.cursor = cursor;
  }
};

/**
 * @param e Konva event
 * @param offset
 * @param scale
 * @returns the cursor position (relative?, absolute?, need to figure out?)
 */
export const getCursorPos = (
  e: Konva.KonvaEventObject<MouseEvent>,
  offset: PdfCoordinate,
  scale: number,
  callback: (pos: PdfCoordinate) => void,
) => {
  const pos = e.target.getStage()?.getPointerPosition();
  if (!pos) {
    toast.error("Unable to get cursor position!");
    return;
  }
  callback({
    x: Number(((pos.x - offset.x) / scale).toFixed(2)),
    y: Number(((pos.y - offset.y) / scale).toFixed(2)),
  });
};

export const getDragObjectPos = (e: Konva.KonvaEventObject<DragEvent>) => {
  return {
    x: Number(e.target.x().toFixed(2)),
    y: Number(e.target.y().toFixed(2)),
  };
};

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * @returns the bounding box of every room polygon and node on the floor,
 * or null if the floor has nothing to show
 */
export const getFloorBounds = (graph: Graph, rooms: Rooms): Bounds | null => {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const extend = (x: number, y: number) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  for (const room of Object.values(rooms)) {
    for (const ring of room.polygon.coordinates) {
      for (const [x, y] of ring) {
        extend(x, y);
      }
    }
  }
  for (const node of Object.values(graph)) {
    extend(node.pos.x, node.pos.y);
  }

  return Number.isFinite(bounds.minX) ? bounds : null;
};

/**
 * Computes the stage scale and offset that center the bounds in the view.
 * Drawing units differ between datasets, so this never assumes a fixed size.
 * @param padding fraction of the view the bounds should fill
 */
export const fitBoundsToView = (
  bounds: Bounds,
  viewWidth: number,
  viewHeight: number,
  padding: number,
): { scale: number; offset: PdfCoordinate } => {
  // Avoid dividing by zero for a floor with a single point
  const width = Math.max(bounds.maxX - bounds.minX, Number.EPSILON);
  const height = Math.max(bounds.maxY - bounds.minY, Number.EPSILON);
  const scale = Math.min(viewWidth / width, viewHeight / height) * padding;

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    offset: {
      x: viewWidth / 2 - centerX * scale,
      y: viewHeight / 2 - centerY * scale,
    },
  };
};
