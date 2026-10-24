/** Stage native candidates separately; only a ready database/cache set activates. */
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import {
  activateDatabase,
  controlPrisma,
  databaseUrlForSchema,
  prisma,
  storedPreview,
} from "../../prisma/index.ts";
import { env } from "../env.ts";
import { HttpError } from "../middleware/errorHandler.ts";
import {
  activePreview,
  setPreview,
  switchPreview,
  type PreviewInfo,
} from "../lib/previewGate.ts";
import { repositoryRoot, runPipeline } from "../lib/runPipeline.ts";
import { activateGraph, prepareGraph } from "./pathService.ts";
import {
  populateTableService,
  type PopulationTables,
} from "./populateTableService.ts";
import {
  activateSearchContext,
  prepareSearchContext,
} from "./searchService.ts";

interface CandidatePayload {
  report: {
    revision: string;
    working_revision: string;
    counts: Record<string, number>;
    warnings: string[];
  };
  tables: PopulationTables;
}
let loading = false;

function previewInfo(
  workspace: string,
  revision: string,
  warnings: unknown,
  counts: unknown,
  building: string,
): PreviewInfo {
  const appUrl = new URL(env.BETTER_AUTH_URL);
  appUrl.pathname = `/${encodeURIComponent(building)}`;
  appUrl.search = new URLSearchParams({ workspace, revision }).toString();
  appUrl.hash = "";
  return { workspace, revision, warnings, counts, appUrl: appUrl.toString() };
}

export async function initializePreview() {
  const [graph, search] = await Promise.all([
    prepareGraph(prisma),
    prepareSearchContext(prisma),
  ]);
  activateGraph(graph);
  activateSearchContext(search);
  if (storedPreview) {
    const building = await prisma.building.findFirst({
      orderBy: { buildingCode: "asc" },
    });
    if (!building) throw new Error("Selected preview has no building metadata");
    setPreview(
      previewInfo(
        storedPreview.workspace,
        storedPreview.revision,
        storedPreview.warnings,
        storedPreview.counts,
        building.buildingCode,
      ),
    );
  }
}

function requireNativeDatabase() {
  const runtime = process.env.DEVENV_RUNTIME;
  if (!runtime || !process.env.PIPELINE_ROOT)
    throw new HttpError(404, "Native preview loading is disabled");
  const url = new URL(env.DATABASE_URL);
  if (
    url.searchParams.get("host") !== path.join(runtime, "postgres") ||
    url.pathname !== "/maps"
  ) {
    throw new HttpError(
      422,
      "Preview writes require the private Maps devenv database",
    );
  }
}

async function prepareSchema(schemaName: string) {
  const child = Bun.spawn(
    ["bun", "x", "prisma", "db", "push", "--skip-generate"],
    {
      cwd: path.join(repositoryRoot, "apps/server"),
      env: { ...process.env, DATABASE_URL: databaseUrlForSchema(schemaName) },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (status !== 0) {
    console.error("Candidate schema failed:", stdout, stderr);
    throw new HttpError(
      422,
      "Candidate schema could not be prepared; the active preview is unchanged",
    );
  }
}

async function authorizePopulationClient() {
  const issuer = env.AUTH_ISSUER.replace(/\/$/u, "");
  const token = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.AUTH_CLIENT_ID,
      client_secret: env.AUTH_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!token.ok)
    throw new HttpError(
      403,
      "Keycloak rejected the population client credentials",
    );
  const response = await token.json();
  if (typeof response.access_token !== "string")
    throw new HttpError(403, "Keycloak returned no population access token");
  // Reuse the existing API's signature/issuer/group validation without adding rows.
  const probe = await fetch(`${env.SERVER_URL}/populate-table/building`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${response.access_token}`,
      "Content-Type": "application/json",
    },
    body: "[]",
    signal: AbortSignal.timeout(10000),
  });
  if (!probe.ok)
    throw new HttpError(
      403,
      "The population client needs /projects/maps/admins in its Keycloak groups claim",
    );
}

export async function loadPreview(
  workspace: string,
  revision: string,
): Promise<PreviewInfo> {
  requireNativeDatabase();
  if (
    typeof workspace !== "string" ||
    typeof revision !== "string" ||
    !/^[a-f0-9]{64}$/u.test(revision)
  ) {
    throw new HttpError(422, "Choose a generated workspace revision");
  }
  if (loading) throw new HttpError(409, "Another candidate is being loaded");
  loading = true;
  let candidate: PrismaClient | undefined;
  let activated = false;
  try {
    await authorizePopulationClient();
    // The worker only reads verified files and runs the shared serializers offline.
    const payload = await runPipeline<CandidatePayload>({
      operation: "import-payload",
      workspace,
      revision,
    });
    const current = activePreview();
    if (current?.revision === revision && current.workspace === workspace)
      return current;
    const schemaName = `maps_preview_${revision.slice(0, 32)}`;
    await prepareSchema(schemaName);
    candidate = new PrismaClient({
      datasourceUrl: databaseUrlForSchema(schemaName),
    });
    const tables = payload.tables;
    await candidate.$transaction(
      async (transaction) => {
        await transaction.edge.deleteMany();
        await transaction.node.deleteMany();
        await transaction.alias.deleteMany();
        await transaction.poi.deleteMany();
        await transaction.room.deleteMany();
        await transaction.floor.deleteMany();
        await transaction.building.deleteMany();
        await populateTableService.populateBuildings(
          tables.Building,
          transaction,
        );
        await populateTableService.populateFloors(tables.Floor, transaction);
        await populateTableService.populateRooms(tables.Room, transaction);
        await populateTableService.populateAlias(tables.Alias, transaction);
        await populateTableService.populateNodes(tables.Node, transaction);
        await populateTableService.populateEdges(tables.Edge, transaction);
        await populateTableService.populatePois(tables.Poi, transaction);
      },
      { timeout: 60000 },
    );
    const [graph, search] = await Promise.all([
      prepareGraph(candidate),
      prepareSearchContext(candidate),
    ]);
    const info = previewInfo(
      workspace,
      revision,
      payload.report.warnings,
      payload.report.counts,
      tables.Building[0].buildingCode,
    );
    let previous: PrismaClient | undefined;
    await switchPreview(async () => {
      await controlPrisma.previewSelection.upsert({
        where: { id: "active" },
        create: {
          id: "active",
          workspace,
          revision,
          schemaName,
          warnings: payload.report.warnings,
          counts: payload.report.counts,
        },
        update: {
          workspace,
          revision,
          schemaName,
          warnings: payload.report.warnings,
          counts: payload.report.counts,
        },
      });
      previous = activateDatabase(candidate as PrismaClient);
      activateGraph(graph);
      activateSearchContext(search);
      setPreview(info);
      activated = true;
    });
    if (previous && previous !== controlPrisma)
      await previous.$disconnect().catch(console.error);
    return info;
  } finally {
    if (candidate && !activated) await candidate.$disconnect();
    loading = false;
  }
}

/** Return to the preserved ordinary import without deleting either dataset. */
export async function restoreBaseline(): Promise<{ appUrl: string }> {
  requireNativeDatabase();
  if (loading) throw new HttpError(409, "Another candidate is being loaded");
  loading = true;
  try {
    await authorizePopulationClient();
    const [graph, search] = await Promise.all([
      prepareGraph(controlPrisma),
      prepareSearchContext(controlPrisma),
    ]);
    let previous: PrismaClient | undefined;
    await switchPreview(async () => {
      await controlPrisma.previewSelection.deleteMany({
        where: { id: "active" },
      });
      previous = activateDatabase(controlPrisma);
      activateGraph(graph);
      activateSearchContext(search);
      setPreview(null);
    });
    if (previous && previous !== controlPrisma)
      await previous.$disconnect().catch(console.error);
    return { appUrl: new URL("/", env.BETTER_AUTH_URL).toString() };
  } finally {
    loading = false;
  }
}
