# CMU Maps Data

## Overview

This directory is responsible for handling data flow for CMU Maps. Check the
scripts section in `pyproject.toml` for the available commands. You can run a
script using the following command:

```zsh
uv run --env-file <ENV_FILE> <SCRIPT_NAME>
```

## Local database import

Follow the [running guide](../../docs/src/Setup.md). The host launcher downloads the
`TEMP_DEV_S3` record from OpenBao into this app's ignored `.env` and `.env.local`.
The record contains `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, and
`S3_SECRET_KEY`. Identity settings come from the existing app entries.

This branch temporarily uses only `https://t3.storageapi.dev`, region `auto`, bucket
`categorized-lockerbox-v9qy6t`. The importer and scraper/serializer S3 helpers read
the same dataflow env file, ignoring old shell storage settings. There is no source
selector or local object-storage service.

With the native devenv stack running, run from the repository root
(macOS, Linux, or WSL2):

```sh
python3 scripts/dev/dev.py populate --check
python3 scripts/dev/dev.py populate
```

Required keys are `floorplans/buildings.json`, `floorplans/floorplans.json`,
`floorplans/placements.json`, and `floorplans/all-graph.json`. Import validates data
and authorization before clearing the seven local map tables. POIs remain empty
unless `--include-pois` is supplied and `floorplans/osm-pois.json` exists. Raw
source-fetch artifacts are not valid import inputs. Missing credentials or files
abort before clearing tables; a later failure can leave a partial import because
the entire operation is not transactional.

Restart the backend after import to refresh search/graph caches. The local wrapper
always targets the local backend on port 8080, loading identity credentials from the server's
ignored env file. The client needs `/projects/maps/admins` in its Keycloak token.
The minimal `populate` group avoids installing the full scraper toolchain.

## Validation

Inside `devenv shell`, run from this directory:

```sh
uv sync --locked --only-group populate --group dev
PYTHONPATH=src uv run --no-sync python -m unittest discover -s tests -v
PYTHONPATH=src uv run --no-sync python -c "from linter import main; main()"
```

The shell assignment above works on macOS, Linux, or WSL2. For the host
launcher's platform-independent tests, see the main running guide.

## _25live

`_25live/` directory contains the code for processing data from the 25live data
from the [event-scraper](https://github.com/ScottyLabs/event-scraper) s3 bucket
and populating the database with the data.

## Cleaner

`cleaner/` is responsible for archiving one-time scripts for cleaning data.

## Clients

`clients/` contains the clients for interacting with the CMU Maps API and S3 bucket.

## Deserializer

`deserializer/` is responsible for deserializing the JSON files from the S3 bucket
and populating the database with the data.

## Linter

`linter/` exists to enable the `lint` script in `pyproject.toml`.

## Logger

`logger/` contains the logging module for the dataflow application.

## Processor

`processor/` is responsible for processing the scraped floorplan data.

### Generator

`processor/generator/` is responsible for generating the floorplan data from the
scraped data.

### Merger

`processor/merger/` is responsible for merging the scraped data into the
existing floorplan data.

## Scraper

`scraper/` is responsible for scraping floorplan data from various sources and
uploading it to the S3 bucket

### ESIM

`scraper/esim/` is responsible for scraping building data from the ESIM website.

### FMS

`scraper/fms/` is responsible for scraping floorplan data from the FMS website.

### OSM

`scraper/osm/` is responsible for scraping graph data from the OSM website.

## Serializer

`serializer/` is responsible for serializing data from the database to JSON files.

## Additional Information

See the [Data Flow documentation](../../docs/src/Data-Flow.md)
for more information.
