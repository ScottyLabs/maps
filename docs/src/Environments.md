# Environments

[Kennel](https://docs.kennel.scottylabs.org/guides/deploying/) deploys every long-lived branch and pull request with the matching secretspec profile. Each deployment has its own database.

| Branch | Profile | Server | Docs |
| -- | -- | -- | -- |
| `main` | `prod` | [cmumaps.com](https://cmumaps.com) | [maps-docs-main.scottylabs.net](https://maps-docs-main.scottylabs.net) |
| `staging` | `staging` | [maps-server-staging.scottylabs.net](https://maps-server-staging.scottylabs.net) | [maps-docs-staging.scottylabs.net](https://maps-docs-staging.scottylabs.net) |
| `dev` | `dev` | [maps-server-dev.scottylabs.net](https://maps-server-dev.scottylabs.net) | [maps-docs-dev.scottylabs.net](https://maps-docs-dev.scottylabs.net) |
| PR `n` | `preview` | `maps-server-pr-n.scottylabs.net` | `maps-docs-pr-n.scottylabs.net` |

The server serves the web at `/` and the visualizer at `/visualizer`.
