# CMU Maps Web

The [CMU Maps web app](https://cmumaps.com) provides a map of the CMU campus.

## Development

Follow the [native running guide](../../docs/src/Setup.md). The launcher starts
the web app on [localhost:5173](http://localhost:5173), the API on port 8080 and
the visualizer on port 5174. Edit this checkout directly; Nix supplies runtimes.
The default bindings are loopback. Access from another device requires deliberate
network and authentication-origin configuration.

For split manual startup inside `devenv shell`, follow the guide to select the
private database and configure the API before using `bun run dev:web`. Run either
that split workflow or the all-in-one launcher to avoid duplicate API processes.

A generated preview pins the app to its workspace/revision, preserves the context
in room and route URLs, and requests a full reload when the selected dataset
changes. See the [visualizer workflow](../../docs/src/Data-Visualizer-Wiki.md) for
saving working JSON, building and loading a candidate.
