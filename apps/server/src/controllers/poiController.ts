import type { PoiInfo, PoiType } from "../../../../packages/common/src/index.ts";
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
import { poiService } from "../services/poiService.ts";

@Security(OIDC_AUTH, [MEMBER_SCOPE])
@Security(BEARER_AUTH, [MEMBER_SCOPE])
@Middlewares(requireSocketId)
@Route("pois")
export class PoiController {
  @Post("/:poiId")
  public async createPoi(
    @Request() req: ExpressRequest,
    @Body() body: { poiInfo: PoiInfo },
  ) {
    const { poiId, socketId } = req.params;
    const { poiInfo } = body;

    await poiService.createPoi(poiId, poiInfo);
    const payload = { poiId, poiInfo };
    webSocketService.broadcastToUserFloor(socketId, "create-poi", payload);
    return null;
  }

  @Delete("/:poiId")
  public async deletePoi(@Request() req: ExpressRequest) {
    const { poiId, socketId } = req.params;
    await poiService.deletePoi(poiId);
    const payload = { poiId };
    webSocketService.broadcastToUserFloor(socketId, "delete-poi", payload);
    return null;
  }

  @Put("/:poiId/type")
  public async updatePoiType(
    @Request() req: ExpressRequest,
    @Body() body: { poiType: PoiType },
  ) {
    const { poiId, socketId } = req.params;
    const { poiType } = body;

    await poiService.updatePoiType(poiId, poiType);
    const payload = { poiId, poiType };
    webSocketService.broadcastToUserFloor(socketId, "update-poi", payload);
    return null;
  }
}
