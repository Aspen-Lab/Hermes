import type { RawItem } from "@/lib/sources/types";
import type { ScoredItem } from "@/lib/scoring/types";
import type { Paper, PaperSource } from "@/types";

function mapSource(source: string, venue?: string): PaperSource {
  if (source === "arxiv") return "arxiv";
  const v = (venue ?? "").toLowerCase();
  if (v.includes("neurips")) return "neurIPS";
  if (v.includes("iclr")) return "iclr";
  if (v.includes("icml")) return "icml";
  if (v.includes("chi")) return "chi";
  return "other";
}

function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function fallbackVenue(source: string): string {
  if (source === "arxiv") return "arXiv";
  if (source === "hn") return "Hacker News";
  return "";
}

// Source feeds (notably HN's `story_text`) can return HTML-encoded
// markup with `<p>` tags and entities like `&#x2F;` `&#x27;`. Render
// surfaces are plain text — decode + strip before splitting.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s: string): string {
  // Drop tags, collapse whitespace.
  return s
    .replace(/<\/?(p|br|div)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanProseText(s: string | undefined): string | undefined {
  if (!s) return s;
  return stripHtml(decodeHtmlEntities(s));
}

// HN `_tags` carries system markers (`story`, `front_page`, `show_hn`,
// `author_<name>`, `story_<id>`) that aren't useful as "Methods &
// techniques" chips. Filter them out — keep only plain words.
function isUsefulKeyword(tag: string): boolean {
  if (!tag) return false;
  if (tag.includes("_")) return false;
  const sys = new Set([
    "story",
    "front_page",
    "show_hn",
    "ask_hn",
    "comment",
    "poll",
    "job",
  ]);
  return !sys.has(tag.toLowerCase());
}

function splitAbstractForBriefing(abstract: string | undefined): {
  intro: string;
  discussion: string;
} {
  if (!abstract) return { intro: "", discussion: "" };
  const sentences = abstract.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1) return { intro: abstract, discussion: "" };
  const introSentenceCount = sentences[0].length < 80 ? 2 : 1;
  const intro = sentences.slice(0, introSentenceCount).join(" ");
  const discussion = sentences.slice(introSentenceCount).join(" ");
  return { intro, discussion };
}

export interface RawItemToPaperOptions {
  relevanceReason?: string;
  relevanceScore?: number;
  matchedKeywords?: string[];
}

export function rawItemToPaper(
  item: RawItem,
  options: RawItemToPaperOptions = {},
): Paper {
  const cleanedAbstract = cleanProseText(item.abstract);
  const { intro, discussion } = splitAbstractForBriefing(cleanedAbstract);
  const keywords = Array.from(
    new Set([
      ...(options.matchedKeywords ?? []),
      ...(item.tags ?? []).filter(isUsefulKeyword),
    ]),
  ).slice(0, 6);
  const isArxiv = item.source === "arxiv";
  const introText = intro || truncate(cleanedAbstract, 400);
  return {
    id: item.id,
    title: item.title,
    authors: item.authors,
    relevanceReason: options.relevanceReason ?? "",
    venue: item.venue || fallbackVenue(item.source),
    source: mapSource(item.source, item.venue),
    summaryIntro: introText,
    summaryExperimentKeywords: keywords,
    summaryResultDiscussion: discussion,
    linkPaper: item.url,
    linkArxiv: isArxiv ? item.url : undefined,
    publishedDate: item.publishedAt || undefined,
    isSaved: false,
    relevanceScore: options.relevanceScore,
  };
}

export function scoredItemToPaper(item: ScoredItem): Paper {
  return rawItemToPaper(item, {
    relevanceReason: item.relevanceReason,
    relevanceScore: item.score,
    matchedKeywords: item.matchedKeywords,
  });
}
