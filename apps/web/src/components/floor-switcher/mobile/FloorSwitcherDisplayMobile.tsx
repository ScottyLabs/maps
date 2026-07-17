import type { Building } from "@cmumaps/common";
import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { MdLock } from "react-icons/md";
import { $api } from "@/api/client.ts";
import { useBoundStore } from "@/store/index.ts";
import { FloorSwitcherCarouselMobile } from "./FloorSwitcherCarouselMobile.tsx";

interface Props {
  building: Building;
  initialFloorLevel: string;
}

const FloorSwitcherDisplayMobile = ({ building, initialFloorLevel }: Props) => {
  const focusFloor = useBoundStore((state) => state.focusFloor);
  const searchTarget = useBoundStore((state) => state.searchTarget);
  const hasFloorplan = building.floors.length > 0;
  const floorIndex = building.floors.indexOf(initialFloorLevel);

  const draggableRegionRef = useRef<HTMLDivElement>(null);

  /* float value ranging from 0 to building.floors.length, representing the position of the floor switcher Carousel
   * Each whole number value corresponds to the floor with the corresponding index being selected
   * progressValue between two whole numbers occurs when dragging/animating the floor switcher Carousel */
  const progressValue = useMotionValue(floorIndex);

  const [startingTouchY, setStartingTouchY] = useState(0);
  const [startingProgressValue, setStartingProgressValue] = useState(0);

  const focusedFloor = useBoundStore((state) => state.focusedFloor);

  const { data: buildings } = $api.useQuery("get", "/buildings");

  useEffect(() => {
    const focusedBuilding = buildings?.[focusedFloor?.buildingCode ?? ""];
    if (focusedFloor && focusedBuilding) {
      const newFloorIndex = focusedBuilding.floors.indexOf(focusedFloor.level);
      progressValue.set(newFloorIndex);
    }
  }, [focusedFloor, buildings, progressValue.set]);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0]?.clientY) {
      setStartingTouchY(e.touches[0]?.clientY);
      setStartingProgressValue(progressValue.get());
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0]?.clientY) {
      const newValue =
        startingProgressValue - (e.touches[0]?.clientY - startingTouchY) / 50;
      progressValue.set(
        Math.max(0, Math.min(building.floors.length - 1, newValue)),
      );
    }
  };

  const onTouchEnd = () => {
    const targetFloorIndex = Math.round(progressValue.get());

    const controls = animate(progressValue, targetFloorIndex, {
      duration: Math.abs(progressValue.get() - targetFloorIndex) * 0.5,
      ease: "easeInOut",
      bounce: 0,
    });

    controls.then(() => {
      if (building.floors[targetFloorIndex]) {
        focusFloor({
          buildingCode: building.code,
          level: building.floors[targetFloorIndex],
        });
      }
    });

    return controls.stop;
  };

  //e.preventDefault can only be called in an active event listener
  useEffect(() => {
    const el = draggableRegionRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      e.preventDefault();
    };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  if (searchTarget) {
    return;
  }

  if (!hasFloorplan) {
    return (
      <div className="fixed top-1/2 flex h-78 w-68 -translate-x-1/2 -translate-y-1/2 items-center justify-center align-center">
        <div className="btn-shadow flex items-center justify-center rounded-full bg-white/80 p-3 text-gray-600 backdrop-blur-md">
          <MdLock size={32} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed top-1/2 flex h-78 w-68 -translate-x-1/2 -translate-y-1/2 items-center align-center"
      style={{ borderRadius: "50% / 50%" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      ref={draggableRegionRef}
    >
      <motion.div
        className="btn-shadow m-auto h-52 w-45 self-center bg-white/10 backdrop-blur-md"
        style={{ borderRadius: "50% / 50%" }}
      >
        <FloorSwitcherCarouselMobile
          building={building}
          progressValue={progressValue}
        />
      </motion.div>
    </div>
  );
};

export { FloorSwitcherDisplayMobile };
