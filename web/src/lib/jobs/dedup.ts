import type { JobSourceId, RawJobItem } from "./types";

// Aggregators overlap heavily (the same posting appears on Adzuna, JSearch and
// the employer's board), so dedup keys on normalized title + company. Higher
// priority wins: sources with richer, more canonical postings beat web scrapes.
const SOURCE_PRIORITY: Record<JobSourceId, number> = {
  usajobs: 6,
  adzuna: 5,
  jsearch: 5,
  remotive: 4,
  himalayas: 4,
  arbeitnow: 3,
  jobweb: 1,
};

function normalizeToken(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function jobDedupKey(item: RawJobItem): string {
  const title = normalizeToken(item.title).slice(0, 6).sort().join(" ");
  const company = normalizeToken(item.company).slice(0, 3).sort().join(" ");
  return `${title}::${company}`;
}

export function dedupJobs(items: RawJobItem[]): RawJobItem[] {
  const byKey = new Map<string, RawJobItem>();
  for (const item of items) {
    const key = jobDedupKey(item);
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
