/** biome-ignore-all lint/style/useNamingConvention: TODO: use right naming convention */
import type { Coordinate } from "mapkit-react";
import { Annotation } from "mapkit-react";
import { useEffect, useState } from "react";
import enterIcon from "@/assets/icons/nav/path/enter.svg";
import enterCompletedIcon from "@/assets/icons/nav/path/enter-completed.svg";
import exitIcon from "@/assets/icons/nav/path/exit.svg";
import exitCompletedIcon from "@/assets/icons/nav/path/exit-completed.svg";
import endIcon from "@/assets/icons/nav/path/pathEnd.svg";
import startIcon from "@/assets/icons/nav/path/pathStart.svg";
import startIconCompleted from "@/assets/icons/nav/path/pathStart-completed.svg";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useBoundStore } from "@/store/index.ts";
import type { Node } from "@/types/navTypes";
import { zoomOnPoint } from "@/utils/zoomUtils";

interface IconInfo {
  coordinate: Coordinate;
  icon: {
    icon: string;
    offset?: { x: number; y: number };
    size?: { width: number; height: number };
  };
}

interface Props {
  map: mapkit.Map | null;
}

const standardOffset = { x: 16, y: 8 };
const standardSize = { width: 40, height: 40 };
const PathInstructionIcons: Record<
  string,
  {
    icon: string;
    offset?: { x: number; y: number };
    size?: { width: number; height: number };
  }
> = {
  Start: {
    icon: startIcon,
    offset: { x: 0, y: 8 },
    size: { width: 16, height: 16 },
  },
  StartCompleted: { icon: startIconCompleted, offset: { x: 0, y: 8 } },
  Enter: { icon: enterIcon, offset: standardOffset, size: standardSize },
  EnterCompleted: {
    icon: enterCompletedIcon,
    offset: standardOffset,
    size: standardSize,
  },
  Exit: { icon: exitIcon, offset: standardOffset, size: standardSize },
  ExitCompleted: {
    icon: exitCompletedIcon,
    offset: standardOffset,
    size: standardSize,
  },
};
const EndIcon = { icon: endIcon, offset: { x: 15, y: 4 } };

const NavLine = ({ map }: Props) => {
  //   const dispatch = useAppDispatch();
  const [completedPath, setCompletedPath] = useState<Node[] | null>(null);
  const [uncompletedPath, setUncompletedPath] = useState<Node[] | null>(null);

  const [pathOverlay, setPathOverlay] = useState<mapkit.PolylineOverlay[]>([]);
  const [iconInfos, setIconInfos] = useState<IconInfo[]>([]);

  const { navPaths, isNavOpen } = useNavPaths();

  const instructionIndex = useBoundStore((state) => state.navInstructionIndex);
  const isNavigating = useBoundStore((state) => state.isNavigating);
  const selectedPath = useBoundStore((state) => state.selectedPath);
  const setIsZooming = useBoundStore((state) => state.setIsZooming);
  const setQueuedZoomRegion = useBoundStore(
    (state) => state.setQueuedZoomRegion,
  );
  const focusFloor = useBoundStore((state) => state.focusFloor);

  const path = navPaths?.[selectedPath]?.path.path ?? [];

  const recommendedPath = navPaths;

  const instructions = useBoundStore((state) => state.navInstructions) ?? [];

  // zoom on current instruction and focus the corresponding floor
  useEffect(() => {
    if (isNavigating && map) {
      const node =
        instructionIndex === 0
          ? navPaths?.[selectedPath]?.path.path[0]
          : navPaths?.[selectedPath]?.path.path.find(
              (n) => n.id === instructions[instructionIndex - 1]?.nodeId,
            );
      if (node) {
        focusFloor(node.floor);
      }
      if (node?.coordinate) {
        zoomOnPoint(
          map,
          node.coordinate,
          0.0004,
          setIsZooming,
          setQueuedZoomRegion,
        );
      }
    }
  }, [
    isNavigating,
    instructionIndex,
    focusFloor,
    instructions[instructionIndex - 1]?.nodeId,
    map,
    navPaths?.[selectedPath]?.path.path.find,
    setIsZooming,
    navPaths?.[selectedPath]?.path.path[0],
    setQueuedZoomRegion,
    selectedPath,
  ]);

  // calculate curFloorPath and restPath
  useEffect(() => {
    if (isNavigating) {
      const newFinishedPath: Node[] = [];
      const newUnfinishedPath: Node[] = [];

      const currentNodeid =
        instructionIndex > 0
          ? instructions[instructionIndex - 1]?.nodeId
          : path[0]?.id;

      let reachedCurrentNode = false;
      for (const node of path) {
        if (reachedCurrentNode) {
          newUnfinishedPath.push(node);
        } else {
          newFinishedPath.push(node);
        }

        if (node.id === currentNodeid) {
          reachedCurrentNode = true;
          newUnfinishedPath.push(node);
        }
      }

      setCompletedPath(newFinishedPath);
      setUncompletedPath(newUnfinishedPath);
    }
  }, [
    instructionIndex,
    instructions[instructionIndex]?.nodeId,
    isNavigating,
    path,
  ]);

  useEffect(() => {
    if (!map) return;
    const newPathOverlays: mapkit.PolylineOverlay[] = [];

    if (isNavigating) {
      if (completedPath) {
        const curFloorPathOverlay = new mapkit.PolylineOverlay(
          completedPath.map(
            (n) =>
              new mapkit.Coordinate(
                n.coordinate.latitude,
                n.coordinate.longitude,
              ),
          ),
          {
            style: new mapkit.Style({
              strokeColor: "grey",
              strokeOpacity: 0.5,
              lineWidth: 5,
            }),
          },
        );

        newPathOverlays.push(curFloorPathOverlay);
      }

      if (uncompletedPath) {
        const restPathOverlay = new mapkit.PolylineOverlay(
          uncompletedPath.map(
            (n) =>
              new mapkit.Coordinate(
                n.coordinate.latitude,
                n.coordinate.longitude,
              ),
          ),
          {
            style: new mapkit.Style({
              strokeColor: "#3D83D3",
              strokeOpacity: 0.9,
              lineWidth: 5,
              //   lineDash: [10, 10],
            }),
          },
        );

        newPathOverlays.push(restPathOverlay);
      }

      setPathOverlay(newPathOverlays);
    } else if (recommendedPath?.[selectedPath]) {
      const selectedNavPath = recommendedPath[selectedPath];
      const style = {
        strokeColor: "#3D83D3",
        strokeOpacity: 0.9,
        lineWidth: 5,
      };

      const selectedPathOverlay = new mapkit.PolylineOverlay(
        selectedNavPath.path.path.map(
          (n) =>
            new mapkit.Coordinate(
              n.coordinate.latitude,
              n.coordinate.longitude,
            ),
        ),
        { style: new mapkit.Style(style) },
      );

      newPathOverlays.push(selectedPathOverlay);
      setPathOverlay(newPathOverlays);
    } else {
      setPathOverlay([]);
    }
  }, [
    map,
    recommendedPath,
    completedPath,
    isNavigating,
    uncompletedPath,
    selectedPath,
  ]);

  // render the polylines so they stay on top
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-render whenever new floor is focused so line is not covered
  useEffect(() => {
    if (pathOverlay) {
      if (isNavOpen) {
        map?.addOverlays(pathOverlay);
      } else {
        map?.removeOverlays(pathOverlay);
      }
    }

    return () => {
      if (pathOverlay) {
        map?.removeOverlays(pathOverlay);
      }
    };
  }, [map, map?.overlays, map?.selectedAnnotation, pathOverlay, isNavOpen]);

  // calculate the icons (annotations)
  useEffect(() => {
    if (!recommendedPath) {
      setIconInfos([]);
      return;
    }

    const addStartEndIcons = () => {
      if (!path[0]) return;
      newIconInfos.push({
        coordinate: path[0].coordinate,
        icon: PathInstructionIcons[
          instructionIndex === 0 ? "Start" : "StartCompleted"
        ] ?? { icon: "" },
      });

      const lastIndex = path.length - 1;
      if (!path[lastIndex]) return;
      const { coordinate } = path[lastIndex];
      newIconInfos.push({
        coordinate,
        icon: EndIcon,
      });
    };

    const addInstructionIcons = () => {
      instructions.forEach((instruction, i) => {
        const coord = path.find((n) => n.id === instruction.nodeId)?.coordinate;
        const isCompleted = instructionIndex > i;

        if (!coord) return;

        if (PathInstructionIcons[instruction.action]) {
          newIconInfos.push({
            coordinate: {
              latitude: coord.latitude + 0.000_000_001,
              longitude: coord.longitude,
            },
            icon: PathInstructionIcons[
              isCompleted
                ? `${instruction.action}Completed`
                : instruction.action
            ] ?? { icon: "" },
          });
        }
      });
    };

    const newIconInfos: IconInfo[] = [];

    addInstructionIcons();
    addStartEndIcons();

    setIconInfos(newIconInfos);
  }, [
    path.length,
    path[0],
    recommendedPath,
    instructions.forEach,
    instructionIndex,
  ]);

  if (!(isNavOpen && map)) {
    return;
  }

  return (
    <>
      {iconInfos.map((iconInfo, index) => (
        <Annotation
          // biome-ignore lint/suspicious/noArrayIndexKey: TODO: fix the array index key
          key={index}
          latitude={iconInfo.coordinate.latitude}
          longitude={iconInfo.coordinate.longitude}
          displayPriority="required"
        >
          <img
            src={iconInfo.icon.icon}
            alt="Icon"
            className="pointer-events-none"
            height={iconInfo.icon.size?.height}
            width={iconInfo.icon.size?.width}
            style={{
              height: iconInfo.icon.size?.height,
              width: iconInfo.icon.size?.width,
              transform: `translate(${iconInfo.icon.offset?.x ?? 0}px, ${iconInfo.icon.offset?.y ?? 0}px)`,
            }}
          />
        </Annotation>
      ))}
    </>
  );
};

export { NavLine };
