"""SQLite storage for items, scores, and feedback."""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from hermes_news.models import Item, ScoredItem

log = logging.getLogger(__name__)


class Database:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.conn = sqlite3.connect(str(path))
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()

    def _init_schema(self) -> None:
        schema_path = Path(__file__).parent / "schema.sql"
        self.conn.executescript(schema_path.read_text())
        self.conn.commit()

    def filter_unseen(self, items: list[Item], dedup_window_days: int = 30) -> list[Item]:
        """Return only items not already in the database."""
        if not items:
            return []

        cutoff = (datetime.now(timezone.utc) - timedelta(days=dedup_window_days)).isoformat()

        existing_ids: set[str] = set()
        existing_urls: set[str] = set()

        rows = self.conn.execute(
            "SELECT id, url FROM items WHERE fetched_at >= ?", (cutoff,)
        ).fetchall()
        for row in rows:
            existing_ids.add(row[0])
            existing_urls.add(row[1])

        return [
            it for it in items
            if it.id not in existing_ids and it.url not in existing_urls
        ]

    def store_items(self, items: list[ScoredItem], run_id: str) -> None:
        """Store scored items and their tags."""
        for si in items:
            it = si.item
            try:
                self.conn.execute(
                    """INSERT OR IGNORE INTO items
                       (id, title, url, content, source, source_type, published, authors, metadata)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        it.id,
                        it.title,
                        it.url,
                        it.content,
                        it.source,
                        it.source_type,
                        it.published.isoformat() if it.published else None,
                        json.dumps(it.authors),
                        json.dumps(it.metadata),
                    ),
                )

                for tag in si.tags:
                    self.conn.execute(
                        "INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)",
                        (it.id, tag),
                    )

                self.conn.execute(
                    """INSERT OR IGNORE INTO item_scores (item_id, run_id, score, breakdown)
                       VALUES (?, ?, ?, ?)""",
                    (it.id, run_id, si.score, json.dumps(si.score_breakdown)),
                )
            except sqlite3.Error:
                log.warning("Failed to store item %s", it.id, exc_info=True)

        self.conn.commit()

    def record_run(self, run_id: str, started_at: str, finished_at: str,
                   fetched: int, scored: int, output: int, config_hash: str = "") -> None:
        self.conn.execute(
            """INSERT INTO runs (id, started_at, finished_at, items_fetched, items_scored, items_output, config_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (run_id, started_at, finished_at, fetched, scored, output, config_hash),
        )
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()
