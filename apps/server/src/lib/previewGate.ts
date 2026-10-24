import type { NextFunction, Request, Response } from "express";
import { activeGraph } from "../services/pathService.ts";
import { activeSearchContext } from "../services/searchService.ts";
import { withMapRuntime } from "./mapRuntime.ts";
import { getActiveDatabase } from "../../prisma/index.ts";

export interface PreviewInfo {
  workspace: string;
  revision: string;
  warnings: unknown;
  counts: unknown;
  appUrl: string;
}

let current: PreviewInfo | null = null;
let activeRequests = 0;
let switching = false;
let releaseReaders: (() => void) | undefined;
let drained: (() => void) | undefined;
let readersReady = Promise.resolve();

export function activePreview() {
  return current;
}
export function setPreview(info: PreviewInfo | null) {
  current = info;
}

export async function switchPreview(action: () => Promise<void>) {
  if (switching) throw new Error("Another preview is being activated");
  switching = true;
  readersReady = new Promise((resolve) => {
    releaseReaders = resolve;
  });
  try {
    if (activeRequests)
      await new Promise<void>((resolve) => {
        drained = resolve;
      });
    await action();
  } finally {
    switching = false;
    releaseReaders?.();
    drained = undefined;
  }
}

/** Keep a request on one dataset; callers with old state get an explicit reload. */
export async function previewGate(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (switching) await readersReady;
  const revision = request.header("X-Maps-Revision") ?? "baseline";
  const expected = current?.revision ?? "baseline";
  const emptyAuthorizationProbe =
    request.path === "/populate-table/building" &&
    Array.isArray(request.body) &&
    request.body.length === 0;
  if (revision !== expected && !emptyAuthorizationProbe) {
    response.status(409).json({ code: "PREVIEW_CHANGED", preview: current });
    return;
  }
  if (
    current &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !emptyAuthorizationProbe
  ) {
    response.status(409).json({
      message:
        "Edit the working JSON, then explicitly rebuild/load this preview.",
    });
    return;
  }
  activeRequests++;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    activeRequests--;
    if (activeRequests === 0) drained?.();
  };
  response.once("finish", finish);
  response.once("close", finish);
  withMapRuntime(
    {
      database: getActiveDatabase(),
      graph: activeGraph(),
      search: activeSearchContext(),
    },
    next,
  );
}
