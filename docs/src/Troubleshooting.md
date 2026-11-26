# Troubleshooting

## Committing

The dev shell installs kennel's [git hooks](https://docs.kennel.scottylabs.org/guides/local-development/#git-hooks). If a commit is rejected:

1. Use a [conventional commit message](https://www.conventionalcommits.org/en/v1.0.0/).
1. Run `prek run --all-files` to see every failing check, and `nix fmt` to apply formatting.
1. If the errors look unrelated to your change, sync with `git pull` and `deno task sync`.

nixbot runs the same hooks on every push, so skipping them with `--no-verify` only delays the failure.

## Secrets

If `nix develop` warns that secretspec could not resolve the project's secrets, log in again with `nix run git+https://git.cmu.dev/ScottyLabs/kennel#login`. Check what is missing with `secretspec check`.
