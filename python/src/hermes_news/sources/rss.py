"""RSS/Atom feed source adapter."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from time import mktime
from typing import ClassVar

import feedparser

from hermes_news.models import Item
from hermes_news.sources import SourceAdapter

log = logging.getLogger(__name__)


class RSSAdapter(SourceAdapter):
    source_type: ClassVar[str] = "rss"

    async def fetch(self) -> list[Item]:
        url = self.config.extra.get("url", "")
        if not url:
            log.warning("RSS source '%s' has no url configured", self.config.name)
            return []

        resp = await self.client.get(url)
        resp.raise_for_status()

        feed = feedparser.parse(resp.text)
        items: list[Item] = []

        for entry in feed.entries:
            item_id = entry.get("id") or entry.get("link") or ""
            if not item_id:
                continue

            stable_id = hashlib.sha256(item_id.encode()).hexdigest()[:16]
            published = _parse_time(entry)

            content = ""
            if hasattr(entry, "summary"):
                content = entry.summary
            elif hasattr(entry, "content") and entry.content:
                content = entry.content[0].get("value", "")

            items.append(Item(
                id=f"rss:{stable_id}",
                title=entry.get("title", ""),
                url=entry.get("link", ""),
                content=_strip_html(content),
                source=self.config.name,
                source_type="rss",
                published=published,
                authors=[a.get("name", "") for a in entry.get("authors", [])],
                metadata={
                    "feed_title": feed.feed.get("title", ""),
                    "feed_url": url,
                },
            ))

        log.info("RSS '%s': fetched %d items", self.config.name, len(items))
        return items


def _parse_time(entry: dict) -> datetime | None:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        return datetime.fromtimestamp(mktime(entry.published_parsed), tz=timezone.utc)
    if hasattr(entry, "updated_parsed") and entry.updated_parsed:
        return datetime.fromtimestamp(mktime(entry.updated_parsed), tz=timezone.utc)
    return None


def _strip_html(text: str) -> str:
    """Naive HTML tag removal."""
    import re
    clean = re.sub(r"<[^>]+>", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean
