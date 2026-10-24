import { Elysia } from "elysia";

// broadcasts are scoped to the caller's floor, so mutations must identify the socket
export const requireSocketId = new Elysia({ name: "requireSocketId" }).derive(
  { as: "scoped" },
  ({ headers, status }) => {
    const socketId = headers["x-socket-id"];
    if (!socketId) {
      return status(400, { error: "X-Socket-ID header is required" });
    }
    return { socketId };
  },
);
