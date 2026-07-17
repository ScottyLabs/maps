import type { PreciseRoute } from "../../../../packages/common/src/index.ts";
import { Get, Query, Route, Security } from "tsoa";
import { BEARER_AUTH, OIDC_AUTH } from "../lib/authentication.ts";
import { pathService } from "../services/pathService.ts";

@Route("/path")
export class PathController {
  @Get("/")
  @Security(OIDC_AUTH, [])
  @Security(BEARER_AUTH, [])
  public path(
    @Query() start: string,
    @Query() end: string,
  ): Promise<Record<string, PreciseRoute>> {
    return pathService.calculatePath(start, end);
  }

  @Get("/public")
  public async publicPath(
    @Query() start: string,
    @Query() end: string,
  ): Promise<Record<string, PreciseRoute>> {
    return await pathService.calculatePublicPath(start, end);
  }
}
