"""Markdown output writer — flat daily note."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from hermes_news.config import HermesConfig, OutputConfig
from hermes_news.models import ScoredItem
from hermes_news.output import OutputWriter

log = logging.getLogger(__name__)


class MarkdownWriter(OutputWriter):
    def __init__(self, config: OutputConfig) -> None:
        super().__init__(config)

    def write(self, items: list[ScoredItem], hermes_config: HermesConfig) -> Path:
        out_dir = Path(self.config.path).expanduser()
        out_dir.mkdir(parents=True, exist_ok=True)

        date_str = datetime.now().strftime("%Y-%m-%d")
        filepath = out_dir / f"{date_str}.md"

        lines: list[str] = []

        if self.config.frontmatter:
            lines.extend([
                "---",
                f"date: {date_str}",
                f"items: {len(items)}",
                "type: hermes-briefing",
                "---",
                "",
            ])

        lines.append(f"# Hermes Briefing — {date_str}\n")

        # Group by tag
        by_tag: dict[str, list[ScoredItem]] = defaultdict(list)
        for item in items:
            if item.tags:
                for tag in item.tags:
                    by_tag[tag].append(item)
            else:
                by_tag["Untagged"].append(item)

        for tag, tag_items in sorted(by_tag.items()):
            lines.append(f"\n## {tag}\n")
            # Deduplicate within tag (item may appear under multiple tags)
            seen: set[str] = set()
            for si in sorted(tag_items, key=lambda x: x.score, reverse=True):
                if si.item.id in seen:
                    continue
                seen.add(si.item.id)
                lines.append(f"### [{si.item.title}]({si.item.url})")
                meta_parts = [
                    f"score: {si.score:.2f}",
                    f"source: {si.item.source}",
                ]
                if si.item.source_type == "hackernews" and si.item.metadata.get("points"):
                    meta_parts.append(f"{si.item.metadata['points']} points")
                if si.item.source_type == "reddit" and si.item.metadata.get("upvotes"):
                    meta_parts.append(f"{si.item.metadata['upvotes']} upvotes")
                lines.append(f"*{' · '.join(meta_parts)}*\n")

                if si.item.authors:
                    lines.append(f"**Authors:** {', '.join(si.item.authors)}\n")

                content = si.item.content
                if len(content) > 400:
                    content = content[:400] + "..."
                lines.append(f"{content}\n")

        filepath.write_text("\n".join(lines))
        log.info("Wrote %d items to %s", len(items), filepath)
        return filepath
