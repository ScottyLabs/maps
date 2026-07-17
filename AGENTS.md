# AGENTS.md

## Cursor Cloud specific instructions

### Overview

CMU Maps is a Deno workspace monorepo with 4 apps and 3 shared packages. Each app/package has its own `deno.json` declaring its dependencies; the root `deno.json` lists the workspace members and shared tasks. See `README.md` and `.github/CONTRIBUTING.md` for general project info.

### Services

| Service | Port | How to start |
| -- | -- | -- |
| PostgreSQL 17 | 5432 | `sudo docker start cmumaps-postgres` (or create via `docker run`) |
| Server (`@cmumaps/server`) | 80 | `cd apps/server && deno run -A --watch --env-file=.env src/server.ts` |
| Web app (`@cmumaps/web`) | 5173 | `cd apps/web && deno run -A npm:vite --port 5173 --host` |

### Key gotchas

- **`DATABASE_URL` in shell env**: The VM may have a stale `DATABASE_URL` env var (e.g. `postgres:5432` from Docker Compose). Always `unset DATABASE_URL` before starting the server, or rely on `dotenv -e .env` properly. The server's `.env` should point to `localhost:5432`.
- **`SERVER_PORT` in Zod v4**: `z.number()` in Zod v4 does NOT coerce strings. Do NOT set `SERVER_PORT` in `.env`; let it default to 80. Use `sudo setcap cap_net_bind_service=+ep $(which deno)` to allow binding port 80 without root.
- **Code generation before lint/build**: Before running `deno task check`, `deno task tsc`, or `deno task build`, you must first generate the server's build artifacts: `deno task db-generate && deno task tsoa && deno task openapi` (or use `deno task sync` from the root).
- **Pre-commit hooks** (`.husky/pre-commit`): Runs `editorconfig-checker`, `deno task check`, and `uv run lint` for Python. These are automatically run by husky on commit.

### Populating the database from S3

The dataflow app reads JSON from S3 and POSTs to the server's `/populate-table/*` endpoints. Required env vars in `apps/dataflow/.env`: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SERVER_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`. The server must be running with valid OIDC config (AUTH_ISSUER, AUTH_JWKS_URI derived from `tsoa.json`'s openIdConnectUrl). Run: `cd apps/dataflow && uv run populate-database`. After populating, restart the server to rebuild the in-memory search index and graph cache.

### Standard commands

- **Lint/check**: `deno task check` (runs `deno check` across all workspace members)
- **Python lint**: `cd apps/dataflow && uv run lint`
- **Build**: `deno task build`
- **Dev (server + web)**: `deno task dev:web` (uses `concurrently` to start both)
- **Dev (server + web, no auth)**: `deno task dev:web:noauth` (bypasses all CMU login checks — sets `IGNORE_LOGIN=true` and `VITE_IGNORE_LOGIN=true). Use this for local development and testing features that requires authentication(e.g. viewing floorplans, path finding to POIs).
- **Dev (server only)**: `deno task dev:server`
- See `deno.json` tasks for the full list.
