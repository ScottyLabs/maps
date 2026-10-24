# Development scripts and Kennel scaffold

See [Running locally](../../docs/src/Setup.md) for quick start, credentials,
manual commands, and troubleshooting.

## Entry points

| File | Runs where | Purpose |
| --- | --- | --- |
| `dev.py` | Host Python | `start`, `secrets`, `populate`, `shell`, `logs`, `stop` |
| `container.ts` | Optional host Bun | Selects Python for `bun run dev:container` |
| `container.sh` | Host Bash compatibility | Calls `dev.py start` |
| `container-app.sh` | Linux devcontainer | Installs runtimes/dependencies, generates code, syncs schema, starts app |
| `populate.sh` | Host Bash or container | Reads the temporary bucket and imports through the local API |
| `prepare.ts` | Native host workflow | Older Bun setup, separate from the container launcher |

The host launcher uses the active Docker context for Docker Desktop, Colima, or
Docker Engine. It reports missing Docker/Compose and OpenBao dependencies; install
and start these yourself.

## Temporary shared bucket

This branch uses one S3-compatible source: `https://t3.storageapi.dev`, region
`auto`, bucket `categorized-lockerbox-v9qy6t`. OpenBao record
`secret/secretspec/maps/dev/TEMP_DEV_S3` contains its five `S3_*` settings.
`dev.py start` / `dev.py secrets` download these into the ignored dataflow env
files alongside the existing server/web secret refresh. All values are fetched
before files are replaced; failures preserve the saved configuration.

The population pipeline only reads this bucket. `populate --check` validates the
four `floorplans/*.json` inputs and backend authorization; `populate` replaces
local map records. Scraper/serializer S3 helpers also use this bucket.

## Container layout

```text
Host: editor + Python launcher + OpenBao login + Docker CLI
  Docker engine
    dev: Kennel/devenv Ricochet; Bun API + Vite; dataflow importer
    postgres: PostgreSQL 17
  Hosted S3 bucket: processed source datasets
```

The containers are siblings. The checkout is mounted at `/workspace`, and Linux
dependencies use named volumes. Edit on the host or attach VS Code to the container.
Ports 80, 5173, and 8090 are published on host loopback only. Services bind to the
container interface so Docker can forward them. PostgreSQL uses `postgres:5432`
inside Docker and has no host port.

The Nix scaffold imports Kennel and enables Ricochet. Local object storage is
disabled on this branch. `/tmp` is executable tmpfs so stale devenv PID/socket
files do not survive container restarts. Named volumes preserve PostgreSQL, Nix,
and caches; the setup does not delete previously created storage volumes.

`devenv.lock` pins project inputs. To update deliberately, run `devenv update`
inside the container, review the lock changes, and update the Dockerfile's bootstrap
nixpkgs revision to match. Existing Nix volumes preserve installed profiles across
rebuilds; explicitly update installed packages if changing their pins. Application
deployment targets are not configured by this local scaffold.
