import type { RawItem, SourceId } from "@/lib/sources/types";

const SOURCE_PRIORITY: Record<SourceId, number> = {
  semantic_scholar: 5,
  arxiv: 4,
  openalex: 3,
  pubmed: 2,
  dblp: 2,
  web: 1,
  hn: 1,
};

function dedupKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 8)
    .sort()
    .join(" ");
}

export function dedupItems(items: RawItem[]): RawItem[] {
  const byKey = new Map<string, RawItem>();
  for (const item of items) {
    const key = dedupKey(item.title);
    if (!key) {
      byKey.set(item.id, item);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    const pNew = SOURCE_PRIORITY[item.source] ?? 0;
    const pOld = SOURCE_PRIORITY[existing.source] ?? 0;
    if (pNew > pOld) byKey.set(key, item);
  }
  return Array.from(byKey.values());
}
