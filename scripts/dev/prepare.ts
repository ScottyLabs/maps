#!/usr/bin/env -S deno run -A

import { constants } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

type Profile = "default" | "visualizer" | "web-noauth";

type EnvFileSpec = {
  path: string;
  requiredKeys: string[];
  mismatchChecks?: (env: Record<string, string>) => string[];
};

type EnvValidation = {
  file: string;
  issues: string[];
  values: Record<string, string> | null;
};

const textDecoder = new TextDecoder();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverDir = path.join(repoRoot, "apps/server");
const composeFile = path.join(repoRoot, "compose.dev.yml");
const commandEnv = Deno.env.toObject();

const envFilesByProfile: Record<Profile, EnvFileSpec[]> = {
  default: [
    {
      path: path.join(repoRoot, "apps/server/.env"),
      requiredKeys: [
        "ALLOWED_ORIGINS_REGEX",
        "AUTH_CLIENT_ID",
        "AUTH_CLIENT_SECRET",
        "AUTH_ISSUER",
        "AUTH_JWKS_URI",
        "BETTER_AUTH_URL",
        "DATABASE_URL",
        "SERVER_URL",
      ],
      mismatchChecks: (env) =>
        [
          ...(env.IGNORE_LOGIN === "true"
            ? ["expected login-enabled server profile but IGNORE_LOGIN=true"]
            : []),
          ...getLocalDatabaseUrlIssues(env),
        ],
    },
    {
      path: path.join(repoRoot, "apps/web/.env"),
      requiredKeys: ["VITE_SERVER_URL"],
      mismatchChecks: (env) =>
        env.VITE_IGNORE_LOGIN === "true"
          ? ["expected login-enabled web profile but VITE_IGNORE_LOGIN=true"]
          : [],
    },
  ],
  "web-noauth": [
    {
      path: path.join(repoRoot, "apps/server/.env"),
      requiredKeys: ["ALLOWED_ORIGINS_REGEX", "DATABASE_URL", "SERVER_URL"],
      mismatchChecks: (env) => getLocalDatabaseUrlIssues(env),
    },
    {
      path: path.join(repoRoot, "apps/web/.env"),
      requiredKeys: ["VITE_SERVER_URL"],
    },
  ],
  visualizer: [
    {
      path: path.join(repoRoot, "apps/server/.env"),
      requiredKeys: [
        "ALLOWED_ORIGINS_REGEX",
        "AUTH_CLIENT_ID",
        "AUTH_CLIENT_SECRET",
        "AUTH_ISSUER",
        "AUTH_JWKS_URI",
        "BETTER_AUTH_URL",
        "DATABASE_URL",
        "SERVER_URL",
      ],
      mismatchChecks: (env) =>
        [
          ...(env.IGNORE_LOGIN === "true"
            ? ["expected login-enabled server profile but IGNORE_LOGIN=true"]
            : []),
          ...getLocalDatabaseUrlIssues(env),
        ],
    },
    {
      path: path.join(repoRoot, "apps/visualizer/.env"),
      requiredKeys: ["VITE_CLERK_PUBLISHABLE_KEY", "VITE_SERVER_URL"],
    },
  ],
};

const { values } = parseArgs({
  args: Deno.args,
  options: {
    help: { type: "boolean" },
    profile: { type: "string" },
  },
  strict: true,
});

if (values.help) {
  console.log(`Usage: deno run -A ./scripts/dev/prepare.ts [--profile default|web-noauth|visualizer]

Preflight steps:
  1. Validate the selected env files
  2. Start local Postgres from compose.dev.yml when it is not already reachable
  3. Regenerate stale server build artifacts
  4. Apply Drizzle migrations to the local database
`);
  process.exit(0);
}

const profile = parseProfile(values.profile);

try {
  await main();
} catch (error) {
  const message = toError(error).message;
  console.error(`Preflight failed: ${message}`);
  process.exit(1);
}

async function main() {
  console.log(`Preparing local dev profile: ${profile}`);

  logTool(`Deno ${Deno.version.deno}`);
  assertCommand(["deno", "run", "-A", "npm:mprocs", "--version"], "deno run -A npm:mprocs");

  const dockerAvailable = canRun(["docker", "compose", "version"]);
  if (dockerAvailable) {
    assertCommand(["docker", "compose", "version"], "docker compose");
  } else {
    log(
      "docker compose is not available in this shell; continuing because Postgres may already be reachable",
    );
  }

  const serverEnv = await ensureEnvFiles(profile);
  await ensureServerArtifacts();
  await ensureDatabase(serverEnv.DATABASE_URL, dockerAvailable);
  await applyDatabaseMigrations(serverEnv.DATABASE_URL);

  log("Preflight complete.");
}

function parseProfile(input: string | undefined): Profile {
  if (
    input === undefined ||
    input === "default" ||
    input === "visualizer" ||
    input === "web-noauth"
  ) {
    return input ?? "default";
  }

  throw new Error(
    `Unsupported profile "${input}". Expected default, web-noauth, or visualizer.`,
  );
}

async function ensureEnvFiles(profile: Profile) {
  const validations = await Promise.all(
    envFilesByProfile[profile].map(validateEnvFile),
  );
  printEnvIssues(validations);
  try {
    await runCommand(["deno", "task", "secrets:setup"], repoRoot, commandEnv);
  } catch (error) {
    throw new Error(
      "Environment sync is required, but the repo secrets bootstrap could not run. Ensure the checked-out repo includes the expected scripts under scripts/secrets/ and that local Vault access is configured.",
      {
        cause: error,
      },
    );
  }

  try {
    await runCommand(
      ["deno", "task", "secrets:pull", "all", vaultEnv],
      repoRoot,
      commandEnv,
    );
    await promotePulledEnvFiles(specs, vaultEnv);
  } catch (error) {
    throw new Error(
      `Environment sync failed after running the repo secrets flow. ${toError(error).message}`,
      {
        cause: error,
      },
    );
  }

  validations = await Promise.all(specs.map(validateEnvFile));
  if (validations.some((validation) => validation.issues.length > 0)) {
    printEnvIssues(validations);
    throw new Error(
      "Configure the selected apps' .env files with the required values, then rerun dev preparation.",
    );
  }

  log("Environment files are present and valid for this profile.");
  return getServerEnv(validations);
}

async function promotePulledEnvFiles(
  specs: EnvFileSpec[],
  vaultEnv: VaultEnv,
) {
  for (const spec of specs) {
    const sourcePath = getVaultEnvFilePath(spec.path, vaultEnv);

    try {
      await access(sourcePath, constants.F_OK);
    } catch {
      throw new Error(
        `Expected ${path.relative(repoRoot, sourcePath)} to exist after pulling Vault env "${vaultEnv}".`,
      );
    }

    log(
      `Syncing ${path.relative(repoRoot, spec.path)} from ${path.relative(repoRoot, sourcePath)}.`,
    );
    const sourceText = await Deno.readTextFile(sourcePath);
    const targetText = transformPulledEnvFile(spec.path, sourceText, vaultEnv);
    await Deno.writeTextFile(spec.path, targetText);
  }
}

function getVaultEnvFilePath(envFilePath: string, vaultEnv: VaultEnv) {
  return `${envFilePath}.${vaultEnv}`;
}

function transformPulledEnvFile(
  envFilePath: string,
  sourceText: string,
  vaultEnv: VaultEnv,
) {
  if (
    vaultEnv === "local" &&
    envFilePath === path.join(repoRoot, "apps/server/.env")
  ) {
    const values = parseDotEnv(sourceText);
    const normalizedDatabaseUrl = normalizeLocalDatabaseUrl(values.DATABASE_URL);

    if (values.DATABASE_URL !== normalizedDatabaseUrl) {
      log("Rewriting apps/server/.env DATABASE_URL for local Postgres.");
    }

    values.DATABASE_URL = normalizedDatabaseUrl;
    return serializeDotEnv(values);
  }

  return sourceText;
}

async function validateEnvFile(spec: EnvFileSpec): Promise<EnvValidation> {
  const issues: string[] = [];

  try {
    await access(spec.path, constants.F_OK);
  } catch {
    return {
      file: spec.path,
      issues: ["file is missing"],
      values: null,
    };
  }

  const values = parseDotEnv(await Deno.readTextFile(spec.path));
  const missingKeys = spec.requiredKeys.filter((key) => !values[key]?.trim());

  if (missingKeys.length > 0) {
    issues.push(`missing keys: ${missingKeys.join(", ")}`);
  }

  for (const mismatch of spec.mismatchChecks?.(values) ?? []) {
    issues.push(mismatch);
  }

  return { file: spec.path, issues, values };
}

function getServerEnv(validations: EnvValidation[]) {
  const serverValidation = validations.find(
    (validation) => validation.file === path.join(repoRoot, "apps/server/.env"),
  );

  if (!serverValidation?.values) {
    throw new Error("apps/server/.env was not available after env validation.");
  }

  return serverValidation.values;
}

function printEnvIssues(validations: EnvValidation[]) {
  for (const validation of validations) {
    if (validation.issues.length === 0) {
      continue;
    }

    log(
      `${path.relative(repoRoot, validation.file)}: ${validation.issues.join("; ")}`,
    );
  }
}

function parseDotEnv(text: string) {
  const values: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const match = rawLine.match(/^\s*(?:export\s+)?([\w.]+)\s*=\s*(.*)\s*$/u);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    values[key] = normalizeEnvValue(rawValue);
  }

  return values;
}

function getLocalDatabaseUrlIssues(env: Record<string, string>) {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return [];
  }

  if (databaseUrl.includes("${{")) {
    return ["DATABASE_URL contains an unresolved template value"];
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return ["DATABASE_URL is not a valid URL"];
  }

  const issues: string[] = [];
  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    issues.push("DATABASE_URL must target localhost for local development");
  }

  if (Number(parsed.port || "5432") !== 5432) {
    issues.push("DATABASE_URL must target port 5432 for local development");
  }

  return issues;
}

function normalizeEnvValue(rawValue: string) {
  let value = rawValue.trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  const commentIndex = value.search(/\s+#/u);
  if (commentIndex >= 0) {
    value = value.slice(0, commentIndex).trimEnd();
  }

  return value;
}

async function ensureServerArtifacts() {
  const inputs = [
    ...(await readdir(path.join(serverDir, "src/controllers"))).map((file) =>
      path.join(serverDir, "src/controllers", file),
    ),
    path.join(serverDir, "tsoa.json"),
  ];
  const outputs = [
    path.join(serverDir, "build/routes.ts"),
    path.join(serverDir, "build/swagger.yaml"),
    path.join(serverDir, "build/swagger.d.ts"),
  ];

  const latestInputMtime = Math.max(
    ...(await Promise.all(inputs.map(getFileMtimeMs))),
  );

  const staleOutputs: string[] = [];
  for (const output of outputs) {
    const outputMtime = await getFileMtimeMs(output);
    if (outputMtime === null || outputMtime < latestInputMtime) {
      staleOutputs.push(path.relative(repoRoot, output));
    }
  }

  if (staleOutputs.length === 0) {
    log("Server-generated artifacts are up to date.");
    return;
  }

  log(
    `Refreshing generated server artifacts: ${staleOutputs.join(", ")}`,
  );
  await runCommand(["deno", "task", "sync"], repoRoot, commandEnv);

  for (const output of outputs) {
    const exists = await getFileMtimeMs(output);
    if (exists === null) {
      throw new Error(
        `Expected ${path.relative(repoRoot, output)} to exist after deno task sync.`,
      );
    }
  }
}

async function ensureDatabase(
  databaseUrl: string,
  dockerAvailable: boolean,
) {
  const target = getDatabaseTarget(databaseUrl);

  if (await isPortReachable(target.host, target.port)) {
    log(`Postgres is reachable at ${target.host}:${target.port}.`);
    return;
  }

  if (!dockerAvailable) {
    throw new Error(
      `Postgres is not reachable at ${target.host}:${target.port}, and docker compose is not available to start it.`,
    );
  }

  log("Starting local Postgres with compose.dev.yml.");
  await runCommand(
    ["docker", "compose", "-f", composeFile, "up", "-d", "postgres"],
    repoRoot,
    process.env,
  );

  const reachable = await waitForPort(target.host, target.port, 30_000);
  if (!reachable) {
    throw new Error(
      `Postgres did not become reachable at ${target.host}:${target.port} after docker compose startup.`,
    );
  }

  log(`Postgres is reachable at ${target.host}:${target.port}.`);
}

function getDatabaseTarget(databaseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL in apps/server/.env is not a valid URL for local development.",
    );
  }

  return {
    host: parsed.hostname,
    port: Number(parsed.port || "5432"),
  };
}

async function applyDatabaseMigrations(databaseUrl: string) {
  log("Pushing the Prisma schema to the local database.");
  await runCommand(
    ["deno", "run", "-A", "npm:prisma", "db", "push", "--skip-generate"],
    serverDir,
    {
      ...commandEnv,
      DATABASE_URL: databaseUrl,
    },
  );
}

async function getFileMtimeMs(filePath: string) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.mtimeMs;
  } catch {
    return null;
  }
}

async function isPortReachable(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });

    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1_000);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

async function waitForPort(host: string, port: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortReachable(host, port)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return false;
}

function canRun(command: string[]) {
  try {
    const result = new Deno.Command(command[0], {
      args: command.slice(1),
      cwd: repoRoot,
      env: commandEnv,
      stderr: "piped",
      stdout: "piped",
    }).outputSync();

    return result.code === 0;
  } catch {
    return false;
  }
}

function assertCommand(command: string[], label: string) {
  let result;
  try {
    result = new Deno.Command(command[0], {
      args: command.slice(1),
      cwd: repoRoot,
      env: commandEnv,
      stderr: "piped",
      stdout: "piped",
    }).outputSync();
  } catch (error) {
    throw new Error(
      `${label} is required for this dev flow but could not be executed. ${toError(error).message}`,
    );
  }

  if (result.code !== 0) {
    const stderr = textDecoder.decode(result.stderr).trim();
    throw new Error(
      `${label} is required for this dev flow but could not be executed.${stderr ? ` ${stderr}` : ""}`,
    );
  }

  const output = textDecoder.decode(result.stdout).trim();
  logTool(output || label);
}

async function runCommand(
  command: readonly string[],
  cwd: string,
  env: Record<string, string>,
) {
  log(`$ ${command.join(" ")}`);

  const proc = new Deno.Command(command[0], {
    args: command.slice(1),
    cwd,
    env,
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

function logTool(message: string) {
  console.log(`- ${message}`);
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
