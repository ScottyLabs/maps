import { extractBuildingCode, extractFloorLevel } from "../../../../packages/common/src/index.ts";
import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { edgeService } from "../services/edgeService.ts";
import { nodeService } from "../services/nodeService.ts";
import { webSocketService } from "../services/webSocketService.ts";
import { requireSocketId } from "./socketId.ts";

const edgeBody = t.Object({ inNodeId: t.String(), outNodeId: t.String() });

const acrossFloorsBody = t.Object({
  floorCode: t.String(),
  outFloorCode: t.String(),
  inNodeId: t.String(),
  outNodeId: t.String(),
});

export const edgesRoutes = new Elysia({ prefix: "/edge" })
  .use(authPlugin)
  .use(requireSocketId)

  .post(
    "",
    async ({ body, socketId }) => {
      const { inNodeId, outNodeId } = body;
      await edgeService.createEdge(inNodeId, outNodeId);
      webSocketService.broadcastToUserFloor(socketId, "create-edge", {
        inNodeId,
        outNodeId,
      });
      return null;
    },
    { auth: "member", body: edgeBody },
  )

  .delete(
    "",
    async ({ body, socketId }) => {
      const { inNodeId, outNodeId } = body;
      await edgeService.deleteEdge(inNodeId, outNodeId);
      webSocketService.broadcastToUserFloor(socketId, "delete-edge", {
        inNodeId,
        outNodeId,
      });
      return null;
    },
    { auth: "member", body: edgeBody },
  )

  .post(
    "/across-floors",
    async ({ body, socketId, status }) => {
      const { floorCode, outFloorCode, inNodeId, outNodeId } = body;

      const outNode = await nodeService.getNode(outNodeId);
      const onOutFloor =
        outFloorCode === "outside"
          ? outNode.buildingCode === null && outNode.floorLevel === null
          : outNode.buildingCode === extractBuildingCode(outFloorCode) &&
            outNode.floorLevel === extractFloorLevel(outFloorCode);
      if (!onOutFloor) {
        return status(400, { error: "Out node is not on the out floor" });
      }

      await edgeService.createEdge(inNodeId, outNodeId);
      webSocketService.broadcastToUserFloor(socketId, "create-edge-across-floors", {
        outFloorCode,
        inNodeId,
        outNodeId,
      });
      webSocketService.broadcastToFloor(outFloorCode, "create-edge-across-floors", {
        outFloorCode: floorCode,
        inNodeId: outNodeId,
        outNodeId: inNodeId,
      });
      return null;
    },
    { auth: "member", body: acrossFloorsBody },
  )

  .delete(
    "/across-floors",
    async ({ body, socketId }) => {
      const { floorCode, outFloorCode, inNodeId, outNodeId } = body;

      await edgeService.deleteEdge(inNodeId, outNodeId);
      webSocketService.broadcastToUserFloor(socketId, "delete-edge-across-floors", {
        outFloorCode,
        inNodeId,
        outNodeId,
      });
      webSocketService.broadcastToFloor(outFloorCode, "delete-edge-across-floors", {
        outFloorCode: floorCode,
        inNodeId: outNodeId,
        outNodeId: inNodeId,
      });
      return null;
    },
    { auth: "member", body: acrossFloorsBody },
  );
