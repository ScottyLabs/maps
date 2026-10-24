# Data storage

## PostgreSQL

The backend uses Prisma with PostgreSQL. The authoritative schema lives in
[`apps/server/prisma`](../../apps/server/prisma). Map records include buildings,
floors, rooms, aliases, graph nodes/edges and POIs. Browser authentication is
handled separately by the API's Better Auth/Keycloak integration. Population
replaces the seven map tables without invoking login/account operations.

Locally, Kennel enables PostgreSQL 18 through devenv, using a private Unix
socket and database `maps`. Inspect it from the repository root:

```sh
devenv shell -- psql -d maps
```

Data persist under `.devenv/state`, independently of the old Docker volume.
Startup applies the Prisma schema without populating or resetting map records.
See [Running locally](Setup.md#populate-the-local-database) for importing.
Hosted database access is configured separately.

Fresh generated previews are staged in separate schemas on the same private
database. `public.PreviewSelection` records the selected schema/revision; the
ordinary baseline remains in `public`. The loader activates a candidate only
after its transaction and cache preparation succeed. See the
[candidate workflow](FMS-Capture.md#load-the-candidate).

## Object storage

This branch temporarily uses `categorized-lockerbox-v9qy6t` at
`https://t3.storageapi.dev`, with region `auto`. Settings and credentials come from OpenBao record
`secret/secretspec/maps/dev/TEMP_DEV_S3`, downloaded into ignored
`apps/dataflow/.env`. See the [running guide](Setup.md#quick-start) for setup.

The importer reads processed JSON under `floorplans/` and sends records through
the local API into each developer's own PostgreSQL database. It does not modify
hosted storage. Builds and preview loads also leave hosted storage unchanged;
upload is a separate operation. Raw source-fetch artifacts are not import datasets.
Keep downloaded files under ignored `uploads/` and never commit credentials.

### Current bucket checkpoint — October 24, 2026, 14:10 EDT

The latest `ansys-v1` scrape and processed results were uploaded explicitly at
18:10 UTC. The four older campus JSON objects were replaced. **Ordinary population
now imports the partial Ansys dataset, rather than the former campus dataset.**
The bucket contains one current workspace/revision, with a processed mirror for
the existing importer:

```text
floorplans/                          # Five current canonical JSONs
workspaces/ansys-v1/
  manifest.json                      # Completion record, object sizes and SHA-256s
  capture.json                       # Selected FMS floors and artifact checksums
  working.json                       # Source-frame data, saved edits and placement
  raw/fms/AN/{1,2,A,B,C,D}/            # Manifest-listed FMS drawings and metadata
  raw/public/                        # Current CMU GIS and OSM source snapshots
  generated.json                     # Current generation report
  generated/<revision>/
    report.json
    floorplans/                      # Same five JSONs as the root mirror
```

Generated revision:
`e053b4ff24f1b72f1632b09ee9bfea2c95ec0f3ef56c69d9d994fadd8613fb87`.
Working revision:
`cc6569199604999dc677cf89e16ae11673f7e5ec2b9950f0ae594199e92e2ba2`.

The snapshot has six scraped floors, five generated floors, 145 source pieces,
1,155 nodes, 2,114 directed outdoor edges and 34 point POIs. D remains excluded
from generation pending alignment evidence. Indoor nodes remain isolated and FMS
room inventory has not been joined; this is not a complete navigation dataset.
Use `populate --include-pois` to include the uploaded POI file.

All **68 objects (2,628,205 bytes)** were downloaded and checked. A separate
downloaded `ansys-v1` directory reproduced the exact generated revision and passed
conversion to all seven table batches. The completion manifest was written after
verification. Only the current capture's listed artifacts, selected public sources,
saved working data and latest generated revision were uploaded. Environment files,
cookies, profiles, locks and older generated revisions were excluded.

The original local workspace and active database preview were left intact. An
ignored local transfer receipt and recovery copy of the replaced objects live in
`uploads/storage-transfers/2026-10-24_1408-EDT/`. Older data are no longer present
as current bucket objects. Nothing was uploaded to the production CDN.

This was a verified one-off transfer. A supported upload/download command and
interruption/recovery behavior remain work under
[DP-07](Data-Pipeline-TODO.md#dp-07--named-workspace-synchronization-with-s3).
For a manual recovery, read `workspaces/ansys-v1/manifest.json`, download its
`workspaces/ansys-v1/` entries while removing that prefix, and verify every size
and SHA-256 before using the result. Preserve the local directory name `ansys-v1`
when reproducing the revision: workspace identity participates in its hash.
