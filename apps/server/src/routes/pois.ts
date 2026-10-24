import { PoiTypes } from "../../../../packages/common/src/index.ts";
import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { poiService } from "../services/poiService.ts";
import { webSocketService } from "../services/webSocketService.ts";
import { requireSocketId } from "./socketId.ts";

const poiIdParams = t.Object({ poiId: t.String() });

const poiTypeSchema = t.UnionEnum(PoiTypes);

const poiInfoSchema = t.Object({
  type: poiTypeSchema,
  latitude: t.Number(),
  longitude: t.Number(),
  buildingCode: t.Optional(t.Nullable(t.String())),
  floorLevel: t.Optional(t.Nullable(t.String())),
});

export const poisRoutes = new Elysia({ prefix: "/pois" })
  .use(authPlugin)
  .use(requireSocketId)

  .post(
    "/:poiId",
    async ({ params, body, socketId }) => {
      const { poiId } = params;
      const { poiInfo } = body;

      await poiService.createPoi(poiId, poiInfo);
      webSocketService.broadcastToUserFloor(socketId, "create-poi", {
        poiId,
        poiInfo,
      });
      return null;
    },
    {
      auth: "member",
      params: poiIdParams,
      body: t.Object({ poiInfo: poiInfoSchema }),
    },
  )

  .delete(
    "/:poiId",
    async ({ params, socketId }) => {
      const { poiId } = params;
      await poiService.deletePoi(poiId);
      webSocketService.broadcastToUserFloor(socketId, "delete-poi", { poiId });
      return null;
    },
    { auth: "member", params: poiIdParams },
  )

  .put(
    "/:poiId/type",
    async ({ params, body, socketId }) => {
      const { poiId } = params;
      const { poiType } = body;

      await poiService.updatePoiType(poiId, poiType);
      webSocketService.broadcastToUserFloor(socketId, "update-poi", {
        poiId,
        poiType,
      });
      return null;
    },
    {
      auth: "member",
      params: poiIdParams,
      body: t.Object({ poiType: poiTypeSchema }),
    },
  );
