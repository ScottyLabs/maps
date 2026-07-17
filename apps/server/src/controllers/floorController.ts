import type { Placement } from "../../../../packages/common/src/index.ts";
import { Body, Get, Path, Put, Route, Security } from "tsoa";
import { BEARER_AUTH, MEMBER_SCOPE, OIDC_AUTH } from "../lib/authentication.ts";
import { floorService } from "../services/floorService.ts";

@Security(OIDC_AUTH, [])
@Security(BEARER_AUTH, [])
@Route("floors")
export class FloorController {
  @Get("/:floorCode/floorplan")
  public async getFloorplan(@Path() floorCode: string) {
    return await floorService.getFloorplan(floorCode);
  }

  @Get("/:floorCode/rooms")
  public async getFloorRooms(@Path() floorCode: string) {
    const rooms = await floorService.getFloorRooms(floorCode);
    return rooms;
  }

  @Get("/:floorCode/graph")
  public async getFloorGraph(@Path() floorCode: string) {
    const placement = await floorService.getFloorPlacement(floorCode);
    const graph = await floorService.getFloorGraph(floorCode, placement);
    return graph;
  }

  @Get("/:floorCode/geonodes")
  public async getFloorNodes(@Path() floorCode: string) {
    return await floorService.getFloorNodes(floorCode);
  }

  @Get("/:floorCode/pois")
  public async getFloorPois(@Path() floorCode: string) {
    return await floorService.getFloorPois(floorCode);
  }

  @Get("/:floorCode/placement")
  public async getFloorPlacement(@Path() floorCode: string) {
    return await floorService.getFloorPlacement(floorCode);
  }

  @Security(OIDC_AUTH, [MEMBER_SCOPE])
  @Security(BEARER_AUTH, [MEMBER_SCOPE])
  @Put("/:floorCode/placement")
  public async updateFloorPlacement(
    @Path() floorCode: string,
    @Body() body: { placement: Placement },
  ) {
    return await floorService.updateFloorPlacement(floorCode, body.placement);
  }
}
