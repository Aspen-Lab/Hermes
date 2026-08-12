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

function selectedDomScopes(html: string, selectedUrl: string, title: string): string[] {
  const candidates: Array<{ html: string; length: number }> = [];
  const opening = /<(article|li|section|div|main)\b[^>]*>/gi;
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
    // A bounded posting block can legitimately link to an application form or
    // schedule as well as its own canonical URL. Only an additional job
    // witness—not an arbitrary related link—would disprove this owner; exact
    // selected-link/heading witnesses below establish the boundary.
    if ((exactLinks === 1 || titleMatches === 1) && exactLinks <= 1 && titleMatches <= 1) {
      candidates.push({ html: block, length: block.length });
    }
  }
  const smallest = candidates.sort((a, b) => a.length - b.length)[0];
  return smallest ? [smallest.html] : [];
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
