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

export function scoredItemToPaper(item: ScoredItem): Paper {
  const keywords = Array.from(
    new Set([...(item.matchedKeywords ?? []), ...(item.tags ?? [])]),
  ).slice(0, 6);
  const isArxiv = item.source === "arxiv";
  return {
    id: item.id,
    title: item.title,
    authors: item.authors,
    relevanceReason: item.relevanceReason,
    venue: item.venue || fallbackVenue(item.source),
    source: mapSource(item.source, item.venue),
    summaryIntro: truncate(item.abstract, 400),
    summaryExperimentKeywords: keywords,
    summaryResultDiscussion: "",
    linkPaper: item.url,
    linkArxiv: isArxiv ? item.url : undefined,
    publishedDate: item.publishedAt || undefined,
    isSaved: false,
    relevanceScore: item.score,
  };
}
