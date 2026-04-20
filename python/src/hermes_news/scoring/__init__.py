"""Scoring system — pluggable scorers with composite aggregation."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import ClassVar

from hermes_news.config import HermesConfig
from hermes_news.models import ScoredItem, TaggedItem

log = logging.getLogger(__name__)


class Scorer(ABC):
    """Base class for scoring strategies."""

    name: ClassVar[str]

    @abstractmethod
    def score_batch(self, items: list[TaggedItem], config: HermesConfig) -> list[float]:
        """Score a batch of items. Returns list of floats in [0.0, 1.0]."""
        ...


class CompositeScorer:
    """Combines multiple scorers with configurable weights."""

    def __init__(self, config: HermesConfig) -> None:
        self.config = config
        self.scorers: list[tuple[Scorer, float]] = []

        weights = config.engine.weights
        from hermes_news.scoring.keyword import KeywordScorer
        from hermes_news.scoring.tfidf import TFIDFScorer
        from hermes_news.scoring.source_priority import SourcePriorityScorer

        if "keyword" in weights:
            self.scorers.append((KeywordScorer(), weights["keyword"]))
        if "tfidf" in weights:
            self.scorers.append((TFIDFScorer(), weights["tfidf"]))
        if "source" in weights:
            self.scorers.append((SourcePriorityScorer(), weights["source"]))

    def score_batch(self, items: list[TaggedItem]) -> list[ScoredItem]:
        if not items:
            return []

        all_scores: list[dict[str, float]] = [{} for _ in items]

        for scorer, weight in self.scorers:
            try:
                raw = scorer.score_batch(items, self.config)
            except Exception:
                log.warning("Scorer '%s' failed", scorer.name, exc_info=True)
                raw = [0.0] * len(items)

            for i, s in enumerate(raw):
                all_scores[i][scorer.name] = s

        result: list[ScoredItem] = []
        for i, tagged in enumerate(items):
            breakdown = all_scores[i]
            composite = sum(
                breakdown.get(s.name, 0.0) * w for s, w in self.scorers
            )
            result.append(ScoredItem(
                item=tagged.item,
                tags=tagged.tags,
                score=min(composite, 1.0),
                score_breakdown=breakdown,
            ))

        return sorted(result, key=lambda x: x.score, reverse=True)
