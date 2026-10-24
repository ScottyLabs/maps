import type { LiveUser } from "@cmumaps/websocket";
import type { CursorInfo } from "../features/liveCursor/liveCursorTypes.ts";

// Action types
export const WEBSOCKET_JOIN = "WEBSOCKET_JOIN";
export const WEBSOCKET_LEAVE = "WEBSOCKET_LEAVE";
export const WEBSOCKET_BROADCAST = "WEBSOCKET_BROADCAST";

// Action creators
export type JoinWebSocketAction = ReturnType<typeof joinWebSocket>;
export const joinWebSocket = (user: LiveUser) => ({
  type: WEBSOCKET_JOIN,
  payload: { user },
});

export type LeaveWebSocketAction = ReturnType<typeof leaveWebSocket>;
export const leaveWebSocket = (floorCode?: string) => ({
  type: WEBSOCKET_LEAVE,
  // we need to send the floorCode because the url changes before the middleware can process the action
  payload: { floorCode },
});

export type BroadcastWebSocketAction = ReturnType<typeof broadcastWebSocket>;
export const broadcastWebSocket = ({ event, payload }: BroadcastMessage) => ({
  type: WEBSOCKET_BROADCAST,
  payload: { event, payload },
});

// Define all Broadcast event names as string literals
export const BroadcastEvents = {
  SYNC_CURSORS: "sync-cursors",
} as const;

// Create a type from the values
export type BroadcastEventType = (typeof BroadcastEvents)[keyof typeof BroadcastEvents];

// Event payload types
interface SyncCursorsPayload {
  socketId: string;
  cursorInfos: CursorInfo[];
}

// Define payload types for each event
export type BroadcastPayloads = {
  [BroadcastEvents.SYNC_CURSORS]: SyncCursorsPayload;
};

export type BroadcastMessage = {
  [T in BroadcastEventType]: {
    event: T;
    payload: BroadcastPayloads[T];
  };
}[BroadcastEventType];
