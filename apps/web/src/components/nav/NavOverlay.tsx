import { useEffect } from "react";
import { NavOverlayMobile } from "@/components/nav/NavOverlayMobile.tsx";
import { useIsMobile } from "@/hooks/useIsMobile.ts";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useUser } from "@/hooks/useUser.ts";
import { track } from "@/lib/analytics.ts";
import { useBoundStore } from "@/store/index.ts";
import type { Node } from "@/types/navTypes";
import { isPublicBuilding } from "@/utils/authUtils";

const NavOverlay = ({
  mapRef,
}: {
  mapRef: React.RefObject<mapkit.Map | null>;
}) => {
  const isMobile = useIsMobile();

  const isNavigating = useBoundStore((state) => state.isNavigating);
  const startNav = useBoundStore((state) => state.startNav);
  const endNav = useBoundStore((state) => state.endNav);
  const setNavInstructions = useBoundStore((state) => state.setNavInstructions);
  const selectedPath = useBoundStore((state) => state.selectedPath);
  const showLogin = useBoundStore((state) => state.showLogin);

  const {
    navPaths,
    isNavOpen,
    dstType,
    srcType,
    srcBuildingCode,
    dstBuildingCode,
  } = useNavPaths();
  const user = useUser();

  // Process instructions
  useEffect(() => {
    const instructions = navPaths?.[selectedPath]?.instructions ?? [];
    const path: Node[] = navPaths?.[selectedPath]?.path.path ?? [];

    // biome-ignore lint/suspicious/noEvolvingTypes: TODO: fix the type
    const newInstructions = [];

    let oldInstructionsIndex = 0;
    let distanceAcc = 0;
    path.forEach((node, index) => {
      if (node.id === instructions[oldInstructionsIndex]?.nodeId) {
        const instruction = instructions[oldInstructionsIndex];
        if (instruction) instruction.distance = Math.round(distanceAcc);
        newInstructions.push(instruction);
        distanceAcc = 0;
        oldInstructionsIndex++;
      }

      if (
        index < path.length - 1 &&
        (!node.floor || node.floor.buildingCode === "outside") &&
        path[index + 1]?.floor &&
        path[index + 1]?.floor.buildingCode !== "outside"
      ) {
        newInstructions.push({
          action: "Enter",
          distance: Math.round(distanceAcc),
          nodeId: node.id,
        });
        distanceAcc = 0;
      }
      if (
        index > 0 &&
        (!node.floor || node.floor.buildingCode === "outside") &&
        path[index - 1]?.floor &&
        path[index - 1]?.floor.buildingCode !== "outside"
      ) {
        newInstructions.push({
          action: "Exit",
          distance: Math.round(distanceAcc),
          nodeId: node.id,
        });
        distanceAcc = 0;
      }

      if (index < path.length - 1) {
        const nextNode = path[index + 1];
        if (nextNode) {
          const distance = node.neighbors[nextNode.id]?.dist ?? 0;
          distanceAcc += distance;
        }
      }
    });

    newInstructions.push({
      action: "Forward",
      distance: Math.round(distanceAcc),
      nodeId: path.at(-1)?.id ?? "",
    });
    newInstructions.push({
      action: "Arrive",
      distance: 0,
      nodeId: path.at(-1)?.id ?? "",
    });
    setNavInstructions?.(newInstructions);
  }, [navPaths, setNavInstructions, selectedPath]);

  useEffect(() => {
    if (!isNavOpen) {
      endNav();
    }
  }, [isNavOpen, endNav]);

  // On page load, if the destination is a non-public room and the user is not signed in, show the login modal
  // Public buildings (e.g., CUC) are allowed for unauthenticated users via the public pathfinding API
  // biome-ignore lint/correctness/useExhaustiveDependencies: should only fire on page load/dstType change
  useEffect(() => {
    if (!user) {
      // Only check for auth if the building code is known (not undefined)
      // A room needs auth if it's a Room type with a known building code that is NOT public
      const srcNeedsAuth =
        (srcType === "Room" || srcType === "Floor") &&
        srcBuildingCode &&
        !isPublicBuilding(srcBuildingCode);
      const dstNeedsAuth =
        (dstType === "Room" || dstType === "Floor") &&
        dstBuildingCode &&
        !isPublicBuilding(dstBuildingCode);
      if (srcNeedsAuth || dstNeedsAuth) {
        track("login_prompted", { source: "navigation" });
        showLogin();
      }
    }
  }, [dstType, srcType, srcBuildingCode, dstBuildingCode]);

  if (!isNavOpen) {
    return;
  }

  if (isMobile) {
    return (
      <NavOverlayMobile
        mapRef={mapRef}
        isNavigating={isNavigating}
        startNav={startNav}
      />
    );
  }
};

export { NavOverlay };
