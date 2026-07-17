import type { NodeInfo, Placement } from "../../../../packages/common/src/index.ts";
import {
  extractBuildingCode,
  extractFloorLevel,
  pdfCoordsToGeoCoords,
} from "../../../../packages/common/src/index.ts";
import { prisma } from "../../prisma/index.ts";

export const nodeService = {
  getNode: async (nodeId: string) =>
    await prisma.node.findUniqueOrThrow({
      where: { nodeId },
    }),

  upsertNode: async (
    floorCode: string,
    nodeId: string,
    nodeInfo: NodeInfo,
    placement: Placement,
  ) => {
    const { pos, roomId } = nodeInfo;
    const geoCoords = pdfCoordsToGeoCoords(placement)(pos);

    const buildingCode = extractBuildingCode(floorCode);
    const floorLevel = extractFloorLevel(floorCode);

    const data = {
      ...geoCoords,
      buildingCode,
      floorLevel,
      ...(roomId ? { roomId } : {}),
    };

    await prisma.node.upsert({
      where: { nodeId },
      create: {
        nodeId,
        ...data,
      },
      update: data,
    });
  },

  deleteNode: async (nodeId: string) => {
    await prisma.node.delete({ where: { nodeId } });
  },
};
