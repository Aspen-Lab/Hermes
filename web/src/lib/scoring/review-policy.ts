import type { RawItem } from "@/lib/sources/types";

const REVIEW_PATTERNS = [
  /\breview\b/i,
  /\bsurvey\b/i,
  /\boverview\b/i,
  /\btutorial\b/i,
  /\bperspective\b/i,
  /\broadmap\b/i,
  /\bmeta-analysis\b/i,
  /\bminireview\b/i,
  /\bliterature review\b/i,
  /\bsystematic review\b/i,
  /\bstate[- ]of[- ]the[- ]art\b/i,
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "using",
  "with",
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+\-/.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function seedOverlapScore(item: RawItem, seedText: string): number {
  const seedTokens = Array.from(new Set(tokenize(seedText)));
  if (seedTokens.length === 0) return 0;

  const itemText = [
    item.title,
    item.abstract,
    item.venue,
    ...(item.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const itemTokens = new Set(tokenize(itemText));
  const overlap = seedTokens.filter((token) => itemTokens.has(token));

  const overlapRatio = overlap.length / seedTokens.length;
  const strongOverlap = overlap.filter((token) => token.length >= 5).length;
  const exactPhrase =
    seedText.trim().length >= 18 &&
    normalizeText(itemText).includes(normalizeText(seedText));

  if (exactPhrase) return 1;
  if (overlap.length >= 3 && strongOverlap >= 1) return Math.max(0.75, overlapRatio);
  if (overlap.length >= 2 && strongOverlap >= 2) return Math.max(0.55, overlapRatio);
  if (overlap.length >= 2 && overlapRatio >= 0.3) return 0.45;
  if (overlap.length >= 1 && overlapRatio >= 0.5 && strongOverlap >= 1) return 0.35;
  return overlapRatio;
}

export function isReviewLike(item: RawItem): boolean {
  const workType = item.metadata.workType?.toLowerCase();
  if (workType && workType.includes("review")) return true;

  const haystack = [item.title, item.abstract, ...(item.tags ?? [])]
    .filter(Boolean)
    .join(" ");
  return REVIEW_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function isDirectProjectOrChallengeMatch(
  item: RawItem,
  seedTexts?: string[],
): boolean {
  const normalizedSeeds = (seedTexts ?? [])
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  if (normalizedSeeds.length === 0) return false;

  return normalizedSeeds.some((seedText) => seedOverlapScore(item, seedText) >= 0.45);
}

export function shouldPushReviewPaper(
  item: RawItem,
  seedTexts?: string[],
): boolean {
  if (!isReviewLike(item)) return true;
  return isDirectProjectOrChallengeMatch(item, seedTexts);
}
