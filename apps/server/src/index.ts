import { staticPlugin } from "@elysia/static";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { elysiaLogger } from "@logtape/elysia";
import { Elysia } from "elysia";
import {
  buildLoginUrl,
  buildOidcConfig,
  createRelayState,
  exchangeCodeForClaims,
  loadOidcSettings,
} from "./auth/oidc.ts";
import {
  createSession,
  deleteSession,
  OAUTH_STATE_COOKIE_NAME,
  oauthStateCookieOptions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "./auth/session.ts";
import { claimedGroups, getOrCreateUser } from "./auth/user.ts";
import { healthRoute } from "./routes/health.ts";
import { apiRoutes } from "./routes/index.ts";
import { meRoute } from "./routes/me.ts";
import { wsRoutes } from "./routes/ws.ts";
import { configureLogger, logger } from "./utils/log.ts";

await configureLogger();

const port = Number.parseInt(Deno.env.get("PORT") ?? "", 10);
if (!port) {
  logger.error("PORT is not set");
  Deno.exit(1);
}

const appUrl = Deno.env.get("APP_URL");
const staticDir = Deno.env.get("STATIC_DIR");
const visualizerDir = Deno.env.get("VISUALIZER_DIR");

const oidcSettings = appUrl ? loadOidcSettings() : undefined;
const oidcConfig = oidcSettings ? await buildOidcConfig(oidcSettings) : undefined;
if (oidcConfig) {
  logger.info("OIDC discovery completed");
} else {
  logger.warn(
    "OIDC is not configured (needs APP_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, KEYCLOAK_URL, KEYCLOAK_REALM, OAUTH_RELAY_URL); /api/auth/login is disabled",
  );
}
function appRedirect(redirect: (url: string) => Response, path: string): Response {
  return appUrl
    ? redirect(new URL(path, appUrl).href)
    : new Response(null, { headers: { Location: path }, status: 302 });
}

const api = new Elysia({ prefix: "/api" })
  .use(elysiaLogger({ category: "cmumaps-server" }))
  .use(openapi({ path: "/docs", references: fromTypes() }))
  .use(healthRoute)
  .use(meRoute)
  .use(apiRoutes)
  .use(wsRoutes)
  .get("/auth/login", ({ cookie, redirect }) => {
    if (!oidcConfig || !oidcSettings || !appUrl) {
      return appRedirect(redirect, "/");
    }

    const state = createRelayState(`${appUrl}/api/auth/callback`);
    cookie[OAUTH_STATE_COOKIE_NAME].set({
      value: state,
      ...oauthStateCookieOptions,
    });

    return redirect(buildLoginUrl(oidcConfig, oidcSettings, state).href);
  })
  .get("/auth/callback", async ({ cookie, redirect, request }) => {
    if (!oidcConfig) {
      return appRedirect(redirect, "/");
    }

    const expectedState = cookie[OAUTH_STATE_COOKIE_NAME].value;
    cookie[OAUTH_STATE_COOKIE_NAME].remove();
    if (typeof expectedState !== "string" || expectedState === "") {
      logger.warn("OIDC callback without a matching oauth_state cookie");
      return appRedirect(redirect, "/");
    }

    try {
      const claims = await exchangeCodeForClaims(oidcConfig, request, expectedState);
      if (!claims) {
        logger.error("OIDC callback: token response carried no ID token");
        return appRedirect(redirect, "/");
      }

      const user = await getOrCreateUser(claims);
      const sessionId = await createSession(user.id, claimedGroups(claims));
      cookie[SESSION_COOKIE_NAME].set({
        value: sessionId,
        ...sessionCookieOptions,
      });
    } catch (error) {
      logger.error("OIDC callback failed: {error}", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return appRedirect(redirect, "/");
  })
  .get("/auth/logout", async ({ cookie, redirect }) => {
    const sessionId = cookie[SESSION_COOKIE_NAME].value;
    if (typeof sessionId === "string" && sessionId !== "") {
      await deleteSession(sessionId);
    }
    cookie[SESSION_COOKIE_NAME].remove();
    return appRedirect(redirect, "/");
  });

const app = new Elysia().use(api);

if (visualizerDir) {
  app.use(
    staticPlugin({
      assets: visualizerDir,
      indexHTML: true,
      prefix: "/visualizer",
    }),
  );
}

if (staticDir) {
  app.use(staticPlugin({ assets: staticDir, indexHTML: true, prefix: "/" }));

  const webIndex = await Deno.readTextFile(`${staticDir}/index.html`);
  const visualizerIndex = visualizerDir
    ? await Deno.readTextFile(`${visualizerDir}/index.html`)
    : undefined;

  app.onError(({ code, path, set }) => {
    if (code !== "NOT_FOUND" || path.startsWith("/api")) {
      return;
    }
    set.status = 200;
    return new Response(
      visualizerIndex && path.startsWith("/visualizer") ? visualizerIndex : webIndex,
      { headers: { "content-type": "text/html; charset=utf-8" }, status: 200 },
    );
  });
} else {
  logger.warn("STATIC_DIR is not set; run the Vite dev servers for the UIs");
}

Deno.serve(
  {
    onListen: ({ hostname }) => {
      logger.info(`Listening on ${appUrl || `http://${hostname}:${port}`}`);
    },
    port,
  },
  app.handle,
);
