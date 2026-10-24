# Troubleshooting

Start with [Running locally](Setup.md). Run commands from the repository root in
a macOS/Linux terminal or inside WSL2 on Windows.

## Missing Nix, devenv, or OpenBao

Follow the official installation links in the running guide and open a fresh
terminal after installing Nix. Verify `nix --version`, `devenv version`, and
`bao version`. The launcher reports missing tools and does not install them.
PowerShell users must enter WSL2 and install the tools there. Docker Desktop and
Colima are not part of this setup.

## OpenBao login succeeds but secret reads return 403

OIDC login establishes identity; access policies determine readable paths. This
setup uses KV v2 mount `secret`, path `secretspec/maps/dev/<NAME>`. Ask the team to
check access to the six app entries and grouped `TEMP_DEV_S3` record listed in
the running guide. The older `ScottyLabs/cmumaps/local/server` path is unused.
A failed fetch preserves saved env files. Never paste credentials into logs.

## Port 5173, 8080, or 8090 is occupied

Stop the application owning the port. If it is an older CMU Maps development
container, stop that container through its engine; the native launcher does not
manage Docker. Then restart the native stack:

```sh
python3 scripts/dev/dev.py stop
python3 scripts/dev/dev.py start --skip-secrets
```

The API uses 8080 to avoid privileged port binding on Linux. Vite requires 5173
and will not silently choose another port. Use one startup process per checkout.

## Services do not become ready

Inspect the PostgreSQL and Ricochet logs in the `devenv up` terminal or with
`python3 scripts/dev/dev.py logs postgres` / `logs ricochet`. First-run Nix downloads can take several
minutes. Check connectivity, free disk space, and the reported Nix evaluation
error before restarting. After changing Nix configuration, stop the existing
process manager and start again. Do not delete database state to fix a download.

PostgreSQL uses the socket under `$DEVENV_RUNTIME/postgres`; the app explicitly
selects it. A stale shell `DATABASE_URL` or old Docker `.env` connection string
must not redirect app startup. To refresh local configuration, run `dev.py secrets`.

## Keycloak rejects redirect_uri

Refresh secrets and restart. The development client must allow the supplied
`OAUTH_RELAY_URL`. The backend's local return URL is
`http://localhost:8080/api/auth/oauth2/callback/keycloak`; wrapped state lets
Ricochet forward there after Keycloak returns to the registered relay.
Check `http://localhost:8090/healthz`. Changing a local callback does not register
it in Keycloak; ask the identity administrator if the supplied relay is rejected.

## Population is rejected

Run `python3 scripts/dev/dev.py populate --check` with the backend running.
Its Keycloak service account needs `/projects/maps/admins` in the token's `groups`
claim. Signature, expiry, and issuer must pass; audience is not required by this
branch's policy. Personal OpenBao or browser login does not grant API population
permission.

## Missing maps after switching from Docker

Native PostgreSQL starts with a new database. Existing Docker volume data are
retained separately, not automatically migrated. Follow the quick start to import
the shared dataset. If you need unexported edits from the old database, export
those before retiring it.

`populate --check` must find all four processed `floorplans/*.json` files in the
temporary bucket. A storage 403 concerns S3 credentials, separately from Keycloak
API permissions. Raw source-fetch files cannot replace processed datasets.
After importing, restart the backend to rebuild caches. A failed write after
reset can leave partial records; fix the cause and rerun the full import. POIs
need their optional dataset and `--include-pois`.

## File watching and Windows paths

Keep a WSL checkout in the Linux filesystem and use a WSL-connected editor.
Install/log into Bao inside WSL, where the launcher runs. Quote paths with spaces.
Shell, Python, and Nix sources use LF through `.gitattributes`. The native app
edits the checkout directly; there is no bind mount or container user ownership.

## Checks and committing

Run inside `devenv shell`, generating server artifacts before checks:

```sh
bun run sync
bun run check
```

Use Conventional Commits. Hooks check EditorConfig, Syncpack, TypeScript/Biome,
and Python when dataflow files change. See the
[dataflow README](../../apps/dataflow/README.md) for Python validation.
Git uses your normal host SSH credentials.
