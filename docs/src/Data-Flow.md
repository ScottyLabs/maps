# Data flow

The [fresh-source v1 specification](Data-Pipeline-Spec.md) defines the intended
workflow. The [work queue](Data-Pipeline-TODO.md) and its dated handoff distinguish
implemented stages from remaining source and navigation work.

## Fresh-source workspace

```text
Authenticated FMS capture + selected public building/OSM records
  -> saved source-frame working JSON
  -> visualizer room corrections + reference placement
  -> explicit build: five canonical JSONs + validation/evidence report
  -> shared converters -> isolated local schema transaction
  -> ready search/graph caches -> explicit activation -> fresh app page
```

Use [FMS Capture](FMS-Capture.md) for acquisition, offline replay, build, load and
API verification, and the [visualizer guide](Data-Visualizer-Wiki.md) for editing.
Working JSON is authoritative. Save, build and load are separate operations.
The CLI and visualizer use the same engine; failed loads retain the active preview.

FMS provides drawing identities, bounds, units, layer roles and SVG data. Public
CMU GIS provides selected building names and geographic footprints through a
numeric FMS-ID join. Public OSM provides explicit outdoor way relationships and
supported point POIs. A configured layer name or touching pair of polygons is
not evidence of a door or navigable connection.

The current Ansys milestone includes five aligned floors, source-space polygons,
public outdoor routes and point POIs. Floor D alignment, source-linked room
classification and indoor/cross-floor/entrance connectivity remain incomplete.
Detailed status and evidence are in the timestamped handoff linked from the queue.

## Application contracts

Each generated revision exports these files together under `floorplans/`:

| File | Contents |
| --- | --- |
| `buildings.json` | Building-code dictionary: names, floors and geographic shapes |
| `placements.json` | Building/floor placements |
| `floorplans.json` | Building/floor/room-ID dictionary with labels and polygon rings |
| `all-graph.json` | Node-ID dictionary with coordinates, floor and neighbor dictionaries |
| `osm-pois.json` | Existing POI dictionary, including valid empty results |

Raw drawing coordinates are normalized to metres before geographic projection.
The database is derived from a complete generated revision through the existing
seven table converters. Per-workspace source provenance belongs in capture and
working/report metadata rather than unsupported canonical fields.

Fresh captures, working JSON and generated candidates live under ignored
`uploads/pipeline/`. The current Ansys workspace was explicitly uploaded to the
temporary bucket; see the dated [storage checkpoint](Data-Storage.md#current-bucket-checkpoint--october-24-2026-1410-edt).
A supported synchronization command remains an open task. A local build/load
does not publish data or update hosted S3 objects.

## Shared baseline import

The [running guide](Setup.md#populate-the-local-database) describes the shared-data
import used for ordinary app onboarding. Choose `--dataset old` for the historical campus data or `--dataset new`
(default) for the partial fresh Ansys candidate:

```text
Temporary S3 datasets/{old,new}/floorplans/*.json
  -> model/reference checks + Keycloak authorization
  -> population API -> local baseline PostgreSQL tables
  -> explicit backend restart -> search/graph caches -> app
```

OpenBao `TEMP_DEV_S3` supplies the one temporary source through ignored dataflow
env files. Population reads hosted storage and writes the developer's private
local database. This older multi-request import is not transactional. Required
JSON and authorization failures abort before reset; a later write failure may
require rerunning population. POIs require the optional file and an explicit flag.

Generated previews use isolated schemas and atomic activation instead. Restore
the baseline before ordinary population. Production deployment and object-storage
publication remain separate from either local import path.
