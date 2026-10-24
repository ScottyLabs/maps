#!/usr/bin/env bash
# Run after `devenv up -d postgres ricochet`; no application secrets are needed.
set -euo pipefail
: "${DEVENV_RUNTIME:?Run inside devenv shell}"

for ((attempt = 0; attempt < 120; attempt++)); do
  if pg_isready -h "$DEVENV_RUNTIME/postgres" -U "$(id -un)" -d maps >/dev/null 2>&1 && \
    curl --fail --silent --max-time 2 http://127.0.0.1:8090/healthz >/dev/null; then
    psql -h "$DEVENV_RUNTIME/postgres" -U "$(id -un)" -d maps -v ON_ERROR_STOP=1 -c 'SELECT 1'
    exit 0
  fi
  sleep 1
done

echo "Native PostgreSQL/Ricochet smoke check timed out." >&2
exit 1
