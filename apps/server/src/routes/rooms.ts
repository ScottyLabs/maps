import { RoomTypes } from "../../../../packages/common/src/index.ts";
import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { floorService } from "../services/floorService.ts";
import { roomService } from "../services/roomService.ts";
import { webSocketService } from "../services/webSocketService.ts";
import { requireSocketId } from "./socketId.ts";

const roomIdParams = t.Object({ roomId: t.String() });

const roomInfoSchema = t.Object({
  name: t.String(),
  labelPosition: t.Object({ x: t.Number(), y: t.Number() }),
  type: t.UnionEnum(RoomTypes),
  displayAlias: t.Optional(t.String()),
  aliases: t.Array(t.String()),
  polygon: t.Object({
    type: t.Literal("Polygon"),
    coordinates: t.Array(t.Array(t.Array(t.Number()))),
  }),
});

export const roomsRoutes = new Elysia({ prefix: "/rooms" })
  .use(authPlugin)
  .use(requireSocketId)

  .post(
    "/:roomId",
    async ({ params, body, socketId }) => {
      const { roomId } = params;
      const { floorCode, roomNodes, roomInfo } = body;

      const placement = await floorService.getFloorPlacement(floorCode);
      await roomService.createRoom(floorCode, roomId, roomNodes, roomInfo, placement);
      webSocketService.broadcastToUserFloor(socketId, "create-room", {
        roomId,
        roomNodes,
        roomInfo,
      });
      return null;
    },
    {
      auth: "member",
      params: roomIdParams,
      body: t.Object({
        floorCode: t.String(),
        roomNodes: t.Array(t.String()),
        roomInfo: roomInfoSchema,
      }),
    },
  )

  .delete(
    "/:roomId",
    async ({ params, socketId }) => {
      const { roomId } = params;
      await roomService.deleteRoom(roomId);
      webSocketService.broadcastToUserFloor(socketId, "delete-room", {
        roomId,
      });
      return null;
    },
    { auth: "member", params: roomIdParams },
  )

  .patch(
    "/:roomId",
    async ({ params, body, socketId }) => {
      const { roomId } = params;
      const { floorCode, roomInfo } = body;

      const placement = await floorService.getFloorPlacement(floorCode);
      await roomService.updateRoom(roomId, roomInfo, placement);
      webSocketService.broadcastToUserFloor(socketId, "update-room", {
        roomId,
        roomInfo,
      });
      return null;
    },
    {
      auth: "member",
      params: roomIdParams,
      body: t.Object({
        floorCode: t.String(),
        roomInfo: t.Partial(roomInfoSchema),
      }),
    },
  );
