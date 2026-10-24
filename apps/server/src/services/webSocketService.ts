import type {
  BroadcastPayload,
  LiveUser,
  WebSocketFrame,
  WebSocketPayloads,
} from "../../../../packages/websocket/src/index.ts";
import { WebSocketEvents } from "../../../../packages/websocket/src/index.ts";
import { logger } from "../utils/log.ts";

// structural, so both a native WebSocket and elysia's ElysiaWS fit
export interface WebSocketConnection {
  send(data: string): unknown;
  close(code?: number, reason?: string): void;
}

export class WebSocketService {
  private readonly socketToRoom: Map<string, string> = new Map();
  private readonly socketToUser: Map<string, LiveUser> = new Map();
  private readonly socketToConnection: Map<string, WebSocketConnection> = new Map();

  public register(socketId: string, connection: WebSocketConnection): void {
    this.socketToConnection.set(socketId, connection);
  }

  public unregister(socketId: string): void {
    const room = this.socketToRoom.get(socketId);

    this.socketToConnection.delete(socketId);
    this.socketToUser.delete(socketId);
    this.socketToRoom.delete(socketId);

    if (room) {
      this.syncUsers(room);
    }
  }

  public joinFloor(socketId: string, room: string, user: LiveUser): void {
    this.socketToUser.set(socketId, user);
    this.socketToRoom.set(socketId, room);
    this.syncUsers(room);
  }

  public leaveFloor(socketId: string, room: string): void {
    this.socketToRoom.delete(socketId);
    this.syncUsers(room);
  }

  // sender is excluded: it already applied the message locally
  public relayBroadcast(senderId: string, payload: BroadcastPayload): void {
    const room = this.socketToRoom.get(senderId);
    if (!room) {
      logger.warn(
        "Could not send broadcast to room (excluding the sender) due to invalid sender or room",
      );
      return;
    }

    this.emit(room, WebSocketEvents.BROADCAST, payload, senderId);
  }

  /**
   * Send an event to all clients in the room the sender is in
   */
  public broadcastToUserFloor<E extends keyof WebSocketPayloads>(
    senderId: string,
    event: E,
    payload: WebSocketPayloads[E],
  ): void {
    const room = this.socketToRoom.get(senderId);
    if (room) {
      this.emit(room, event, payload);
    } else {
      logger.warn("Could not broadcast to room due to invalid sender or room");
    }
  }

  /**
   * Send an event to all clients in the room the sender is in
   */
  public broadcastToFloor<E extends keyof WebSocketPayloads>(
    room: string,
    event: E,
    payload: WebSocketPayloads[E],
  ): void {
    if (room) {
      this.emit(room, event, payload);
    } else {
      logger.warn("Could not broadcast to room due to invalid sender or room");
    }
  }

  private syncUsers(room: string): void {
    const users: Record<string, LiveUser> = {};
    for (const [socketId, socketRoom] of this.socketToRoom) {
      if (socketRoom !== room) {
        continue;
      }
      const user = this.socketToUser.get(socketId);
      if (user) {
        users[socketId] = user;
      }
    }

    this.emit(room, WebSocketEvents.SYNC_USERS, { users });
  }

  private emit<E extends keyof WebSocketPayloads>(
    room: string,
    event: E,
    payload: WebSocketPayloads[E],
    excludeSocketId?: string,
  ): void {
    const frame: WebSocketFrame<E> = { event, payload };
    const data = JSON.stringify(frame);

    for (const [socketId, socketRoom] of this.socketToRoom) {
      if (socketRoom !== room || socketId === excludeSocketId) {
        continue;
      }
      const connection = this.socketToConnection.get(socketId);
      if (!connection) {
        continue;
      }

      try {
        connection.send(data);
      } catch (error) {
        logger.error(
          `Failed to send ${event} to socket ${socketId}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }
}

export const webSocketService = new WebSocketService();
