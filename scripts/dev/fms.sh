#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

: "${DEVENV_STATE:?Run inside devenv shell}"
export UV_PROJECT_ENVIRONMENT="$DEVENV_STATE/fms-venv"
export UV_PYTHON_DOWNLOADS=never
export PYTHONPATH="$PWD/apps/dataflow/src"
exec uv run --project apps/dataflow --locked --only-group fms \
  --python "$(command -v python3)" python -m scraper.fms "$@"
