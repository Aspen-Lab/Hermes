"""arXiv source adapter via Atom API."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from time import mktime
from typing import ClassVar

import feedparser

from hermes_news.models import Item
from hermes_news.sources import SourceAdapter

log = logging.getLogger(__name__)

ARXIV_API = "http://export.arxiv.org/api/query"


class ArxivAdapter(SourceAdapter):
    source_type: ClassVar[str] = "arxiv"

    async def fetch(self) -> list[Item]:
        query = self.config.extra.get("query", "cat:cs.AI")
        max_results = self.config.extra.get("max_results", 30)

        params = {
            "search_query": query,
            "start": 0,
            "max_results": max_results,
            "sortBy": "submittedDate",
            "sortOrder": "descending",
        }

        # arXiv asks for 3s between requests
        await asyncio.sleep(0.5)

        resp = await self.client.get(ARXIV_API, params=params)
        resp.raise_for_status()

        feed = feedparser.parse(resp.text)
        items: list[Item] = []

        for entry in feed.entries:
            arxiv_id = entry.get("id", "")
            # extract just the ID part, e.g. "2604.08821"
            short_id = arxiv_id.split("/abs/")[-1] if "/abs/" in arxiv_id else arxiv_id

            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime.fromtimestamp(
                    mktime(entry.published_parsed), tz=timezone.utc
                )

            authors = []
            for a in entry.get("authors", []):
                name = a.get("name", "")
                if name:
                    authors.append(name)

            categories = [t.get("term", "") for t in entry.get("tags", [])]

            items.append(Item(
                id=f"arxiv:{short_id}",
                title=entry.get("title", "").replace("\n", " ").strip(),
                url=entry.get("link", arxiv_id),
                content=entry.get("summary", "").replace("\n", " ").strip(),
                source=self.config.name,
                source_type="arxiv",
                published=published,
                authors=authors,
                metadata={
                    "arxiv_id": short_id,
                    "categories": categories,
                },
            ))

        log.info("arXiv '%s': fetched %d items", self.config.name, len(items))
        return items
