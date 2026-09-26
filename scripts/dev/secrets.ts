#!/usr/bin/env bun

import { randomBytes, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs, parseEnv } from "node:util";

const baoAddress = "https://secrets.scottylabs.org";
const secretPrefix = "secretspec/maps/dev";
const repoRoot = path.resolve(import.meta.dir, "../..");
const loginCommand = `BAO_ADDR=${baoAddress} bao login -method=oidc -no-print`;
const secretKeys = [
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "KEYCLOAK_URL",
  "KEYCLOAK_REALM",
  "CDN_S3_ENDPOINT",
  "CDN_ACCESS_KEY_ID",
  "CDN_SECRET_ACCESS_KEY",
] as const;

type SecretKey = (typeof secretKeys)[number];
type Secrets = Record<SecretKey, string>;
type App = "server" | "web" | "dataflow";

export class SetupError extends Error {}

const managedKeys: Record<App, string[]> = {
  server: [
    "AUTH_CLIENT_ID",
    "AUTH_CLIENT_SECRET",
    "AUTH_ISSUER",
    "AUTH_JWKS_URI",
  ],
  web: [],
  dataflow: [
    "S3_ENDPOINT",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "AUTH_CLIENT_ID",
    "AUTH_CLIENT_SECRET",
  ],
};

const help = `Usage: bun run secrets:setup [--auth | --no-auth]
        bun run secrets:pull [--auth | --no-auth]

Read OpenBao maps/dev secrets and sync local server, web, and dataflow .env files.
Both commands create missing files and refresh OpenBao-managed values in existing
files. Local settings, custom entries, and BETTER_AUTH_SECRET are preserved;
missing local defaults are added. Files are written with owner-only permissions.
New files default to localhost services with app login bypassed. --auth enables
app login; --no-auth disables it. Existing login settings are otherwise preserved.
Uses the cached OpenBao session; prompts for OIDC login in an interactive terminal.
For non-interactive use, first run: ${loginCommand}
Visualizer credentials and production environments are not supported.
`;

export function serializeEnv(values: Record<string, string>): string {
  return `${Object.entries(values)
    .map(([key, value]) => {
      // Bun, dotenv-cli, and python-dotenv differ in interpolation and escaping.
      // Reject values that cannot be represented literally across these loaders.
      const quote = value.includes("'") ? '"' : "'";
      if (
        /[\r\n\0]/u.test(value) ||
        /\$(?=[\w{])/u.test(value) ||
        value.includes(quote) ||
        value.includes("\\\\") ||
        value.endsWith("\\") ||
        (quote === '"' && value.includes("\\"))
      ) {
        throw new SetupError(
          `${key} cannot be safely represented in the supported .env loaders (quotes, interpolation, or escapes). No files were written.`,
        );
      }
      return `${key}=${quote}${value}${quote}`;
    })
    .join("\n")}\n`;
}

function httpsUrl(value: string, key: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SetupError(`${key} must be a valid HTTPS URL.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new SetupError(
      `${key} must be an HTTPS URL without credentials, query, or fragment.`,
    );
  }
  return url;
}

export function buildEnvFiles(
  secrets: Secrets,
  auth: boolean,
): Record<App, string> {
  const keycloak = httpsUrl(secrets.KEYCLOAK_URL, "KEYCLOAK_URL");
  const s3 = httpsUrl(secrets.CDN_S3_ENDPOINT, "CDN_S3_ENDPOINT");
  if (s3.pathname !== "/") {
    throw new SetupError("CDN_S3_ENDPOINT must not contain a path.");
  }
  const issuer = `${keycloak.toString().replace(/\/+$/u, "")}/realms/${encodeURIComponent(secrets.KEYCLOAK_REALM)}`;
  return {
    server: serializeEnv({
      ALLOWED_ORIGINS_REGEX: "^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$",
      AUTH_CLIENT_ID: secrets.OIDC_CLIENT_ID,
      AUTH_CLIENT_SECRET: secrets.OIDC_CLIENT_SECRET,
      AUTH_ISSUER: issuer,
      AUTH_JWKS_URI: `${issuer}/protocol/openid-connect/certs`,
      BETTER_AUTH_URL: "http://localhost:5173",
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      DATABASE_URL:
        "postgresql://postgres:donotuseinprod@localhost:5432/cmumaps",
      SERVER_URL: "http://localhost",
      IGNORE_LOGIN: String(!auth),
    }),
    web: serializeEnv({
      VITE_SERVER_URL: "http://localhost",
      VITE_IGNORE_LOGIN: String(!auth),
    }),
    dataflow: serializeEnv({
      S3_ENDPOINT: s3.host,
      S3_ACCESS_KEY: secrets.CDN_ACCESS_KEY_ID,
      S3_SECRET_KEY: secrets.CDN_SECRET_ACCESS_KEY,
      SERVER_URL: "http://localhost",
      AUTH_CLIENT_ID: secrets.OIDC_CLIENT_ID,
      AUTH_CLIENT_SECRET: secrets.OIDC_CLIENT_SECRET,
    }),
  };
}

async function bao(args: string[]) {
  const proc = Bun.spawn(["bao", ...args], {
    env: { ...process.env, BAO_ADDR: baoAddress },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });
  const [output, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  return { output, exitCode };
}

async function readSecrets(): Promise<Secrets> {
  if (!Bun.which("bao")) {
    throw new SetupError(
      "OpenBao CLI is required. On macOS: brew install openbao",
    );
  }
  const session = await bao(["token", "lookup", "-format=json"]);
  if (session.exitCode !== 0) {
    if (!process.stdin.isTTY) {
      throw new SetupError(
        `OpenBao session unavailable. Check connectivity and run: ${loginCommand}`,
      );
    }
    console.log("OpenBao session unavailable; opening OIDC login.");
    const proc = Bun.spawn(["bao", "login", "-method=oidc", "-no-print"], {
      env: { ...process.env, BAO_ADDR: baoAddress },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((await proc.exited) !== 0) {
      throw new SetupError(
        "OpenBao login failed. Check connectivity and your access, then retry.",
      );
    }
  }

  const secrets = {} as Secrets;
  for (const key of secretKeys) {
    const result = await bao([
      "kv",
      "get",
      "-format=json",
      "-mount=secret",
      `${secretPrefix}/${key}`,
    ]);
    if (result.exitCode !== 0) {
      throw new SetupError(
        `Unable to read maps/dev/${key}. Check OpenBao connectivity, session, and read permission. No files were written.`,
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(result.output)?.data?.data?.value;
    } catch {
      throw new SetupError(
        `Invalid OpenBao response for ${key}. No files were written.`,
      );
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new SetupError(
        `OpenBao ${key} must contain a non-empty string in data.data.value. No files were written.`,
      );
    }
    secrets[key] = value;
  }
  return secrets;
}

async function targetExists(file: string): Promise<boolean> {
  try {
    const info = await lstat(file);
    if (!info.isFile()) {
      throw new SetupError(`Refusing non-regular .env file: ${file}`);
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function mergeEnv(
  existing: string,
  generated: string,
  managed: string[],
): string {
  const defaults = parseEnv(generated);
  const seen = new Set<string>();
  // Consume whole quoted values, including multiline custom entries, so a line
  // resembling AUTH_CLIENT_SECRET inside a custom value is never rewritten.
  const assignment =
    /^[ \t]*(?:export[ \t]+)?([\w.]+)[ \t]*=[ \t]*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|[^\r\n]*)[^\r\n]*/gmu;
  let merged = existing.replace(assignment, (original, key: string) => {
    seen.add(key);
    return managed.includes(key)
      ? serializeEnv({ [key]: defaults[key]! }).trimEnd()
      : original;
  });
  for (const [key, value] of Object.entries(defaults)) {
    if (!seen.has(key) && value !== undefined) {
      if (merged && !merged.endsWith("\n")) merged += "\n";
      merged += serializeEnv({ [key]: value });
    }
  }
  return merged;
}

export async function setupSecrets(
  root: string,
  options: { auth?: boolean },
  fetchSecrets: () => Promise<Secrets> = readSecrets,
) {
  const targets: { app: App; file: string; original: string | null }[] = [];
  for (const app of ["server", "web", "dataflow"] as const) {
    const file = path.join(root, "apps", app, ".env");
    const exists = await targetExists(file);
    targets.push({
      app,
      file,
      original: exists ? await readFile(file, "utf8") : null,
    });
  }

  const files = buildEnvFiles(await fetchSecrets(), options.auth ?? false);
  const staged: {
    file: string;
    temporary: string;
    app: App;
    original: string | null;
  }[] = [];
  try {
    // Stage every file with restrictive permissions before publishing any file.
    for (const target of targets) {
      const managed = [...managedKeys[target.app]];
      if (options.auth !== undefined) {
        if (target.app === "server") managed.push("IGNORE_LOGIN");
        if (target.app === "web") managed.push("VITE_IGNORE_LOGIN");
      }
      const content =
        target.original === null
          ? files[target.app]
          : mergeEnv(target.original, files[target.app], managed);
      const temporary = `${target.file}.${randomUUID()}.tmp`;
      staged.push({ ...target, temporary });
      await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
    }
    for (const target of staged) {
      if (target.original !== null) {
        if (
          !(await targetExists(target.file)) ||
          (await readFile(target.file, "utf8")) !== target.original
        ) {
          throw new SetupError(
            "An .env file changed during sync. Retry after the other writer finishes.",
          );
        }
        await rename(target.temporary, target.file);
      } else {
        // An atomic link fails if another process created the destination meanwhile.
        await link(target.temporary, target.file);
      }
      console.log(`Synced apps/${target.app}/.env (0600)`);
    }
  } finally {
    await Promise.all(
      staged.map(({ temporary }) => unlink(temporary).catch(() => {})),
    );
  }
  console.log(
    "Local environment sync complete. Visualizer credentials, S3 datasets, and MapKit access require separate setup.",
  );
}

if (import.meta.main) {
  try {
    const { values, positionals } = parseArgs({
      options: {
        auth: { type: "boolean" },
        "no-auth": { type: "boolean" },
        help: { type: "boolean" },
        push: { type: "boolean" },
      },
      allowPositionals: true,
      strict: true,
    });
    if (values.auth && values["no-auth"]) {
      throw new SetupError("Choose either --auth or --no-auth.");
    }
    if (values.push) {
      throw new SetupError(
        "secrets:push is disabled. Local .env files mix shared credentials and local settings. Update shared secrets in OpenBao through an authorized maintainer.",
      );
    }
    if (positionals.length) {
      throw new SetupError(
        `App/environment positional arguments are no longer supported.\n${help}`,
      );
    }
    if (values.help) {
      console.log(help);
    } else {
      await setupSecrets(repoRoot, {
        auth: values.auth ? true : values["no-auth"] ? false : undefined,
      });
    }
  } catch (error) {
    // Do not relay subprocess output, secret-bearing parse errors, or values.
    console.error(
      error instanceof SetupError
        ? error.message
        : "Environment setup failed. Check CLI arguments, filesystem permissions, and OpenBao connectivity. Use --help for usage.",
    );
    process.exitCode = 1;
  }
}
