#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

args=(--local)
skip_pois=true
original_args=("$@")
while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-pois) skip_pois=false ;;
    --check) args+=(--check) ;;
    --help|-h)
      echo "Usage: bash scripts/dev/populate.sh [--check] [--include-pois]"
      echo "Reads the branch's temporary S3 bucket; writes only to the local backend."
      echo "Run with the devcontainer and backend already running."
      echo "Replaces local map tables; POIs are cleared and left empty by default."
      echo "--check validates inputs and backend authorization without clearing data."
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done
if "$skip_pois"; then args+=(--skip-pois); fi

if [[ ! -f /.dockerenv ]]; then
  exec python3 scripts/dev/dev.py populate "${original_args[@]}"
fi

# Use the same pinned Nix runtime source as the application helper.
if ! command -v uv >/dev/null; then
  nixpkgs_rev=$(jq -er '.nodes[.nodes.root.inputs.nixpkgs].locked.rev' devenv.lock)
  nix profile install --profile /nix/var/nix/profiles/devenv \
    "github:NixOS/nixpkgs/$nixpkgs_rev#uv"
fi

# Keep Linux dependencies separate from the host's apps/dataflow/.venv.
export UV_CACHE_DIR=/root/.cache/cmumaps-dataflow/uv
export UV_PYTHON_INSTALL_DIR=/root/.cache/cmumaps-dataflow/python
export UV_PROJECT_ENVIRONMENT=/root/.cache/cmumaps-dataflow/venv
exec devenv shell -- bash -c 'set -e; cd apps/dataflow; export PYTHONPATH=src; exec uv run --locked --only-group populate python -m deserializer "$@"' bash "${args[@]}"
