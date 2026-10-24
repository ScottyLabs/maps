import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { requestRuntime } from "../src/lib/mapRuntime.ts";

export const controlPrisma = new PrismaClient();
export const storedPreview = process.env.PIPELINE_ROOT
  ? await controlPrisma.previewSelection.findUnique({ where: { id: "active" } })
  : null;

export function databaseUrlForSchema(schema: string): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required");
  const url = new URL(value);
  url.searchParams.set("schema", schema);
  return url.toString();
}

let activeDatabase = storedPreview
  ? new PrismaClient({
      datasourceUrl: databaseUrlForSchema(storedPreview.schemaName),
    })
  : controlPrisma;

/** Activation happens only after the candidate database and caches are ready. */
export function activateDatabase(candidate: PrismaClient) {
  const previous = activeDatabase;
  activeDatabase = candidate;
  return previous;
}

export const getActiveDatabase = () => activeDatabase;

// Preserve existing service imports while pinning database access per request.
export const prisma: PrismaClient = new Proxy(controlPrisma, {
  get(_target, property) {
    const database = requestRuntime()?.database ?? activeDatabase;
    const value = Reflect.get(database, property);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
