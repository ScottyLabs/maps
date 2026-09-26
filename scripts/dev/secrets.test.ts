import { afterEach, expect, test } from "bun:test";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildEnvFiles, mergeEnv, serializeEnv, setupSecrets } from "./secrets";

const roots: string[] = [];
const secrets = {
  OIDC_CLIENT_ID: "test-client",
  OIDC_CLIENT_SECRET: "test-secret#with=punctuation",
  KEYCLOAK_URL: "https://identity.example.test/auth/",
  KEYCLOAK_REALM: "test",
  CDN_S3_ENDPOINT: "https://s3.example.test:9443/",
  CDN_ACCESS_KEY_ID: "test-access",
  CDN_SECRET_ACCESS_KEY: "test-s3-secret",
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "cmumaps-secrets-"));
  roots.push(root);
  await Promise.all(
    ["server", "web", "dataflow"].map((app) =>
      mkdir(path.join(root, "apps", app), { recursive: true }),
    ),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

test("generates localhost configuration, derived auth URLs, private permissions, and no SERVER_PORT", async () => {
  const root = await fixture();
  await setupSecrets(root, { auth: false }, async () => secrets);
  const server = await readFile(path.join(root, "apps/server/.env"), "utf8");
  expect(server).toContain(
    "AUTH_ISSUER='https://identity.example.test/auth/realms/test'",
  );
  expect(server).toContain(
    "AUTH_JWKS_URI='https://identity.example.test/auth/realms/test/protocol/openid-connect/certs'",
  );
  expect(server).toContain("IGNORE_LOGIN='true'");
  expect(server).toContain("@localhost:5432/cmumaps");
  expect(server).not.toContain("SERVER_PORT");
  expect(server).toMatch(/BETTER_AUTH_SECRET='[a-f0-9]{64}'/u);
  expect(
    await readFile(path.join(root, "apps/dataflow/.env"), "utf8"),
  ).toContain("S3_ENDPOINT='s3.example.test:9443'");
  for (const app of ["server", "web", "dataflow"]) {
    expect(
      (await stat(path.join(root, "apps", app, ".env"))).mode & 0o777,
    ).toBe(0o600);
    expect(await readdir(path.join(root, "apps", app))).toEqual([".env"]);
  }
});

test("refreshes managed values while preserving custom entries, local settings, and local auth secret", async () => {
  const root = await fixture();
  const file = path.join(root, "apps/server/.env");
  await writeFile(
    file,
    "# custom\nCUSTOM=value\nAUTH_CLIENT_SECRET=old\nBETTER_AUTH_SECRET=keep-me\nSERVER_URL=http://localhost:8080\nIGNORE_LOGIN=false\n",
  );
  await setupSecrets(root, {}, async () => secrets);
  const server = await readFile(file, "utf8");
  expect(server).toStartWith("# custom\nCUSTOM=value\n");
  expect(server).toContain(
    `AUTH_CLIENT_SECRET='${secrets.OIDC_CLIENT_SECRET}'`,
  );
  expect(server).not.toContain("AUTH_CLIENT_SECRET=old");
  expect(server).toContain("BETTER_AUTH_SECRET=keep-me");
  expect(server).toContain("SERVER_URL=http://localhost:8080");
  expect(server).toContain("IGNORE_LOGIN=false");
  await setupSecrets(root, {}, async () => secrets);
  expect(await readFile(file, "utf8")).toBe(server);
});

test("explicit auth flags update both server and web without dropping custom settings", async () => {
  const root = await fixture();
  await writeFile(
    path.join(root, "apps/server/.env"),
    "CUSTOM=value\nIGNORE_LOGIN=true\n",
  );
  await setupSecrets(root, { auth: true }, async () => secrets);
  let server = await readFile(path.join(root, "apps/server/.env"), "utf8");
  expect(server).toContain("CUSTOM=value");
  expect(server).toContain("IGNORE_LOGIN='false'");
  expect(await readFile(path.join(root, "apps/web/.env"), "utf8")).toContain(
    "VITE_IGNORE_LOGIN='false'",
  );
  await setupSecrets(root, { auth: false }, async () => secrets);
  server = await readFile(path.join(root, "apps/server/.env"), "utf8");
  expect(server).toContain("IGNORE_LOGIN='true'");
  expect(await readFile(path.join(root, "apps/web/.env"), "utf8")).toContain(
    "VITE_IGNORE_LOGIN='true'",
  );
});

test("merge handles duplicate managed assignments, CRLF, and multiline custom values", () => {
  const existing =
    '# comment\r\nCUSTOM="first\nAUTH_CLIENT_SECRET=inside-custom\nlast"\r\nexport AUTH_CLIENT_SECRET=old # comment\r\nAUTH_CLIENT_SECRET=duplicate';
  const updated = mergeEnv(
    existing,
    "AUTH_CLIENT_SECRET='new'\nMISSING='default'\n",
    ["AUTH_CLIENT_SECRET"],
  );
  expect(updated).toContain(
    'CUSTOM="first\nAUTH_CLIENT_SECRET=inside-custom\nlast"',
  );
  expect(updated).toContain("# comment\r\n");
  expect(updated.match(/AUTH_CLIENT_SECRET='new'/gu)?.length).toBe(2);
  expect(updated).toEndWith("MISSING='default'\n");
  const quotedCustom =
    'CUSTOM="first\\"quoted\nAUTH_CLIENT_SECRET=inside\nlast"\n';
  expect(
    mergeEnv(quotedCustom, "AUTH_CLIENT_SECRET='new'\n", [
      "AUTH_CLIENT_SECRET",
    ]),
  ).toBe(`${quotedCustom}AUTH_CLIENT_SECRET='new'\n`);
});

test("fetch and validation failures leave existing files unchanged and missing files absent", async () => {
  const root = await fixture();
  const file = path.join(root, "apps/server/.env");
  await writeFile(file, "CUSTOM=value\n");
  await expect(
    setupSecrets(root, { auth: false }, async () => {
      throw new Error("denied");
    }),
  ).rejects.toThrow("denied");
  await expect(
    setupSecrets(root, { auth: false }, async () => ({
      ...secrets,
      CDN_S3_ENDPOINT: "invalid-private-value",
    })),
  ).rejects.toThrow("CDN_S3_ENDPOINT must be a valid HTTPS URL");
  expect(await readFile(file, "utf8")).toBe("CUSTOM=value\n");
  expect(await readdir(path.join(root, "apps/web"))).toEqual([]);
});

test("refuses symlink destinations", async () => {
  const root = await fixture();
  const outside = path.join(root, "outside");
  await writeFile(outside, "do not overwrite");
  await symlink(outside, path.join(root, "apps/server/.env"));
  await expect(
    setupSecrets(root, { auth: false }, async () => secrets),
  ).rejects.toThrow("Refusing non-regular");
  expect(await readFile(outside, "utf8")).toBe("do not overwrite");
});

test("rejects unsafe dotenv values without including them in errors", () => {
  for (const value of [
    "private$HOME",
    "private\nINJECTED=yes",
    "private'\"quotes",
    "private\0value",
    "private\\",
  ]) {
    try {
      serializeEnv({ SECRET: value });
      throw new Error("expected rejection");
    } catch (error) {
      expect((error as Error).message).toContain(
        "SECRET cannot be safely represented",
      );
      expect((error as Error).message).not.toContain(value);
    }
  }
});

test("generated files round-trip through Bun's actual dotenv loader", async () => {
  const root = await fixture();
  await writeFile(
    path.join(root, ".env"),
    buildEnvFiles(secrets, false).server,
  );
  const proc = Bun.spawn(
    [
      process.execPath,
      "-e",
      "console.log(JSON.stringify([process.env.AUTH_CLIENT_SECRET, process.env.ALLOWED_ORIGINS_REGEX]))",
    ],
    {
      cwd: root,
      env: { PATH: process.env.PATH },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const output = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(JSON.parse(output)).toEqual([
    secrets.OIDC_CLIENT_SECRET,
    "^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$",
  ]);
});

async function runMockCli(mode: "success" | "denied" | "expired") {
  const root = await fixture();
  const scriptDir = path.join(root, "scripts/dev");
  const binDir = path.join(root, "bin");
  await mkdir(scriptDir, { recursive: true });
  await mkdir(binDir);
  await copyFile(
    path.join(import.meta.dir, "secrets.ts"),
    path.join(scriptDir, "secrets.ts"),
  );
  await writeFile(
    path.join(binDir, "bao"),
    `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (process.env.BAO_ADDR !== "https://secrets.scottylabs.org") process.exit(10);
if (args[0] === "token") {
  console.log(JSON.stringify({ data: { id: "private-cached-token" } }));
  process.exit(${mode === "expired" ? 1 : 0});
}
if (args[0] !== "kv" || !args.includes("-mount=secret")) process.exit(11);
const key = args.at(-1).replace("secretspec/maps/dev/", "");
if (${JSON.stringify(mode)} === "denied" && key === "CDN_SECRET_ACCESS_KEY") {
  console.error("private-raw-error");
  process.exit(1);
}
console.log(JSON.stringify({ data: { data: { value: ${JSON.stringify(secrets)}[key] } } }));
`,
    { mode: 0o700 },
  );
  const proc = Bun.spawn(
    [process.execPath, path.join(scriptDir, "secrets.ts")],
    {
      cwd: root,
      env: {
        PATH: `${binDir}:${path.dirname(process.execPath)}:${process.env.PATH}`,
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const output = stdout + stderr;
  expect(output).not.toContain("private-cached-token");
  expect(output).not.toContain("private-raw-error");
  expect(output).not.toContain(secrets.OIDC_CLIENT_SECRET);
  expect(output).not.toContain(secrets.CDN_SECRET_ACCESS_KEY);
  return { root, exitCode, output };
}

test("CLI uses cached login and the KV v2 value layout without exposing secrets", async () => {
  const result = await runMockCli("success");
  expect(result.exitCode).toBe(0);
  expect(
    await readFile(path.join(result.root, "apps/server/.env"), "utf8"),
  ).toContain(secrets.OIDC_CLIENT_SECRET);
});

test("a later secret read failure writes no files and suppresses raw OpenBao output", async () => {
  const result = await runMockCli("denied");
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(
    "Unable to read maps/dev/CDN_SECRET_ACCESS_KEY",
  );
  for (const app of ["server", "web", "dataflow"]) {
    expect(await readdir(path.join(result.root, "apps", app))).toEqual([]);
  }
});

test("expired login in a non-interactive shell gives instructions without writing files", async () => {
  const result = await runMockCli("expired");
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain("bao login -method=oidc -no-print");
  expect(await readdir(path.join(result.root, "apps/server"))).toEqual([]);
});
