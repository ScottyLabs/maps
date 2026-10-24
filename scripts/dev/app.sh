#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

: "${DEVENV_RUNTIME:?Run with devenv up or inside devenv shell}"

for app in server web; do
  if [[ ! -s "apps/$app/.env" ]]; then
    echo "Missing apps/$app/.env. Run python3 scripts/dev/dev.py secrets first." >&2
    exit 1
  fi
done

# Use Kennel's private socket, including an explicit user for Prisma.
export DATABASE_URL
DATABASE_URL=$(python3 - <<'PY'
import getpass
import os
from urllib.parse import quote

user = quote(getpass.getuser(), safe="")
socket = quote(os.environ["DEVENV_RUNTIME"] + "/postgres", safe="")
print(f"postgresql://{user}@localhost/maps?host={socket}")
PY
)
export SERVER_HOST=127.0.0.1 SERVER_PORT=8080 SERVER_URL=http://localhost:8080
export VITE_SERVER_URL=http://localhost:8080

python3 - <<'PY'
import socket
import sys

for port in (8080, 5173):
    with socket.socket() as listener:
        try:
            listener.bind(("127.0.0.1", port))
        except OSError:
            sys.exit(f"Port {port} is occupied. Stop the existing app before starting CMU Maps.")
PY

echo "Waiting for PostgreSQL and Ricochet..."
ready=false
for ((attempt = 0; attempt < 120; attempt++)); do
  if pg_isready -h "$DEVENV_RUNTIME/postgres" -d maps -U "$(id -un)" >/dev/null 2>&1 && \
    curl --fail --silent --max-time 2 http://127.0.0.1:8090/healthz >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "PostgreSQL or Ricochet did not become ready. Check their devenv process logs." >&2
  exit 1
fi

bun install --frozen-lockfile
bun run sync
(cd apps/server && bunx prisma db push --skip-generate)

echo "Starting web at http://localhost:5173 and API at http://localhost:8080"
export TURBO_UI=stream
exec bunx turbo dev --env-mode=loose --filter=@cmumaps/web --filter=@cmumaps/server
