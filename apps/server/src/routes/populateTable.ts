import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { populateTableService } from "../services/populateTableService.ts";

// bulk ingestion payloads are deliberately untyped
const bulkRoute = { auth: "admin", body: t.Unknown() } as const;

export const populateTableRoutes = new Elysia({ prefix: "/populate-table" })
  .use(authPlugin)

  .post(
    "/building",
    async ({ body }) => {
      await populateTableService.populateBuildings(body);
      return { message: "Buildings populated" };
    },
    bulkRoute,
  )

  .post(
    "/floor",
    async ({ body }) => {
      await populateTableService.populateFloors(body);
      return { message: "Floors populated" };
    },
    bulkRoute,
  )

  .post(
    "/room",
    async ({ body }) => {
      await populateTableService.populateRooms(body);
      return { message: "Rooms populated" };
    },
    bulkRoute,
  )

  .post(
    "/alias",
    async ({ body }) => {
      await populateTableService.populateAlias(body);
      return { message: "Alias populated" };
    },
    bulkRoute,
  )

  .post(
    "/node",
    async ({ body }) => {
      await populateTableService.populateNodes(body);
      return { message: "Nodes populated" };
    },
    bulkRoute,
  )

  .post(
    "/edge",
    async ({ body }) => {
      await populateTableService.populateEdges(body);
      return { message: "Edges populated" };
    },
    bulkRoute,
  )

  .post(
    "/poi",
    async ({ body }) => {
      await populateTableService.populatePois(body);
      return { message: "POIs populated" };
    },
    bulkRoute,
  );
