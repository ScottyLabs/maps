## Dev Container

If you see the following error when opening the Dev Container, check this [issue](https://github.com/microsoft/vscode-remote-release/issues/11425).
```
2024-01-29 17:48:50.785 [error] Error: unable to get issuer certificate
  at TLSSocket.onConnectSecure (node:_tls_wrap:1543:34)
  at TLSSocket.emit (node:events:513:28)
  at TLSSocket._finishInit (node:_tls_wrap:962:8)
  at ssl.onhandshakedone (node:_tls_wrap:746:12) remote-containers.createDevContainerFile {"value":"ms-vscode-remote.remote-containers","_lower":"ms-vscode-remote.remote-containers"}
```


## Committing Tips

If you aren't allowed to commit, try the following:

1. Make sure you are using a [conventional commit message](https://www.conventionalcommits.org/en/v1.0.0/).
2. Run `bun run check` and try to fix the errors.
3. If you believe the errors are not related to your code changes, try syncing with
   - `git pull`
   - `bun run sync`

If you really believe that it is a local issue, use the `--no-verify` flag to bypass the precommit hook. 
All the tests will be run again on PR as GitHub workflows. 

Optionally, you can also comment out lines in <https://github.com/ScottyLabs/cmumaps/blob/main/.husky/pre-commit> to disable
some precommit checks to speed up committing. For example, there is no need to run `uv run lint` if you didn't make any change 
to Python files. Make sure to not commit these changes!

## Git Push Troubleshooting

> If you clone a Git repository using SSH and your SSH key has a passphrase, VS Code's pull and sync features may hang when running remotely. Either use an SSH key without a passphrase, clone using HTTPS, or run git push from the command line to work around the issue.
>
> *Source: [VS Code Remote Containers – Known Limitations](https://code.visualstudio.com/docs/devcontainers/containers#_known-limitations)*

The easiest option is to run `git push` from command line outside the dev container. 

## Extension Issue in Editor

Try reloading the window or restarting the extension, applies to Biome, MyPy, etc.