"""YAML config loading and validation."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


class ConfigError(Exception):
    pass


@dataclass
class ProfileConfig:
    name: str = ""
    keywords: list[str] = field(default_factory=list)


@dataclass
class TopicConfig:
    name: str = ""
    keywords: list[str] = field(default_factory=list)
    patterns: list[str] = field(default_factory=list)
    match: str = "any"  # "any" or "all"


@dataclass
class SourceConfig:
    name: str = ""
    type: str = ""
    priority: int = 5
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class EngineConfig:
    weights: dict[str, float] = field(
        default_factory=lambda: {"tfidf": 0.5, "keyword": 0.3, "source": 0.2}
    )
    min_score: float = 0.15
    max_items: int = 50
    dedup_window_days: int = 30


@dataclass
class OutputConfig:
    format: str = "markdown"
    path: str = "~/hermes-output"
    daily_note: bool = True
    frontmatter: bool = True
    wikilinks: bool = True


@dataclass
class HermesConfig:
    profile: ProfileConfig = field(default_factory=ProfileConfig)
    topics: list[TopicConfig] = field(default_factory=list)
    sources: list[SourceConfig] = field(default_factory=list)
    engine: EngineConfig = field(default_factory=EngineConfig)
    output: OutputConfig = field(default_factory=OutputConfig)
    storage_path: str = "~/.hermes/hermes.db"
    log_level: str = "info"


def load_config(path: Path) -> HermesConfig:
    """Load and validate a YAML config file into HermesConfig."""
    raw = yaml.safe_load(path.read_text())
    if not isinstance(raw, dict):
        raise ConfigError(f"Config must be a YAML mapping, got {type(raw).__name__}")
    return _parse_config(raw)


def _parse_config(raw: dict[str, Any]) -> HermesConfig:
    profile = _parse_profile(raw.get("profile", {}))
    topics = [_parse_topic(t) for t in raw.get("topics", [])]
    sources = [_parse_source(s) for s in raw.get("sources", [])]
    engine = _parse_engine(raw.get("engine", {}))
    output = _parse_output(raw.get("output", {}))

    storage_raw = raw.get("storage", {})
    storage_path = storage_raw.get("path", "~/.hermes/hermes.db") if isinstance(storage_raw, dict) else "~/.hermes/hermes.db"
    log_level = raw.get("logging", {}).get("level", "info") if isinstance(raw.get("logging"), dict) else "info"

    config = HermesConfig(
        profile=profile,
        topics=topics,
        sources=sources,
        engine=engine,
        output=output,
        storage_path=storage_path,
        log_level=log_level,
    )
    _validate(config)
    return config


def _parse_profile(raw: Any) -> ProfileConfig:
    if not isinstance(raw, dict):
        return ProfileConfig()
    return ProfileConfig(
        name=raw.get("name", ""),
        keywords=raw.get("keywords", []),
    )


def _parse_topic(raw: Any) -> TopicConfig:
    if not isinstance(raw, dict):
        raise ConfigError(f"Topic must be a mapping, got {type(raw).__name__}")
    return TopicConfig(
        name=raw.get("name", ""),
        keywords=raw.get("keywords", []),
        patterns=raw.get("patterns", []),
        match=raw.get("match", "any"),
    )


def _parse_source(raw: Any) -> SourceConfig:
    if not isinstance(raw, dict):
        raise ConfigError(f"Source must be a mapping, got {type(raw).__name__}")

    known_keys = {"name", "type", "priority"}
    extra = {k: v for k, v in raw.items() if k not in known_keys}

    return SourceConfig(
        name=raw.get("name", ""),
        type=raw.get("type", ""),
        priority=raw.get("priority", 5),
        extra=extra,
    )


def _parse_engine(raw: Any) -> EngineConfig:
    if not isinstance(raw, dict):
        return EngineConfig()
    return EngineConfig(
        weights=raw.get("weights", {"tfidf": 0.5, "keyword": 0.3, "source": 0.2}),
        min_score=raw.get("min_score", 0.15),
        max_items=raw.get("max_items", 50),
        dedup_window_days=raw.get("dedup_window_days", 30),
    )


def _parse_output(raw: Any) -> OutputConfig:
    if not isinstance(raw, dict):
        return OutputConfig()
    return OutputConfig(
        format=raw.get("format", "markdown"),
        path=raw.get("path", "~/hermes-output"),
        daily_note=raw.get("daily_note", True),
        frontmatter=raw.get("frontmatter", True),
        wikilinks=raw.get("wikilinks", True),
    )


def _validate(config: HermesConfig) -> None:
    if not config.sources:
        raise ConfigError("At least one source must be configured")
    for s in config.sources:
        if not s.name:
            raise ConfigError("Every source must have a 'name'")
        if not s.type:
            raise ConfigError(f"Source '{s.name}' must have a 'type'")
    for t in config.topics:
        if not t.name:
            raise ConfigError("Every topic must have a 'name'")
        if not t.keywords and not t.patterns:
            raise ConfigError(f"Topic '{t.name}' must have at least one keyword or pattern")
