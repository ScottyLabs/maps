# Environments

## Local development

The supported local workflow is documented in [Running locally](Setup.md).
Docker runs a Linux development container and a sibling PostgreSQL 17 container.
Nix/devenv uses Kennel's module for Ricochet. It does not deploy the app.

| Component | Local address | Configuration |
| --- | --- | --- |
| Web | `http://localhost:5173` | Vite in the devcontainer |
| API | `http://localhost` | Bun in the devcontainer |
| OAuth relay | `http://localhost:8090` | Kennel Ricochet; callback from OpenBao |
| Dataset source | `https://t3.storageapi.dev` | Bucket `categorized-lockerbox-v9qy6t`, region `auto` |
| PostgreSQL | `postgres:5432` inside Docker | No host port published |
| Identity provider | ScottyLabs Keycloak | Development client from OpenBao |

OpenBao supplies identity/MapKit settings from `secret/secretspec/maps/dev`.
The `TEMP_DEV_S3` record supplies all temporary bucket settings; the launcher
writes them to ignored dataflow env files when refreshing secrets. Each local database
imports independently from the same hosted source.

## Hosted environments

The public app is [CMU Maps](https://cmumaps.com). Hosted web/API/identity/storage
settings are deployment-specific and must not be replaced with local defaults.
Older native setup commands retain environment profiles such as staging and prod;
they are separate from this local container workflow.

The root Nix scaffold preserves Kennel integration for a future migration. It
currently enables local services, not production application deployment. Consult
the team's deployment configuration for current hosted endpoints and credentials;
this local setup does not provision them.
