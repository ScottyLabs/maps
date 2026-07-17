import { useQueryState } from "nuqs";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { $api } from "@/api/client.ts";
import { useBoundStore } from "@/store/index.ts";

const useFocusedFloorParam = () => {
  const location = useLocation();
  // path navigation (room/building/coordinate/event) takes precedence over the floor param
  const isTrivialPath = location.pathname === "/";

  const [floorParam, setFloorParam] = useQueryState("floor", {
    history: "replace",
  });
  const focusedFloor = useBoundStore((state) => state.focusedFloor);
  const focusFloor = useBoundStore((state) => state.focusFloor);
  const { data: buildings } = $api.useQuery("get", "/buildings");

  const restored = useRef(false);

  // restore once after buildings are available, only on trivial path
  useEffect(() => {
    if (restored.current || !buildings || !floorParam || !isTrivialPath) {
      return;
    }
    const dash = floorParam.indexOf("-");
    if (dash <= 0) {
      return;
    }
    const buildingCode = floorParam.slice(0, dash);
    const level = floorParam.slice(dash + 1);
    if (
      buildings[buildingCode]?.floors.includes(level) &&
      (focusedFloor?.buildingCode !== buildingCode ||
        focusedFloor?.level !== level)
    ) {
      focusFloor({ buildingCode, level });
    }
    restored.current = true;
  }, [buildings, floorParam, focusFloor, focusedFloor, isTrivialPath]);

  // mirror store -> url, but clear when a path is selected
  useEffect(() => {
    if (!isTrivialPath) {
      if (floorParam !== null) {
        setFloorParam(null);
      }
      return;
    }
    const next = focusedFloor
      ? `${focusedFloor.buildingCode}-${focusedFloor.level}`
      : null;
    if (next !== floorParam) {
      setFloorParam(next);
    }
  }, [focusedFloor, floorParam, setFloorParam, isTrivialPath]);
};

export { useFocusedFloorParam };
