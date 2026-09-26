# Local development and OpenBao

CMU Maps reads local `.env` files. Use OpenBao to populate and refresh the shared
development credentials in those files. The generated files are git-ignored and
written with mode `0600`; never commit them or paste their contents into logs.

## First setup

Install the OpenBao CLI (`brew install openbao` on macOS), then run:

```sh
export BAO_ADDR=https://secrets.scottylabs.org
bao login -method=oidc -no-print
bun run secrets:setup
env -u DATABASE_URL bun run dev:web:noauth
```

The login command opens the browser for ScottyLabs authentication and caches the
OpenBao session. Git SSH authentication is separate. The setup script reuses the
cached session, or starts OIDC login if the session check fails in an interactive
terminal. Non-interactive execution fails with login instructions; it never waits
for a browser login. Connectivity and permission failures must be resolved before
retrying. See the [OpenBao login documentation](https://openbao.org/docs/commands/login/).

The script reads only the `secret` KV v2 mount under `secretspec/maps/dev/<KEY>`
at `https://secrets.scottylabs.org`, using each secret's `data.data.value` string.
The OpenBao address and development profile are fixed in the script. It does not
fall back to production or try to list parent paths.

## Refresh existing files

```sh
bun run secrets:pull
```

`secrets:setup` and `secrets:pull` run the same sync. Both create missing files,
replace OpenBao-managed values in existing files, and add missing local defaults.
They preserve existing local settings, custom entries, and `BETTER_AUTH_SECRET`.
Managed assignments are normalized; comments on those assignments are replaced.
Other comments and custom multiline entries are preserved.

| File | Values refreshed from OpenBao |
| --- | --- |
| `apps/server/.env` | `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_ISSUER`, `AUTH_JWKS_URI` |
| `apps/web/.env` | None; this file contains local configuration |
| `apps/dataflow/.env` | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET` |

`OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` supply the `AUTH_*` credentials.
`KEYCLOAK_URL` and `KEYCLOAK_REALM` form the issuer and JWKS URLs.
`CDN_S3_ENDPOINT` supplies the S3 hostname/port, and `CDN_ACCESS_KEY_ID` and
`CDN_SECRET_ACCESS_KEY` supply the S3 credentials. HTTPS endpoints are required.

New files use the local API at `http://localhost`, web app at
`http://localhost:5173`, and Postgres at
`postgresql://postgres:donotuseinprod@localhost:5432/cmumaps`.
The server gets a randomly generated local `BETTER_AUTH_SECRET`.
`SERVER_PORT` is omitted because the server schema expects a number and defaults
to port 80; remove this variable from older local files if present.

New files bypass app login by default. To explicitly switch an existing setup:

```sh
bun run secrets:pull --auth
# Or switch back to bypassing app login:
bun run secrets:pull --no-auth
```

Without either flag, existing login settings are preserved. OpenBao login is
required to fetch secrets regardless of whether the local app bypasses login.
Restart running apps after pulling changed credentials.

The script fetches and validates all required secrets before writing files. It
stages files with restrictive permissions and replaces each destination atomically.
A filesystem failure during publication can leave only some files updated; fix
the error and rerun sync. Symlink destinations are rejected. It never prints secret
values or raw read errors. Values that would be interpolated or cannot be quoted
consistently by Bun, dotenv-cli, and python-dotenv are rejected rather than changed.

Startup preflight validates local files without logging into OpenBao or rewriting
them. Missing or invalid configuration produces setup instructions. Local files
are plaintext snapshots: OpenBao session expiry does not delete them, and rotated
credentials require another explicit pull.

## Migration from Vault scripts

The `scripts/secrets` submodule is retained but is no longer used by the root
secrets commands or development preflight. It expects the obsolete per-app
`ScottyLabs/cmumaps/<environment>/<app>` layout.

The old `secrets:pull all local` arguments are no longer supported; use
`bun run secrets:pull`. `secrets:push` is disabled with an explanatory error.
An authorized maintainer should update shared credentials in OpenBao directly;
local `.env` files also contain machine-specific settings that must not be uploaded.

## Remaining setup gaps

- The current OpenBao dev keys do not provide the visualizer's
  `VITE_CLERK_PUBLISHABLE_KEY`. Supply that separately along with
  `VITE_SERVER_URL` in `apps/visualizer/.env`; the sync does not create this file.
- An Apple MapKit token was absent from the dev/prod key listings in the setup
  handoff. Map rendering still requires the appropriate MapKit configuration.
- The handoff reports that `cdn-maps` is empty. The dataflow client still hardcodes
  the old `cmumaps` bucket. This sync does not fix the bucket selection or supply
  datasets. Required objects are `floorplans/buildings.json`,
  `floorplans/floorplans.json`, `floorplans/placements.json`,
  `floorplans/all-graph.json`, and `floorplans/osm-pois.json`.
- Do not run the importer until the bucket/data issues are resolved. The importer
  drops existing tables first; keep its target local.

## Proposed future sync workflow

The current command implements the basic workflow: authenticate, explicitly pull,
then develop using local files. A more complete sync could add:

1. A versioned mapping manifest defining secret paths, local variable names, and
   which settings are owned by OpenBao versus the developer.
2. A `secrets:status` command and a pull dry run that report changed key names and
   KV version metadata without exposing values. Local overrides remain separate
   from generated credentials, with precedence defined for each app's loader.
3. Explicit conflict handling for locally edited managed values, removed secrets,
   and incomplete rotations across the current per-key KV entries. A failed read
   must never silently erase a working credential.
4. A rotation workflow: maintainer updates OpenBao, developer checks status and
   pulls, then restarts affected apps. Routine app startup stays independent of
   OpenBao availability.
5. Separate automation authentication for CI/deployments, scoped to the environment
   and required keys, rather than using a developer's cached OIDC session.

These are proposals, not additional commands implemented in this hotfix.

## Verification

```sh
bun test scripts/dev/secrets.test.ts
bun run sync
bun run check
```

Tests use synthetic credentials and temporary directories, never real local env
files. They cover refresh, local setting preservation, login mode selection,
private permissions, validation failures, symlink rejection, and dotenv loading.
