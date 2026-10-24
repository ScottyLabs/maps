# Troubleshooting

Start with the [running guide](Setup.md). Replace `python3` with `py -3` in
Windows PowerShell. Run host commands from the repository root.

## Missing Docker, Compose, or OpenBao

Install these high-level dependencies yourself using their official instructions
linked from the running guide. The launcher reports missing commands; it does not
install them. Verify `docker compose version`, `docker info`, and `bao version`.
Start Docker Desktop, Colima, or Docker Engine before launching. Docker Desktop
must use Linux containers. The script uses the active Docker context; check
`docker context show` if it cannot find your engine or existing volumes.

## OpenBao login succeeds but reading secrets returns 403

OIDC login authenticates your identity; it does not grant every path. This setup
reads KV v2 mount `secret`, path `secretspec/maps/dev/<NAME>`, field `value`.
The older `ScottyLabs/cmumaps/local/server` path is not used by the new launcher.
Ask the team to check your Maps development policies and that the six identity/MapKit entries and the `TEMP_DEV_S3` record
listed in the running guide exist. A failed fetch leaves existing env files intact.
Do not paste tokens or secret values into logs or issues.

## A different app appears on port 5173

Stop the other app, then stop/start the CMU Maps containers so the engine retries
host port forwarding. The same applies to conflicts on ports 80 and 8090.

```sh
python3 scripts/dev/dev.py stop
python3 scripts/dev/dev.py start --skip-secrets
```

Vite now requires port 5173 and will not silently choose 5174. If the helper says
an app already runs inside the container, use its original terminal or stop the
containers before launching another. Host ports are bound only to loopback.
On rootless Linux Docker, publishing port 80 may require host configuration;
use an engine configured to publish the documented ports.

## Relay readiness times out

```sh
python3 scripts/dev/dev.py logs
```

The first run downloads Nix packages and may need more than the launcher's
ten-minute readiness window on a slow connection. Once services finish, rerun
`start --skip-secrets`. Check connectivity and available VM memory/disk if package
downloads or evaluation fail. Do not delete volumes as a first troubleshooting step.

The Compose file mounts `/tmp` as executable tmpfs so devenv PID/socket files
cannot survive container restarts. After updating from an older configuration,
recreate the devcontainer with `docker compose -f .devcontainer/docker-compose.yml up -d --force-recreate dev`.
Persistent PostgreSQL data stay in named volumes. Restart the app after
recreating the container.

## Keycloak rejects redirect_uri

Refresh env files from OpenBao and restart the app. The development client must
allow the supplied `OAUTH_RELAY_URL`; the backend's local callback is
`http://localhost/api/auth/oauth2/callback/keycloak`. Ricochet forwards the callback
to the backend using the wrapped state. Check that port 8090 is available and
`http://localhost:8090/healthz` responds. Changing a redirect URL locally does not
register it with Keycloak. Ask the identity administrator to check the client
registration if the supplied relay URL is rejected.

## Population is rejected by the backend

Run `python3 scripts/dev/dev.py populate --check` with the backend running. The
client needs service-account/client-credentials support and
`/projects/maps/admins` in the access token's `groups` claim. Signature, expiry,
and issuer must pass; audience is not required by the current backend policy.
This account is separate from your personal OpenBao login. A successful browser
login does not prove that the service account can populate data.

## Missing maps, routes, or floorplans

Startup creates the local schema but does not import campus data. Run `dev.py secrets` to refresh the `TEMP_DEV_S3` configuration, then
`populate --check`. This branch reads the one source from the dataflow env file;
inherited storage variables and old settings do not select another source. A storage
403 means the supplied bucket credentials lack access, separate from Keycloak
backend authorization.

The four required `floorplans/*.json` objects must exist. Raw source-fetch files
cannot be imported directly. Missing credentials/files fail before database reset.
After a successful import, restart the app to rebuild caches. A failure after
reset can leave partial records; fix the cause and rerun the complete import.
POIs require their optional dataset; floorplans render from imported room geometry.

## Windows line endings, file watching, and paths

Use PowerShell with `py -3 scripts/dev/dev.py`, or a WSL terminal with `python3`.
The host launcher needs no Bash or jq. Container helpers are Bash scripts running
inside Linux, and `.gitattributes` keeps their line endings as LF. If you have an
older checkout with CRLF scripts, normalize those files to LF before rebuilding.
Quote paths containing spaces. The checkout is mounted at `/workspace` in the container.

For reliable hot reload with Docker Desktop/WSL, keep the checkout in the WSL
filesystem and edit using a WSL-aware editor. Run `bao login` in the same host
terminal environment as the launcher; Windows and WSL can have separate tokens.

## Checks and committing

Generate server artifacts before checks, preferably inside the devcontainer:

```sh
bun run sync
bun run check
```

Use a conventional commit message. The pre-commit hook checks EditorConfig,
Syncpack, TypeScript/Biome, and Python when dataflow files change. Fix reported
errors instead of editing or disabling hooks. See the [dataflow README](../../apps/dataflow/README.md)
for minimal import dependencies and Python checks. If a Linux container created
root-owned generated files in the bind mount, correct ownership of those specific
files before editing them as your host user.

Git operations can run from the host terminal, where your SSH credentials already
work. Do not copy private SSH keys into the image. If an editor extension appears
stale, reload its window after generated types and dependencies are available.
