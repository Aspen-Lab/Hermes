import { normalizeLoose } from "@/lib/opportunities/shared";

const MIN_SENTENCE_LENGTH = 40;
const MAX_SENTENCE_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 240;

// B5-07/R4. The e-commerce/UI phrases below are a parallel vocabulary
// family, not a fold-in to looksLikeScrapedChrome (which stays narrowly
// about the colon-label shape, per its own name). Real job 2's surviving
// junk was a shopping-cart widget's own chrome (a different site template's
// furniture) with zero colons anywhere in it, so the existing colon-count
// guard never saw it.
const NOISE_RE =
  /\b(equal opportunit|affirmative action|without regard to|does not discriminate|reasonable accommodation|protected veteran|benefits? (?:include|package)|health insurance|dental insurance|401\(k\)|how to apply|apply (?:now|today)|submit(?:ting)? (?:your|an) application|application instructions|about us|our history|founded in|add to (?:cart|bag)|shopping cart|checkout|in stock|out of stock|sku|wishlist|item(?:s)? in (?:your |the )?cart|proceed to payment)\b/i;

/**
 * A capitalised phrase of up to three words immediately followed by a
 * colon — "Employment type:", "Experience required:", "Location:". One of
 * these is a normal sentence opener (see SECTION_RE below, which already
 * scores "Role Overview: ..." as a bonus, not noise). Two or more in one
 * candidate is scraped ATS-page chrome, not prose (R4's own repro: a run of
 * concatenated form-field labels and values with no real sentence
 * punctuation between them). Shape-based rather than a phrase list tied to
 * one site template.
 */
const LABEL_MARKER_RE = /\b[A-Z][a-zA-Z]*(?:\s+[a-zA-Z]+){0,2}:/g;

function looksLikeScrapedChrome(text: string): boolean {
  return (text.match(LABEL_MARKER_RE) ?? []).length >= 2;
}

/**
 * B5-07/R4, the second, complementary check. Real job 2's surviving junk
 * ended with a near-repeat of the posting's own title ("...Opening For
 * Marketing Intern Ion Exchange Ltd.") — no e-commerce vocabulary needed for
 * NOISE_RE to name, no colon for looksLikeScrapedChrome to count, but a
 * sentence that trails off INTO the job's own title carries no descriptive
 * information beyond what the report's own H1 already shows.
 *
 * Checked at the END of the sentence specifically, not "contains the title
 * anywhere" — a genuinely descriptive sentence commonly OPENS by naming the
 * role ("As a Marketing Intern, you will develop...") and then says
 * something substantive; only a sentence that has nothing meaningful AFTER
 * the title is the echo shape this targets. A short title (under 6
 * normalised characters) is not trusted as a signal at all — too easy to
 * collide with the tail of an unrelated, genuinely descriptive sentence by
 * chance.
 */
function endsWithTitleEcho(sentence: string, jobTitle: string | undefined): boolean {
  if (!jobTitle) return false;
  const normalizedTitle = normalizeLoose(jobTitle);
  if (normalizedTitle.length < 6) return false;
  return normalizeLoose(sentence).endsWith(normalizedTitle);
}

const SECTION_RE =
  /^(?:key )?(?:responsibilities|requirements|qualifications|what you(?:'|’)ll do|the role|role overview)\b/i;

/**
 * B10-07 fix 1 (round 10, item 6): SECTION_RE above grants `sectionScore`
 * for STARTING WITH a section word, with no requirement that anything
 * resembling real content follows it. Round 9's own trace (§4 "Round 9 —
 * Agent B (B9-03)") found a junk fragment
 * ("Qualifications: ### Get the Saturday tech briefing [...") cleared the
 * positive-content floor on `sectionScore` alone — zero keyword match, zero
 * role-verb match. A bare section label followed by real prose is a
 * legitimate, rewarded sentence opener (`summarize.test.ts`'s own "still
 * credits a single label as a genuine sentence opener, not chrome" case,
 * unaffected by this) — the defect is specifically a label immediately
 * followed by SCRAPED-PAGE markers with nothing readable in between: an
 * unbalanced bracket (a Markdown-link remnant, same general shape
 * `job-cleanup.ts`'s `stripOrphanedFormattingArtifacts` already treats as
 * an artifact, B9-03) or a bare Markdown heading marker (`##`+). Narrow and
 * shape-based, matching this file's own "catch a known shape" convention:
 * does not touch `matchedCount` or `roleScore`, and a genuine
 * "Qualifications: Design and build systems that..."-shaped sentence has
 * neither marker and is unaffected.
 */
const SCRAPED_FRAGMENT_MARKER_RE = /#{2,}/;

function hasUnbalancedBracket(text: string): boolean {
  const opens = (text.match(/\[/g) ?? []).length;
  const closes = (text.match(/\]/g) ?? []).length;
  return opens !== closes;
}

function sectionOpenerHasReadableContent(text: string): boolean {
  const afterLabel = text.replace(SECTION_RE, "").trim();
  return (
    afterLabel.length >= 20 &&
    !SCRAPED_FRAGMENT_MARKER_RE.test(afterLabel) &&
    !hasUnbalancedBracket(afterLabel)
  );
}

/**
 * B10-07 fix 2 (round 10, item 8): a leading `Label:` pattern left visible
 * in the final displayed summary — a capitalised phrase of up to three
 * words immediately followed by a colon, at the START of a sentence (the
 * same shape LABEL_MARKER_RE above recognises, anchored). Item 8's own live
 * repro ("Multi-Level: This is a multi-level posting...") is confirmed, by
 * controlled construction against this file's real, unmodified scoring
 * logic, to clear the floor through `roleScore`/`matchedCount` on real
 * content — never through `SECTION_RE` — so it is a legitimately-selected
 * sentence with a purely cosmetic un-stripped label prefix.
 *
 * **Deliberately NOT placed in `job-cleanup.ts`'s `cleanJobDescription`**,
 * though B's guide named that as the natural home (same scoping precedent
 * as B9-03's dash/bracket cleanup). Traced the actual call order first:
 * `mapper.ts` calls `cleanJobDescription(summarySource)` BEFORE
 * `summarizeJob` ever runs `scoreSentences` — stripping the label there
 * would remove it from the text `SECTION_RE` itself scores, silently
 * blinding `sectionScore`'s detection for every label-led sentence
 * (including the "Role Overview: We're hiring..." case this file's own
 * existing test protects) before scoring ever saw it. That is a scoring
 * regression, not a cosmetic fix. Stripped here instead, applied only to
 * the STORED/displayed `text` of a sentence that already survived scoring
 * — every scoring check above (`SECTION_RE`, `sectionOpenerHasReadableContent`,
 * `ROLE_RE`, `matchedCount`) still runs against the original, unstripped
 * sentence text.
 */
const LEADING_LABEL_RE = /^[A-Z][a-zA-Z]*(?:[\s-][A-Za-z]+){0,2}:\s*/;

function stripLeadingLabel(text: string): string {
  return text.replace(LEADING_LABEL_RE, "");
}

const ROLE_RE =
  /\b(?:in this role|you will|you(?:'|’)ll|responsible for|we(?:'|’)re hiring|develop|design|build|research|analy[sz]e|lead|manage)\b/i;

type ScoredSentence = {
  index: number;
  score: number;
  text: string;
};

export type HighlightSegment = {
  text: string;
  matched: boolean;
};

function splitSentences(description: string): string[] {
  return (description.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [])
    .map((sentence) => sentence.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function termMatches(sentence: string, term: string): boolean {
  return sentence.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase());
}

function scoreSentences(
  description: string,
  matchedKeywords: string[],
  jobTitle: string | undefined,
): ScoredSentence[] {
  const terms = matchedKeywords.map((term) => term.trim()).filter(Boolean);

  return splitSentences(description)
    .map((text, index): ScoredSentence | null => {
      if (
        text.length < MIN_SENTENCE_LENGTH ||
        text.length > MAX_SENTENCE_LENGTH ||
        NOISE_RE.test(text) ||
        looksLikeScrapedChrome(text) ||
        endsWithTitleEcho(text, jobTitle)
      ) {
        return null;
      }

      const matchedCount = terms.filter((term) => termMatches(text, term)).length;
      const positionScore = Math.max(0, 3 - index * 0.25);
      const sectionScore =
        SECTION_RE.test(text) && sectionOpenerHasReadableContent(text) ? 4 : 0;
      const roleScore = ROLE_RE.test(text) ? 2 : 0;
      const readableLengthScore = text.length >= 60 && text.length <= 180 ? 1 : 0;

      // B8-05 (round 8): everything above this point is a NEGATIVE check —
      // nothing required a survivor to carry positive evidence of role
      // content. positionScore and readableLengthScore are structural/
      // cosmetic (where a sentence sits, how long it is), not evidence a
      // sentence is actually about the role, so a survivor scoring only on
      // those two — site-navigation chrome, ATS breadcrumbs with no colon
      // markers — was still eligible and could outscore or join genuine
      // content on a short candidate pool. Minimal floor, as guided: require
      // at least one real content signal. Known, named limitation (not
      // fixed here): a chrome sentence that happens to contain a matched
      // profile keyword still clears this floor — see
      // summarize.test.ts's "positive-content floor (B8-05)" block.
      if (matchedCount === 0 && sectionScore === 0 && roleScore === 0) {
        return null;
      }

      return {
        index,
        text: stripLeadingLabel(text),
        score: matchedCount * 6 + positionScore + sectionScore + roleScore + readableLengthScore,
      };
    })
    .filter((sentence): sentence is ScoredSentence => sentence !== null);
}

function bestCombination(sentences: ScoredSentence[]): ScoredSentence[] {
  const candidates = [...sentences].sort((a, b) => b.score - a.score).slice(0, 8);
  let best: ScoredSentence[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let mask = 1; mask < 1 << candidates.length; mask += 1) {
    const selected = candidates.filter((_, index) => (mask & (1 << index)) !== 0);
    if (selected.length > 3) continue;

    const ordered = [...selected].sort((a, b) => a.index - b.index);
    const text = ordered.map((sentence) => sentence.text).join(" ");
    if (text.length > MAX_SUMMARY_LENGTH) continue;

    const score =
      ordered.reduce((total, sentence) => total + sentence.score, 0) +
      Math.min(ordered.length, 2) * 0.5;
    if (
      score > bestScore ||
      (score === bestScore && ordered.length > best.length) ||
      (score === bestScore && ordered.length === best.length && text.length < best.map((s) => s.text).join(" ").length)
    ) {
      best = ordered;
      bestScore = score;
    }
  }

  return best;
}

export function summarizeJob(
  description: string | null | undefined,
  matchedKeywords: string[] = [],
  // B5-07/R4. Additive third parameter with a default — every existing call
  // site (this file's own tests included) stays valid and unaffected unless
  // its fixture actually contains the title-echo shape (none does; see the
  // gate note in the round log).
  jobTitle?: string,
): string {
  if (!description?.trim()) return "";

  const selected = bestCombination(scoreSentences(description, matchedKeywords, jobTitle));
  return selected.map((sentence) => sentence.text).join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{N}]/u.test(value);
}

export function highlightSegments(text: string, terms: string[]): HighlightSegment[] {
  const normalizedTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (!text || normalizedTerms.length === 0) return [{ text, matched: false }];

  const intervals: Array<{ start: number; end: number }> = [];
  for (const term of normalizedTerms) {
    const pattern = new RegExp(escapeRegExp(term), "giu");
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const beginsWithWord = isWordCharacter(term[0]);
      const endsWithWord = isWordCharacter(term.at(-1));
      const hasLeftBoundary = !beginsWithWord || !isWordCharacter(text[start - 1]);
      const hasRightBoundary = !endsWithWord || !isWordCharacter(text[end]);

      if (hasLeftBoundary && hasRightBoundary) intervals.push({ start, end });
      pattern.lastIndex = start + 1;
    }
  }

  if (intervals.length === 0) return [{ text, matched: false }];

  intervals.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const interval of merged) {
    if (cursor < interval.start) {
      segments.push({ text: text.slice(cursor, interval.start), matched: false });
    }
    segments.push({ text: text.slice(interval.start, interval.end), matched: true });
    cursor = interval.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matched: false });

  return segments;
}
