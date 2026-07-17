import type { NodeInfo } from "../../../../packages/common/src/index.ts";
import type { Request as ExpressRequest } from "express";
import {
  Body,
  Delete,
  Middlewares,
  Post,
  Put,
  Request,
  Route,
  Security,
} from "tsoa";
import { BEARER_AUTH, MEMBER_SCOPE, OIDC_AUTH } from "../lib/authentication.ts";
import { requireSocketId } from "../middleware/socketAuth.ts";
import { webSocketService } from "../server.ts";
import { edgeService } from "../services/edgeService.ts";
import { floorService } from "../services/floorService.ts";
import { nodeService } from "../services/nodeService.ts";

@Security(OIDC_AUTH, [MEMBER_SCOPE])
@Security(BEARER_AUTH, [MEMBER_SCOPE])
@Middlewares(requireSocketId)
@Route("nodes")
export class NodeController {
  @Post("/:nodeId")
  public async createNode(
    @Request() req: ExpressRequest,
    @Body() body: { floorCode: string; nodeInfo: NodeInfo },
  ) {
    const { floorCode, nodeInfo } = body;
    const { nodeId, socketId } = req.params;

    // create node in database
    const placement = await floorService.getFloorPlacement(floorCode);
    await nodeService.upsertNode(floorCode, nodeId, nodeInfo, placement);

    // create edges to neighbors if they don't already exist
    await edgeService.createEdges(nodeId, Object.keys(nodeInfo.neighbors));

    // broadcast to all users on the floor
    const payload = { nodeId, nodeInfo };
    webSocketService.broadcastToUserFloor(socketId, "create-node", payload);

    return null;
  }

  @Delete("/:nodeId")
  public async deleteNode(@Request() req: ExpressRequest) {
    const { nodeId, socketId } = req.params;
    await edgeService.deleteEdges(nodeId);
    await nodeService.deleteNode(nodeId);
    webSocketService.broadcastToUserFloor(socketId, "delete-node", { nodeId });
    return null;
  }

  @Put("/:nodeId")
  public async updateNode(
    @Request() req: ExpressRequest,
    @Body() body: { nodeInfo: NodeInfo; floorCode: string },
  ) {
    const { nodeInfo, floorCode } = body;
    const { nodeId, socketId } = req.params;

    const placement = await floorService.getFloorPlacement(floorCode);
    await nodeService.upsertNode(floorCode, nodeId, nodeInfo, placement);
    const payload = { nodeId, nodeInfo };
    webSocketService.broadcastToUserFloor(socketId, "update-node", payload);
    return null;
  }
}
