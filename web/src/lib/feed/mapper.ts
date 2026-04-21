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

function splitAbstractForBriefing(abstract: string | undefined): {
  intro: string;
  discussion: string;
} {
  if (!abstract) return { intro: "", discussion: "" };
  // First 1-2 sentences as intro, rest as discussion.
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
  const { intro, discussion } = splitAbstractForBriefing(item.abstract);
  const keywords = Array.from(
    new Set([...(options.matchedKeywords ?? []), ...(item.tags ?? [])]),
  ).slice(0, 6);
  const isArxiv = item.source === "arxiv";
  const introText = intro || truncate(item.abstract, 400);
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
