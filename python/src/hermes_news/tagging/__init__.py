"""Tagging engine — assigns topic tags to items based on keyword/regex rules."""

from __future__ import annotations

import logging

from hermes_news.config import TopicConfig
from hermes_news.models import Item, TaggedItem
from hermes_news.tagging.rules import MatchRule

log = logging.getLogger(__name__)


class Tagger:
    def __init__(self, topics: list[TopicConfig]) -> None:
        self.topics = topics

    def tag(self, item: Item) -> TaggedItem:
        """Apply all topic rules against item title + content."""
        text = f"{item.title} {item.content}"
        tags: list[str] = []
        matched_rules: list[str] = []

        for topic in self.topics:
            rules = self._build_rules(topic)
            hits = [r for r in rules if r.matches(text)]

            if topic.match == "all":
                matched = len(hits) == len(rules) and len(rules) > 0
            else:  # "any"
                matched = len(hits) > 0

            if matched:
                tags.append(topic.name)
                matched_rules.extend(f"{topic.name}:{r.pattern}" for r in hits)

        return TaggedItem(item=item, tags=tags, matched_rules=matched_rules)

    def tag_batch(self, items: list[Item]) -> list[TaggedItem]:
        return [self.tag(item) for item in items]

    @staticmethod
    def _build_rules(topic: TopicConfig) -> list[MatchRule]:
        rules: list[MatchRule] = []
        for kw in topic.keywords:
            rules.append(MatchRule(pattern=kw, mode="substring"))
        for pat in topic.patterns:
            rules.append(MatchRule(pattern=pat, mode="regex"))
        return rules
