# Running locally

## Quick start

**Start the app, populate your database, restart, then open CMU Maps.**
Use a macOS or Linux terminal, or a WSL2 terminal on Windows. Run commands from
the repository root after installing the [prerequisites](#prerequisites).

### 1. Log in and start (terminal 1)

```sh
export BAO_ADDR=https://secrets.scottylabs.org
bao login -method=oidc
python3 scripts/dev/dev.py start
```

Leave this terminal running. Nix downloads the pinned toolchain on the first run.
Devenv starts PostgreSQL and the OAuth relay; the app process installs Bun
packages, generates API/database code, applies the local schema, and starts the
API and web app. The new database has tables but no campus data yet.

### 2. Populate (terminal 2)

Open another terminal in the repository root. Continue only if the check succeeds:

```sh
python3 scripts/dev/dev.py populate --check
python3 scripts/dev/dev.py populate
```

This reads the shared temporary S3 dataset and replaces your local map tables.
It does not scrape or publish data. Each developer has their own database.
The bucket currently contains the partial Ansys test dataset: five processed
floors, with indoor routing still incomplete. Add `--include-pois` to both commands
to validate and import its 34 point POIs. See the dated
[storage checkpoint](Data-Storage.md#current-bucket-checkpoint--october-24-2026-1410-edt)
for coverage and the matching saved scrape.

### 3. Restart and open

Stop the stack with Ctrl-C in terminal 1, then restart to rebuild backend caches:

```sh
python3 scripts/dev/dev.py stop
python3 scripts/dev/dev.py start --skip-secrets
```

Open [localhost:5173](http://localhost:5173). The visualizer runs at
[localhost:5174](http://localhost:5174) and uses the same Keycloak session. On later sessions, use
`start --skip-secrets`. Populate again only when refreshing your local dataset.
The explicit `stop` also handles a process manager left running in the background.

## Prerequisites

Install these yourself; the launcher reports missing dependencies:

- Git and Python 3.9 or newer for the launcher.
- [Nix and devenv](https://devenv.sh/getting-started/), following the instructions
  for your operating system. Use the current devenv CLI.
- [OpenBao CLI](https://openbao.org/docs/install/) (`bao`) and Maps development
  secret access.

| Platform | Where to run |
| --- | --- |
| macOS | Native terminal, including Apple Silicon |
| Linux | Native terminal as your normal user |
| Windows | WSL2 Linux terminal; install Nix, devenv, Python, and Bao inside WSL |

Windows PowerShell cannot run Nix directly. Keep the checkout in the WSL Linux
filesystem and use an editor connected to WSL. OpenBao login must happen inside
WSL too; a Windows login does not automatically authenticate the Linux CLI.

Verify `nix --version`, `devenv version`, and `bao version` work. Open a new shell
after installing Nix so its environment is loaded. Docker, Colima, and Docker
Desktop are not used by this development workflow. Nix supplies Bun, Node,
Python 3.12, uv, PostgreSQL, and the relay through the committed scaffold/lock.
The launcher does not install system tools, request sudo, or perform your login.

## Everyday commands

```sh
python3 scripts/dev/dev.py start --skip-secrets
python3 scripts/dev/dev.py secrets
python3 scripts/dev/dev.py shell
python3 scripts/dev/dev.py logs
python3 scripts/dev/dev.py logs postgres
python3 scripts/dev/dev.py stop
```

`secrets` refreshes the saved env files without starting anything. `shell` enters
the pinned development environment. `logs` shows recent app output; name `postgres` or `ricochet` to inspect those
services. `devenv up` shows live process output. `stop` stops the stack and preserves data.
Use one process manager per checkout; stop it before changing the Nix service
configuration and starting again.

The web app requires port 5173, the visualizer 5174, and the API 8080. Startup needs no root
privileges. Ricochet uses Kennel's fixed loopback port 8090. PostgreSQL uses a
private Unix socket rather than a TCP port. Stop other applications using these
HTTP ports before startup; Vite will fail rather than silently choose another.

## What startup does

1. Checks for devenv and, unless `--skip-secrets` is supplied, your OpenBao login.
2. Fetches six app entries and `TEMP_DEV_S3`. It validates all values before
   replacing server/web/visualizer/dataflow `.env` and `.env.local` files. Refreshing replaces
   local edits in those eight files.
3. Runs `devenv up`. Kennel starts PostgreSQL and Ricochet as native processes.
4. The app helper waits for both services, then runs `bun install --frozen-lockfile`.
5. Runs `bun run sync` to generate Prisma, tsoa, and OpenAPI artifacts, followed by
   `prisma db push --skip-generate`. It does not accept destructive schema changes
   automatically.
6. Starts the backend and both Vite applications. Importing campus data remains a separate command.

Code generation makes the server's database client and API types available.
Applying the schema creates tables; population is the later JSON-to-database
operation. Startup never resets or imports map records.

## Secrets and login

App values are KV v2 entries under mount `secret`, path
`secretspec/maps/dev/<NAME>`, with a string field named `value`:

| OpenBao entry | Used as |
| --- | --- |
| `OIDC_CLIENT_ID` | Server `AUTH_CLIENT_ID` |
| `OIDC_CLIENT_SECRET` | Server `AUTH_CLIENT_SECRET` |
| `KEYCLOAK_URL`, `KEYCLOAK_REALM` | Server issuer and JWKS URL |
| `OAUTH_RELAY_URL` | Server callback relay URL |
| `MAPKIT_TOKEN` | Web `VITE_MAPKIT_TOKEN` |

The grouped `TEMP_DEV_S3` record at `secret/secretspec/maps/dev/TEMP_DEV_S3`
contains `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, and
`S3_SECRET_KEY`. Those settings go only into the ignored dataflow env files.
The browser receives the MapKit token and local API URL; identity and storage
credentials stay in backend/dataflow files. Env files use owner-only POSIX
permissions. Never commit them or your OpenBao token.

The current temporary bucket is `categorized-lockerbox-v9qy6t` at
`https://t3.storageapi.dev`, region `auto`. Changing its OpenBao record changes the
shared source. The app/database URL is local configuration, not a hosted secret.
Kennel supplies the PostgreSQL socket; the app helper explicitly selects that
socket so stale Docker database settings cannot choose another database.

OpenBao authenticates the developer. Application browser login is separate:

```text
Browser -> API on localhost:8080 -> Keycloak
Keycloak -> registered OAUTH_RELAY_URL -> Ricochet on localhost:8090
Ricochet -> localhost:8080/api/auth/oauth2/callback/keycloak -> web session
```

The backend wraps the return URL in OAuth state and binds it to a signed cookie.
Kennel enables Ricochet with `scottylabs.ricochet.enable`; its native loopback
binding needs no override or Docker forwarding. Use the relay URL from OpenBao.
Changing local settings does not register a new redirect with Keycloak.
The visualizer returns through the same relay/API callback to its own local
origin. `AUTH_TRUSTED_ORIGINS` allows that additional frontend origin. API
requests and sockets use the Better Auth session cookie; Clerk is not required.

Population uses a Keycloak service-account token through `client_credentials`.
Its `groups` claim must contain `/projects/maps/admins`. The backend validates
signature, expiration, issuer, and group; audience is not required by the current
policy. Your personal Bao login does not grant this API permission.

## Populate the local database

This imports the current shared S3 baseline, now the partial Ansys snapshot
described in [Data storage](Data-Storage.md). For a freshly captured workspace,
use [build and load preview](FMS-Capture.md#generate-an-application-candidate)
instead. That path stages a separate local schema transactionally and refreshes
caches automatically. If a generated preview is active, run
`devenv shell -- bash scripts/dev/pipeline.sh baseline` before ordinary population.

With the app running:

```sh
python3 scripts/dev/dev.py populate --check
python3 scripts/dev/dev.py populate
```

| S3 object key | Contents |
| --- | --- |
| `floorplans/buildings.json` | Building metadata |
| `floorplans/floorplans.json` | Room geometry and labels |
| `floorplans/placements.json` | Floor placements |
| `floorplans/all-graph.json` | Navigation graph |
| `floorplans/osm-pois.json` (optional) | Points of interest |

`--check` validates the models/references and sends an empty building batch to
check backend authorization without clearing tables. Population clears the seven
map tables, then imports records. POIs remain empty unless `--include-pois` is
supplied and the optional file exists. Authentication records are retained.

Missing credentials, objects, or validation failures abort before reset. A later
write failure can leave partial map records because the existing importer is not
one transaction; resolve the failure and rerun. Restart the app afterward so its
search index and graph cache reflect the imported data.

The importer always targets `http://localhost:8080` in local mode. It reads auth
from `apps/server/.env` and storage from `apps/dataflow/.env`, ignoring inherited
storage variables. Population reads hosted storage without modifying it. Fresh
capture/generation is covered by the [pipeline specification](Data-Pipeline-Spec.md);
raw source artifacts are not valid substitutes for the processed JSONs above.

## Manual run

These are the same stages the launcher performs, separated for inspection.

### 1. Refresh secrets

After `bao login -method=oidc`:

```sh
python3 scripts/dev/dev.py secrets
```

[`pull_secrets`](../../scripts/dev/dev.py) runs `bao kv get -format=json
-mount=secret secretspec/maps/dev/<NAME>` and reads `data.data.value`. For
`TEMP_DEV_S3`, it reads the five fields directly from `data.data`. All values are
validated before any env file is replaced; downloaded content is never executed
as shell code.

### 2. Enter the environment and start services

```sh
devenv shell
devenv up postgres ricochet
```

Leave that terminal running. In another terminal, enter the environment and start
the app helper:

```sh
devenv shell
bash scripts/dev/app.sh
```

[`app.sh`](../../scripts/dev/app.sh) selects Kennel's PostgreSQL socket, waits for
PostgreSQL and relay health, and executes:

```sh
bun install --frozen-lockfile
bun run sync
(cd apps/server && bunx prisma db push --skip-generate)
bunx turbo dev --env-mode=loose --filter=@cmumaps/web --filter=@cmumaps/server --filter=@cmumaps/visualizer
```

The helper supplies the local API port/URLs and an explicit database user in the
socket URL for Prisma. On Linux, Nix supplies OpenSSL and C++ shared libraries
needed by Prisma's downloaded engines. No global runtime profile is modified.
Run either this manual split or the all-in-one startup, so two app processes
cannot race for the same ports.

### 3. Populate explicitly

In a third terminal:

```sh
devenv shell
bash scripts/dev/populate.sh --check
bash scripts/dev/populate.sh
```

The helper runs the minimal population dependency group with Nix's Python 3.12
and uv. Its virtual environment lives under `.devenv/state/dataflow-venv`:

```sh
cd apps/dataflow
uv run --locked --only-group populate --python "$(command -v python3)" python -m deserializer --local --skip-pois --check
```

The helper also sets `PYTHONPATH=src`, `UV_PROJECT_ENVIRONMENT`, and disables uv's
Python downloads. Remove `--check` to import; `--include-pois` on the helper
removes the importer's `--skip-pois`. Stop and restart the app when done.

## Checks and maintenance

Run checks in the pinned shell:

```sh
devenv shell
bun run sync
bun run check
bun test apps/server/src/lib/ricochetOAuth.test.ts
python3 -m unittest discover -s scripts/dev/tests -v
```

See the [dataflow README](../../apps/dataflow/README.md) for Python checks.
`devenv.lock` pins the project inputs; use `devenv update` only when deliberately
upgrading them and review its diff.

PostgreSQL data live under `.devenv/state`, independently of the old Docker
volume. Switching starts a fresh local database; run population after startup.
The migration does not delete Docker volumes. If you need previous local edits,
export them before retiring the old setup. Stop processes before moving the
checkout or removing state. Deleting `.devenv/state` deletes the native database.
Keep source captures/datasets under ignored `uploads/` and credentials in env files.
