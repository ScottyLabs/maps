# CMU Maps visualizer

Use the [native setup guide](../../docs/src/Setup.md). `python3 scripts/dev/dev.py start`
starts the visualizer at [localhost:5174](http://localhost:5174), alongside the API
and web app. Log in with Keycloak; the API and sockets share the Better Auth
session. No Clerk account or Clerk credentials are needed.

For manual startup inside the pinned environment, use `bun run dev:visualizer`
with the API's native database environment configured as described in the guide.
Do not start a second API over the all-in-one launcher.

The [workspace editing guide](../../docs/src/Data-Visualizer-Wiki.md) covers saving
working JSON, placing a reference floor, fetching public sources, and explicitly
building/loading a preview. The [work queue](../../docs/src/Data-Pipeline-TODO.md)
links the current dated handoff and remaining implementation tasks.
