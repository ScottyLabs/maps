import { afterAll, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { genericOAuth, keycloak } from "better-auth/plugins";
import { ricochetOAuth } from "./ricochetOAuth.ts";

const callbackURL = "http://localhost:8080/api/auth/oauth2/callback/keycloak";
const relayURL = "http://localhost:8090/oauth2/callback";
const frontendURL = "http://localhost:5173/room/test";
let exchanges: URLSearchParams[] = [];

// Exercise BetterAuth's actual authorization, token exchange, and session paths
// against a local test IdP; no real credentials or accounts are used.
const issuer = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/.well-known/openid-configuration")) {
      return Response.json({
        // biome-ignore lint/style/useNamingConvention: OIDC protocol fields
        authorization_endpoint: `${url.origin}/authorize`,
        // biome-ignore lint/style/useNamingConvention: OIDC protocol fields
        token_endpoint: `${url.origin}/token`,
        // biome-ignore lint/style/useNamingConvention: OIDC protocol fields
        userinfo_endpoint: `${url.origin}/protocol/openid-connect/userinfo`,
      });
    }
    if (url.pathname === "/token") {
      exchanges.push(new URLSearchParams(await request.text()));
      return Response.json({
        // biome-ignore lint/style/useNamingConvention: OIDC protocol fields
        access_token: "test-access-token",
        // biome-ignore lint/style/useNamingConvention: OIDC protocol fields
        token_type: "Bearer",
        // biome-ignore lint/style/useNamingConvention: OIDC protocol fields
        expires_in: 3600,
      });
    }
    if (url.pathname === "/protocol/openid-connect/userinfo") {
      return Response.json({
        sub: "test-user",
        name: "Test User",
        email: "test@example.invalid",
        // biome-ignore lint/style/useNamingConvention: OIDC protocol field
        email_verified: true,
      });
    }
    return new Response(null, { status: 404 });
  },
});

afterAll(() => issuer.stop(true));
beforeEach(() => {
  exchanges = [];
});

const createTestAuth = (relay = true) =>
  betterAuth({
    secret: "ricochet-test-only-secret-at-least-32-characters",
    baseURL: "http://localhost:8080",
    trustedOrigins: ["http://localhost:5173"],
    plugins: [
      genericOAuth({
        config: [
          keycloak({
            clientId: "test-client",
            clientSecret: "test-client-secret",
            issuer: issuer.url.origin,
            redirectURI: relay ? relayURL : callbackURL,
            pkce: true,
          }),
        ],
      }),
      ...(relay ? [ricochetOAuth({ callbackURL, relayURL })] : []),
    ],
  });

const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

const startLogin = async (
  auth: ReturnType<typeof createTestAuth>,
  generic = false,
) => {
  const response = await auth.handler(
    new Request(
      `http://localhost:8080/api/auth/sign-in/${generic ? "oauth2" : "social"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          ...(generic ? { providerId: "keycloak" } : { provider: "keycloak" }),
          callbackURL: frontendURL,
        }),
      },
    ),
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { url: string };
  return { response, url: new URL(body.url), cookie: cookies(response) };
};

for (const generic of [false, true]) {
  test(`relay login preserves PKCE, token redirect, and frontend return (${generic ? "oauth2" : "social"})`, async () => {
    const auth = createTestAuth();
    const login = await startLogin(auth, generic);
    expect(login.url.searchParams.get("redirect_uri")).toBe(relayURL);
    const state = login.url.searchParams.get("state")!;
    const envelope = JSON.parse(Buffer.from(state, "base64url").toString());
    expect(envelope.return_to).toBe(callbackURL);
    expect(typeof envelope.state).toBe("string");
    if (!generic)
      expect(login.response.headers.get("location")).toBe(login.url.toString());
    const callback = new URL(callbackURL);
    callback.searchParams.set("state", state);
    callback.searchParams.set("code", "test-code");
    const response = await auth.handler(
      new Request(callback, { headers: { Cookie: login.cookie } }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(frontendURL);
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].get("redirect_uri")).toBe(relayURL);
    const verifier = exchanges[0].get("code_verifier")!;
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(
      login.url.searchParams.get("code_challenge"),
    );
    expect(
      response.headers
        .getSetCookie()
        .some(
          (cookie) =>
            cookie.includes("ricochet_state=") && cookie.includes("Max-Age=0"),
        ),
    ).toBe(true);
    const session = await auth.handler(
      new Request("http://localhost:8080/api/auth/get-session", {
        headers: { Cookie: cookies(response) },
      }),
    );
    expect((await session.json()).user.email).toBe("test@example.invalid");
  });
}

test("rejects missing, malformed, tampered, and other-browser state before token exchange", async () => {
  const auth = createTestAuth();
  const login = await startLogin(auth);
  const otherLogin = await startLogin(auth);
  const state = login.url.searchParams.get("state")!;
  const envelope = JSON.parse(Buffer.from(state, "base64url").toString());
  const tampered = Buffer.from(
    JSON.stringify({
      ...envelope,
      return_to: "https://attacker.invalid/callback",
    }),
  ).toString("base64url");
  for (const [candidate, cookie] of [
    ["", login.cookie],
    ["not-json", login.cookie],
    [tampered, login.cookie],
    [state, ""],
    [state, otherLogin.cookie],
  ]) {
    const callback = new URL(callbackURL);
    callback.searchParams.set("code", "test-code");
    callback.searchParams.set("state", candidate);
    const response = await auth.handler(
      new Request(callback, { headers: { Cookie: cookie } }),
    );
    expect(response.status).toBe(400);
  }
  expect(exchanges).toHaveLength(0);
});

test("provider errors still return through BetterAuth's error handler", async () => {
  const auth = createTestAuth();
  const login = await startLogin(auth);
  const callback = new URL(callbackURL);
  callback.searchParams.set("state", login.url.searchParams.get("state")!);
  callback.searchParams.set("error", "access_denied");
  const response = await auth.handler(
    new Request(callback, { headers: { Cookie: login.cookie } }),
  );
  expect(response.status).toBe(302);
  expect(
    new URL(response.headers.get("location")!).searchParams.get("error"),
  ).toBe("access_denied");
  expect(exchanges).toHaveLength(0);
});

test("without the relay plugin, direct callback configuration remains available", async () => {
  const login = await startLogin(createTestAuth(false));
  expect(login.url.searchParams.get("redirect_uri")).toBe(callbackURL);
  expect(login.cookie).not.toContain("ricochet_state");
});
