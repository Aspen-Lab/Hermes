"""Output writers — render scored items to various formats."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from hermes_news.config import HermesConfig, OutputConfig
from hermes_news.models import ScoredItem


class OutputWriter(ABC):
    def __init__(self, config: OutputConfig) -> None:
        self.config = config

    @abstractmethod
    def write(self, items: list[ScoredItem], hermes_config: HermesConfig) -> Path:
        """Write items to output. Returns path of primary output file."""
        ...


def get_writer(output_config: OutputConfig) -> OutputWriter:
    if output_config.format == "obsidian":
        from hermes_news.output.obsidian import ObsidianWriter
        return ObsidianWriter(output_config)
    from hermes_news.output.markdown import MarkdownWriter
    return MarkdownWriter(output_config)
