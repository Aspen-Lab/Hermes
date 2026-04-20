"""Reddit source adapter via public JSON API (no OAuth)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import ClassVar

from hermes_news.models import Item
from hermes_news.sources import SourceAdapter

log = logging.getLogger(__name__)

REDDIT_URL = "https://www.reddit.com/r/{subreddit}/{sort}.json"


class RedditAdapter(SourceAdapter):
    source_type: ClassVar[str] = "reddit"

    async def fetch(self) -> list[Item]:
        subreddit = self.config.extra.get("subreddit", "")
        if not subreddit:
            log.warning("Reddit source '%s' has no subreddit configured", self.config.name)
            return []

        sort = self.config.extra.get("sort", "hot")
        limit = self.config.extra.get("limit", 25)

        url = REDDIT_URL.format(subreddit=subreddit, sort=sort)
        resp = await self.client.get(
            url,
            params={"limit": limit, "raw_json": 1},
            headers={"User-Agent": "hermes-news/0.1"},
        )
        resp.raise_for_status()

        data = resp.json()
        children = data.get("data", {}).get("children", [])
        items: list[Item] = []

        for child in children:
            post = child.get("data", {})
            if not post:
                continue

            post_id = post.get("id", "")
            published = None
            if post.get("created_utc"):
                published = datetime.fromtimestamp(post["created_utc"], tz=timezone.utc)

            content = post.get("selftext", "") or post.get("title", "")

            items.append(Item(
                id=f"reddit:{post_id}",
                title=post.get("title", ""),
                url=post.get("url", ""),
                content=content,
                source=self.config.name,
                source_type="reddit",
                published=published,
                authors=[post.get("author", "")],
                metadata={
                    "subreddit": subreddit,
                    "upvotes": post.get("ups", 0),
                    "num_comments": post.get("num_comments", 0),
                    "permalink": f"https://reddit.com{post.get('permalink', '')}",
                },
            ))

        log.info("Reddit '%s': fetched %d items", self.config.name, len(items))
        return items
