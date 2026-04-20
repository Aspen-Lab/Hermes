"""TF-IDF scorer — cosine similarity between items and user profile."""

from __future__ import annotations

import logging
from typing import ClassVar

from hermes_news.config import HermesConfig
from hermes_news.models import TaggedItem
from hermes_news.scoring import Scorer

log = logging.getLogger(__name__)


class TFIDFScorer(Scorer):
    name: ClassVar[str] = "tfidf"

    def score_batch(self, items: list[TaggedItem], config: HermesConfig) -> list[float]:
        # Build profile document from all profile keywords + topic keywords
        profile_parts: list[str] = list(config.profile.keywords)
        for topic in config.topics:
            profile_parts.extend(topic.keywords)

        profile_text = " ".join(profile_parts)
        if not profile_text.strip() or not items:
            return [0.0] * len(items)

        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity
        except ImportError:
            log.warning("scikit-learn not installed, TF-IDF scorer disabled")
            return [0.0] * len(items)

        docs = [f"{it.item.title} {it.item.content}" for it in items]
        all_docs = [profile_text] + docs

        vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=5000,
            sublinear_tf=True,
        )

        tfidf_matrix = vectorizer.fit_transform(all_docs)
        similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        return similarities.tolist()
