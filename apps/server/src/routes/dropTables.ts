import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { dropTablesService } from "../services/dropTablesService.ts";

export const dropTablesRoutes = new Elysia({ prefix: "/drop-tables" }).use(authPlugin).delete(
  "",
  async ({ body }) => {
    const { tableNames } = body;
    await dropTablesService.dropTables(tableNames);
    return { message: `Tables dropped: ${tableNames.join(", ")}` };
  },
  { auth: "admin", body: t.Object({ tableNames: t.Array(t.String()) }) },
);
