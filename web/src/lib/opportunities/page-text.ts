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
