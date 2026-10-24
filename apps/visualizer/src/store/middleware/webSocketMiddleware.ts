import {
  type ConnectedPayload,
  WebSocketEvents,
  type WebSocketFrame,
  type WebSocketPayloads,
} from "@cmumaps/websocket";
import type { Action, Middleware } from "@reduxjs/toolkit";
import {
  createEdge,
  createEdgeAcrossFloors,
  deleteEdge,
  deleteEdgeAcrossFloors,
} from "../api/edgeApiSlice.ts";
import { createNode, deleteNode, updateNode } from "../api/nodeApiSlice.ts";
import { createPoi, deletePoi, updatePoi } from "../api/poiApiSlice.ts";
import { createRoom, deleteRoom, updateRoom } from "../api/roomApiSlice.ts";
import { setCursorInfos, setLiveUsers } from "../features/liveCursor/liveCursorSlice.ts";
import type { AppDispatch } from "../store.ts";
import {
  type BroadcastMessage,
  type BroadcastWebSocketAction,
  type JoinWebSocketAction,
  type LeaveWebSocketAction,
  WEBSOCKET_BROADCAST,
  WEBSOCKET_JOIN,
  WEBSOCKET_LEAVE,
} from "./webSocketActions.ts";

let socket: WebSocket | null = null;
let socketId: string | undefined;

// frames queued while the socket is still connecting
let pendingFrames: string[] = [];

// acceptable approach since the socket id won't change
export const getSocketId = () => socketId;

interface ParamsType {
  dispatch: AppDispatch;
}

// Get floor code from URL
const getFloorCode = () => {
  return window.location.pathname.split("/")[1];
};

const send = <E extends keyof WebSocketPayloads>(event: E, payload: WebSocketPayloads[E]) => {
  if (socket === null) {
    return;
  }

  const frame = JSON.stringify({ event, payload } satisfies WebSocketFrame<E>);
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(frame);
  } else if (socket.readyState === WebSocket.CONNECTING) {
    pendingFrames.push(frame);
  }
};

const handleFrame = (frame: WebSocketFrame, dispatch: AppDispatch) => {
  const floorCode = getFloorCode();

  switch (frame.event) {
    case WebSocketEvents.CONNECTED: {
      socketId = (frame.payload as ConnectedPayload).socketId;
      break;
    }

    case WebSocketEvents.BROADCAST: {
      const { event, payload } = frame.payload as BroadcastMessage;
      if (event === "sync-cursors") {
        const { socketId: senderId, cursorInfos } = payload;
        dispatch(setCursorInfos({ socketId: senderId, cursorInfos }));
      }
      break;
    }

    case WebSocketEvents.SYNC_USERS: {
      const payload = frame.payload as WebSocketPayloads["sync-users"];
      dispatch(setLiveUsers(payload.users));
      break;
    }

    case WebSocketEvents.CREATE_NODE: {
      if (floorCode) {
        dispatch(createNode(floorCode, frame.payload as WebSocketPayloads["create-node"]));
      }
      break;
    }

    case WebSocketEvents.DELETE_NODE: {
      if (floorCode) {
        dispatch(deleteNode(floorCode, frame.payload as WebSocketPayloads["delete-node"]));
      }
      break;
    }

    case WebSocketEvents.UPDATE_NODE: {
      if (floorCode) {
        dispatch(updateNode(floorCode, frame.payload as WebSocketPayloads["update-node"]));
      }
      break;
    }

    case WebSocketEvents.CREATE_EDGE: {
      if (floorCode) {
        dispatch(createEdge(floorCode, frame.payload as WebSocketPayloads["create-edge"]));
      }
      break;
    }

    case WebSocketEvents.DELETE_EDGE: {
      if (floorCode) {
        dispatch(deleteEdge(floorCode, frame.payload as WebSocketPayloads["delete-edge"]));
      }
      break;
    }

    case WebSocketEvents.CREATE_EDGE_ACROSS_FLOORS: {
      if (floorCode) {
        dispatch(
          createEdgeAcrossFloors(
            floorCode,
            frame.payload as WebSocketPayloads["create-edge-across-floors"],
          ),
        );
      }
      break;
    }

    case WebSocketEvents.DELETE_EDGE_ACROSS_FLOORS: {
      if (floorCode) {
        dispatch(
          deleteEdgeAcrossFloors(
            floorCode,
            frame.payload as WebSocketPayloads["delete-edge-across-floors"],
          ),
        );
      }
      break;
    }

    case WebSocketEvents.CREATE_ROOM: {
      if (floorCode) {
        dispatch(createRoom(floorCode, frame.payload as WebSocketPayloads["create-room"]));
      }
      break;
    }

    case WebSocketEvents.DELETE_ROOM: {
      if (floorCode) {
        dispatch(deleteRoom(floorCode, frame.payload as WebSocketPayloads["delete-room"]));
      }
      break;
    }

    case WebSocketEvents.UPDATE_ROOM: {
      if (floorCode) {
        dispatch(updateRoom(floorCode, frame.payload as WebSocketPayloads["update-room"]));
      }
      break;
    }

    case WebSocketEvents.CREATE_POI: {
      if (floorCode) {
        dispatch(createPoi(floorCode, frame.payload as WebSocketPayloads["create-poi"]));
      }
      break;
    }

    case WebSocketEvents.DELETE_POI: {
      if (floorCode) {
        dispatch(deletePoi(floorCode, frame.payload as WebSocketPayloads["delete-poi"]));
      }
      break;
    }

    case WebSocketEvents.UPDATE_POI: {
      if (floorCode) {
        dispatch(updatePoi(floorCode, frame.payload as WebSocketPayloads["update-poi"]));
      }
      break;
    }

    default:
      break;
  }
};

// Create socket connection
const createSocket = (dispatch: AppDispatch) => {
  // same-origin, so the session cookie rides along with the upgrade
  const url = `${location.origin.replace(/^http/u, "ws")}/api/ws`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("Connected to server");
    for (const frame of pendingFrames) {
      ws.send(frame);
    }
    pendingFrames = [];
  };

  ws.onerror = () => {
    console.error("WebSocket connection error");
  };

  ws.onclose = () => {
    console.log("Disconnected from server");
    if (socket === ws) {
      socket = null;
      socketId = undefined;
      pendingFrames = [];
    }
  };

  ws.onmessage = (event) => {
    if (typeof event.data !== "string") {
      return;
    }

    try {
      handleFrame(JSON.parse(event.data) as WebSocketFrame, dispatch);
    } catch (error) {
      console.error("Failed to handle WebSocket frame:", error);
    }
  };

  return ws;
};

// Socket middleware
const webSocketMiddleware: Middleware = (params) => (next) => (action) => {
  const { dispatch } = params as ParamsType;
  const { type } = action as Action;
  const floorCode = getFloorCode();

  switch (type) {
    case WEBSOCKET_JOIN: {
      const { payload } = action as JoinWebSocketAction;
      const { user } = payload;

      const stale =
        socket === null ||
        socket.readyState === WebSocket.CLOSING ||
        socket.readyState === WebSocket.CLOSED;
      if (stale) {
        socket = createSocket(dispatch);
      }

      if (floorCode) {
        send(WebSocketEvents.JOIN_FLOOR, { floorCode, user });
      }

      break;
    }

    case WEBSOCKET_LEAVE: {
      const { payload } = action as LeaveWebSocketAction;
      const { floorCode } = payload;
      if (socket && floorCode) {
        send(WebSocketEvents.LEAVE_FLOOR, { floorCode });
      }
      break;
    }

    // broadcast through socket
    case WEBSOCKET_BROADCAST: {
      const { payload } = action as BroadcastWebSocketAction;
      send(WebSocketEvents.BROADCAST, payload);
      break;
    }

    default:
      break;
  }

  return next(action);
};

export { webSocketMiddleware };
