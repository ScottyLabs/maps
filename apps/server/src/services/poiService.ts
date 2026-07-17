import type { PoiInfo, PoiType } from "../../../../packages/common/src/index.ts";

import { prisma } from "../../prisma/index.ts";

export const poiService = {
  createPoi: async (poiId: string, poiInfo: PoiInfo) => {
    await prisma.poi.create({
      data: {
        poiId,
        type: poiInfo.type,
        latitude: poiInfo.latitude,
        longitude: poiInfo.longitude,
        buildingCode: poiInfo.buildingCode ?? null,
        floorLevel: poiInfo.floorLevel ?? null,
      },
    });
  },

  deletePoi: async (poiId: string) => {
    await prisma.poi.delete({
      where: { poiId },
    });
  },

  updatePoiType: async (poiId: string, poiType: PoiType) => {
    await prisma.poi.update({
      where: { poiId },
      data: { type: poiType },
    });
  },
};
