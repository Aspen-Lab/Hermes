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

// A22-05(a) (round 22 C): **B's RECOMMENDED "sort, THEN slice" WAS BUILT,
// MEASURED, AND REJECTED. IT IS A REGRESSION, NOT A REPAIR.**
//
// B recommended swapping these two operations as a correctness fix to a
// function whose shape claims an order-independence it does not have, noting
// that it would not close A22-05 on its own. C built it and ran it against the
// three live rows B recorded, and it BREAKS the one merge that works today:
//
//   title                                                  slice-then-sort (shipped)                          sort-then-slice (B's (a))
//   "…Postdoc Research Associate"   (linkedin)             actinide chemistry exchange ion postdoc research   actinide associate chemistry exchange ion postdoc
//   "…Postdoc Research ..."         (salutemyjob)          actinide chemistry exchange ion postdoc research   actinide chemistry exchange ion postdoc research
//
// The keys MATCH under the shipped order and DIVERGE under B's, because
// `associate` sorts early and displaces `research` out of the six-token window
// on the longer title only. B measured that (a) does not close the row; B did
// not measure that it re-opens a merge that already works. **An un-merge is an
// EXTRA card — the very defect class A22-05 is filed under — so the shipped
// order stays.**
//
// The order-independence B wanted is delivered by the URL rule below instead,
// on strictly better evidence than a truncated rendered heading.
export function jobDedupKey(item: RawJobItem): string {
  const title = normalizeToken(item.title).slice(0, 6).sort().join(" ");
  const company = normalizeToken(item.company ?? "").slice(0, 3).sort().join(" ");
  return `${title}::${company}`;
}

// A22-05(b) (round 22 C): THE KEY NEVER LOOKED AT THE URL, WHICH IS THE
// STRONGEST IDENTITY SIGNAL AVAILABLE.
//
// The same Savannah River vacancy occupied TWO of twelve job slots. All three
// copies carried the same posting slug — the aggregator's own transcription of
// the employer's title — and the key discarded it before doing anything else.
//
// COLLISION RULE: one slug's token sequence is a PREFIX of the other's, in
// full. That is deliberately much stricter than "share the first N tokens".
// Aggregators TRUNCATE an employer's title, they do not rewrite it, so a
// truncation is a prefix — `actinide chemistry ion exchange postdoc` (vaia) is
// a prefix of `actinide chemistry ion exchange postdoc research associate …`
// (salutemyjob, linkedin). Two genuinely different postings DIVERGE rather than
// stop: `research scientist battery materials cathode` and `… anode` share four
// tokens and neither is a prefix of the other, so they do not collide.
//
// This is why B's third option — token-overlap similarity over full title sets
// — is REJECTED and recorded as rejected: a threshold-based collapse destroys a
// real posting when it false-fires, and a drop's false fire costs a whole item.
// Do not ship one without the matrix.
//
// The four-token floor keeps opaque slugs (`/jobs/12345`, `/apply/req-8891`)
// out of the rule entirely: too little to identify anything is not evidence
// that two postings are the same.
const MIN_SLUG_TOKENS = 4;

/** The posting-name tokens an aggregator put in the URL, if it put any there. */
export function jobSlugTokens(url: string | undefined): string[] {
  if (!url) return [];
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return [];
  }
  const slug = pathname
    .split("/")
    .filter((segment) => segment.includes("-"))
    .sort((a, b) => b.length - a.length)[0];
  if (!slug) return [];
  const tokens = normalizeToken(slug.replace(/-/g, " ")).filter(
    (token) => !/^\d+$/.test(token),
  );
  return tokens.length >= MIN_SLUG_TOKENS ? tokens : [];
}

function isTokenPrefix(shorter: string[], longer: string[]): boolean {
  if (shorter.length > longer.length) return false;
  return shorter.every((token, index) => token === longer[index]);
}

/** Whether two postings' URL slugs identify the same vacancy. */
export function slugsIdentifySamePosting(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return isTokenPrefix(a, b) || isTokenPrefix(b, a);
}

// A22-05 (round 22 C): THE TIE-BREAK IS NOT OPTIONAL, and B named the failure
// mode this item was most likely to ship with. `dedupJobs` kept the FIRST item
// at a key and only replaced it on strictly higher source priority — so between
// two `jobweb` rows the survivor was decided by ARRIVAL ORDER. On the live rows
// that gave the `linkedin` copy, which renders no employer at all, while the
// `vaia` copy it failed to merge with renders `Savannah River National
// Laboratory` correctly. Merging them without this rule would have traded two
// cards for one WORSE card and taken away an employer line the reader can see
// today.
function beatsIncumbent(candidate: RawJobItem, incumbent: RawJobItem): boolean {
  const candidatePriority = SOURCE_PRIORITY[candidate.source] ?? 0;
  const incumbentPriority = SOURCE_PRIORITY[incumbent.source] ?? 0;
  if (candidatePriority !== incumbentPriority) return candidatePriority > incumbentPriority;
  return Boolean(candidate.company?.trim()) && !incumbent.company?.trim();
}

/**
 * A22-05 (round 22 C): grouping is a UNION over both identity signals rather
 * than a lookup in one map, because there are now TWO signals and a posting can
 * be related to one copy by its title and to another by its URL.
 *
 * On the live triple the title key already relates linkedin and salutemyjob,
 * and the slug relates vaia to both — so any of several structures would
 * collapse them. The union is what keeps that true in the general shape, where
 * A shares a slug with C, B shares a title key with C, and A and B share
 * NEITHER. `dedup.test.ts`'s three-way case is that shape, built explicitly,
 * because the live rows do not exercise it.
 *
 * It also makes the outcome independent of arrival order, which the tie-break's
 * own test asserts directly in both directions.
 */
export function dedupJobs(items: RawJobItem[]): RawJobItem[] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const slugs = items.map((item) => jobSlugTokens(item.url));
  const firstAtTitleKey = new Map<string, number>();
  items.forEach((item, index) => {
    const titleKey = jobDedupKey(item);
    // An item with neither a usable title nor a company keeps its own group,
    // exactly as before — an empty key is "unknown", not a shared value.
    if (titleKey && titleKey !== "::") {
      const seen = firstAtTitleKey.get(titleKey);
      if (seen === undefined) firstAtTitleKey.set(titleKey, index);
      else union(seen, index);
    }
    for (let other = 0; other < index; other++) {
      if (slugsIdentifySamePosting(slugs[index], slugs[other])) union(other, index);
    }
  });

  const winners = new Map<number, RawJobItem>();
  items.forEach((item, index) => {
    const root = find(index);
    const incumbent = winners.get(root);
    if (!incumbent || beatsIncumbent(item, incumbent)) winners.set(root, item);
  });
  // Input order is preserved, so pool composition does not shuffle underneath
  // anything downstream that reads position.
  return items.filter((item, index) => winners.get(find(index)) === item);
}
