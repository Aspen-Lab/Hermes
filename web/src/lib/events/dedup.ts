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

// Round 36 B §3.1 (A35-01, Ruling 99b's "genuinely different wording"
// duplicate class): a THIRD, additive dedup pass. `www.djk.co.jp` and
// `quintustechnologies.com` describe the SAME real event (Solid-State
// Battery Summit 2026) but `eventDedupKey` above never matches them: djk's
// title tokenizes to 19 significant tokens against quintus's clean 4, so
// quintus's name is a token-SET SUBSET of djk's, not a scrambled equal set.
// PROVEN BY CONSTRUCTION, NOT ASSUMED: stripping the two most plausibly
// generic words from djk's title ("exhibition", the preposition "in") still
// leaves "chicago"/"showcasing" occupying the six-token slice, and the
// reduced key still does not equal quintus's — no stopword list or
// token-reprioritization scheme can ever equalize two token sets of
// different SIZE where one is not a rearrangement of the other. Only a
// CONTAINMENT check (is one title's text a literal substring of the
// other's) can ever close a pair shaped like this — generic-noun-stripping
// and token-prioritization (the two cheaper alternatives) cannot, even in
// principle.
//
// `eventDedupKey`, `dedupEvents`, and `dedupScoredEvents` above are
// UNTOUCHED by this item — zero risk to any locked key-equality test. This
// pass runs once more, additively, after `dedupScoredEvents` at the same
// structurally-safe pipeline site (pipeline.ts, immediately after the
// existing `dedupScoredEvents` call) — every candidate it ever sees has
// ALREADY individually survived `scoreEvents`' own expiry + required-topic
// gate, for the same reason `dedupScoredEvents`' own candidates have (see
// that function's comment above): an expired sibling is structurally
// incapable of reaching this merge.

// Same rule `eventDedupKey` uses for its year half, extracted here as its
// own tiny helper so this item's year gate stays byte-identical to that
// rule without touching `eventDedupKey` itself.
function eventYearOf(item: ScoredEventItem): number | string {
  return item.startDate ? new Date(item.startDate).getUTCFullYear() : "";
}

// Reuses `eventDedupKey`'s own `ORDINAL_RE`/`SHORT_ACRONYM_PAREN_RE`/
// year-strip/non-alnum-strip pipeline, but WITHOUT the six-token cap and
// WITHOUT the alphabetical sort — word ORDER must survive here, because a
// substring check on a bag-of-words would be meaningless.
function normalizedEventText(name: string): string {
  return name
    .replace(ORDINAL_RE, " ")
    .replace(SHORT_ACRONYM_PAREN_RE, " ")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .join(" ")
    .trim();
}

// Four is not an arbitrary round number: it is the EXACT token width of
// quintus's own clean name ("solid state battery summit"). Raising the
// floor to five would make this pass unable to catch its own target case,
// so four is both the minimum viable floor AND the ceiling this evidence
// supports — tightening it further breaks the one confirmed must-merge
// pair.
const MIN_CONTAINED_TOKENS = 4;

// Bounded three independent ways, each required, none optional:
// 1. CONTIGUOUS, WORD-ORDER-PRESERVING SUBSTRING — not bag-of-words. The
//    shorter title's normalized text must appear as a literal,
//    word-boundary-safe substring of the longer title's normalized text
//    (padded with spaces on both sides before `.includes()`, so a token can
//    never partial-match inside a longer token). This is the single
//    biggest safety property: a coincidental SCATTERED token overlap (two
//    titles sharing several words in different positions/order) produces
//    no match, only a genuine shared PHRASE does.
// 2. MINIMUM FOUR DISTINCT TOKENS on the CONTAINED (shorter) side — see
//    `MIN_CONTAINED_TOKENS` above. Blocks generic 2-3-word phrases
//    ("Battery Conference") regardless of what they are found inside.
// 3. SAME YEAR BUCKET. Exact string/number equality on the year half —
//    byte-identical rule to `eventDedupKey`'s own, never loosened, never a
//    range/fuzzy match.
function isContainedDuplicate(a: ScoredEventItem, b: ScoredEventItem): boolean {
  if (eventYearOf(a) !== eventYearOf(b)) return false;
  const textA = normalizedEventText(a.name);
  const textB = normalizedEventText(b.name);
  if (!textA || !textB) return false;
  const paddedA = ` ${textA} `, paddedB = ` ${textB} `;
  const tokensA = new Set(textA.split(" ")).size;
  const tokensB = new Set(textB.split(" ")).size;
  if (paddedA.includes(paddedB) && tokensB >= MIN_CONTAINED_TOKENS && textA !== textB) return true;
  if (paddedB.includes(paddedA) && tokensA >= MIN_CONTAINED_TOKENS && textA !== textB) return true;
  return false;
}

// A HARNESS BUG FOUND BY EXECUTION, FIXED BEFORE ANY RESULT WAS BANKED
// (round 36 B §3.3): the FIRST version of this loop tracked a dropped-id
// `Set` and marked only the LOSER of each pairwise tie-break. When the
// running `winner` switched to a LATER item at index `j` (that later row
// outscored/outranked the current winner), that later row's OWN id was
// never marked dropped, so the outer loop's later natural pass over
// `i = j` pushed it a SECOND time as an undeduped copy — traced by a
// dedicated debug probe. Fixed by tracking FINALIZED INDICES instead:
// index `j` is marked finalized the moment it is compared, win or lose,
// while the winning VALUE still lands in `i`'s push slot (preserving
// first-seen-slot ordering, mirroring `dedupScoredEvents`'s own documented
// `Map` behaviour). DO NOT REINTRODUCE THE DROPPED-ID VERSION — it
// double-counts a winner that wins by switching to a later index
// mid-chain.
export function mergeContainedEventNames(
  items: ScoredEventItem[],
): ScoredEventItem[] {
  const result: ScoredEventItem[] = [];
  const finalized = new Array(items.length).fill(false);
  for (let i = 0; i < items.length; i++) {
    if (finalized[i]) continue;
    let winner = items[i];
    for (let j = i + 1; j < items.length; j++) {
      if (finalized[j]) continue;
      const other = items[j];
      if (!isContainedDuplicate(winner, other)) continue;
      finalized[j] = true;
      const pWinner = SOURCE_PRIORITY[winner.source] ?? 0;
      const pOther = SOURCE_PRIORITY[other.source] ?? 0;
      if (pOther > pWinner || (pOther === pWinner && other.score > winner.score)) winner = other;
    }
    result.push(winner);
  }
  return result;
}
