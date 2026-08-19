import { fetchPageHtml } from "./page-fetch";
import { stripHtml } from "./shared";

export const MAX_PAGE_TEXT_CHARS = 40_000;
export const MAX_PAGE_HEADING_TEXT_CHARS = 6_000;
export const PAGE_HEADING_MARKER_PREFIX = "[PROGRAMME HEADING LEVEL ";

export interface PageHeadingEvidence {
  level: number;
  text: string;
}

export function mergePageHeadings(
  ...groups: ReadonlyArray<readonly PageHeadingEvidence[]>
): PageHeadingEvidence[] {
  const headings: PageHeadingEvidence[] = [];
  const returned = new Set<string>();
  let totalCharacters = 0;
  for (const heading of groups.flat()) {
    const normalized = heading.text.toLowerCase();
    if (!heading.text || returned.has(normalized)) continue;
    const nextLength =
      totalCharacters + (headings.length > 0 ? 2 : 0) + heading.text.length;
    if (nextLength > MAX_PAGE_HEADING_TEXT_CHARS) break;
    headings.push(heading);
    returned.add(normalized);
    totalCharacters = nextLength;
  }
  return headings;
}

const PARAGRAPH_BREAK = "\uE000PEER_PARAGRAPH\uE001";
const PAGE_FURNITURE_ROLE_RE =
  /\b(?:navigation|banner|contentinfo|complementary)\b/i;
const PAGE_FURNITURE_NAME_RE =
  /\b(?:nav|navigation|navbar|header|masthead|footer|sidebar|menu|breadcrumb)\b/i;
const JAVASCRIPT_PLACEHOLDER_RE =
  /^(?:(?:please\s+)?enable\s+javascript|javascript\s+(?:is\s+)?required|loading)\b[^.!?]{0,120}[.!?]*$/i;
const PROGRAMME_LINK_KEYWORDS = [
  { pattern: /\bprogram(?:me)?s?\b/i, weight: 7 },
  { pattern: /\bschedule\b/i, weight: 6 },
  { pattern: /\bagenda\b/i, weight: 5 },
  { pattern: /\bsessions\b/i, weight: 4 },
  { pattern: /\btalks\b/i, weight: 3 },
  { pattern: /\bspeakers\b/i, weight: 2 },
] as const;

function withoutHiddenContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(
      /<(?:script|style|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|template)>/gi,
      " ",
    );
}

function semanticValues(attributes: string): string[] {
  const values: string[] = [];
  for (const match of attributes.matchAll(
    /\b(?:class|id|itemprop|data-field|data-type|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  )) {
    values.push(
      ...(match[1] ?? match[2] ?? "")
        .split(/\s+/)
        .map((value) => value.toLowerCase().replace(/[-_]+/g, " ").trim())
        .filter(Boolean),
    );
  }
  return values;
}

function findElementEnd(
  html: string,
  tag: string,
  contentStart: number,
): number | undefined {
  const token = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  token.lastIndex = contentStart;
  let depth = 1;
  for (let match = token.exec(html); match; match = token.exec(html)) {
    if (/^<\//.test(match[0])) {
      depth -= 1;
      if (depth === 0) return token.lastIndex;
    } else if (!/\/>$/.test(match[0])) {
      depth += 1;
    }
  }
  return undefined;
}

function isPageFurniture(tag: string, attributes: string): boolean {
  const role = attributes.match(
    /\brole\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  if (PAGE_FURNITURE_ROLE_RE.test(role?.[1] ?? role?.[2] ?? "")) return true;
  if (/\bsession[-_\s]*header\b/i.test(attributes)) return false;
  if (["nav", "header", "footer", "aside"].includes(tag)) return true;
  return PAGE_FURNITURE_NAME_RE.test(semanticValues(attributes).join(" "));
}

function withoutPageFurniture(html: string): string {
  const ranges: Array<{ start: number; end: number }> = [];
  const opening = /<(nav|header|footer|aside|div|section)\b([^>]*)>/gi;
  for (let match = opening.exec(html); match; match = opening.exec(html)) {
    const tag = match[1].toLowerCase();
    if (!isPageFurniture(tag, match[2] ?? "")) continue;
    const end = findElementEnd(html, tag, opening.lastIndex);
    if (end === undefined) continue;
    ranges.push({ start: match.index, end });
    opening.lastIndex = end;
  }
  if (ranges.length === 0) return html;

  let cursor = 0;
  let visible = "";
  for (const range of ranges) {
    visible += `${html.slice(cursor, range.start)} `;
    cursor = range.end;
  }
  return visible + html.slice(cursor);
}

function normalizedParagraphs(text: string): string[] {
  return text
    .split(/(?:\r?\n){2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function visibleParagraphText(html: string): string {
  const separated = html.replace(
    /<br\s*\/?>|<\/(?:p|li|h[1-6]|div|section|article|main|tr|blockquote)>/gi,
    PARAGRAPH_BREAK,
  );
  return stripHtml(separated)
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

// A programme entry is very often NOT an <h1>–<h6>. The IAEA record for "Ion
// exchange processes: advances and applications" lists its eight contributions
// as <li><a> links in a sidebar, so searching only heading tags found nothing
// and the report said it could quote no talk titles at all. Tables of sessions
// are just as common.
//
// Widening WHERE a candidate may be found is safe. The verbatim check that a
// title must survive is unchanged and stays as strict as it was.
const CANDIDATE_LIST_ROW_RE = /<(li|td)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
// Link text is frequently cut short for layout ("Ion exchange in the nuclear
// power indust…"). A truncated title can never match the page verbatim, so
// prefer the full string the markup carries in title= or aria-label=.
const TRUNCATION_RE = /(?:…|\.\.\.)\s*$/;
const FULL_TEXT_ATTRIBUTE_RE =
  /\b(?:title|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const LIST_ROW_LEVEL = 7;

function candidateText(rawHtml: string): string | undefined {
  const text = stripHtml(rawHtml).replace(/\s+/g, " ").trim();
  if (!TRUNCATION_RE.test(text)) return text || undefined;
  const attribute = rawHtml.match(FULL_TEXT_ATTRIBUTE_RE);
  const full = (attribute?.[1] ?? attribute?.[2] ?? "").replace(/\s+/g, " ").trim();
  // No recoverable full text — drop it rather than publish half a title.
  return full && !TRUNCATION_RE.test(full) ? full : undefined;
}

export function extractPageHeadings(html: string): PageHeadingEvidence[] {
  const visibleHtml = withoutPageFurniture(withoutHiddenContent(html));
  const headings: PageHeadingEvidence[] = [];

  for (const match of visibleHtml.matchAll(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
  )) {
    const text = candidateText(match[2] ?? "");
    if (!text || text.length > 240) continue;
    headings.push({ level: Number(match[1]), text });
  }

  for (const match of visibleHtml.matchAll(CANDIDATE_LIST_ROW_RE)) {
    const body = match[2] ?? "";
    // A row containing its own nested rows is a container, not an entry.
    if (/<(?:li|td)\b/i.test(body)) continue;
    const text = candidateText(body);
    // A bare word is a label, and a paragraph is prose — neither is a title.
    if (!text || text.length > 240 || !/\s/.test(text)) continue;
    headings.push({ level: LIST_ROW_LEVEL, text });
  }

  return mergePageHeadings(headings);
}

export function annotatePageHeadings(
  text: string,
  headings: readonly PageHeadingEvidence[],
  maxChars = MAX_PAGE_TEXT_CHARS,
): { text: string | null; headings: PageHeadingEvidence[] } {
  const remaining = new Map(
    headings.map((heading) => [heading.text.toLowerCase(), heading]),
  );
  const annotatedParagraphs: string[] = [];
  for (const paragraph of normalizedParagraphs(text)) {
    const lowered = paragraph.toLowerCase();
    const matches = [...remaining].flatMap(([normalized, heading]) => {
      const index = lowered.indexOf(normalized);
      return index >= 0 ? [{ index, normalized, heading }] : [];
    }).sort(
      (left, right) =>
        left.index - right.index || right.normalized.length - left.normalized.length,
    );
    let cursor = 0;
    for (const match of matches) {
      if (match.index < cursor) continue;
      const before = paragraph.slice(cursor, match.index).trim();
      if (before) annotatedParagraphs.push(before);
      const sourceTitle = paragraph.slice(
        match.index,
        match.index + match.normalized.length,
      );
      annotatedParagraphs.push(
        `${PAGE_HEADING_MARKER_PREFIX}${match.heading.level}] ${sourceTitle}`,
      );
      cursor = match.index + match.normalized.length;
      remaining.delete(match.normalized);
    }
    const after = paragraph.slice(cursor).trim();
    if (after) annotatedParagraphs.push(after);
  }
  const annotated = annotatedParagraphs.join("\n\n");
  const capped = capPageText(annotated, maxChars);
  if (!capped) return { text: null, headings: [] };

  const retained = new Set(
    normalizedParagraphs(capped).flatMap((paragraph) => {
      const match = paragraph.match(
        /^\[PROGRAMME HEADING LEVEL ([1-6])\]\s+(.+)$/,
      );
      return match ? [`${match[1]}:${match[2].toLowerCase()}`] : [];
    }),
  );
  return {
    text: capped,
    headings: headings.filter((heading) =>
      retained.has(`${heading.level}:${heading.text.toLowerCase()}`),
    ),
  };
}

function linkKeywordScore(value: string): number {
  return (
    PROGRAMME_LINK_KEYWORDS.find(({ pattern }) => pattern.test(value))?.weight ??
    0
  );
}

function linkHref(attributes: string): string | null {
  const match = attributes.match(
    /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i,
  );
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "")
    .replace(/&amp;/gi, "&")
    .trim() || null;
}

export function findProgrammePageUrl(
  html: string,
  eventPageUrl: string,
): string | null {
  let baseUrl: URL;
  try {
    baseUrl = new URL(eventPageUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(baseUrl.protocol)) return null;
  baseUrl.hash = "";

  let best: { score: number; index: number; url: string } | null = null;
  // F-P2-01 (round 5-6, Ruling 114): this was the one extraction path in
  // this file that scanned <a> tags via withoutHiddenContent alone, without
  // the withoutPageFurniture pass that extractPageHeadings (:170) and
  // extractPageText (:350) already run — the asymmetry was the root cause.
  // The live witness: an ion-exchange course's rsc.org page carried a
  // sitewide nav link ("Careers talks and events") that scored high enough
  // to be picked as its programme page, and that wrong page's own
  // ChemCareers content then bled into talkSummaries. Routing this scan
  // through the same withoutPageFurniture call makes all three paths
  // symmetric: a chrome-suppressed candidate now falls out of the
  // comparison entirely, so the safe failure direction is a null pick (an
  // honestly empty programme), never a wrong-event fill.
  const visibleHtml = withoutPageFurniture(withoutHiddenContent(html));
  for (const match of visibleHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = linkHref(match[1] ?? "");
    if (!href) continue;

    let candidate: URL;
    try {
      candidate = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(candidate.protocol)) continue;
    if (candidate.host.toLowerCase() !== baseUrl.host.toLowerCase()) continue;
    if (candidate.username || candidate.password) continue;
    if (/\.(?:ics|pdf|zip)$/i.test(candidate.pathname)) continue;
    candidate.hash = "";
    if (
      candidate.pathname === baseUrl.pathname &&
      candidate.search === baseUrl.search
    ) {
      continue;
    }

    const text = stripHtml(match[2] ?? "").replace(/\s+/g, " ").trim();
    let target = href;
    try {
      const explicitTarget = new URL(href, "https://peer.invalid/");
      target = decodeURIComponent(
        `${explicitTarget.pathname} ${explicitTarget.search} ${explicitTarget.hash}`,
      );
    } catch {
      // Keep the encoded target for scoring when a site has a malformed escape.
    }
    const score = linkKeywordScore(text) * 2 + linkKeywordScore(target);
    if (score === 0) continue;

    const index = match.index ?? Number.MAX_SAFE_INTEGER;
    if (!best || score > best.score || (score === best.score && index < best.index)) {
      best = { score, index, url: candidate.toString() };
    }
  }
  return best?.url ?? null;
}

export function capPageText(
  text: string,
  maxChars = MAX_PAGE_TEXT_CHARS,
): string | null {
  if (!Number.isFinite(maxChars) || maxChars < 1) return null;
  const limit = Math.min(Math.floor(maxChars), MAX_PAGE_TEXT_CHARS);
  const paragraphs = normalizedParagraphs(text);
  if (paragraphs.length === 0) return null;

  const kept: string[] = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    const separatorLength = kept.length > 0 ? 2 : 0;
    if (length + separatorLength + paragraph.length > limit) break;
    kept.push(paragraph);
    length += separatorLength + paragraph.length;
  }
  if (kept.length > 0) return kept.join("\n\n");

  return null;
}

export function extractPageText(
  html: string,
  maxChars = MAX_PAGE_TEXT_CHARS,
): string | null {
  const visibleHtml = withoutPageFurniture(withoutHiddenContent(html));
  const text = capPageText(visibleParagraphText(visibleHtml), maxChars);
  if (!text) return null;
  if (text.length <= 160 && JAVASCRIPT_PLACEHOLDER_RE.test(text)) return null;
  return text;
}

export async function fetchPageText(
  url: string,
  maxChars = MAX_PAGE_TEXT_CHARS,
): Promise<string | null> {
  try {
    const html = await fetchPageHtml(url);
    return html ? extractPageText(html, maxChars) : null;
  } catch {
    return null;
  }
}
