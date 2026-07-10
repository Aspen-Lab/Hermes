"""Source priority scorer — scores items based on their source's priority setting."""

from __future__ import annotations

from typing import ClassVar

from peer_news.config import PeerConfig
from peer_news.models import TaggedItem
from peer_news.scoring import Scorer


class SourcePriorityScorer(Scorer):
    name: ClassVar[str] = "source"

    def score_batch(self, items: list[TaggedItem], config: PeerConfig) -> list[float]:
        source_priority: dict[str, float] = {}
        for s in config.sources:
            source_priority[s.name] = s.priority / 10.0  # normalize 1-10 to 0.0-1.0

        return [source_priority.get(it.item.source, 0.5) for it in items]
