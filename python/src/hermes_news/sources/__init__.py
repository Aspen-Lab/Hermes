"""Source adapter base class and auto-discovery registry."""

from __future__ import annotations

import importlib
import logging
import pkgutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, ClassVar

import httpx

from hermes_news.models import Item

log = logging.getLogger(__name__)


class SourceAdapter(ABC):
    """Base class for all source adapters.

    To add a new source: create a .py file in this directory, define a class
    that inherits from SourceAdapter, and set `source_type` to a unique string
    matching the YAML config `type:` field.
    """

    source_type: ClassVar[str]

    def __init__(self, config: Any, client: httpx.AsyncClient) -> None:
        self.config = config
        self.client = client

    @abstractmethod
    async def fetch(self) -> list[Item]:
        """Fetch items from the source. Returns normalized Item list."""
        ...


_registry: dict[str, type[SourceAdapter]] = {}


def get_source_registry() -> dict[str, type[SourceAdapter]]:
    """Return mapping of source_type -> adapter class."""
    if not _registry:
        _discover_sources()
    return dict(_registry)


def _discover_sources() -> None:
    """Import all modules in this package, then register subclasses."""
    package_dir = Path(__file__).parent
    for info in pkgutil.iter_modules([str(package_dir)]):
        try:
            importlib.import_module(f"{__name__}.{info.name}")
        except Exception:
            log.warning("Failed to import source adapter: %s", info.name, exc_info=True)

    for cls in SourceAdapter.__subclasses__():
        if hasattr(cls, "source_type"):
            _registry[cls.source_type] = cls
