"""Keyword scorer — scores items based on fraction of topic tags matched."""

from __future__ import annotations

from typing import ClassVar

from peer_news.config import PeerConfig
from peer_news.models import TaggedItem
from peer_news.scoring import Scorer


class KeywordScorer(Scorer):
    name: ClassVar[str] = "keyword"

    def score_batch(self, items: list[TaggedItem], config: PeerConfig) -> list[float]:
        num_topics = len(config.topics) if config.topics else 1
        return [len(it.tags) / num_topics for it in items]
