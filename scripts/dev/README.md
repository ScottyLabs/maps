# Development scripts and Kennel scaffold

See [Running locally](../../docs/src/Setup.md) for prerequisites, quick start,
manual commands, and troubleshooting.

| File | Purpose |
| --- | --- |
| `dev.py` | Host entry point: secrets, startup, population, shell, logs, stop |
| `app.sh` | Inside devenv: check services, install dependencies, generate code, apply schema, start app |
| `populate.sh` | Inside devenv: run the minimal Python importer against the local API |
| `fms.sh` | Inside devenv: interactive source capture and verified resume, using a minimal Python environment |

`devenv.nix` imports the pinned Kennel module and enables its PostgreSQL and
Ricochet features. Native processes replace the former development containers.
Nix supplies Bun, Node, Python 3.12, uv, and Linux Prisma libraries. PostgreSQL 18
uses Kennel's private socket; the app adds an explicit database user for Prisma.
The web app uses port 5173, API 8080, and relay 8090.

OpenBao runs in the developer's terminal. The launcher validates all app entries
and the grouped `secret/secretspec/maps/dev/TEMP_DEV_S3` record before replacing
ignored env files. It never installs system dependencies or executes downloaded
secret values as shell code. Windows development runs inside WSL2.

The temporary bucket is `categorized-lockerbox-v9qy6t` at
`https://t3.storageapi.dev`, region `auto`. Population only reads its processed
`floorplans/*.json` dataset. It validates before replacing local map tables;
restart the app after importing to refresh caches.

`devenv.lock` pins the project inputs. Native PostgreSQL and the importer's virtual
environment persist under `.devenv/state`. The old Docker volumes are separate
and are not deleted by this setup. Production Dockerfiles remain independent of
local development. Fresh scraping/generation is specified in the
[pipeline spec](../../docs/src/Data-Pipeline-Spec.md).

`pipeline.sh normalize --workspace <path>` normalizes a verified FMS capture into
editable source-frame JSON using the minimal processing dependency group. See
[the FMS guide](../../docs/src/FMS-Capture.md#normalize-the-saved-drawing).
