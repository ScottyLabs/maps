# Setup

1. Install Lix with the ScottyLabs binary cache and log in to OpenBao once per machine, following kennel's [local development](https://docs.kennel.scottylabs.org/guides/local-development/#installing-nix) and [secrets](https://docs.kennel.scottylabs.org/guides/secrets/#local-development) guides.

1. Enter the dev shell from the repository root. It installs the Deno and Python dependencies, the git hooks, and loads the `dev` secrets:

   ```sh
   nix develop
   ```

1. Start PostgreSQL, the Ricochet login relay, the server, the web and the visualizer:

   ```sh
   pitchfork start --local
   ```

   The web runs at <http://localhost:5173> and the visualizer at <http://localhost:5174/visualizer/>. Both proxy `/api` to the server on port 3001. Follow one process with `pitchfork logs server` and stop everything with `pitchfork stop --local`.

To run the dataflow scripts, copy `.env.example` to `.env` and fill in the values you need.
