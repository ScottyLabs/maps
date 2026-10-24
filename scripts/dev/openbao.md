# Devcontainer and OpenBao running guide

The maintained guide is now [Running locally](../../docs/src/Setup.md).

- [Prerequisites for macOS, Windows, Linux, Docker Desktop, and Colima](../../docs/src/Setup.md#prerequisites)
- [Quick start](../../docs/src/Setup.md#quick-start)
- [Secrets and browser/service-account login](../../docs/src/Setup.md#secrets-and-login)
- [Populate the local database](../../docs/src/Setup.md#populate-the-local-database)
- [Manual run: the commands behind the launcher](../../docs/src/Setup.md#manual-run)
- [Troubleshooting](../../docs/src/Troubleshooting.md)

The host launcher is [`dev.py`](dev.py). `container.sh` and `populate.sh` retain
compatible Bash entry points. Container-only helpers run on Linux regardless of
the host OS. The [script reference](README.md) describes the temporary bucket and Kennel scaffold.
