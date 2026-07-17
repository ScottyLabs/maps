#!/usr/bin/env bash
set -e

# Install UV for Python package management:
# https://docs.astral.sh/uv/getting-started/installation/
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Deno for JavaScript and TypeScript tooling:
# https://docs.deno.com/runtime/getting_started/installation/
brew install deno

# Install shfmt for shell script formatting
# https://formulae.brew.sh/formula/shfmt
brew install shfmt

# Install editorconfig-checker for linting with EditorConfig
# https://github.com/editorconfig-checker/editorconfig-checker?tab=readme-ov-file#6-using-homebrew
brew install editorconfig-checker

# Install Vault for secret management
# https://developer.hashicorp.com/vault/install
brew tap hashicorp/tap
brew install hashicorp/tap/vault

# Set up environment variables
deno task secrets:setup
deno task secrets:pull all all

# Push the database schema and generate OpenAPI spec
cd apps/server
deno run -A npm:prisma db push
deno task tsoa
deno task openapi

# Start the server in the background (without console output) for data population
deno task dev >/dev/null 2>&1 &

# Create a virtual environment for Python
cd ../..
cd apps/dataflow
uv sync

# Populate the database
uv run populate-database

# Kill the server
kill %1
