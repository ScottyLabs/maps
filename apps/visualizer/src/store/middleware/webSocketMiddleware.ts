import {
  type LiveUser,
  WebSocketEvents,
  type WebSocketEventType,
  type WebSocketPayloads,
} from "@cmumaps/websocket";
import type { Action, Middleware } from "@reduxjs/toolkit";
import { io, type Socket } from "socket.io-client";
import env from "../../env";
import {
  createEdge,
  createEdgeAcrossFloors,
  deleteEdge,
  deleteEdgeAcrossFloors,
} from "../api/edgeApiSlice";
import { createNode, deleteNode, updateNode } from "../api/nodeApiSlice";
import { createPoi, deletePoi, updatePoi } from "../api/poiApiSlice";
import { createRoom, deleteRoom, updateRoom } from "../api/roomApiSlice";
import {
  setCursorInfos,
  setLiveUsers,
} from "../features/liveCursor/liveCursorSlice";
import type { AppDispatch } from "../store";
import {
  type BroadcastMessage,
  type BroadcastWebSocketAction,
  type JoinWebSocketAction,
  type LeaveWebSocketAction,
  WEBSOCKET_BROADCAST,
  WEBSOCKET_JOIN,
  WEBSOCKET_LEAVE,
} from "./webSocketActions";

// Socket instance
let socket: Socket | null = null;

// acceptable approach since the socket id won't change
export const getSocketId = () => socket?.id;

interface ParamsType {
  dispatch: AppDispatch;
}

// Get floor code from URL
const getFloorCode = () => {
  return window.location.pathname.split("/")[2];
};

// Create socket connection
const createSocket = async (user: LiveUser, dispatch: AppDispatch) => {
  const socket = io(env.VITE_SERVER_URL, {
    query: {
      userName: user.userName,
      userColor: user.color,
    },
    withCredentials: true,
    reconnectionAttempts: 1,
  });

  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("connect_error", (err) => {
    console.error("WebSocket connection error:", err.message);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  socket.on("broadcast", (message) => {
    const { event, payload } = message as BroadcastMessage;
    if (event === "sync-cursors") {
      const { socketId, cursorInfos } = payload;
      dispatch(setCursorInfos({ socketId, cursorInfos }));
    }
  });

  // Handle sync users event
  socket.on<WebSocketEventType>(
    WebSocketEvents.SYNC_USERS,
    (message: WebSocketPayloads["sync-users"]) => {
      dispatch(setLiveUsers(message.users));
    },
  );

  // Handle create node event
  socket.on<WebSocketEventType>(
    WebSocketEvents.CREATE_NODE,
    (message: WebSocketPayloads["create-node"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(createNode(floorCode, message));
      }
    },
  );

  // Handle delete node event
  socket.on<WebSocketEventType>(
    WebSocketEvents.DELETE_NODE,
    (message: WebSocketPayloads["delete-node"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(deleteNode(floorCode, message));
      }
    },
  );

  // Handle update node event
  socket.on<WebSocketEventType>(
    WebSocketEvents.UPDATE_NODE,
    (message: WebSocketPayloads["update-node"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(updateNode(floorCode, message));
      }
    },
  );

  // Handle create edge event
  socket.on<WebSocketEventType>(
    WebSocketEvents.CREATE_EDGE,
    (message: WebSocketPayloads["create-edge"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(createEdge(floorCode, message));
      }
    },
  );

  // Handle delete edge event
  socket.on<WebSocketEventType>(
    WebSocketEvents.DELETE_EDGE,
    (message: WebSocketPayloads["delete-edge"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(deleteEdge(floorCode, message));
      }
    },
  );

  // Handle create edge across floors event
  socket.on<WebSocketEventType>(
    WebSocketEvents.CREATE_EDGE_ACROSS_FLOORS,
    (message: WebSocketPayloads["create-edge-across-floors"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(createEdgeAcrossFloors(floorCode, message));
      }
    },
  );

  // Handle delete edge across floors event
  socket.on<WebSocketEventType>(
    WebSocketEvents.DELETE_EDGE_ACROSS_FLOORS,
    (message: WebSocketPayloads["delete-edge-across-floors"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(deleteEdgeAcrossFloors(floorCode, message));
      }
    },
  );

  // Handle create room
  socket.on<WebSocketEventType>(
    WebSocketEvents.CREATE_ROOM,
    (message: WebSocketPayloads["create-room"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(createRoom(floorCode, message));
      }
    },
  );

  // Handle delete room
  socket.on<WebSocketEventType>(
    WebSocketEvents.DELETE_ROOM,
    (message: WebSocketPayloads["delete-room"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(deleteRoom(floorCode, message));
      }
    },
  );

  // Handle update room
  socket.on<WebSocketEventType>(
    WebSocketEvents.UPDATE_ROOM,
    (message: WebSocketPayloads["update-room"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(updateRoom(floorCode, message));
      }
    },
  );

  // Handle create poi
  socket.on<WebSocketEventType>(
    WebSocketEvents.CREATE_POI,
    (message: WebSocketPayloads["create-poi"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(createPoi(floorCode, message));
      }
    },
  );

  // Handle delete poi
  socket.on<WebSocketEventType>(
    WebSocketEvents.DELETE_POI,
    (message: WebSocketPayloads["delete-poi"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(deletePoi(floorCode, message));
      }
    },
  );

  // Handle update poi
  socket.on<WebSocketEventType>(
    WebSocketEvents.UPDATE_POI,
    (message: WebSocketPayloads["update-poi"]) => {
      const floorCode = getFloorCode();
      if (floorCode) {
        dispatch(updatePoi(floorCode, message));
      }
    },
  );

  return socket;
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

      // Connect to socket
      (async () => {
        if (socket === null) {
          socket = await createSocket(user, dispatch);
        }

        // Join room after socket creation
        if (floorCode && socket) {
          socket.emit("join", floorCode);
        }
      })();

      break;
    }

    case WEBSOCKET_LEAVE: {
      const { payload } = action as LeaveWebSocketAction;
      const { floorCode } = payload;
      if (socket && floorCode) {
        socket.emit("leave", floorCode);
      }
      break;
    }

    // broadcast through socket
    case WEBSOCKET_BROADCAST: {
      const { payload } = action as BroadcastWebSocketAction;
      if (socket !== null) {
        socket.emit("broadcast", payload);
      }
      break;
    }

    default:
      break;
  }

  return next(action);
};

export { webSocketMiddleware };
