# CMU Maps Web

## Overview

The [CMU Maps web](https://cmumaps.com) is a web application that provides a map of the CMU campus.

## Development

### Running the Web

Start the server, both UIs and their dependencies from the repository root inside `nix develop`:

```zsh
pitchfork start --local
```

The web runs at <http://localhost:5173>.

### Developing by viewing on a Mobile Device

To expose the dev server on your network, restart it with `--host`:

```zsh
pitchfork stop web
secretspec run -- deno task dev:web --host
```

Then, open the web application on your mobile device by navigating to the Network URL listed in the terminal.
