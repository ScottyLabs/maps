import posthog from "posthog-js";
import { env } from "@/env.ts";
import type { NavWaypointType } from "@/types/navTypes";
import type { SearchTarget } from "@/types/searchTypes";

// Governance's posthog feature points every project at PostHog's managed
// reverse proxy on a ScottyLabs domain, so ad blockers don't drop events
const DEFAULT_POSTHOG_HOST = "https://v.scottylabs.org";

// Custom events and their properties. Keep property names to a single
// lowercase word so they read the same in PostHog and pass the linter.
/** biome-ignore lint/style/useNamingConvention: posthog event names are in snake_case */
interface AnalyticsEvents {
  search_result_selected: {
    query: string;
    type: string;
    id: string;
    rank: number;
    target: SearchTarget | "none";
  };
  navigation_started: {
    route: string;
    from?: NavWaypointType;
    to?: NavWaypointType;
    distance?: number;
  };
  navigation_ended: { route: string };
  location_shared: Record<string, never>;
  map_view_changed: { mode: string };
  login_prompted: { source: "search" | "navigation" };
}

/** biome-ignore lint/style/useNamingConvention: environment variables are in all caps */
interface PublicEnv {
  PUBLIC_POSTHOG_KEY?: string;
  PUBLIC_POSTHOG_HOST?: string;
}

// Kennel serves a site's [scopes.public] secretspec values here at runtime.
// Anywhere else (Vercel, the Vite dev server) the SPA rewrite answers with
// index.html instead, which the content-type check filters out.
const loadKennelEnv = async (): Promise<PublicEnv> => {
  try {
    const response = await fetch("/_kennel/env.json");
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return {};
    }
    return (await response.json()) as PublicEnv;
  } catch {
    return {};
  }
};

// Resolves to whether PostHog was initialized, so calls made before init
// finishes are replayed afterwards and become no-ops without a key
let ready: Promise<boolean> = Promise.resolve(false);

const initAnalytics = () => {
  ready = (async () => {
    // Build-time values (Vercel, local .env) win over kennel's runtime ones
    const runtimeEnv = env.VITE_PUBLIC_POSTHOG_KEY ? {} : await loadKennelEnv();
    const key = env.VITE_PUBLIC_POSTHOG_KEY || runtimeEnv.PUBLIC_POSTHOG_KEY;
    if (!key) {
      return false;
    }

    // https://posthog.com/docs/libraries/js/config
    posthog.init(key, {
      // biome-ignore lint/style/useNamingConvention: posthog config is in snake_case
      api_host:
        env.VITE_PUBLIC_POSTHOG_HOST ||
        runtimeEnv.PUBLIC_POSTHOG_HOST ||
        DEFAULT_POSTHOG_HOST,
      // Needed for the PostHog toolbar, since api_host is the reverse proxy
      // biome-ignore lint/style/useNamingConvention: posthog config is in snake_case
      ui_host: "https://us.posthog.com",
      // biome-ignore lint/style/useNamingConvention: posthog config is in snake_case
      person_profiles: "identified_only",
      // Includes pageviews on history changes; they fire only when the
      // pathname changes, so viewport query param updates are not counted
      defaults: "2026-01-30",
    });
    return true;
  })();
};

const whenReady = (callback: () => void) => {
  ready
    .then((initialized) => {
      if (initialized) {
        callback();
      }
    })
    .catch(() => undefined);
};

const track = <E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
) => {
  whenReady(() => posthog.capture(event, properties));
};

// Ties events to the signed-in user. Only resets after a previously
// identified user signs out, so anonymous visitors keep one distinct ID.
const setAnalyticsUser = (userId: string | null) => {
  whenReady(() => {
    if (userId) {
      posthog.identify(userId);
    } else if (posthog.get_property("$user_state") === "identified") {
      posthog.reset();
    }
  });
};

export { initAnalytics, setAnalyticsUser, track };
