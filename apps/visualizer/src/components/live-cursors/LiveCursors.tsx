import { useAppSelector } from "../../store/hooks.ts";
import { getSocketId } from "../../store/middleware/webSocketMiddleware.ts";
import LiveCursor from "./LiveCursor.tsx";

interface LiveCursorsProps {
  floorCode: string;
  scale: number;
}

const LiveCursors = ({ floorCode, scale }: LiveCursorsProps) => {
  const users = useAppSelector((state) => state.liveCursor.liveUsers);
  const socketId = getSocketId();
  return Object.entries(users).map(
    ([userSocketId, user]) =>
      userSocketId !== socketId && (
        <LiveCursor
          key={userSocketId}
          floorCode={floorCode}
          userSocketId={userSocketId}
          user={user}
          scale={scale}
        />
      ),
  );
};

export default LiveCursors;
