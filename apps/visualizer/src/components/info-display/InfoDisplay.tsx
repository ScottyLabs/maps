import type { Graph, Pois, Rooms } from "@cmumaps/common";

import React from "react";

import useValidatedFloorParams from "../../hooks/useValidatedFloorParams.ts";
import { GRAPH_SELECT, setMode } from "../../store/features/modeSlice.ts";
import { setEditRoomLabel, setInfoDisplayActiveTabIndex } from "../../store/features/uiSlice.ts";
import { useAppDispatch, useAppSelector } from "../../store/hooks.ts";
import GraphInfoDisplay from "./graph/GraphInfoDisplay.tsx";
import PoiInfoDisplay from "./poi/PoiInfoDisplay.tsx";
import PoilessDisplay from "./poi/PoilessDisplay.tsx";
import RoomInfoDisplay from "./room/RoomInfoDisplay.tsx";
import RoomlessDisplay from "./room/RoomlessDisplay.tsx";

interface Props {
  floorCode: string;
  graph: Graph;
  rooms: Rooms;
  pois: Pois;
}

const InfoDisplay = ({ floorCode, graph, rooms, pois }: Props) => {
  const dispatch = useAppDispatch();
  const activeTabIndex = useAppSelector((state) => state.ui.infoDisplayActiveTabIndex);

  const result = useValidatedFloorParams(floorCode);
  if ("error" in result) {
    return;
  }

  // need at least one of ids for info display
  const { nodeId, roomId, poiId } = result;
  if (!nodeId && !roomId && !poiId) {
    return;
  }

  const renderRoomInfoDisplay = () => {
    // One of these conditions should always occur since we checked that one of the ids is available and we can retrieve nodeId from poiId
    if (roomId) {
      return <RoomInfoDisplay floorCode={floorCode} roomId={roomId} rooms={rooms} />;
    }

    if (nodeId) {
      return <RoomlessDisplay floorCode={floorCode} nodeId={nodeId} graph={graph} />;
    }
  };

  const renderPoiInfoDisplay = () => {
    // One of these conditions should always occur since we check either poiId or nodeId is available
    if (poiId) {
      return <PoiInfoDisplay floorCode={floorCode} poiId={poiId} pois={pois} />;
    }

    if (nodeId) {
      return <PoilessDisplay floorCode={floorCode} nodeId={nodeId} />;
    }
  };

  const renderGraphInfoDisplay = () => {
    // This condition should always occur since we check nodeId is available
    if (nodeId) {
      return <GraphInfoDisplay floorCode={floorCode} nodeId={nodeId} graph={graph} />;
    }
  };

  const tabNames = ["Room Info"];
  const tabContents = [renderRoomInfoDisplay];

  if (poiId || nodeId) {
    tabNames.push("POI Info");
    tabContents.push(renderPoiInfoDisplay);
  }

  if (nodeId) {
    tabNames.push("Graph Info");
    tabContents.push(renderGraphInfoDisplay);
  }

  const renderTabHeader = (tabName: string, index: number) => {
    const handleClick = () => {
      dispatch(setEditRoomLabel(false));
      dispatch(setInfoDisplayActiveTabIndex(index));
      dispatch(setMode(GRAPH_SELECT));
    };

    return (
      <button
        type="button"
        key={index}
        className={`mb-3 cursor-pointer border-b-2 px-3 pt-4 pb-2 text-center font-medium ${
          index === activeTabIndex
            ? "border-blue-400 text-blue-400"
            : "border-transparent text-gray-400 hover:border-gray-300 hover:text-white"
        }`}
        onClick={handleClick}
      >
        {tabName}
      </button>
    );
  };

  return (
    <div className="flex w-fit flex-col rounded-lg bg-gray-600 px-2 pb-2 text-white shadow-lg">
      <ul className="flex text-sm">
        {tabNames.map((tabName, index) => renderTabHeader(tabName, index))}
      </ul>
      <div>{React.createElement(tabContents[activeTabIndex])}</div>
    </div>
  );
};

export default InfoDisplay;
