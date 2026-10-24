import { auth } from "../auth";

import { useEffect, useRef } from "react";

import { USE_STRICT_MODE } from "../settings";
import { useAppDispatch } from "../store/hooks";
import {
  joinWebSocket,
  leaveWebSocket,
} from "../store/middleware/webSocketActions";

const getRandomColor = (): string => {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
};

// Custom hook to join and leave the WebSocket connection
// Compatible with React Strict Mode
const useWebSocket = (floorCode?: string) => {
  const dispatch = useAppDispatch();
  const { data: session } = auth.useSession();
  const userName = session?.user.name;
  const isInitialRender = useRef<boolean>(true);

  useEffect(() => {
    // Skip first render if in Strict Mode
    if (isInitialRender.current && USE_STRICT_MODE) {
      isInitialRender.current = false;
      return;
    }

    if (userName) {
      const user = { userName, color: getRandomColor() };
      dispatch(joinWebSocket(user));
    }

    return () => {
      dispatch(leaveWebSocket(floorCode));
    };
  }, [userName, dispatch, floorCode]);
};

export default useWebSocket;
