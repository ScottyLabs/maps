#!/usr/bin/env -S deno run -A

import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Environment and Postgres are owned by devenv: secretspec resolves the
// secrets declared in secretspec.toml into the shell, and the devenv postgres
// module runs the database and exports DATABASE_URL. This script only covers
// what remains: regenerating stale server artifacts and pushing the schema.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverDir = path.join(repoRoot, "apps/server");
const commandEnv = Deno.env.toObject();

const { values } = parseArgs({
  args: Deno.args,
  options: { help: { type: "boolean" } },
  strict: true,
});

if (values.help) {
  console.log(`Usage: deno run -A ./scripts/dev/prepare.ts

Preflight steps:
  1. Regenerate the Prisma client when the schema is newer
  2. Push the Prisma schema to the database
`);
  Deno.exit(0);
}

try {
  await main();
} catch (error) {
  console.error(`Preflight failed: ${toError(error).message}`);
  Deno.exit(1);
}

async function main() {
  log(`Deno ${Deno.version.deno}`);
  await ensurePrismaClient();
  await pushDatabaseSchema();
  log("Preflight complete.");
}

async function ensurePrismaClient() {
  const schema = path.join(serverDir, "prisma/schema.prisma");
  const client = path.join(repoRoot, "node_modules/.prisma/client/index.d.ts");

  const schemaMtime = (await getFileMtimeMs(schema)) ?? 0;
  const clientMtime = await getFileMtimeMs(client);
  if (clientMtime !== null && clientMtime >= schemaMtime) {
    log("Prisma client is up to date.");
    return;
  }

  log("Regenerating the Prisma client.");
  await runCommand(["deno", "task", "db-generate"], repoRoot);
}

async function pushDatabaseSchema() {
  const databaseUrl = Deno.env.get("DATABASE_URL");
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Enter the devenv shell so the postgres module can provide it.",
    );
  }

  // devenv hands out postgresql:///maps?host=/run/... with no user; the Prisma
  // CLI does not fall back to the OS user the way libpq does, and fails P1010.
  const socketUrl = databaseUrl.match(/^postgresql:\/\/\/([^?]+)\?host=(.+)$/u);
  const user = Deno.env.get("PGUSER") ?? Deno.env.get("USER");
  const cliUrl =
    socketUrl && user
      ? `postgresql://${user}@localhost/${socketUrl[1]}?host=${socketUrl[2]}`
      : databaseUrl;

  log("Pushing the Prisma schema to the database.");
  await runCommand(
    ["deno", "run", "-A", "npm:prisma@^6.19.3", "db", "push", "--skip-generate"],
    serverDir,
    { DATABASE_URL: cliUrl },
  );
}

async function getFileMtimeMs(filePath: string) {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return null;
  }
}

async function runCommand(
  command: readonly string[],
  cwd: string,
  envOverrides: Record<string, string> = {},
) {
  log(`$ ${command.join(" ")}`);

  const proc = new Deno.Command(command[0], {
    args: command.slice(1),
    cwd,
    env: { ...commandEnv, ...envOverrides },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const { code } = await proc.status;

  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${command.join(" ")}`);
  }
}

function log(message: string) {
  console.log(`- ${message}`);
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
