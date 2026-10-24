# AGENTS.md

## Overview

CMU Maps is a Deno workspace monorepo deployed by [kennel](https://docs.kennel.scottylabs.org).
The root `deno.json` lists the workspace members and shared tasks; each app/package declares its
own dependencies.

| Member | What it is |
|---|---|
| `apps/server` | Elysia API on Deno. Serves `/api/*`, plus both SPAs as static files in production. |
| `apps/web` | Public map SPA (React + Vite), served at `/`. |
| `apps/visualizer` | Internal floorplan editor (React + Vite), served at `/visualizer`. |
| `apps/dataflow` | Python (uv) scrapers and the database population job. Operator-run, never deployed. |
| `packages/*` | Shared types and utilities. |

## Environment

Everything comes from devenv. Enter the shell (`devenv shell`, or let direnv do it) and you get
Deno, Python/uv, PostgreSQL, the `bao`/`secretspec` CLIs, and every secret resolved out of OpenBao.

- One-time per machine: `nix run git+https://codeberg.org/ScottyLabs/kennel#login`
- Secrets are declared in `secretspec.toml` under project name `maps` and live at
  `secret/secretspec/maps/<profile>/<KEY>` in OpenBao. Check with `secretspec check -P dev`.
- `DATABASE_URL` comes from the devenv postgres module locally and from kennel in deployments.
  `PORT`, `APP_URL` and `COMMIT_HASH` are injected by kennel. None of them belong in `secretspec.toml`.
- `apps/dataflow` reads its own `.env` (`cp .env.example .env`); it is not part of secretspec.

## Standard commands

- Dev (server + web): `deno task dev:web` — backend on `:3001`, Vite on `:5173` proxying `/api`
- Dev without auth: `deno task dev:web:noauth` (sets `IGNORE_LOGIN`/`VITE_IGNORE_LOGIN`)
- Dev (server + visualizer): `deno task dev:visualizer` (Vite on `:5174`)
- Type check: `deno task check` (browser code is excluded; Vite builds cover it)
- Build everything: `deno task build`
- Regenerate the Prisma client: `deno task db-generate`
- Regenerate `apps/server/build/openapi.{json,d.ts}` for the web client: `deno task openapi`
- Push schema in dev: `deno task db-push`
- Python lint: `cd apps/dataflow && uv run lint`

## Auth

Keycloak OIDC through the Ricochet relay, the same structure as `ScottyLabs/housing`:

- `GET /api/auth/login` → relay → Keycloak → `GET /api/auth/callback` → session cookie
- Session rows live in Postgres (`Session`), keyed to a `User` upserted on the OIDC subject
- `GET /api/me` returns the session user and their Keycloak `groups`
- Route authorization uses the `auth` macro from `apps/server/src/auth/middleware.ts`:
  `auth: "user" | "member" | "admin"`, or `optionalAuth: true` for routes that tolerate anonymous
  callers. `member`/`admin` are checked against `PROJECT_GROUP`/`PROJECT_ADMIN_GROUP`.
- `IGNORE_LOGIN=true` short-circuits every check to a synthetic admin, for local development.
- Machine clients (`apps/dataflow`) send a Keycloak client-credentials bearer token, verified
  against the realm JWKS.

## Browser configuration

The SPAs are built by Nix in a sandbox with no secrets, and a preview's values are not knowable
at build time, so nothing is inlined by Vite. `GET /api/config` serves the browser-facing values
(`mapkitToken`, `googleMapsApiKey`, `posthogKey`, `posthogHost`, `ignoreLogin`) from server env at
runtime, and each SPA awaits it in `main.tsx` before rendering. Add a new browser value by
declaring it in `secretspec.toml`, returning it from `apps/server/src/routes/config.ts`, and
exposing it as a getter on the app's `env.ts`.

## Deployment

Kennel builds the flake on every push to `main`, `staging`, `dev`, and on pull requests.

- `flake.nix` exposes `server`, `web` and `visualizer`. The `server` binary is wrapped with
  `STATIC_DIR` and `VISUALIZER_DIR` pointing at the two built SPAs, so one service serves everything.
- `devenv.nix` declares `scottylabs.kennel.services.server.customDomain = "cmumaps.com"`.
- `GET /api/health` must keep returning `200`; kennel gates every deployment on it.
- Preview deployments land at `maps-server-pr-<n>.scottylabs.net` with their own database.
