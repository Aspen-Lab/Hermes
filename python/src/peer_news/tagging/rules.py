"""Match rules for the tagging engine."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class MatchRule:
    """A single matching rule within a topic."""

    pattern: str
    mode: str  # "substring", "regex"
    _compiled: re.Pattern[str] | None = field(default=None, repr=False)

    def matches(self, text: str) -> bool:
        if self.mode == "substring":
            return self.pattern.lower() in text.lower()
        elif self.mode == "regex":
            if self._compiled is None:
                self._compiled = re.compile(self.pattern, re.IGNORECASE)
            return bool(self._compiled.search(text))
        return False
