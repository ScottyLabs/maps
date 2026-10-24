"""Workspace selection and conflict-safe edits shared by local UI and CLI."""

from __future__ import annotations

import fcntl
import hashlib
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

from pydantic import BaseModel

from processor.working import WorkingDataset
from processor.workspace import normalize_workspace, save_working
from scraper.fms.capture import SourceError


class WorkspaceView(BaseModel):
    """A revision identifies exactly the working JSON returned to an editor."""

    revision: str
    working: WorkingDataset


class EditConflictError(SourceError):
    """The editor must reload rather than overwrite a newer saved revision."""


class WorkspaceStore:
    """Constrain workspace access to one local root and protect saved edits."""

    def __init__(self, root: Path) -> None:
        """Select the development-only workspace root, never an arbitrary URL."""
        self.root = root.resolve()

    def path(self, name: str) -> Path:
        """Resolve a named workspace without allowing traversal or escaping links."""
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}", name):
            msg = "Workspace names use letters, numbers, hyphens and underscores"
            raise SourceError(msg)
        path = (self.root / name).resolve()
        if not path.is_relative_to(self.root) or not path.is_dir():
            msg = "Workspace does not exist under the configured pipeline root"
            raise SourceError(msg)
        return path

    def names(self) -> list[str]:
        """List saved captures, including ones awaiting normalization."""
        if not self.root.is_dir():
            return []
        names = []
        for entry in self.root.iterdir():
            try:
                path = self.path(entry.name)
            except SourceError:
                continue
            if (path / "capture.json").is_file():
                names.append(entry.name)
        return sorted(names)

    def read(self, name: str) -> WorkspaceView:
        """Read an existing editable dataset without running acquisition."""
        content = (self.path(name) / "working.json").read_bytes()
        return WorkspaceView(
            revision=hashlib.sha256(content).hexdigest(),
            working=WorkingDataset.model_validate_json(content),
        )

    def normalize(self, name: str) -> WorkspaceView:
        """Create working JSON from the verified capture without overwriting edits."""
        path = self.path(name)
        with (path / ".working.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            normalize_workspace(path)
            return self.read(name)

    def save(
        self,
        name: str,
        working: WorkingDataset,
        *,
        expected_revision: str,
    ) -> WorkspaceView:
        """Save one validated edit, or leave the current dataset intact on conflict."""
        path = self.path(name)
        with (path / ".working.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            previous = self.read(name)
            if previous.revision != expected_revision:
                msg = "Workspace changed in another editor; reload before saving"
                raise EditConflictError(msg)
            if working.capture_digest != previous.working.capture_digest:
                msg = "An edit cannot replace the capture identity"
                raise SourceError(msg)
            _validate_edit(previous.working, working)
            for code, anchor in working.anchors.items():
                if anchor.reference_floor not in working.floors.get(code, {}):
                    msg = "Reference placement must select a captured building/floor"
                    raise SourceError(msg)
            save_working(path, working)
            return self.read(name)


def _validate_edit(previous: WorkingDataset, working: WorkingDataset) -> None:
    """Edits may correct spaces and placement without changing source frames."""

    def frames(dataset: WorkingDataset) -> set[tuple[str, str, str, str]]:
        return {
            (code, level, floor.fms_id, floor.source_unit)
            for code, floors in dataset.floors.items()
            for level, floor in floors.items()
        }

    if frames(previous) != frames(working):
        msg = "Changing captured floors or source units requires explicit re-extraction"
        raise SourceError(msg)
    if any(
        key != space.id
        for floors in working.floors.values()
        for floor in floors.values()
        for key, space in floor.spaces.items()
    ):
        msg = "Space dictionary keys must match their saved identifiers"
        raise SourceError(msg)
