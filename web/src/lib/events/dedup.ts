import type { EventSourceId, RawEventItem, ScoredEventItem } from "./types";

// The same conference shows up in ccfddl, confs.tech, and web discovery —
// dedup on normalized name (+ year when present). Curated academic sources
// beat web hits because they carry deadlines and ranks.
const SOURCE_PRIORITY: Record<EventSourceId, number> = {
  ccfddl: 4,
  researchseminars: 3,
  confstech: 2,
  eventweb: 1,
};

// A34-01 (round 34 A) / round 35 B §2.1: the key missed a cross-source
// duplicate whose two titles differ by an ordinal ("26th") and a short
// all-caps acronym parenthetical ("(AABC)") — neither of which is
// LOAD-BEARING FOR ANYTHING ELSE this key reads. Stripped from the NAME TEXT
// ONLY, before the existing six-token slice/sort/join pipeline; the YEAR half
// is untouched, still comes from item.startDate alone, and cannot be affected
// by this change — a genuine multi-edition series (e.g. 2026 vs 2027) still
// discriminates on year.
//
// Deliberately narrow, not "strip every parenthetical." The all-caps,
// 2-8-character shape catches the common "Full Name (ACRONYM)" pattern while
// leaving a mixed-case parenthetical alone — e.g. "... Symposium (MoSES)"
// does NOT match `[A-Z0-9]{2,8}` because of the lowercase o/E/S mix, so it is
// deliberately left untouched.
const ORDINAL_RE = /\b\d+(?:st|nd|rd|th)\b/gi;
const SHORT_ACRONYM_PAREN_RE = /\s*\([A-Z0-9]{2,8}\)/g;

export function eventDedupKey(item: RawEventItem): string {
  const year = item.startDate ? new Date(item.startDate).getUTCFullYear() : "";
  const normalizedName = item.name
    .replace(ORDINAL_RE, " ")
    .replace(SHORT_ACRONYM_PAREN_RE, " ");
  const name = normalizedName
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

// A34-01 part 2 (round 35 B §2.2/§2.3): a SECOND dedup pass over the SCORED
// pool, positioned AFTER `scoreEvents`' own expiry + required-topic gate
// (scoring.ts:206-222) rather than before it. Every candidate this function
// ever sees has ALREADY individually survived that gate, so an expired
// sibling is structurally incapable of reaching the merge below — there is no
// tie-break branch that could ever pick it, because it was never a candidate
// here in the first place. This closes the "does a merge resurrect an
// expired row" risk BY CONSTRUCTION rather than by a second, independently
// -drifting implementation of "is this expired" (day-level vs.
// month-granularity end, the bare-year escape, etc. are non-obvious rules
// already encoded once, in scoring.ts/eventweb.ts — hand-rolling them again
// here risks drifting from that single definition).
//
// Tie-break: SOURCE_PRIORITY first (mirrors dedupEvents above), then the
// higher `.score` on a priority tie — mirrors the jobs side's own shipped
// `beatsIncumbent` precedent (jobs/dedup.ts:108-122, round 22, Ruling
// A22-05): between two same-priority rows, arrival order alone is not a safe
// tie-break, so the richer/better-matching row (by the scorer's own signal)
// wins instead.
export function dedupScoredEvents(items: ScoredEventItem[]): ScoredEventItem[] {
  const byKey = new Map<string, ScoredEventItem>();
  const passthrough: ScoredEventItem[] = [];
  for (const item of items) {
    const key = eventDedupKey(item);
    if (!key || key === "::") {
      passthrough.push(item);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    const pNew = SOURCE_PRIORITY[item.source] ?? 0;
    const pOld = SOURCE_PRIORITY[existing.source] ?? 0;
    if (pNew > pOld) {
      byKey.set(key, item);
      continue;
    }
    if (pNew === pOld && item.score > existing.score) byKey.set(key, item);
  }
  return [...byKey.values(), ...passthrough];
}
