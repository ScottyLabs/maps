import { useEffect, useRef } from "react";

import { useSession } from "../auth.tsx";
import { USE_STRICT_MODE } from "../settings.ts";
import { useAppDispatch } from "../store/hooks.ts";
import { joinWebSocket, leaveWebSocket } from "../store/middleware/webSocketActions.ts";

const getRandomColor = (): string => {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
};

// Custom hook to join and leave the WebSocket connection
// Compatible with React Strict Mode
const useWebSocket = (floorCode?: string) => {
  const dispatch = useAppDispatch();
  const { name } = useSession();
  const isInitialRender = useRef<boolean>(true);

  useEffect(() => {
    // Skip first render if in Strict Mode
    if (isInitialRender.current && USE_STRICT_MODE) {
      isInitialRender.current = false;
      return;
    }

    dispatch(joinWebSocket({ color: getRandomColor(), userName: name }));

    return () => {
      dispatch(leaveWebSocket(floorCode));
    };
  }, [name, dispatch, floorCode]);
};

export default useWebSocket;
