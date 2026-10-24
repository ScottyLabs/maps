# CMU Maps Server

The backend is the REST API for the web app and visualizer.

## Local development

Use the [native running guide](../../docs/src/Setup.md). Kennel/devenv supplies
PostgreSQL through a private Unix socket. The app helper selects that database
and starts the API on `127.0.0.1:8080`. Startup applies the schema without
populating map records. Run `bun run sync` from the repository root before checks
or builds.

The [fresh-source workflow](../../docs/src/FMS-Capture.md#load-the-candidate)
validates generated JSONs, imports them into a separate candidate schema,
prepares search/graph caches, and then activates one complete preview. The
baseline importer remains available after explicitly restoring the baseline.

Browser login uses Better Auth, Keycloak and Ricochet. Population requires a
signed, unexpired token from `AUTH_ISSUER` with `/projects/maps/admins` in its
groups. Audience is not required by the branch's current policy. The running
guide documents the separate OpenBao and application login steps.
