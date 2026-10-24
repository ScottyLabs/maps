# CMU Maps Dataflow

Dataflow captures selected FMS drawings and public source records, normalizes
editable working JSON, generates the existing app JSON contracts and converts
those records for database import. The CLI and visualizer call the same engine.

## Fresh-source workflow

After the [native setup](../../docs/src/Setup.md), run from the repository root:

```sh
devenv shell -- bash scripts/dev/fms.sh --workspace uploads/pipeline/ansys-v1 --building AN=116
devenv shell -- bash scripts/dev/pipeline.sh normalize --workspace uploads/pipeline/ansys-v1
devenv shell -- bash scripts/dev/pipeline.sh public --workspace uploads/pipeline/ansys-v1
devenv shell -- bash scripts/dev/pipeline.sh outdoor --workspace uploads/pipeline/ansys-v1
```

Complete interactive CMU/Duo login for a fresh FMS capture. Open the existing
[workspace editor](http://localhost:5174/workspaces) to review rooms, place one
reference floor and save working JSON. Source discovery accepts other selected
buildings/floors; `AN=116` is the example mapping, not a hardcoded pipeline.

Build explicitly, then use the full printed revision for load and read-only API
verification while the native stack is running:

```sh
devenv shell -- bash scripts/dev/pipeline.sh build --workspace uploads/pipeline/ansys-v1
devenv shell -- bash scripts/dev/pipeline.sh load --workspace uploads/pipeline/ansys-v1 --revision <full-revision>
devenv shell -- bash scripts/dev/pipeline.sh verify --workspace uploads/pipeline/ansys-v1 --revision <full-revision>
```

The [capture guide](../../docs/src/FMS-Capture.md) covers cache reuse, explicit
refresh/re-extraction, coordinates, source limitations and commands behind UI
actions. All five canonical JSONs are exported together. Candidate conversion
reuses the existing table converters; import is one transaction in an isolated
local schema, followed by ready cache activation. Saving JSON alone changes no
database records. A failed load preserves the previous preview.

The current workspace is a development milestone. Indoor doors/connectors,
complete classification/POIs and S3 workspace synchronization remain open.
See the [work queue](../../docs/src/Data-Pipeline-TODO.md) and linked dated handoff.

## Shared baseline import

The [running guide](../../docs/src/Setup.md#populate-the-local-database) documents
import of the existing hosted baseline:

```sh
python3 scripts/dev/dev.py populate --dataset old --check
python3 scripts/dev/dev.py populate --dataset old
```

OpenBao's `TEMP_DEV_S3` supplies the temporary bucket settings in ignored dataflow
env files. The client uses that saved configuration rather than inherited shell
storage settings. App identity settings come from the ignored server env file.

Choose `--dataset old` for the historical campus snapshot or `--dataset new`
(default) for the fresh Ansys candidate. Each reads its own
`datasets/<choice>/floorplans/` prefix; no fallback mixes snapshots. The old
snapshot has no POI file; only `new` supports `--include-pois`.

The baseline requires `floorplans/{buildings,floorplans,placements,all-graph}.json`;
POIs need `osm-pois.json` and `--include-pois`. Source/auth checks precede reset,
but this older multi-request import is not one transaction. Restart the backend
to rebuild caches afterward. If a generated preview is active, first run
`devenv shell -- bash scripts/dev/pipeline.sh baseline`.

Raw source capture is not an import dataset, and generating/loading a local
workspace does not upload it to S3.

## Validation

Inside `devenv shell`, run from this directory:

```sh
uv sync --locked --group pipeline --group fms --group dev
PYTHONPATH=src uv run --no-sync python -m unittest discover -s tests -v
uv run --no-sync lint
```

Minimal `fms`, `pipeline` and `populate` dependency groups are selected by the
repository helpers. The full package installation also includes dev tools.
No ArcGIS SDK or standalone Overpass wrapper is required; public adapters use
bounded HTTPS requests. NumPy is a direct normalization dependency; SciPy remains
a transitive dependency of svgpathtools.

## Module map

| Directory | Responsibility |
| --- | --- |
| `src/scraper/fms/` | Interactive source authentication, discovery and capture |
| `src/scraper/public.py` | Selected public building metadata |
| `src/scraper/outdoor.py` | Public OSM path/point snapshot |
| `src/processor/` | Working JSON, edits, frame checks, generation, CLI/bridge and app verification |
| `src/models/` | Existing canonical JSON contracts |
| `src/clients/` | Configured S3/API clients and validated local dataset reads |
| `src/deserializer/` | Source validation and shared JSON-to-table conversion |
| `src/logger/`, `src/linter/` | Shared diagnostics and Python checks |

The pre-existing `_25live` package/worker entry point is separate from this
floorplan workflow. Superseded standalone ESIM/OSM scripts and Ansys-specific
graph experiments have been removed; their history remains in Git.
