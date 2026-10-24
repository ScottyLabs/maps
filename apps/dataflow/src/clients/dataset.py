"""Input/output boundaries shared by hosted import and local preview staging."""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, Any, Protocol, cast

from clients._s3_client import SCHEMA_VALIDATORS

if TYPE_CHECKING:
    from pathlib import Path

    from clients._api_client import TableName


class JsonSource(Protocol):
    """A validated, cached snapshot of canonical dataset files."""

    def get_json_file(self, name: str, /) -> dict[str, Any] | None:
        """Read a selected dataset object."""
        ...

    def preload_json_file(self, name: str, /) -> dict[str, Any]:
        """Validate a selected object before any database changes."""
        ...


class TableWriter(Protocol):
    """Accept converted application rows through either HTTP or staging output."""

    def populate_table(self, table_name: TableName, data: list[dict[str, Any]]) -> bool:
        """Accept a batch of records, raising on failure."""
        ...


class LocalDataset:
    """Read the same canonical files from an immutable generated revision."""

    def __init__(
        self, directory: Path, *, checksums: dict[str, str] | None = None,
    ) -> None:
        """Select a validated candidate directory, rather than the shared bucket."""
        self.directory = directory.resolve()
        self.checksums = checksums or {}
        self.cache: dict[str, dict[str, Any]] = {}

    def get_json_file(self, name: str, /) -> dict[str, Any]:
        """Use validated cached bytes consistently throughout conversion."""
        if name not in self.cache:
            return self.preload_json_file(name)
        return self.cache[name]

    def preload_json_file(self, name: str, /) -> dict[str, Any]:
        """Allow valid empty result files while rejecting missing/invalid sources."""
        path = (self.directory / name).resolve()
        if not path.is_relative_to(self.directory):
            msg = "Dataset object is outside the selected candidate"
            raise ValueError(msg)
        content = path.read_bytes()
        expected = self.checksums.get(path.name)
        if expected is not None and hashlib.sha256(content).hexdigest() != expected:
            msg = f"Candidate changed while preparing import: {name}"
            raise ValueError(msg)
        data = json.loads(content)
        validator = SCHEMA_VALIDATORS.get(path.name)
        if validator is None:
            msg = f"Unknown canonical dataset file: {name}"
            raise ValueError(msg)
        validator.model_validate(data)
        self.cache[name] = cast("dict[str, Any]", data)
        return self.cache[name]
