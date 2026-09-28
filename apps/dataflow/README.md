# CMU Maps Data

## Overview

This directory is responsible for handling data flow for CMU Maps. Check the
scripts section in `pyproject.toml` for the available commands. You can run a
script using the following command:

```zsh
uv run --env-file <ENV_FILE> <SCRIPT_NAME>
```

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

`scraper/fms/` fetches authenticated FMS floor-plan assets, converts downloaded
PDF sheets to SVG/text-coordinate sidecars, and can upload SVG trees to S3. The
PDF-derived SVGs are renderable assets; they do not by themselves produce the
room polygons and placements required by `floorplans.json`. See
[`docs/src/Data-Flow.md`](../../docs/src/Data-Flow.md#cmu-fms-floor-plan-pdfs-login-status-depends-on-the-asset-url)
for the fetch results, conversion workflow, and remaining data-processing steps.

### OSM

`scraper/osm/` is responsible for scraping graph data from the OSM website.

## Serializer

`serializer/` is responsible for serializing data from the database to JSON files.

## Additional Information

See the [Dataflow wiki page](https://github.com/ScottyLabs/cmumaps/wiki/Data-Flow)
for more information.
