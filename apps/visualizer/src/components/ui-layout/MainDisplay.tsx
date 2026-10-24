import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "react-toastify";
import useValidatedFloorParams from "../../hooks/useValidatedFloorParams.ts";
import useWebSocket from "../../hooks/useWebSocket.ts";
import {
  useGetFloorGraphQuery,
  useGetFloorPoisQuery,
  useGetFloorRoomsQuery,
} from "../../store/api/floorDataApiSlice.ts";
import InfoDisplay from "../info-display/InfoDisplay.tsx";
import ErrorDisplay from "../shared/ErrorDisplay.tsx";
import Loader from "../shared/Loader.tsx";
import SidePanel from "../side-panel/SidePanel.tsx";
import ZoomPanWrapper from "../zoom-pan/ZoomPanWrapper.tsx";

interface Props {
  floorCode: string;
}

const MainDisplay = ({ floorCode }: Props) => {
  const navigate = useNavigate();
  useWebSocket(floorCode);

  // handles invalid nodeId or roomId
  const result = useValidatedFloorParams(floorCode);
  useEffect(() => {
    if ("error" in result) {
      toast.error(result.error);
      navigate({ to: ".", search: {}, replace: true });
    }
  }, [navigate, result]);

  // fetch graph, rooms, and pois
  const {
    data: graph,
    isFetching: isFetchingGraph,
    isError: isErrorGraph,
  } = useGetFloorGraphQuery(floorCode);
  const {
    data: rooms,
    isFetching: isFetchingRooms,
    isError: isErrorRooms,
  } = useGetFloorRoomsQuery(floorCode);
  const {
    data: pois,
    isFetching: isFetchingPois,
    isError: isErrorPois,
  } = useGetFloorPoisQuery(floorCode);

  if ("error" in result) {
    return;
  }

  // we need this for the flicker effect when refetching
  if (isFetchingGraph || isFetchingRooms || isFetchingPois) {
    return <Loader loadingText="Fetching nodes, rooms, and pois" />;
  }

  // handle errors
  const isError = isErrorGraph || isErrorRooms || isErrorPois;
  if (isError || !graph || !rooms || !pois) {
    return <ErrorDisplay errorText="Failed to fetch nodes, rooms, and pois" />;
  }

  return (
    <>
      <div className="fixed top-1/2 z-50 -translate-y-1/2">
        <SidePanel floorCode={floorCode} graph={graph} rooms={rooms} />
      </div>
      <ZoomPanWrapper floorCode={floorCode} graph={graph} rooms={rooms} />
      <div className="absolute top-28 right-4 z-50">
        <InfoDisplay floorCode={floorCode} graph={graph} rooms={rooms} pois={pois} />
      </div>
    </>
  );
};

export default MainDisplay;
