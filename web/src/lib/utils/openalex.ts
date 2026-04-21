import type { RawItem } from "@/lib/sources/types";

export function reconstructAbstract(
  index: Record<string, number[]> | null | undefined,
): string {
  if (!index) return "";
  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words.push([pos, word]);
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map(([, w]) => w).join(" ");
}

export function normalizeOpenAlexId(openalexId: string): string {
  return "openalex:" + openalexId.split("/").pop();
}

interface OpenAlexAuthorship {
  author_position?: string;
  author: { display_name: string };
}

interface OpenAlexConcept {
  display_name: string;
  level: number;
}

export interface OpenAlexWork {
  id: string;
  title: string | null;
  publication_date: string | null;
  authorships: OpenAlexAuthorship[];
  primary_location: {
    source?: { display_name: string } | null;
  } | null;
  abstract_inverted_index: Record<string, number[]> | null;
  cited_by_count: number;
  doi: string | null;
  concepts?: OpenAlexConcept[];
}

export function openAlexWorkToRawItem(w: OpenAlexWork): RawItem {
  const abstract = reconstructAbstract(w.abstract_inverted_index);
  const doi = w.doi ?? undefined;
  const tags = (w.concepts ?? [])
    .filter((c) => c.level >= 1 && c.level <= 3)
    .map((c) => c.display_name);
  return {
    id: normalizeOpenAlexId(w.id),
    source: "openalex",
    title: w.title || "",
    authors: (w.authorships ?? [])
      .map((a) => a.author?.display_name)
      .filter((n): n is string => Boolean(n)),
    abstract: abstract || undefined,
    url: doi
      ? `https://doi.org/${doi.replace("https://doi.org/", "")}`
      : w.id,
    publishedAt: w.publication_date || "",
    venue: w.primary_location?.source?.display_name,
    tags: tags.length > 0 ? tags : undefined,
    metadata: {
      citationCount: w.cited_by_count,
      doi,
    },
  };
}
