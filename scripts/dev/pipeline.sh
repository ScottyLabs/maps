#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

: "${DEVENV_STATE:?Run inside devenv shell}"
export UV_PROJECT_ENVIRONMENT="$DEVENV_STATE/pipeline-venv"
export UV_PYTHON_DOWNLOADS=never
export PYTHONPATH="$PWD/apps/dataflow/src"
exec uv run --project apps/dataflow --locked --only-group pipeline \
  --python "$(command -v python3)" python -m processor "$@"
