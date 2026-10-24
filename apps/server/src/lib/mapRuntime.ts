/** Requests retain one prepared dataset even if a newer preview activates. */
import { AsyncLocalStorage } from "node:async_hooks";
import type { GeoNodes } from "@cmumaps/common";
import type { PrismaClient } from "@prisma/client";
import type { SearchContext } from "../services/searchService.ts";

interface MapRuntime {
  database: PrismaClient;
  graph: GeoNodes;
  search: SearchContext;
}
const requests = new AsyncLocalStorage<MapRuntime>();
export const requestRuntime = () => requests.getStore();
export const withMapRuntime = (runtime: MapRuntime, action: () => void) =>
  requests.run(runtime, action);
