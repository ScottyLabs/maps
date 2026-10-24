"""Convert a validated generated candidate using the existing table serializers."""

from __future__ import annotations

import hashlib
import json
import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pathlib import Path

from pydantic import BaseModel

from clients import ALL_TABLE_NAMES, TableName
from clients.dataset import LocalDataset
from deserializer.preflight import validate_sources
from deserializer.tables import (
    populate_alias_table,
    populate_building_table,
    populate_edge_table,
    populate_floor_table,
    populate_node_table,
    populate_poi_table,
    populate_room_table,
)
from processor.generate import BuildReport
from processor.store import WorkspaceStore
from scraper.fms.capture import SourceError


class PopulationPayload(BaseModel):
    """The validated candidate's table batches, containing no credentials."""

    report: BuildReport
    tables: dict[TableName, list[dict[str, Any]]]


class TableCollector:
    """Collect ordinary importer output instead of sending partial API writes."""

    def __init__(self) -> None:
        """Keep every map table represented, including valid empty POI results."""
        self.tables: dict[TableName, list[dict[str, Any]]] = {
            name: [] for name in ALL_TABLE_NAMES
        }

    def populate_table(self, table_name: TableName, data: list[dict[str, Any]]) -> bool:
        """Stage the existing converter's batches for one candidate transaction."""
        self.tables[table_name].extend(data)
        return True


def serialize_candidate(workspace: Path, revision: str) -> PopulationPayload:
    """Verify a complete immutable revision before producing any database rows."""
    if not re.fullmatch("[a-f0-9]{64}", revision):
        msg = "Invalid generated revision"
        raise SourceError(msg)
    report = BuildReport.model_validate_json(
        (workspace / "generated.json").read_bytes(),
    )
    view = WorkspaceStore(workspace.resolve().parent).read(workspace.name)
    if report.revision != revision or report.working_revision != view.revision:
        msg = "Candidate is stale; explicitly rebuild the saved working JSON first"
        raise SourceError(msg)
    if report.directory != f"generated/{revision}":
        msg = "Invalid candidate directory"
        raise SourceError(msg)
    source = LocalDataset(workspace / report.directory, checksums=report.files)
    hashes = {}
    expected = {
        "buildings.json",
        "placements.json",
        "floorplans.json",
        "all-graph.json",
        "osm-pois.json",
    }
    if set(report.files) != expected:
        msg = "Candidate is missing canonical files"
        raise SourceError(msg)
    for name, digest in report.files.items():
        path = (source.directory / "floorplans" / name).resolve()
        if not path.is_relative_to(source.directory):
            msg = "Candidate artifact escapes its revision directory"
            raise SourceError(msg)
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        if hashes[name] != digest:
            msg = f"Candidate artifact changed after generation: {name}"
            raise SourceError(msg)
    identity = json.dumps(
        [
            workspace.name,
            view.revision,
            hashes,
            report.warnings,
            {key: value.model_dump() for key, value in report.alignment.items()},
        ],
        sort_keys=True,
    ).encode()
    if hashlib.sha256(identity).hexdigest() != revision:
        msg = "Candidate manifest does not match its revision"
        raise SourceError(msg)
    validate_sources(skip_pois=False, source=source)
    sink = TableCollector()
    for convert in (
        populate_building_table,
        populate_floor_table,
        populate_room_table,
        populate_alias_table,
        populate_node_table,
        populate_edge_table,
        populate_poi_table,
    ):
        convert(source=source, writer=sink)
    return PopulationPayload(report=report, tables=sink.tables)
