"""Obsidian vault output writer — daily note + individual item notes."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from hermes_news.config import HermesConfig, OutputConfig
from hermes_news.models import ScoredItem
from hermes_news.output import OutputWriter

log = logging.getLogger(__name__)


class ObsidianWriter(OutputWriter):
    def __init__(self, config: OutputConfig) -> None:
        super().__init__(config)

    def write(self, items: list[ScoredItem], hermes_config: HermesConfig) -> Path:
        vault = Path(self.config.path).expanduser()
        hermes_dir = vault / "Hermes"
        hermes_dir.mkdir(parents=True, exist_ok=True)

        date_str = datetime.now().strftime("%Y-%m-%d")

        # Write individual item notes
        items_dir = hermes_dir / "Items"
        items_dir.mkdir(exist_ok=True)
        for si in items:
            self._write_item_note(items_dir, si)

        # Write daily note
        daily_path = hermes_dir / f"{date_str}.md"
        self._write_daily_note(daily_path, items, date_str)

        log.info("Wrote %d items to Obsidian vault %s", len(items), hermes_dir)
        return daily_path

    def _write_daily_note(self, path: Path, items: list[ScoredItem], date_str: str) -> None:
        lines: list[str] = []

        if self.config.frontmatter:
            all_tags = sorted({t for si in items for t in si.tags})
            lines.extend([
                "---",
                f"date: {date_str}",
                f"tags: [hermes/daily, {', '.join(all_tags)}]",
                "type: hermes-briefing",
                "---",
                "",
            ])

        lines.append(f"# Hermes Briefing — {date_str}\n")

        # Group by tag
        by_tag: dict[str, list[ScoredItem]] = defaultdict(list)
        for si in items:
            if si.tags:
                for tag in si.tags:
                    by_tag[tag].append(si)
            else:
                by_tag["Untagged"].append(si)

        for tag, tag_items in sorted(by_tag.items()):
            lines.append(f"\n## {tag}\n")
            seen: set[str] = set()
            for si in sorted(tag_items, key=lambda x: x.score, reverse=True):
                if si.item.id in seen:
                    continue
                seen.add(si.item.id)
                safe = _safe_filename(si.item.title)
                if self.config.wikilinks:
                    lines.append(
                        f"- [[Hermes/Items/{safe}|{si.item.title}]] "
                        f"*(score: {si.score:.2f}, {si.item.source})*"
                    )
                else:
                    lines.append(
                        f"- [{si.item.title}]({si.item.url}) "
                        f"*(score: {si.score:.2f})*"
                    )

        path.write_text("\n".join(lines))

    def _write_item_note(self, directory: Path, si: ScoredItem) -> None:
        safe = _safe_filename(si.item.title)
        filepath = directory / f"{safe}.md"

        lines: list[str] = []

        if self.config.frontmatter:
            lines.extend([
                "---",
                f"title: \"{si.item.title}\"",
                f"url: {si.item.url}",
                f"source: {si.item.source}",
                f"source_type: {si.item.source_type}",
                f"score: {si.score:.3f}",
                f"tags: [{', '.join(f'hermes/{t}' for t in si.tags)}]",
            ])
            if si.item.authors:
                lines.append(f"authors: [{', '.join(si.item.authors)}]")
            if si.item.published:
                lines.append(f"date: {si.item.published.strftime('%Y-%m-%d')}")
            lines.extend(["---", ""])

        lines.append(f"# {si.item.title}\n")

        if si.item.authors:
            lines.append(f"**Authors:** {', '.join(si.item.authors)}\n")

        lines.append(f"{si.item.content}\n")

        if self.config.wikilinks and si.tags:
            tag_links = " ".join(f"[[{t}]]" for t in si.tags)
            lines.append(f"\n**Topics:** {tag_links}\n")

        lines.append(f"\n[Source]({si.item.url})")

        filepath.write_text("\n".join(lines))


def _safe_filename(title: str) -> str:
    """Convert title to a safe filename for Obsidian notes."""
    safe = re.sub(r'[<>:"/\\|?*]', "", title)
    safe = safe.strip()
    if len(safe) > 120:
        safe = safe[:120].rsplit(" ", 1)[0]
    return safe or "untitled"
