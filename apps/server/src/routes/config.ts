import { Elysia, t } from "elysia";

// Public, build-independent client config. The SPAs are built in a sandbox with
// no secrets, so anything a browser needs is served from here at runtime.
export const configRoute = new Elysia().get(
  "/config",
  () => ({
    googleMapsApiKey: Deno.env.get("GOOGLE_MAPS_API_KEY") ?? null,
    ignoreLogin: Deno.env.get("IGNORE_LOGIN") === "true",
    mapkitToken: Deno.env.get("MAPKIT_TOKEN") ?? null,
    posthogHost: Deno.env.get("POSTHOG_HOST") ?? null,
    posthogKey: Deno.env.get("POSTHOG_KEY") ?? null,
  }),
  {
    response: {
      200: t.Object({
        googleMapsApiKey: t.Union([t.String(), t.Null()]),
        ignoreLogin: t.Boolean(),
        mapkitToken: t.Union([t.String(), t.Null()]),
        posthogHost: t.Union([t.String(), t.Null()]),
        posthogKey: t.Union([t.String(), t.Null()]),
      }),
    },
  },
);
