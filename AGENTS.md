# AGENTS.md

## Local development

For startup, credentials, database import, or service troubleshooting, read
`docs/src/Setup.md`. The supported stack runs natively through Kennel/devenv on
macOS, Linux, or WSL2. Start with `python3 scripts/dev/dev.py start`.
PostgreSQL and Ricochet are Kennel features; the API uses port 8080. Keep local
database writes on the private devenv database. Existing Docker volumes are
separate data; production Dockerfiles do not define development startup.

## Fresh-source pipeline

For implementation decisions and acceptance, read `docs/src/Data-Pipeline-Spec.md`.
For resuming, assigning, or closing pipeline work, read
`docs/src/Data-Pipeline-TODO.md`; its dated handoff records the tested checkpoint
and source investigations. Working JSONs are authoritative; the database is a
derived preview. CLI and visualizer use the same pipeline implementation.

## Validation and commits

Before TypeScript checks/builds, run `bun run sync` to generate Prisma, tsoa and
OpenAPI artifacts. Run `bun run check` and the relevant Python tests/lint inside
`devenv shell`; commands are in `apps/dataflow/README.md`. Pre-commit hooks run
EditorConfig, syncpack, workspace checks and Python lint for staged dataflow work.
Use incremental Conventional Commits and validate affected source-to-app behavior.
Keep raw campus datasets, env files, credentials and browser profiles outside Git.
