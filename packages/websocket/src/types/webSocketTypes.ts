/** biome-ignore-all lint/style/useNamingConvention: TODO: use the right naming convention */
import type {
  CreateEdgeAcrossFloorsPayload,
  CreateEdgePayload,
  DeleteEdgeAcrossFloorsPayload,
  DeleteEdgePayload,
} from "./edgeTypes.ts";
import type { CreateNodePayload, DeleteNodePayload, UpdateNodePayload } from "./nodeTypes.ts";
import type { CreatePoiPayload, DeletePoiPayload, UpdatePoiPayload } from "./poiTypes.ts";
import type { CreateRoomPayload, DeleteRoomPayload, UpdateRoomPayload } from "./roomTypes.ts";
import type {
  BroadcastPayload,
  ConnectedPayload,
  JoinFloorPayload,
  LeaveFloorPayload,
} from "./transportTypes.ts";
import type { SyncUserPayload } from "./userTypes.ts";

// Define all WebSocket event names as string literals
export const WebSocketEvents = {
  CONNECTED: "connected",
  JOIN_FLOOR: "join-floor",
  LEAVE_FLOOR: "leave-floor",
  BROADCAST: "broadcast",

  SYNC_USERS: "sync-users",

  CREATE_NODE: "create-node",
  DELETE_NODE: "delete-node",
  UPDATE_NODE: "update-node",

  CREATE_EDGE: "create-edge",
  DELETE_EDGE: "delete-edge",
  CREATE_EDGE_ACROSS_FLOORS: "create-edge-across-floors",
  DELETE_EDGE_ACROSS_FLOORS: "delete-edge-across-floors",

  CREATE_ROOM: "create-room",
  DELETE_ROOM: "delete-room",
  UPDATE_ROOM: "update-room",

  CREATE_POI: "create-poi",
  DELETE_POI: "delete-poi",
  UPDATE_POI: "update-poi",
} as const;

// Create a type from the values
export type WebSocketEventType = (typeof WebSocketEvents)[keyof typeof WebSocketEvents];

// Define payload types for each event
export interface WebSocketPayloads {
  [WebSocketEvents.CONNECTED]: ConnectedPayload;
  [WebSocketEvents.JOIN_FLOOR]: JoinFloorPayload;
  [WebSocketEvents.LEAVE_FLOOR]: LeaveFloorPayload;
  [WebSocketEvents.BROADCAST]: BroadcastPayload;

  [WebSocketEvents.SYNC_USERS]: SyncUserPayload;

  [WebSocketEvents.CREATE_NODE]: CreateNodePayload;
  [WebSocketEvents.DELETE_NODE]: DeleteNodePayload;
  [WebSocketEvents.UPDATE_NODE]: UpdateNodePayload;

  [WebSocketEvents.CREATE_EDGE]: CreateEdgePayload;
  [WebSocketEvents.DELETE_EDGE]: DeleteEdgePayload;
  [WebSocketEvents.CREATE_EDGE_ACROSS_FLOORS]: CreateEdgeAcrossFloorsPayload;
  [WebSocketEvents.DELETE_EDGE_ACROSS_FLOORS]: DeleteEdgeAcrossFloorsPayload;

  [WebSocketEvents.CREATE_ROOM]: CreateRoomPayload;
  [WebSocketEvents.DELETE_ROOM]: DeleteRoomPayload;
  [WebSocketEvents.UPDATE_ROOM]: UpdateRoomPayload;

  [WebSocketEvents.CREATE_POI]: CreatePoiPayload;
  [WebSocketEvents.DELETE_POI]: DeletePoiPayload;
  [WebSocketEvents.UPDATE_POI]: UpdatePoiPayload;
}

/** Wire format for every frame, in both directions. */
export interface WebSocketFrame<E extends keyof WebSocketPayloads = keyof WebSocketPayloads> {
  event: E;
  payload: WebSocketPayloads[E];
}
