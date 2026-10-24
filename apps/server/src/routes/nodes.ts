import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { edgeService } from "../services/edgeService.ts";
import { floorService } from "../services/floorService.ts";
import { nodeService } from "../services/nodeService.ts";
import { webSocketService } from "../services/webSocketService.ts";
import { requireSocketId } from "./socketId.ts";

const nodeIdParams = t.Object({ nodeId: t.String() });

const nodeInfoSchema = t.Object({
  pos: t.Object({ x: t.Number(), y: t.Number() }),
  neighbors: t.Record(
    t.String(),
    t.Object({
      outFloorCode: t.Optional(t.String()),
      dist: t.Optional(t.Number()),
    }),
  ),
  roomId: t.Nullable(t.String()),
});

export const nodesRoutes = new Elysia({ prefix: "/nodes" })
  .use(authPlugin)
  .use(requireSocketId)

  .post(
    "/:nodeId",
    async ({ params, body, socketId }) => {
      const { nodeId } = params;
      const { floorCode, nodeInfo } = body;

      const placement = await floorService.getFloorPlacement(floorCode);
      await nodeService.upsertNode(floorCode, nodeId, nodeInfo, placement);
      await edgeService.createEdges(nodeId, Object.keys(nodeInfo.neighbors));

      webSocketService.broadcastToUserFloor(socketId, "create-node", {
        nodeId,
        nodeInfo,
      });
      return null;
    },
    {
      auth: "member",
      params: nodeIdParams,
      body: t.Object({ floorCode: t.String(), nodeInfo: nodeInfoSchema }),
    },
  )

  .delete(
    "/:nodeId",
    async ({ params, socketId }) => {
      const { nodeId } = params;
      await edgeService.deleteEdges(nodeId);
      await nodeService.deleteNode(nodeId);
      webSocketService.broadcastToUserFloor(socketId, "delete-node", {
        nodeId,
      });
      return null;
    },
    { auth: "member", params: nodeIdParams },
  )

  .put(
    "/:nodeId",
    async ({ params, body, socketId }) => {
      const { nodeId } = params;
      const { floorCode, nodeInfo } = body;

      const placement = await floorService.getFloorPlacement(floorCode);
      await nodeService.upsertNode(floorCode, nodeId, nodeInfo, placement);
      webSocketService.broadcastToUserFloor(socketId, "update-node", {
        nodeId,
        nodeInfo,
      });
      return null;
    },
    {
      auth: "member",
      params: nodeIdParams,
      body: t.Object({ nodeInfo: nodeInfoSchema, floorCode: t.String() }),
    },
  );
