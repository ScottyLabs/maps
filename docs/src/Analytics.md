# Analytics

The web app sends product analytics to [PostHog](https://posthog.com). Everything lives in `apps/web/src/lib/analytics.ts`; components only call `track()`.

## Configuration

Governance's `posthog` feature created the project and writes its key and host to OpenBao on the `prod` profile. Without a key, in local development and previews, the SDK is never initialized and nothing is sent.

The app looks for the key in this order:

1. `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST`, inlined at build time (Vercel, or a local `apps/web/.env`)
2. `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST` from `/_kennel/env.json`, which kennel serves at runtime from the `[scopes.public]` values in `secretspec.toml`; it is only fetched when no build-time key is set

The host defaults to `https://v.scottylabs.org`, PostHog's managed reverse proxy on a ScottyLabs domain, so ad blockers that filter PostHog's own domains don't drop events.

## What is captured

- Page views on every pathname change, which covers selecting a building, floor or room. Viewport updates only change the query string, so they are not counted.
- PostHog's default autocapture of clicks and page leaves
- Signed-in users are identified by their user ID. Anonymous visitors keep one ID until a signed-in user signs out.

Custom events:

| Event | Properties | Fired when |
| --- | --- | --- |
| `search_result_selected` | `query`, `type`, `id`, `rank`, `target` | A search result is picked, including as a navigation start or destination |
| `login_prompted` | `source` (`search` or `navigation`) | A signed-out user hits a non-public building |
| `navigation_started` | `route`, `from`, `to`, `distance` (ft) | The GO button is pressed |
| `navigation_ended` | `route` | The End button is pressed |
| `location_shared` | | The share button copies a link |
| `map_view_changed` | `mode` | A different map view is chosen |

## Adding an event

Add the event and its properties to `AnalyticsEvents` in `analytics.ts`, then call `track()`:

```ts
import { track } from "@/lib/analytics.ts";

track("map_view_changed", { mode: "satellite" });
```

Calls made before PostHog finishes loading are sent once it does. Never put the user's own position in an event.

## Testing locally

Put a key in `apps/web/.env` and open the app with `?__posthog_debug=true` to log every event to the console. Use a separate PostHog project rather than the production key, so test traffic doesn't skew the numbers.
