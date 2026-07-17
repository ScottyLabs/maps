import { useUser } from "@clerk/clerk-react";

import { useEffect, useRef } from "react";

import { USE_STRICT_MODE } from "../settings.ts";
import { useAppDispatch } from "../store/hooks.ts";
import {
  joinWebSocket,
  leaveWebSocket,
} from "../store/middleware/webSocketActions.ts";

const getRandomColor = (): string => {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
};

// Custom hook to join and leave the WebSocket connection
// Compatible with React Strict Mode
const useWebSocket = (floorCode?: string) => {
  const dispatch = useAppDispatch();
  const { user: clerkUser } = useUser();
  const isInitialRender = useRef<boolean>(true);

  useEffect(() => {
    // Skip first render if in Strict Mode
    if (isInitialRender.current && USE_STRICT_MODE) {
      isInitialRender.current = false;
      return;
    }

    if (clerkUser) {
      const userName = clerkUser.firstName || "";
      const user = { userName, color: getRandomColor() };
      dispatch(joinWebSocket(user));
    }

    return () => {
      dispatch(leaveWebSocket(floorCode));
    };
  }, [clerkUser, dispatch, floorCode]);
};

export default useWebSocket;
