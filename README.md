# CMU Maps

## Overview

[CMU Maps](https://cmumaps.com) is a web application that provides a map of the
Carnegie Mellon University campus, allowing users to easily access information about campus locations.

Key features include:

- View floorplans
- Room level navigation
- Search for buildings and rooms
- View building and room information

## Quick start

Install Docker with Compose, Python, and OpenBao CLI on your host. Start Docker
Desktop, Colima, or Docker Engine. Ensure your OpenBao policy can read the app
settings and `secret/secretspec/maps/dev/TEMP_DEV_S3`, which contains this branch's
temporary bucket configuration. From the repository root:

1. **Terminal 1:** log into OpenBao and start the app. Leave it running once ready.

   macOS, Linux, or WSL:

   ```sh
   export BAO_ADDR=https://secrets.scottylabs.org
   bao login -method=oidc
   python3 scripts/dev/dev.py start
   ```

   On Windows PowerShell:

   ```powershell
   $env:BAO_ADDR = "https://secrets.scottylabs.org"
   bao login -method=oidc
   py -3 scripts/dev/dev.py start
   ```

2. **Terminal 2:** open another terminal in the repository root, check the shared
   S3 dataset, then populate the local database. Continue only if the check succeeds.

   ```sh
   python3 scripts/dev/dev.py populate --check
   python3 scripts/dev/dev.py populate
   ```

3. **Terminal 1:** after population finishes, press **Ctrl-C** and restart the app
   to refresh its search and navigation caches:

   ```sh
   python3 scripts/dev/dev.py start --skip-secrets
   ```

4. Open [localhost:5173](http://localhost:5173).

For steps 2–3 in Windows PowerShell, replace `python3` with `py -3`.
On later runs, use `start --skip-secrets`; populate only when refreshing local data.

The [running guide](docs/src/Setup.md#quick-start) includes platform prerequisites,
the full first-run walkthrough, daily commands, and manual instructions.
The launcher reports missing Docker/OpenBao dependencies; it does not install them.

## Documentation

The project documentation lives in [docs/src](docs/src/SUMMARY.md).
See the [development script reference](scripts/dev/README.md) for the Kennel scaffold,
service layout, and storage configuration.

## Contributing

Please check out our [Contributing Guide](.github/CONTRIBUTING.md)
for more information about how to contribute to the project.
