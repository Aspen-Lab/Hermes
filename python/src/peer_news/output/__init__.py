"""Output writers — render scored items to various formats."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from peer_news.config import PeerConfig, OutputConfig
from peer_news.models import ScoredItem


class OutputWriter(ABC):
    def __init__(self, config: OutputConfig) -> None:
        self.config = config

    @abstractmethod
    def write(self, items: list[ScoredItem], peer_config: PeerConfig) -> Path:
        """Write items to output. Returns path of primary output file."""
        ...


def get_writer(output_config: OutputConfig) -> OutputWriter:
    if output_config.format == "obsidian":
        from peer_news.output.obsidian import ObsidianWriter
        return ObsidianWriter(output_config)
    from peer_news.output.markdown import MarkdownWriter
    return MarkdownWriter(output_config)
