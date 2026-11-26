import { Elysia } from "elysia";
import { buildingsRoutes } from "./buildings.ts";
import { dropTablesRoutes } from "./dropTables.ts";
import { edgesRoutes } from "./edges.ts";
import { floorsRoutes } from "./floors.ts";
import { nodesRoutes } from "./nodes.ts";
import { pathRoutes } from "./path.ts";
import { poisRoutes } from "./pois.ts";
import { populateTableRoutes } from "./populateTable.ts";
import { roomsRoutes } from "./rooms.ts";
import { searchRoutes } from "./search.ts";

export const apiRoutes = new Elysia()
  .use(buildingsRoutes)
  .use(dropTablesRoutes)
  .use(edgesRoutes)
  .use(floorsRoutes)
  .use(nodesRoutes)
  .use(pathRoutes)
  .use(poisRoutes)
  .use(populateTableRoutes)
  .use(roomsRoutes)
  .use(searchRoutes);
