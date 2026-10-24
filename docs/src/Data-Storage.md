# Data storage

## PostgreSQL

The backend uses Prisma with PostgreSQL. The authoritative schema lives in
[`apps/server/prisma`](../../apps/server/prisma). Map records include buildings,
floors, rooms, aliases, graph nodes/edges, and POIs; authentication tables are
managed alongside them. Population replaces the seven map tables, not user login
records.

Locally, Compose runs PostgreSQL 17 in a sibling container. The backend connects
to `postgres:5432`; the database port is not published to the host. Inspect it from
the repository root with:

```sh
docker compose -f .devcontainer/docker-compose.yml exec postgres psql -U postgres -d cmumaps
```

The `postgres_data` volume preserves data across container recreation. The startup
helper applies the Prisma schema but does not automatically populate it. See
[Running locally](Setup.md#populate-the-local-database) for importing.
Hosted database access is configured separately; do not reuse local credentials.

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
