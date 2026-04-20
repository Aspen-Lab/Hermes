"""Keyword scorer — scores items based on fraction of topic tags matched."""

from __future__ import annotations

from typing import ClassVar

from hermes_news.config import HermesConfig
from hermes_news.models import TaggedItem
from hermes_news.scoring import Scorer


class KeywordScorer(Scorer):
    name: ClassVar[str] = "keyword"

    def score_batch(self, items: list[TaggedItem], config: HermesConfig) -> list[float]:
        num_topics = len(config.topics) if config.topics else 1
        return [len(it.tags) / num_topics for it in items]
