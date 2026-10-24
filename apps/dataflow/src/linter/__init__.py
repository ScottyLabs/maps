"""Linter for the dataflow application."""

import subprocess


def main() -> None:
    """For uv run lint to work."""
    subprocess.run(["ruff", "check"], check=True)  # noqa: S607
    subprocess.run(["mypy", "."], check=True)  # noqa: S607
    subprocess.run(["ty", "check"], check=True)  # noqa: S607
