"""Pipeline orchestrator — fetch → dedup → tag → score → filter → output."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import click
import httpx

from hermes_news.config import HermesConfig
from hermes_news.models import Item, ScoredItem
from hermes_news.output import get_writer
from hermes_news.scoring import CompositeScorer
from hermes_news.sources import get_source_registry
from hermes_news.storage import Database
from hermes_news.tagging import Tagger

log = logging.getLogger(__name__)


async def run_pipeline(config: HermesConfig, db: Database) -> list[ScoredItem]:
    """Single execution of the full Hermes pipeline."""
    run_id = uuid.uuid4().hex[:12]
    started_at = datetime.now(timezone.utc).isoformat()

    # 1. Fetch from all sources
    click.echo("Fetching sources...", nl=False)
    raw_items = await _fetch_all(config)
    click.echo(f" {len(raw_items)} items from {len(config.sources)} sources")

    if not raw_items:
        click.echo("No items fetched. Check your sources config.")
        return []

    # 2. Dedup
    new_items = db.filter_unseen(raw_items, config.engine.dedup_window_days)
    if len(new_items) < len(raw_items):
        click.echo(f"Dedup: {len(raw_items)} → {len(new_items)} new items")

    if not new_items:
        click.echo("No new items since last run.")
        return []

    # 3. Tag
    click.echo("Tagging...", nl=False)
    tagger = Tagger(config.topics)
    tagged = tagger.tag_batch(new_items)
    tagged_count = sum(1 for t in tagged if t.tags)
    click.echo(f" {tagged_count}/{len(tagged)} items matched topics")

    # 4. Score
    click.echo("Scoring...", nl=False)
    scorer = CompositeScorer(config)
    scored = scorer.score_batch(tagged)
    click.echo(f" done")

    # 5. Filter
    filtered = [s for s in scored if s.score >= config.engine.min_score]
    filtered = filtered[: config.engine.max_items]
    click.echo(f"Filtering: {len(scored)} → {len(filtered)} items (threshold {config.engine.min_score})")

    if not filtered:
        click.echo("No items above threshold. Try lowering engine.min_score.")
        return []

    # 6. Store
    db.store_items(filtered, run_id)

    # 7. Output
    writer = get_writer(config.output)
    output_path = writer.write(filtered, config)
    click.echo(f"Output: {output_path}")

    # 8. Record run
    finished_at = datetime.now(timezone.utc).isoformat()
    db.record_run(
        run_id=run_id,
        started_at=started_at,
        finished_at=finished_at,
        fetched=len(raw_items),
        scored=len(scored),
        output=len(filtered),
    )

    return filtered


async def _fetch_all(config: HermesConfig) -> list[Item]:
    """Fetch from all configured sources concurrently."""
    registry = get_source_registry()
    items: list[Item] = []

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        tasks = []
        for sc in config.sources:
            adapter_cls = registry.get(sc.type)
            if not adapter_cls:
                log.warning("Unknown source type '%s' for source '%s', skipping", sc.type, sc.name)
                continue
            adapter = adapter_cls(sc, client)
            tasks.append((sc.name, adapter.fetch()))

        results = await asyncio.gather(
            *(task for _, task in tasks),
            return_exceptions=True,
        )

        for (name, _), result in zip(tasks, results):
            if isinstance(result, Exception):
                log.warning("Source '%s' failed: %s", name, result)
                click.echo(f"  ⚠ {name}: {result}")
            else:
                items.extend(result)

    return items
