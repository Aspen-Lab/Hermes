"""Core data models for the Hermes pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class Item:
    """Normalized item from any source adapter."""

    id: str  # "{source_type}:{native_id}"
    title: str
    url: str
    content: str  # body text, abstract, or summary
    source: str  # config source name, e.g. "arxiv-ml", "hn-frontpage"
    source_type: str  # adapter type: "rss", "hackernews", etc.
    published: datetime | None = None
    authors: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TaggedItem:
    """Item with tags assigned by the tagging engine."""

    item: Item
    tags: list[str] = field(default_factory=list)
    matched_rules: list[str] = field(default_factory=list)


@dataclass
class ScoredItem:
    """Tagged item with relevance scores."""

    item: Item
    tags: list[str]
    score: float  # composite 0.0–1.0
    score_breakdown: dict[str, float] = field(default_factory=dict)
