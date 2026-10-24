import { Elysia, t } from "elysia";
import { searchService } from "../services/searchService.ts";

export const searchRoutes = new Elysia({ prefix: "/search" }).get(
  "",
  ({ query }) => searchService.search(query.query, query.n, query.lat, query.lon),
  {
    query: t.Object({
      query: t.String(),
      n: t.Optional(t.Numeric()),
      lat: t.Optional(t.Numeric()),
      lon: t.Optional(t.Numeric()),
    }),
  },
);
