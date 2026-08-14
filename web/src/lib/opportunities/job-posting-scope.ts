import { extractPageText } from "./page-text";
import {
  extractJsonLdOpportunities,
  type JsonLdOpportunity,
} from "./structured-extract";

export type JobPostingScope =
  | { status: "owned"; text: string; structured?: JsonLdOpportunity }
  | { status: "unproven" };

function canonicalJobUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return undefined;
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizedTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function blockEnd(html: string, tag: string, start: number): number | undefined {
  const token = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  token.lastIndex = start;
  let depth = 1;
  for (let match = token.exec(html); match; match = token.exec(html)) {
    if (match[0].startsWith("</")) {
      if (--depth === 0) return token.lastIndex;
    } else if (!/\/$/.test(match[0])) {
      depth++;
    }
  }
  return undefined;
}

// B8-07 (round 8, closing Ruling 29's own fixture question): a page that
// lays its listings out as sibling <tr> table rows, with no per-listing
// <article>/<li>/<section>/<div>/<main> wrapper around each individual row,
// left `tr` invisible to the scan above — the only candidate block found was
// the whole <table>'s own outer wrapper (if any), spanning every row's text,
// not just the selected listing's. Confirmed with a fixture before this fix
// (see job-posting-scope.test.ts's "same-page multi-listing contamination
// (B8-07)" block): the acceptance filter below is unchanged and already
// correct — it was never given the smaller, single-row candidate to prefer.
// `tr` is added to the recognised tag set for exactly the same reason
// page-text.ts's own extractPageHeadings already treats <li>/<td> rows as
// entries: "Widening WHERE a candidate may be found is safe. The verbatim
// check... stays as strict as it was." No change to the acceptance logic
// itself — a `tr` candidate must still pass every check below, the same as
// any other tag.
function selectedDomScopes(html: string, selectedUrl: string, title: string): string[] {
  const candidates: Array<{ html: string; length: number }> = [];
  const opening = /<(article|li|section|div|main|tr)\b[^>]*>/gi;
  for (let match = opening.exec(html); match; match = opening.exec(html)) {
    const tag = match[1].toLowerCase();
    const end = blockEnd(html, tag, opening.lastIndex);
    if (!end) continue;
    const block = html.slice(match.index, end);
    const hrefs = Array.from(block.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi), m => m[1] ?? m[2] ?? "")
      .map(href => { try { return canonicalJobUrl(new URL(href, selectedUrl).toString()); } catch { return undefined; } });
    const exactLinks = hrefs.filter((href): href is string => href === selectedUrl).length;
    const headings = Array.from(block.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi), m =>
      m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    const titleMatches = headings.filter(heading => normalizedTitle(heading) === normalizedTitle(title)).length;
    const distinctHeadings = new Set(
      headings.map(normalizedTitle).filter(Boolean),
    ).size;
    // A bounded posting block can legitimately link to an application form or
    // schedule as well as its own canonical URL. Only an additional job
    // witness—not an arbitrary related link—would disprove this owner; exact
    // selected-link/heading witnesses below establish the boundary.
    if ((exactLinks === 1 || titleMatches === 1) && exactLinks <= 1 && titleMatches <= 1 && distinctHeadings <= 1) {
      candidates.push({ html: block, length: block.length });
    }
  }
  const smallest = candidates.sort((a, b) => a.length - b.length)[0];
  return smallest ? [smallest.html] : [];
}

// A22-03(b) / Ruling 60d (round 22 C): THE MINIMUM-SUBSTANCE FLOOR.
//
// `resolveJobPostingScope` proves a BOUNDARY, not a BODY. The acceptance
// filter above admits a block on one exact self-link OR one matching heading
// with no second witness — so a block whose entire content IS that witness
// passes it. Measured by B across a live pull: the five `owned` job rows in
// the pool carried 8, 9, 48, 74 and 83 characters of "owned" text (the 83
// being a blog post's headline, Ruling 59b(b)), and the same resolver run on
// event pages returned `owned` for `"Home"` (4 chars), `"Sitemap"` (7) and a
// reCAPTCHA notice (147).
//
// That was harmless while nothing published the text. It stops being harmless
// the moment `owned` AUTHORISES publication, which is exactly what the
// fail-closed gate in `jobs/mapper.ts` now makes it do.
//
// THE FLOOR IS A BODY TEST, NOT A LENGTH GUESS. A posting body says more than
// one thing. A heading, a nav label, a headline and a self-link are each a
// SINGLE fragment however long they run — which is why a bare character count
// cannot separate the 83-character headline from real prose, and why picking
// a number above 83 would be taste. So the floor is TWO sentences that each
// clear the length this codebase already publishes at: `MIN_SENTENCE_LENGTH`
// in `jobs/summarize.ts`, 40 characters, the number `summarizeJob` has used to
// mean "long enough to show a human" since B5-07. Restated here rather than
// imported so the summary layer keeps its own private constant.
//
// FAILURE DIRECTION: too high silences a terse real posting's summary, which
// renders the `Matches your …` line A21-04 already ships — a MISSING value.
// Too low lets a nav fragment be summarised — a WRONG value. This loop's
// standing rule is that a wrong value is worse than a missing one, so the
// floor errs high. It is also free today: B measured ZERO summaries rendered
// from `owned` rows in the live pool, so it removes nothing that exists and
// only constrains what may be published from here.
//
// IT DOES NOT CHANGE THE RESOLVER'S `owned`/`unproven` VERDICT — deliberately,
// and this is C's one documented deviation from B's literal placement at the
// acceptance filter. That verdict also drives place, employer, roleKind, visa,
// workMode and salary; B's matrix priced none of those against a floor, and
// B's own expected effect for this commit is "0 correct values leave". Moving
// the verdict would silence values nobody measured. The floor therefore sits
// at each PUBLICATION boundary instead — the card summary and the deep
// report's LLM evidence — which is the full set of places `owned` text is
// shown to a human, so the deep report inherits it exactly as B required.
const MIN_BODY_SENTENCE_LENGTH = 40;
const MIN_BODY_SENTENCES = 2;

/**
 * Whether owned posting text carries enough substance to be published as a
 * body. Ownership proves WHOSE text it is; this proves there is text.
 */
export function ownedTextHasPostingSubstance(text: string): boolean {
  const sentences = (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [])
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= MIN_BODY_SENTENCE_LENGTH);
  return sentences.length >= MIN_BODY_SENTENCES;
}

/** Resolves one selected posting boundary; successful fetch alone proves nothing. */
export function resolveJobPostingScope(
  html: string,
  selected: { url: string; title: string },
): JobPostingScope {
  const url = canonicalJobUrl(selected.url);
  if (!url) return { status: "unproven" };
  const matching = extractJsonLdOpportunities(html)
    .filter((item) => item.kind === "job" && item.url && canonicalJobUrl(item.url) === url)
    .filter((item, index, all) => all.findIndex(other =>
      canonicalJobUrl(other.url ?? "") === canonicalJobUrl(item.url ?? "") &&
      other.description === item.description,
    ) === index);
  for (const block of selectedDomScopes(html, url, selected.title)) {
    const text = extractPageText(block);
    if (text) return { status: "owned", text, ...(matching.length === 1 ? { structured: matching[0] } : {}) };
  }

  if (matching.length !== 1 || !matching[0].description) return { status: "unproven" };
  const text = extractPageText(`<main>${matching[0].description}</main>`);
  return text ? { status: "owned", text, structured: matching[0] } : { status: "unproven" };
}
