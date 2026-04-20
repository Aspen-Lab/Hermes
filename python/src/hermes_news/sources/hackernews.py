"""Hacker News source adapter via official Firebase API."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import ClassVar

from hermes_news.models import Item
from hermes_news.sources import SourceAdapter

log = logging.getLogger(__name__)

HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{}.json"


class HackerNewsAdapter(SourceAdapter):
    source_type: ClassVar[str] = "hackernews"

    async def fetch(self) -> list[Item]:
        max_items = self.config.extra.get("max_items", 30)
        min_points = self.config.extra.get("min_points", 0)

        resp = await self.client.get(HN_TOP)
        resp.raise_for_status()
        story_ids = resp.json()[:max_items]

        items: list[Item] = []
        for sid in story_ids:
            try:
                r = await self.client.get(HN_ITEM.format(sid))
                r.raise_for_status()
                story = r.json()
            except Exception:
                log.debug("Failed to fetch HN item %s", sid, exc_info=True)
                continue

            if not story or story.get("type") != "story":
                continue
            if story.get("score", 0) < min_points:
                continue

            published = None
            if story.get("time"):
                published = datetime.fromtimestamp(story["time"], tz=timezone.utc)

            items.append(Item(
                id=f"hn:{sid}",
                title=story.get("title", ""),
                url=story.get("url", f"https://news.ycombinator.com/item?id={sid}"),
                content=story.get("text", story.get("title", "")),
                source=self.config.name,
                source_type="hackernews",
                published=published,
                authors=[story.get("by", "")],
                metadata={
                    "points": story.get("score", 0),
                    "num_comments": story.get("descendants", 0),
                    "hn_id": sid,
                },
            ))

        log.info("HN '%s': fetched %d items", self.config.name, len(items))
        return items
