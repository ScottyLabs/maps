import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { floorService } from "../services/floorService.ts";

const floorCodeParams = t.Object({ floorCode: t.String() });

const placementSchema = t.Object({
  geoCenter: t.Object({ latitude: t.Number(), longitude: t.Number() }),
  pdfCenter: t.Object({ x: t.Number(), y: t.Number() }),
  scale: t.Number(),
  angle: t.Number(),
});

export const floorsRoutes = new Elysia({ prefix: "/floors" })
  .use(authPlugin)

  .get(
    "/:floorCode/floorplan",
    ({ params, user, status }) => {
      if (!user && !params.floorCode.startsWith("CUC")) {
        return status(401, { error: "Unauthorized" });
      }
      return floorService.getFloorplan(params.floorCode);
    },
    { optionalAuth: true, params: floorCodeParams },
  )

  .get("/:floorCode/rooms", ({ params }) => floorService.getFloorRooms(params.floorCode), {
    auth: "user",
    params: floorCodeParams,
  })

  .get(
    "/:floorCode/graph",
    async ({ params }) => {
      const placement = await floorService.getFloorPlacement(params.floorCode);
      return await floorService.getFloorGraph(params.floorCode, placement);
    },
    { auth: "user", params: floorCodeParams },
  )

  .get("/:floorCode/geonodes", ({ params }) => floorService.getFloorNodes(params.floorCode), {
    auth: "user",
    params: floorCodeParams,
  })

  .get("/:floorCode/pois", ({ params }) => floorService.getFloorPois(params.floorCode), {
    auth: "user",
    params: floorCodeParams,
  })

  .get("/:floorCode/placement", ({ params }) => floorService.getFloorPlacement(params.floorCode), {
    auth: "user",
    params: floorCodeParams,
  })

  .put(
    "/:floorCode/placement",
    ({ params, body }) => floorService.updateFloorPlacement(params.floorCode, body.placement),
    {
      auth: "member",
      params: floorCodeParams,
      body: t.Object({ placement: placementSchema }),
    },
  );
