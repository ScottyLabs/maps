#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

args=(--local)
dataset=new
skip_pois=true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dataset)
      if [[ $# -lt 2 || ( "$2" != old && "$2" != new ) ]]; then
        echo "--dataset requires old or new" >&2
        exit 1
      fi
      dataset="$2"
      shift ;;
    --include-pois) skip_pois=false ;;
    --check) args+=(--check) ;;
    --help|-h)
      echo "Usage: bash scripts/dev/populate.sh [--dataset old|new] [--check] [--include-pois]"
      echo "Reads the branch's temporary S3 bucket; writes only to the local backend."
      echo "Defaults to new (Ansys); old selects the campus snapshot without a POI file."
      echo "Run inside devenv shell with the backend already running."
      echo "Replaces local map tables; POIs are cleared and left empty by default."
      echo "--check validates inputs and backend authorization without clearing data."
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done
args+=(--dataset "$dataset")
if "$skip_pois"; then args+=(--skip-pois); fi

: "${DEVENV_STATE:?Run with python3 scripts/dev/dev.py populate or inside devenv shell}"
export UV_PROJECT_ENVIRONMENT="$DEVENV_STATE/dataflow-venv"
export UV_PYTHON_DOWNLOADS=never
cd apps/dataflow
export PYTHONPATH=src
exec uv run --locked --only-group populate --python "$(command -v python3)" python -m deserializer "${args[@]}"
