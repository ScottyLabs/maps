import { extractBuildingCode, extractFloorLevel } from "../../../../packages/common/src/index.ts";
import type { Request as ExpressRequest } from "express";
import {
  Body,
  Delete,
  Middlewares,
  Post,
  Request,
  Route,
  Security,
} from "tsoa";
import { BEARER_AUTH, MEMBER_SCOPE, OIDC_AUTH } from "../lib/authentication.ts";
import { requireSocketId } from "../middleware/socketAuth.ts";
import { webSocketService } from "../server.ts";
import { edgeService } from "../services/edgeService.ts";
import { nodeService } from "../services/nodeService.ts";

@Security(OIDC_AUTH, [MEMBER_SCOPE])
@Security(BEARER_AUTH, [MEMBER_SCOPE])
@Middlewares(requireSocketId)
@Route("edge")
export class EdgeController {
  @Post("/")
  public async createEdge(
    @Request() req: ExpressRequest,
    @Body() body: { inNodeId: string; outNodeId: string },
  ) {
    const { inNodeId, outNodeId } = body;
    const { socketId } = req;

    // create edge in database
    await edgeService.createEdge(inNodeId, outNodeId);

    // broadcast to all users on the floor
    const payload = { inNodeId, outNodeId };
    webSocketService.broadcastToUserFloor(socketId, "create-edge", payload);

    return null;
  }

  @Delete("/")
  public async deleteEdge(
    @Request() req: ExpressRequest,
    @Body() body: { inNodeId: string; outNodeId: string },
  ) {
    const { inNodeId, outNodeId } = body;
    const { socketId } = req;

    await edgeService.deleteEdge(inNodeId, outNodeId);
    const payload = { inNodeId, outNodeId };
    webSocketService.broadcastToUserFloor(socketId, "delete-edge", payload);
    return null;
  }

  @Post("/across-floors")
  public async createEdgeAcrossFloors(
    @Request() req: ExpressRequest,
    @Body() body: {
      floorCode: string;
      outFloorCode: string;
      inNodeId: string;
      outNodeId: string;
    },
  ) {
    const { floorCode, outFloorCode, inNodeId, outNodeId } = body;
    const { socketId } = req;

    // validate that the out node is on the out floor
    const outNode = await nodeService.getNode(outNodeId);

    // outside edge cases
    const errorMessage = "Out node is not on the out floor";
    if (outFloorCode === "outside") {
      if (outNode.buildingCode !== null || outNode.floorLevel !== null) {
        throw new Error(errorMessage);
      }
    } else if (
      outNode.buildingCode !== extractBuildingCode(outFloorCode) ||
      outNode.floorLevel !== extractFloorLevel(outFloorCode)
    ) {
      throw new Error(errorMessage);
    }

    await edgeService.createEdge(inNodeId, outNodeId);
    const payload = { outFloorCode, inNodeId, outNodeId };
    webSocketService.broadcastToUserFloor(
      socketId,
      "create-edge-across-floors",
      payload,
    );

    const inPayload = {
      outFloorCode: floorCode,
      inNodeId: outNodeId,
      outNodeId: inNodeId,
    };
    webSocketService.broadcastToFloor(
      outFloorCode,
      "create-edge-across-floors",
      inPayload,
    );
    return null;
  }

  @Delete("/across-floors")
  public async deleteEdgeAcrossFloors(
    @Request() req: ExpressRequest,
    @Body() body: {
      floorCode: string;
      outFloorCode: string;
      inNodeId: string;
      outNodeId: string;
    },
  ) {
    const { floorCode, outFloorCode, inNodeId, outNodeId } = body;
    const { socketId } = req;

    await edgeService.deleteEdge(inNodeId, outNodeId);
    const payload = { outFloorCode, inNodeId, outNodeId };
    webSocketService.broadcastToUserFloor(
      socketId,
      "delete-edge-across-floors",
      payload,
    );

    const inPayload = {
      outFloorCode: floorCode,
      inNodeId: outNodeId,
      outNodeId: inNodeId,
    };
    webSocketService.broadcastToFloor(
      outFloorCode,
      "delete-edge-across-floors",
      inPayload,
    );
    return null;
  }
}
