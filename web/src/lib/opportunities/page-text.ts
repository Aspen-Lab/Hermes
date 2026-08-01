import { fetchPageHtml } from "./page-fetch";
import { stripHtml } from "./shared";

export const MAX_PAGE_TEXT_CHARS = 40_000;

const PARAGRAPH_BREAK = "\uE000PEER_PARAGRAPH\uE001";
const PAGE_FURNITURE_ROLE_RE =
  /\b(?:navigation|banner|contentinfo|complementary)\b/i;
const PAGE_FURNITURE_NAME_RE =
  /\b(?:nav|navigation|navbar|header|masthead|footer|sidebar|menu|breadcrumb)\b/i;
const JAVASCRIPT_PLACEHOLDER_RE =
  /^(?:(?:please\s+)?enable\s+javascript|javascript\s+(?:is\s+)?required|loading)\b[^.!?]{0,120}[.!?]*$/i;
const PROGRAMME_LINK_KEYWORDS = [
  { pattern: /\bprogram(?:me)?\b/i, weight: 7 },
  { pattern: /\bschedule\b/i, weight: 6 },
  { pattern: /\bagenda\b/i, weight: 5 },
  { pattern: /\bsessions?\b/i, weight: 4 },
  { pattern: /\btalks?\b/i, weight: 3 },
  { pattern: /\bspeakers?\b/i, weight: 2 },
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
  if (["nav", "header", "footer", "aside"].includes(tag)) return true;
  const role = attributes.match(
    /\brole\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  if (PAGE_FURNITURE_ROLE_RE.test(role?.[1] ?? role?.[2] ?? "")) return true;
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
  const visibleHtml = withoutHiddenContent(html);
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
    if (candidate.toString() === baseUrl.toString()) continue;

    const text = stripHtml(match[2] ?? "").replace(/\s+/g, " ").trim();
    let target = href;
    try {
      const explicitTarget = new URL(href, "https://peer.invalid/");
      target = decodeURIComponent(
        `${explicitTarget.pathname} ${explicitTarget.search}`,
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
