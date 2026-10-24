import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/index.ts";

type BuildingRow = Omit<Prisma.BuildingCreateManyInput, "shape" | "hitbox"> & {
  shape: string;
  hitbox: string;
};
type RoomRow = Omit<Prisma.RoomCreateManyInput, "polygon"> & {
  polygon: string;
};
export interface PopulationTables {
  Building: BuildingRow[];
  Floor: Prisma.FloorCreateManyInput[];
  Room: RoomRow[];
  Alias: Prisma.AliasCreateManyInput[];
  Node: Prisma.NodeCreateManyInput[];
  Edge: Prisma.EdgeCreateManyInput[];
  Poi: Prisma.PoiCreateManyInput[];
}

type Writer = Prisma.TransactionClient;

// The existing HTTP importer and isolated preview staging use the same row writers.
export const populateTableService = {
  populateBuildings: async (data: BuildingRow[], database: Writer = prisma) => {
    await database.building.createMany({
      data: data.map((building) => {
        const hitbox = JSON.parse(building.hitbox);
        return {
          ...building,
          shape: JSON.parse(building.shape),
          hitbox: hitbox === null ? Prisma.DbNull : hitbox,
        };
      }),
    });
  },
  populateFloors: async (
    data: PopulationTables["Floor"],
    database: Writer = prisma,
  ) => {
    await database.floor.createMany({ data });
  },
  populateRooms: async (data: RoomRow[], database: Writer = prisma) => {
    await database.room.createMany({
      data: data.map((room) => ({
        ...room,
        polygon: JSON.parse(room.polygon),
      })),
    });
  },
  populateAlias: async (
    data: PopulationTables["Alias"],
    database: Writer = prisma,
  ) => {
    await database.alias.createMany({ data });
  },
  populateNodes: async (
    data: PopulationTables["Node"],
    database: Writer = prisma,
  ) => {
    await database.node.createMany({ data });
  },
  populateEdges: async (
    data: PopulationTables["Edge"],
    database: Writer = prisma,
  ) => {
    await database.edge.createMany({ data });
  },
  populatePois: async (
    data: PopulationTables["Poi"],
    database: Writer = prisma,
  ) => {
    await database.poi.createMany({ data, skipDuplicates: true });
  },
};
