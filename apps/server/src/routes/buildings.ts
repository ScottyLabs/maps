import { Elysia, t } from "elysia";
import { BuildingError } from "../errors/error.ts";
import { buildingService } from "../services/buildingService.ts";

const buildingCodeParams = t.Object({ buildingCode: t.String() });

export const buildingsRoutes = new Elysia({ prefix: "/buildings" })
  .get("", () => buildingService.getBuildings())

  .get("/metadata", () => buildingService.getBuildingsMetadata())

  .get(
    "/:buildingCode",
    async ({ params, status }) => {
      try {
        return await buildingService.getBuilding(params.buildingCode);
      } catch (error) {
        if (error instanceof BuildingError) {
          return status(404, { code: error.code });
        }
        throw error;
      }
    },
    { params: buildingCodeParams },
  )

  .get(
    "/:buildingCode/name",
    ({ params }) => buildingService.getBuildingName(params.buildingCode),
    { params: buildingCodeParams },
  )

  .get(
    "/:buildingCode/default-floor",
    async ({ params, status }) => {
      try {
        return await buildingService.getDefaultFloor(params.buildingCode);
      } catch (error) {
        if (error instanceof BuildingError) {
          return status(404, { code: error.code });
        }
        throw error;
      }
    },
    { params: buildingCodeParams },
  )

  .get(
    "/:buildingCode/floors",
    ({ params }) => buildingService.getBuildingFloors(params.buildingCode),
    { params: buildingCodeParams },
  );
