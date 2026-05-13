// HTML full-text extractors. Maps publisher/repository HTML pages into the
// same sectioned shape the PDF extractor produces, so the deep-report
// pipeline can consume either source transparently.
//
// Host coverage (with dedicated parsers, in priority order):
//   - ar5iv.labs.arxiv.org       (arXiv HTML rendering)
//   - pmc.ncbi.nlm.nih.gov       (PubMed Central)
//   - biorxiv.org / medrxiv.org  (Highwire press templates)
//   - generic                    (last-resort: <article>/<main> walker)

import { cleanDisplayText } from "@/lib/text/clean";

const MAX_SECTION_CHARS = 18_000;
const MAX_TOTAL_CHARS = 90_000;

export interface ExtractedSection {
  heading: string;
  /** Canonical bucket: introduction|methods|results|discussion|conclusion|body|... */
  canonical: string;
  text: string;
}

export interface ExtractedFigureCaption {
  ordinal: number;
  label: string;
  caption: string;
}

export type ExtractedSourceKind =
  | "ar5iv"
  | "pmc"
  | "biorxiv"
  | "generic-html"
  | "pdf";

export interface ExtractedDocument {
  title?: string | null;
  sections: ExtractedSection[];
  figureCaptions: ExtractedFigureCaption[];
  source: ExtractedSourceKind;
  reason?: string | null;
}

// ── Utilities ─────────────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<sup\b[^>]*class=["'][^"']*reference[^"']*["'][\s\S]*?<\/sup>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeHeading(heading: string): string {
  const lower = heading.toLowerCase().replace(/^\d+\.?\s*/, "").trim();
  if (/material.*method|experimental section|methodolog/.test(lower)) return "methods";
  if (/method|approach|model|theory/.test(lower)) return "methods";
  if (/result.*discussion/.test(lower)) return "results";
  if (/^result/.test(lower)) return "results";
  if (/discussion/.test(lower)) return "discussion";
  if (/introduction|background/.test(lower)) return "introduction";
  if (/related work/.test(lower)) return "related_work";
  if (/^abstract\b/.test(lower)) return "abstract";
  if (/conclusion|summary/.test(lower)) return "conclusion";
  if (/reference/.test(lower)) return "references";
  if (/acknowledg/.test(lower)) return "acknowledgments";
  if (/supplement|supporting/.test(lower)) return "supplementary";
  return "body";
}

function shouldKeepSection(canonical: string): boolean {
  return canonical !== "references" && canonical !== "acknowledgments";
}

function capSection(text: string): string {
  return text.length > MAX_SECTION_CHARS ? text.slice(0, MAX_SECTION_CHARS) : text;
}

function trimToBudget(sections: ExtractedSection[]): ExtractedSection[] {
  let running = 0;
  const out: ExtractedSection[] = [];
  for (const section of sections) {
    const remaining = MAX_TOTAL_CHARS - running;
    if (remaining <= 0) break;
    const text =
      section.text.length > remaining ? section.text.slice(0, remaining) : section.text;
    out.push({ ...section, text });
    running += text.length;
  }
  return out;
}

function extractTitleFromHtml(html: string): string | null {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (og?.[1]) return cleanDisplayText(decodeEntities(og[1]));
  const cit = html.match(
    /<meta[^>]+name=["']citation_title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (cit?.[1]) return cleanDisplayText(decodeEntities(cit[1]));
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTag?.[1]) {
    const text = cleanDisplayText(decodeEntities(titleTag[1]));
    if (text.length >= 6) return text;
  }
  return null;
}

// ── ar5iv (arXiv HTML rendering) ──────────────────────────────────────
// ar5iv structures the paper as <section class="ltx_section"> with
// <h2 class="ltx_title ltx_title_section"> headings.

function extractAr5iv(html: string): ExtractedDocument {
  const sections: ExtractedSection[] = [];
  const sectionRe = /<section\b[^>]*class=["'][^"']*ltx_section[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi;
  for (const match of html.matchAll(sectionRe)) {
    const inner = match[1];
    const headingMatch = inner.match(
      /<h2\b[^>]*class=["'][^"']*ltx_title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i,
    );
    if (!headingMatch) continue;
    const heading = stripTags(headingMatch[1]);
    if (!heading) continue;
    const bodyHtml = inner.replace(headingMatch[0], " ");
    const text = stripTags(bodyHtml);
    if (!text) continue;
    const canonical = canonicalizeHeading(heading);
    if (!shouldKeepSection(canonical)) continue;
    sections.push({ heading, canonical, text: capSection(text) });
  }

  // Captions: <figcaption class="ltx_caption">Figure 1: <span ...>text</span></figcaption>
  const captionRe =
    /<figcaption\b[^>]*class=["'][^"']*ltx_caption[^"']*["'][^>]*>([\s\S]*?)<\/figcaption>/gi;
  const captions: ExtractedFigureCaption[] = [];
  let ordinal = 0;
  for (const match of html.matchAll(captionRe)) {
    const raw = stripTags(match[1]);
    if (!raw) continue;
    const figMatch = raw.match(/^(fig(?:ure)?\.?\s*\d+[a-z]?)\b[:.]?\s*(.*)$/i);
    const label = figMatch ? `Figure ${figMatch[1].replace(/[^0-9a-z]/gi, "")}` : `Figure ${ordinal + 1}`;
    const tail = figMatch ? figMatch[2] : raw;
    captions.push({ ordinal, label, caption: tail.slice(0, 500) });
    ordinal += 1;
  }

  return {
    title: extractTitleFromHtml(html),
    sections: trimToBudget(sections),
    figureCaptions: captions,
    source: "ar5iv",
  };
}

// ── PubMed Central (PMC) ───────────────────────────────────────────────
// PMC uses JATS-flavored HTML. Body sections are <section class="tsec sec">
// (rendered NXML) with <h2> or <h3> child headings.

function extractPmc(html: string): ExtractedDocument {
  const sections: ExtractedSection[] = [];
  // PMC body sections come in two shapes:
  //   <section id="sec1">...</section>          (new PMC layout)
  //   <section class="sec">...</section>        (older variant)
  // Abstracts are `<section class="abstract" id="abstractN">` — we keep those
  // when they're the only body source.
  const sectionRe =
    /<section\b[^>]*(?:id=["']sec\d+[^"']*["']|class=["'][^"']*\b(?:sec|tsec|abstract)\b[^"']*["'])[^>]*>([\s\S]*?)<\/section>/gi;

  for (const match of html.matchAll(sectionRe)) {
    const inner = match[1];
    // Skip nested sections inside an outer one (we'll catch them on their own
    // iteration of the regex too — pick the heading at this level).
    const headingMatch = inner.match(/<h[234]\b[^>]*>([\s\S]*?)<\/h[234]>/i);
    if (!headingMatch) continue;
    const heading = stripTags(headingMatch[1]);
    if (!heading) continue;
    const text = stripTags(inner.replace(headingMatch[0], " "));
    if (!text) continue;
    const canonical = canonicalizeHeading(heading);
    if (!shouldKeepSection(canonical)) continue;
    sections.push({ heading, canonical, text: capSection(text) });
  }

  // Figure captions: <figcaption> or <div class="caption"> containing <p>Fig N. text</p>
  const captionRe = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi;
  const captions: ExtractedFigureCaption[] = [];
  let ordinal = 0;
  for (const match of html.matchAll(captionRe)) {
    const raw = stripTags(match[1]);
    if (!raw) continue;
    const figMatch = raw.match(/^(fig(?:ure)?\.?\s*\d+[a-z]?)\b[:.]?\s*(.*)$/i);
    const label = figMatch ? `Figure ${figMatch[1].replace(/[^0-9a-z]/gi, "")}` : `Figure ${ordinal + 1}`;
    const tail = figMatch ? figMatch[2] : raw;
    captions.push({ ordinal, label, caption: tail.slice(0, 500) });
    ordinal += 1;
  }

  return {
    title: extractTitleFromHtml(html),
    sections: trimToBudget(sections),
    figureCaptions: captions,
    source: "pmc",
  };
}

// ── bioRxiv / medRxiv (Highwire Press) ────────────────────────────────
// Highwire templates use <div class="section" id="..."> with <h2 class="...">.

function extractBiorxiv(html: string): ExtractedDocument {
  const sections: ExtractedSection[] = [];
  const sectionRe =
    /<div\b[^>]*class=["'][^"']*\bsection\b[^"']*["'][^>]*>([\s\S]*?)<\/div>(?=\s*<div[^>]*class=["'][^"']*\bsection\b|\s*<\/article|\s*<\/main)/gi;

  // The regex above is best-effort; fall back to a heading-based walker if
  // it produces nothing.
  const found = Array.from(html.matchAll(sectionRe));
  if (found.length > 0) {
    for (const match of found) {
      const inner = match[1];
      const headingMatch = inner.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i);
      if (!headingMatch) continue;
      const heading = stripTags(headingMatch[1]);
      if (!heading) continue;
      const text = stripTags(inner.replace(headingMatch[0], " "));
      if (!text) continue;
      const canonical = canonicalizeHeading(heading);
      if (!shouldKeepSection(canonical)) continue;
      sections.push({ heading, canonical, text: capSection(text) });
    }
  } else {
    // Heading-based fallback over the whole article container.
    const articleMatch = html.match(
      /<article\b[^>]*>([\s\S]*?)<\/article>|<main\b[^>]*>([\s\S]*?)<\/main>/i,
    );
    const body = articleMatch ? articleMatch[1] || articleMatch[2] : html;
    sections.push(...walkHeadings(body));
  }

  // Figures
  const captions: ExtractedFigureCaption[] = [];
  const figRe = /<div\b[^>]*class=["'][^"']*\bfig-caption\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let ordinal = 0;
  for (const match of html.matchAll(figRe)) {
    const raw = stripTags(match[1]);
    if (!raw) continue;
    const figMatch = raw.match(/^(fig(?:ure)?\.?\s*\d+[a-z]?)\b[:.]?\s*(.*)$/i);
    const label = figMatch ? `Figure ${figMatch[1].replace(/[^0-9a-z]/gi, "")}` : `Figure ${ordinal + 1}`;
    const tail = figMatch ? figMatch[2] : raw;
    captions.push({ ordinal, label, caption: tail.slice(0, 500) });
    ordinal += 1;
  }

  return {
    title: extractTitleFromHtml(html),
    sections: trimToBudget(sections),
    figureCaptions: captions,
    source: "biorxiv",
  };
}

// ── Generic fallback ──────────────────────────────────────────────────
// Walks every <h2>/<h3> inside <article>/<main> and groups intervening
// text as that section's body. Last resort — used for OA publishers without
// a dedicated parser.

function walkHeadings(html: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  // Find all heading positions
  const headingRe = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches: Array<{ index: number; end: number; heading: string }> = [];
  for (const match of html.matchAll(headingRe)) {
    const heading = stripTags(match[2]);
    if (!heading) continue;
    matches.push({
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      heading,
    });
  }
  if (matches.length === 0) {
    const text = stripTags(html);
    if (text) {
      sections.push({
        heading: "Body",
        canonical: "body",
        text: capSection(text),
      });
    }
    return sections;
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const stop = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const slice = html.slice(start, stop);
    const text = stripTags(slice);
    if (!text) continue;
    const heading = matches[i].heading;
    const canonical = canonicalizeHeading(heading);
    if (!shouldKeepSection(canonical)) continue;
    sections.push({ heading, canonical, text: capSection(text) });
  }
  return sections;
}

function extractGeneric(html: string): ExtractedDocument {
  const articleMatch = html.match(
    /<article\b[^>]*>([\s\S]*?)<\/article>|<main\b[^>]*>([\s\S]*?)<\/main>/i,
  );
  const body = articleMatch ? articleMatch[1] || articleMatch[2] : html;
  const sections = walkHeadings(body);
  const captions: ExtractedFigureCaption[] = [];
  const figRe = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi;
  let ordinal = 0;
  for (const match of html.matchAll(figRe)) {
    const raw = stripTags(match[1]);
    if (!raw) continue;
    const figMatch = raw.match(/^(fig(?:ure)?\.?\s*\d+[a-z]?)\b[:.]?\s*(.*)$/i);
    const label = figMatch ? `Figure ${figMatch[1].replace(/[^0-9a-z]/gi, "")}` : `Figure ${ordinal + 1}`;
    const tail = figMatch ? figMatch[2] : raw;
    captions.push({ ordinal, label, caption: tail.slice(0, 500) });
    ordinal += 1;
  }
  return {
    title: extractTitleFromHtml(html),
    sections: trimToBudget(sections),
    figureCaptions: captions,
    source: "generic-html",
  };
}

// ── Public dispatch ───────────────────────────────────────────────────

export function chooseHtmlExtractor(url: string): (html: string) => ExtractedDocument {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/(^|\.)ar5iv\.labs\.arxiv\.org$/.test(host)) return extractAr5iv;
    if (/(^|\.)pmc\.ncbi\.nlm\.nih\.gov$/.test(host)) return extractPmc;
    if (/(^|\.)biorxiv\.org$/.test(host) || /(^|\.)medrxiv\.org$/.test(host)) {
      return extractBiorxiv;
    }
  } catch {
    // fall through to generic
  }
  return extractGeneric;
}

/**
 * Returns true if the HTML body is too thin to plausibly be full-text — used
 * to detect publisher pages that render an abstract-only stub for
 * non-subscribers.
 */
export function looksLikeFullText(doc: ExtractedDocument, minBodyChars = 2500): boolean {
  const total = doc.sections.reduce((sum, section) => sum + section.text.length, 0);
  if (total < minBodyChars) return false;
  // Need at least one non-abstract body section.
  return doc.sections.some(
    (section) => section.canonical !== "abstract" && section.text.length >= 800,
  );
}
