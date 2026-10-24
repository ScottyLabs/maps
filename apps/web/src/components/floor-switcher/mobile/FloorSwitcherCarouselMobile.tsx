/** biome-ignore-all lint/suspicious/noBitwiseOperators: want to use bitwise operators? */
import type { Building } from "@cmumaps/common";
import type { MotionValue } from "motion/react";
import { animate, motion, useTransform } from "motion/react";
import { useEffect } from "react";
import { $api } from "@/api/client.ts";
import { useBoundStore } from "@/store/index.ts";

interface FloorSwitcherButtonProps {
  building: Building;
  index: number;
  floor: string;
  progressValue: MotionValue<number>;
}

const FloorSwitcherButton = ({
  building,
  index,
  floor,
  progressValue,
}: FloorSwitcherButtonProps) => {
  const focusFloor = useBoundStore((state) => state.focusFloor);

  const offsetDistance = useTransform(
    () => `${Math.max(0, Math.min(100, (progressValue.get() - index) * 25 + 50))}%`,
  );

  useEffect(() => {
    offsetDistance.addDependent(progressValue);
  });

  const distCurveValue = () => {
    const val = Number.parseFloat(offsetDistance.get().replace("%", "")) / 100;
    const dist = 2 - 20 * Math.abs(val - 0.5);
    return Math.max(0, Math.min(1, dist));
  };

  const width = useTransform(() => 38 + distCurveValue() * 8);

  const height = useTransform(() => 38 + distCurveValue() * 8);

  const lerpColor = (colorA: string, colorB: string, t: number): string => {
    const hexToRgb = (hex: string) => {
      const bigint = Number.parseInt(hex.replace("#", ""), 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return { r, g, b };
    };

    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);

    const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * t);
    const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * t);
    const b = Math.round(rgbA.b + (rgbB.b - rgbA.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  };

  const onClick = () => {
    const controls = animate(progressValue, index, {
      duration: 0.3,
      ease: "easeInOut",
      bounce: 0,
    });
    controls.then(() => {
      focusFloor({ buildingCode: building.code, level: floor });
    });
    return controls.stop;
  };

  const color = useTransform(() => lerpColor("#90CFEA", "#0E96D1", distCurveValue()));

  return (
    <motion.div
      className="fixed top-1/2 flex translate-x-22 items-center justify-center rounded-full"
      style={{
        offsetPath: 'path("M -30,70 L 0,70 A 56,70 0 1,0 0,-70 L -30, -70")',
        offsetDistance,
        offsetRotate: "0deg",
      }}
      key={index}
      onClick={onClick}
    >
      <motion.div
        className="fixed flex items-center justify-center rounded-full text-white"
        style={{
          color: "white",
          backgroundColor: color,
          width,
          height,
        }}
      >
        <p>{floor}</p>
      </motion.div>
    </motion.div>
  );
};

interface DummyButtonProps {
  index: number;
  progressValue: MotionValue<number>;
}

const DummyButton = ({ index, progressValue }: DummyButtonProps) => {
  const offsetDistance = useTransform(
    () => `${Math.max(0, Math.min(100, (progressValue.get() - index) * 25 + 50))}%`,
  );

  return (
    <motion.div
      className="fixed top-1/2 flex translate-x-22 items-center justify-center rounded-full text-white"
      style={{
        backgroundColor: "#90CFEA",
        offsetPath: 'path("M -30,70 L 0,70 A 56,70 0 1,0 0,-70 L -30, -70")',
        offsetDistance,
        opacity: 0.25,
        width: 38,
        height: 38,
        offsetRotate: "0deg",
      }}
      key={index}
    />
  );
};

interface Props {
  building: Building;
  progressValue: MotionValue<number>;
}

const FloorSwitcherCarouselMobile = ({ building, progressValue }: Props) => {
  const focusedFloor = useBoundStore((state) => state.focusedFloor);

  const { data: buildings } = $api.useQuery("get", "/api/buildings");
  const currentBuilding = buildings?.[focusedFloor?.buildingCode ?? ""];
  const floors = currentBuilding?.floors ?? [];

  return (
    <>
      <DummyButton index={-1} progressValue={progressValue} />
      {floors.map((floor, index) => (
        <FloorSwitcherButton
          building={currentBuilding ?? building}
          index={index}
          floor={floor}
          progressValue={progressValue}
          key={floor}
        />
      ))}
      <DummyButton index={building.floors.length} progressValue={progressValue} />
    </>
  );
};

export { FloorSwitcherCarouselMobile };
