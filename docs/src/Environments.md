# Environments

## Local development

Follow [Running locally](Setup.md). Nix/devenv runs native processes on macOS,
Linux, or Windows through WSL2. Kennel's modules provide PostgreSQL and Ricochet.
This does not deploy the app or provision hosted services.

| Component | Local address | Configuration |
| --- | --- | --- |
| Web | `http://localhost:5173` | Vite with a fixed port |
| API | `http://localhost:8080` | Bun; unprivileged port |
| OAuth relay | `http://localhost:8090` | Kennel Ricochet on loopback |
| PostgreSQL | Private Unix socket | Kennel PostgreSQL 18, database `maps` |
| Dataset source | `https://t3.storageapi.dev` | Bucket `categorized-lockerbox-v9qy6t`, region `auto` |
| Identity provider | ScottyLabs Keycloak | Development client from OpenBao |

OpenBao supplies identity/MapKit settings from `secret/secretspec/maps/dev`.
`TEMP_DEV_S3` supplies all temporary bucket settings. The launcher writes ignored
env files; each developer imports the shared dataset into a separate database.
Native database state lives under `.devenv/state`, independently of previous
Docker volumes. Population is explicit and startup preserves existing data.

## Hosted environments

The public app is [CMU Maps](https://cmumaps.com). Hosted web, API, identity, and
storage settings are deployment-specific. The production Dockerfiles remain;
removing the development containers does not change hosted deployments.

The Nix scaffold preserves Kennel integration for migration. It enables local
services, not production application deployment. Consult the team's deployment
configuration for hosted endpoints and credentials.
