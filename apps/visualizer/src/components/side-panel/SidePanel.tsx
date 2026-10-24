import type { Graph, Rooms } from "@cmumaps/common";

import { selectEditPolygon } from "../../store/features/modeSlice.ts";
import { setSidePanelActiveTabIndex } from "../../store/features/uiSlice.ts";
import { useAppDispatch, useAppSelector } from "../../store/hooks.ts";
import GraphTab from "./GraphTab.tsx";
import PolygonTab from "./PolygonTab.tsx";
import VisibilityTab from "./VisibilityTab.tsx";

interface Props {
  floorCode: string;
  graph: Graph;
  rooms: Rooms;
}

const SidePanel = ({ floorCode, graph, rooms }: Props) => {
  const dispatch = useAppDispatch();

  const editPolygon = useAppSelector(selectEditPolygon);
  const activeTabIndex = useAppSelector((state) => state.ui.sidePanelActiveTabIndex);

  const tabNames = editPolygon ? ["Visibility", "Polygon"] : ["Visibility", "Graph"];

  const renderVisibilityTab = () => <VisibilityTab />;

  const renderGraphTab = () => <GraphTab floorCode={floorCode} graph={graph} rooms={rooms} />;

  const renderPolygonTab = () => <PolygonTab floorCode={floorCode} rooms={rooms} />;

  const tabContents = editPolygon
    ? [renderVisibilityTab, renderPolygonTab]
    : [renderVisibilityTab, renderGraphTab];

  return (
    <div className="h-[25em] w-fit rounded-lg border bg-slate-400 shadow-lg">
      <h1 className="pt-2 text-center text-xl underline">Settings</h1>
      <ul className="flex text-sm">
        {tabNames.map((tabName, index) => (
          <button
            type="button"
            key={index}
            className={`mb-3 cursor-pointer border-b-2 px-3 pt-4 pb-2 text-center font-medium ${
              activeTabIndex === index
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
            onClick={() => dispatch(setSidePanelActiveTabIndex(index))}
          >
            {tabName}
          </button>
        ))}
      </ul>
      {tabContents[activeTabIndex]()}
    </div>
  );
};

export default SidePanel;
