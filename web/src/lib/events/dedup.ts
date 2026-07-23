import type { EventSourceId, RawEventItem } from "./types";

// The same conference shows up in ccfddl, confs.tech, and web discovery —
// dedup on normalized name (+ year when present). Curated academic sources
// beat web hits because they carry deadlines and ranks.
const SOURCE_PRIORITY: Record<EventSourceId, number> = {
  ccfddl: 4,
  researchseminars: 3,
  confstech: 2,
  eventweb: 1,
};

export function eventDedupKey(item: RawEventItem): string {
  const year = item.startDate ? new Date(item.startDate).getUTCFullYear() : "";
  const name = item.name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 6)
    .sort()
    .join(" ");
  return `${name}::${year}`;
}

export function dedupEvents(items: RawEventItem[]): RawEventItem[] {
  const byKey = new Map<string, RawEventItem>();
  for (const item of items) {
    const key = eventDedupKey(item);
    if (!key || key === "::") {
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
