"""JSON transport for the existing API to call the shared local pipeline."""

from __future__ import annotations

import contextlib
import json
import os
import sys
from pathlib import Path
from typing import Literal

import requests
from pydantic import BaseModel, ConfigDict

from deserializer.bundle import serialize_candidate
from processor.generate import build_workspace
from processor.store import EditConflictError, WorkspaceStore
from processor.working import WorkingDataset  # noqa: TC001
from scraper.fms.capture import SourceError
from scraper.public import fetch_buildings


class Request(BaseModel):
    """Small operation protocol; extraction and edits live in the stage engine."""

    model_config = ConfigDict(extra="forbid")

    operation: Literal[
        "list", "read", "normalize", "save", "public", "build", "import-payload",
    ]
    workspace: str = ""
    expected_revision: str = ""
    revision: str = ""
    working: WorkingDataset | None = None


def main() -> int:
    """Read one local API operation; emit only its JSON response on stdout."""
    try:
        root = os.environ.get("PIPELINE_ROOT")
        if not root:
            msg = "Local pipeline is disabled; use the native development helper"
            raise SourceError(msg)
        store = WorkspaceStore(Path(root))
        request = Request.model_validate_json(sys.stdin.read())
        result = _dispatch(request, store)
    except (OSError, ValueError, RuntimeError, requests.RequestException) as error:
        result = json.dumps(
            {
                "error": str(error),
                "status": 409 if isinstance(error, EditConflictError) else 422,
            },
        )
    sys.stdout.write(result + "\n")
    return 0


def _dispatch(request: Request, store: WorkspaceStore) -> str:
    """Call the stage engine; the transport has no extraction/conversion rules."""
    if request.operation == "list":
        result = json.dumps({"workspaces": store.names()})
    elif request.operation == "save":
        if request.working is None:
            msg = "Missing edited working dataset"
            raise SourceError(msg)
        result = store.save(
            request.workspace,
            request.working,
            expected_revision=request.expected_revision,
        ).model_dump_json()
    elif request.operation == "import-payload":
        with contextlib.redirect_stdout(sys.stderr):
            payload = serialize_candidate(
                store.path(request.workspace), request.revision,
            )
        result = payload.model_dump_json()
    elif request.operation == "build":
        result = _build(request, store)
    elif request.operation == "public":
        with requests.Session() as session:
            fetch_buildings(store.path(request.workspace), session)
        result = store.read(request.workspace).model_dump_json()
    elif request.operation == "normalize":
        result = store.normalize(request.workspace).model_dump_json()
    else:
        result = store.read(request.workspace).model_dump_json()
    return result


def _build(request: Request, store: WorkspaceStore) -> str:
    if request.expected_revision and (
        store.read(request.workspace).revision != request.expected_revision
    ):
        msg = "Workspace changed; reload before building"
        raise EditConflictError(msg)
    return build_workspace(store.path(request.workspace)).model_dump_json()
