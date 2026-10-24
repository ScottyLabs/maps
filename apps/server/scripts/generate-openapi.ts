/// <reference lib="deno.ns" />

const specUrl = "http://localhost:3101/api/docs/json";
const jsonUrl = new URL("../build/openapi.json", import.meta.url);
const dtsUrl = new URL("../build/openapi.d.ts", import.meta.url);

async function fetchSpec(): Promise<unknown | undefined> {
  try {
    const res = await fetch(specUrl);
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

const child = new Deno.Command("deno", {
  args: ["run", "--allow-all", "src/index.ts"],
  env: {
    DATABASE_URL: Deno.env.get("DATABASE_URL") ?? "postgresql://localhost:5432/maps",
    IGNORE_LOGIN: "true",
    PORT: "3101",
  },
  stderr: "null",
  stdout: "null",
}).spawn();

let spec: unknown;
for (let attempt = 0; attempt < 25 && !spec; attempt++) {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 200);
  await promise;
  spec = await fetchSpec();
}
child.kill();
await child.status;

if (!spec) {
  console.error("Failed to read the OpenAPI spec from the server");
  Deno.exit(1);
}

await Deno.mkdir(new URL("../build/", import.meta.url), { recursive: true });
await Deno.writeTextFile(jsonUrl, `${JSON.stringify(spec, null, 2)}\n`);

const typegen = await new Deno.Command("deno", {
  args: ["run", "-A", "npm:openapi-typescript@^7.10.1", jsonUrl.pathname, "-o", dtsUrl.pathname],
  stderr: "inherit",
  stdout: "inherit",
}).output();

if (!typegen.success) {
  console.error("openapi-typescript failed");
  Deno.exit(1);
}
