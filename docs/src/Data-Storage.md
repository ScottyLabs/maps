# Data storage

## PostgreSQL

The backend uses Prisma with PostgreSQL. The authoritative schema lives in
[`apps/server/prisma`](../../apps/server/prisma). Map records include buildings,
floors, rooms, aliases, graph nodes/edges, and POIs; authentication tables are
managed alongside them. Population replaces the seven map tables, not user login
records.

Locally, Kennel enables PostgreSQL 18 through devenv, using a private Unix
socket and database `maps`. Inspect it from the repository root:

```sh
devenv shell -- psql -d maps
```

Data persist under `.devenv/state`, independently of the old Docker volume.
Startup applies the Prisma schema without populating or resetting map records.
See [Running locally](Setup.md#populate-the-local-database) for importing.
Hosted database access is configured separately.

## Object storage

This branch temporarily uses `categorized-lockerbox-v9qy6t` at
`https://t3.storageapi.dev`, with region `auto`. Settings and credentials come from OpenBao record
`secret/secretspec/maps/dev/TEMP_DEV_S3`, downloaded into ignored
`apps/dataflow/.env`. See the [running guide](Setup.md#quick-start) for setup.

The importer reads processed JSON under `floorplans/` and sends records through
the local API into each developer's own PostgreSQL database. It does not modify
hosted storage. The scraper/serializer S3 helpers use the same bucket; publishing
data is a separate operation. Raw source-fetch artifacts are not import datasets.
Keep downloaded files under ignored `uploads/` and never commit credentials.
