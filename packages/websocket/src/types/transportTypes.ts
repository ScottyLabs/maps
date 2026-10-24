import type { LiveUser } from "./userTypes.ts";

export interface ConnectedPayload {
  socketId: string;
}

export interface JoinFloorPayload {
  floorCode: string;
  user: LiveUser;
}

export interface LeaveFloorPayload {
  floorCode: string;
}

// relayed verbatim between clients; the server never reads the inner event
export interface BroadcastPayload {
  event: string;
  payload: unknown;
}
