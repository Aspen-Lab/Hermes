"""Hermes CLI — entry point for all commands."""

from __future__ import annotations

import shutil
from pathlib import Path

import click


HERMES_DIR = Path.home() / ".hermes"
DEFAULT_CONFIG = "hermes.yml"


@click.group()
@click.option(
    "--config", "-c",
    default=DEFAULT_CONFIG,
    type=click.Path(),
    help="Path to config file",
)
@click.pass_context
def main(ctx: click.Context, config: str) -> None:
    """Hermes — self-hosted information agent."""
    ctx.ensure_object(dict)
    ctx.obj["config_path"] = Path(config)


@main.command()
def init() -> None:
    """Initialize a new Hermes project with a default config."""
    HERMES_DIR.mkdir(parents=True, exist_ok=True)

    config_dest = Path(DEFAULT_CONFIG)
    if config_dest.exists():
        click.echo(f"Config already exists: {config_dest}")
    else:
        example = Path(__file__).parent / "data" / "config.example.yaml"
        if example.exists():
            shutil.copy(example, config_dest)
        else:
            config_dest.write_text(_default_config())
        click.echo(f"Created {config_dest} — edit it to add your interests and sources.")

    click.echo(f"Created {HERMES_DIR}/")
    click.echo("\nNext: edit hermes.yml, then run `hermes run --once`")


@main.command()
@click.option("--once", is_flag=True, default=True, help="Run once and exit")
@click.pass_context
def run(ctx: click.Context, once: bool) -> None:
    """Run the Hermes pipeline."""
    import asyncio

    from hermes_news.config import load_config
    from hermes_news.pipeline import run_pipeline
    from hermes_news.storage import Database

    config_path = ctx.obj["config_path"]
    if not config_path.exists():
        raise click.ClickException(
            f"Config not found: {config_path}\nRun `hermes init` first."
        )

    config = load_config(config_path)
    db = Database(Path(config.storage_path).expanduser())

    result = asyncio.run(run_pipeline(config, db))
    click.echo(f"\nDone. {len(result)} items written.")


@main.command()
@click.pass_context
def sources(ctx: click.Context) -> None:
    """List configured sources."""
    from hermes_news.config import load_config

    config_path = ctx.obj["config_path"]
    if not config_path.exists():
        raise click.ClickException(f"Config not found: {config_path}")

    config = load_config(config_path)

    click.echo(f"{'NAME':<24} {'TYPE':<14} {'PRIORITY'}")
    click.echo("─" * 50)
    for s in config.sources:
        click.echo(f"{s.name:<24} {s.type:<14} {s.priority}")


def _default_config() -> str:
    return """\
# hermes.yml — Hermes configuration
# Docs: https://github.com/hermes-news/hermes

profile:
  name: "Your Name"
  keywords:
    - "your interest here"

topics:
  - name: "Example Topic"
    keywords:
      - "keyword1"
      - "keyword2"

sources:
  - name: "example-feed"
    type: rss
    url: "https://example.com/rss"
    priority: 5

engine:
  weights:
    tfidf: 0.50
    keyword: 0.30
    source: 0.20
  min_score: 0.15
  max_items: 50
  dedup_window_days: 30

output:
  format: markdown
  path: "~/hermes-output"

storage:
  path: "~/.hermes/hermes.db"
"""
