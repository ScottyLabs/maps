# AGENTS.md

## Overview

CMU Maps is a Deno workspace monorepo deployed by [kennel](https://docs.kennel.scottylabs.org). The root `deno.json` lists the workspace members and shared tasks; each app/package declares its own dependencies.

| Member | What it is |
| -- | -- |
| `apps/server` | Elysia API on Deno. Serves `/api/*`, plus both SPAs as static files in production. |
| `apps/web` | Public map SPA (React + Vite), served at `/`. |
| `apps/visualizer` | Internal floorplan editor (React + Vite), served at `/visualizer`. |
| `apps/dataflow` | Python (uv) scrapers and the database population job. Operator-run, never deployed. |
| `packages/*` | Shared types and utilities. |
| `docs` | Zensical project docs, deployed as the `docs` site. Preview with `docs` in the dev shell. |

## Environment

Everything comes from `flake.nix`, built on kennel's flake module. `nix develop` gives you Deno, Python/uv, PostgreSQL, pitchfork, the `bao`/`secretspec` CLIs, the git hooks, and every secret of the `dev` profile resolved out of OpenBao.

- One-time per machine: install Lix with the ScottyLabs cache, then `nix run git+https://git.cmu.dev/ScottyLabs/kennel#login` (see [local development](https://docs.kennel.scottylabs.org/guides/local-development/)).
- Secrets are declared in `secretspec.toml` under project name `maps`. Check with `secretspec check`.
- `DATABASE_URL` is a unix-socket URL from kennel's postgres module locally and from kennel in deployments. `PORT`, `APP_URL` and `COMMIT_HASH` are injected by kennel. None of them belong in `secretspec.toml`.
- Shell state (Deno cache, local Postgres) lives in `.scottylabs/`.
- `apps/dataflow` reads its own `.env` (`cp .env.example .env`); it is not part of secretspec.

## Standard commands

- Dev: `pitchfork start --local` starts Postgres, Ricochet, the server on `:3001`, web on `:5173` and the visualizer on `:5174` (both proxy `/api`). `pitchfork logs <name>`, `pitchfork stop --local`.
- Dev without auth: `pitchfork stop server`, then `IGNORE_LOGIN=true secretspec run -- deno task dev:server`
- Type check: `deno task check` (browser code is excluded; Vite builds cover it)
- Build a deploy target: `nix build .#services.x86_64-linux.server.package` (or `.#sites.x86_64-linux.docs.package`)
- Regenerate the Prisma client: `deno task db-generate`
- Regenerate `apps/server/build/openapi.{json,d.ts}` for the web client: `deno task openapi`
- Push schema in dev: `deno task db-push`
- Run every git hook (formatting, oxlint, deno check/test, ruff, ty, pytest): `prek run --all-files`

## Auth

Keycloak OIDC through the Ricochet relay, the same structure as `ScottyLabs/housing`:

- `GET /api/auth/login` -> relay -> Keycloak -> `GET /api/auth/callback` -> session cookie
- Session rows live in Postgres (`Session`), keyed to a `User` upserted on the OIDC subject
- `GET /api/me` returns the session user and their Keycloak `groups`
- Route authorization uses the `auth` macro from `apps/server/src/auth/middleware.ts`: `auth: "user" | "member" | "admin"`, or `optionalAuth: true` for routes that tolerate anonymous callers. `member`/`admin` are checked against `PROJECT_GROUP`/`PROJECT_ADMIN_GROUP`.
- `IGNORE_LOGIN=true` short-circuits every check to a synthetic admin, for local development; `/api/me` returns that admin, so the SPAs need no flag of their own.
- Machine clients (`apps/dataflow`) send a Keycloak client-credentials bearer token, verified against the realm JWKS.

## Browser configuration

The SPAs are built once for every environment, so nothing is inlined by Vite. Browser-facing values are kennel [public values](https://docs.kennel.scottylabs.org/guides/deploying/#public-values): `PUBLIC_*` secrets listed in `[scopes.public]` of `secretspec.toml`, which kennel serves for the branch's profile at `/_kennel/env.json`. Each SPA's `env.ts` fetches it in `main.tsx` before rendering. Locally, a small Vite plugin in each `vite.config.ts` serves the same file from the `PUBLIC_*` variables `secretspec run` resolves. Add a value by declaring it in `secretspec.toml`, listing it in `[scopes.public]`, and exposing it as a getter on the app's `env.ts`. Anyone can read these, so only list values that are safe to publish.

## Deployment

nixbot builds the flake's checks on every push to `main`, `staging`, `dev`, and on pull requests; kennel then deploys the result with the branch's secretspec profile.

- `services.server` is the compiled server, with `STATIC_DIR` and `VISUALIZER_DIR` set to the two built SPAs through `env`, so one service serves everything. Its custom domain is `cmumaps.com`.
- `sites.docs` is the Zensical site in `docs/`, built with `helpers.buildZensical`.
- `GET /api/health` must keep returning `200`; kennel gates every deployment on it.
- Preview deployments land at `maps-server-pr-<n>.scottylabs.net` with their own database.
