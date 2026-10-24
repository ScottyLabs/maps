import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/middleware.ts";
import { pathService } from "../services/pathService.ts";

const waypointQuery = t.Object({ start: t.String(), end: t.String() });

export const pathRoutes = new Elysia({ prefix: "/path" })
  .use(authPlugin)

  .get("", ({ query }) => pathService.calculatePath(query.start, query.end), {
    auth: "user",
    query: waypointQuery,
  })

  .get("/public", ({ query }) => pathService.calculatePublicPath(query.start, query.end), {
    query: waypointQuery,
  });
