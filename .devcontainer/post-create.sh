#!/usr/bin/env bash
set -e

# Install UV for Python package management:
# https://docs.astral.sh/uv/getting-started/installation/
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Bun for JavaScript package management:
# https://bun.com/get
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
# Expand these variables when the shell starts.
# shellcheck disable=SC2016
echo 'export PATH="$HOME/.bun/bin:$PATH"' >>~/.zshrc

# Install shfmt for shell script formatting
# https://formulae.brew.sh/formula/shfmt
brew install shfmt

# Install editorconfig-checker for linting with EditorConfig
# https://github.com/editorconfig-checker/editorconfig-checker?tab=readme-ov-file#6-using-homebrew
brew install editorconfig-checker

# Activate Bun completions in zsh on startup
if ! grep -q 'source <(SHELL=zsh bun completions)' ~/.zshrc; then
  echo 'source <(SHELL=zsh bun completions)' >>~/.zshrc
fi

# Install Bun dependencies
bun install

# Environment files must be configured before database setup.
for app in server dataflow; do
  if [[ ! -f "apps/$app/.env" ]]; then
    echo "Configure apps/$app/.env, then rerun .devcontainer/post-create.sh. Please ask a team lead for the required values." >&2
    exit 1
  fi
done

# Push the database schema and generate OpenAPI spec
cd apps/server
bunx prisma db push
bun run tsoa
bun run openapi

# Start the server in the background (without console output) for data population
bun run dev >/dev/null 2>&1 &

# Create a virtual environment for Python
cd ../..
cd apps/dataflow
uv sync

# Populate the database
uv run populate-database

# Kill the server
kill %1
