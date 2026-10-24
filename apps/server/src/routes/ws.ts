import { Elysia } from "elysia";
import type {
  BroadcastPayload,
  JoinFloorPayload,
  LeaveFloorPayload,
  WebSocketFrame,
} from "../../../../packages/websocket/src/index.ts";
import { WebSocketEvents } from "../../../../packages/websocket/src/index.ts";
import { authPlugin } from "../auth/middleware.ts";
import { webSocketService } from "../services/webSocketService.ts";
import { logger } from "../utils/log.ts";

const ignoreLogin = Deno.env.get("IGNORE_LOGIN") === "true";

const parseFrame = (data: unknown): WebSocketFrame | undefined => {
  if (typeof data !== "string") {
    logger.warn("Discarding non-text websocket frame");
    return undefined;
  }

  try {
    const frame = JSON.parse(data) as WebSocketFrame;
    if (typeof frame?.event !== "string") {
      logger.warn("Discarding websocket frame without an event name");
      return undefined;
    }
    return frame;
  } catch (error) {
    logger.warn(
      "Discarding malformed websocket frame",
      error instanceof Error ? error : new Error(String(error)),
    );
    return undefined;
  }
};

const open = (socketId: string, socket: WebSocket) => {
  webSocketService.register(socketId, socket);
  logger.info("Client connected: {socketId}", { socketId });

  const frame: WebSocketFrame<typeof WebSocketEvents.CONNECTED> = {
    event: WebSocketEvents.CONNECTED,
    payload: { socketId },
  };
  socket.send(JSON.stringify(frame));
};

const message = (socketId: string, data: unknown) => {
  const frame = parseFrame(data);
  if (!frame) {
    return;
  }

  switch (frame.event) {
    case WebSocketEvents.JOIN_FLOOR: {
      const { floorCode, user } = frame.payload as JoinFloorPayload;
      webSocketService.joinFloor(socketId, floorCode, user);
      logger.info("{socketId} joined room: {floorCode}", {
        floorCode,
        socketId,
      });
      break;
    }

    case WebSocketEvents.LEAVE_FLOOR: {
      const { floorCode } = frame.payload as LeaveFloorPayload;
      webSocketService.leaveFloor(socketId, floorCode);
      logger.info("{socketId} left room: {floorCode}", { floorCode, socketId });
      break;
    }

    case WebSocketEvents.BROADCAST: {
      webSocketService.relayBroadcast(socketId, frame.payload as BroadcastPayload);
      break;
    }

    default: {
      logger.warn("Ignoring unsupported client event: {event}", {
        event: frame.event,
      });
      break;
    }
  }
};

const close = (socketId: string) => {
  webSocketService.unregister(socketId);
  logger.info("Client disconnected: {socketId}", { socketId });
};

// elysia 1.4 .ws() is bun-only; upgrade by hand and hand the 101 back to elysia
export const wsRoutes = new Elysia().use(authPlugin).get(
  "/ws",
  ({ request, status, user }) => {
    if (!user && !ignoreLogin) {
      return status(401, { error: "Unauthorized" });
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return status(426, { error: "Expected a websocket upgrade" });
    }

    const { response, socket } = Deno.upgradeWebSocket(request);
    const socketId = crypto.randomUUID();

    socket.onopen = () => open(socketId, socket);
    socket.onmessage = (event) => message(socketId, event.data);
    socket.onclose = () => close(socketId);
    socket.onerror = () => logger.warn("Socket {socketId} errored", { socketId });

    return response;
  },
  { optionalAuth: true },
);
