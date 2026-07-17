import type { RoomInfo } from "../../../../packages/common/src/index.ts";
import type { Request as ExpressRequest } from "express";
import {
  Body,
  Delete,
  Middlewares,
  Patch,
  Post,
  Request,
  Route,
  Security,
} from "tsoa";
import { BEARER_AUTH, MEMBER_SCOPE, OIDC_AUTH } from "../lib/authentication.ts";
import { requireSocketId } from "../middleware/socketAuth.ts";
import { webSocketService } from "../server.ts";
import { floorService } from "../services/floorService.ts";
import { roomService } from "../services/roomService.ts";

@Security(OIDC_AUTH, [MEMBER_SCOPE])
@Security(BEARER_AUTH, [MEMBER_SCOPE])
@Middlewares(requireSocketId)
@Route("rooms")
export class RoomController {
  @Post("/:roomId")
  public async createRoom(
    @Request() req: ExpressRequest,
    @Body() body: {
      floorCode: string;
      roomNodes: string[];
      roomInfo: RoomInfo;
    },
  ) {
    const { roomId } = req.params;
    const { floorCode, roomNodes, roomInfo } = body;
    const { socketId } = req;

    const placement = await floorService.getFloorPlacement(floorCode);
    await roomService.createRoom(
      floorCode,
      roomId,
      roomNodes,
      roomInfo,
      placement,
    );
    const payload = { roomId, roomNodes, roomInfo };
    webSocketService.broadcastToUserFloor(socketId, "create-room", payload);
    return null;
  }

  @Delete("/:roomId")
  public async deleteRoom(@Request() req: ExpressRequest) {
    const { roomId, socketId } = req.params;

    await roomService.deleteRoom(roomId);
    const payload = { roomId };
    webSocketService.broadcastToUserFloor(socketId, "delete-room", payload);
    return null;
  }

  @Patch("/:roomId")
  public async updateRoom(
    @Request() req: ExpressRequest,
    @Body() body: { floorCode: string; roomInfo: Partial<RoomInfo> },
  ) {
    const { roomId } = req.params;
    const { roomInfo, floorCode } = body;
    const { socketId } = req;

    const placement = await floorService.getFloorPlacement(floorCode);
    await roomService.updateRoom(roomId, roomInfo, placement);
    const payload = { roomId, roomInfo };
    webSocketService.broadcastToUserFloor(socketId, "update-room", payload);
    return null;
  }
}
