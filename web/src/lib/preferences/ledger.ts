import type {
  Paper,
  PreferenceConcept,
  PreferenceConceptSource,
  PreferenceLedger,
  PreferenceLedgerEntry,
} from "@/types";
import type { RawItem } from "@/lib/sources/types";

const HALF_LIFE_DAYS = 60;
const MAX_CONCEPTS_PER_ITEM = 16;
const POSITIVE_BOOST_MAX = 0.18;
// Heavier than the original 0.45: a concept you've repeatedly rejected drops to
// ×0.40 of base, so persistent dislikes are genuinely suppressed. A single
// dislike stays gentle thanks to the saturating curve below. Tunable.
const NEGATIVE_PENALTY_MAX = 0.6;

type PreferenceSignalKind = "positive" | "negative";

interface ApplyPreferenceSignalOptions {
  at?: string;
  requiredTopics?: string[];
}

export interface PreferenceMatchScore {
  boost: number;
  penalty: number;
  matchedPositive: string[];
  matchedNegative: string[];
}

export type PreferenceDocumentFrequency = Map<string, number>;

function daysBetween(fromIso: string | undefined, toMs: number): number {
  if (!fromIso) return 0;
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, (toMs - from) / 86_400_000);
}

function decayFactor(fromIso: string | undefined, toMs: number): number {
  const days = daysBetween(fromIso, toMs);
  if (days <= 0) return 1;
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function normalizePreferenceLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bareOpenAlexId(value: string): string {
  return value.split("/").pop()?.toLowerCase() ?? value.toLowerCase();
}

// Canonicalization note: OpenAlex-sourced papers carry stable concept/topic IDs,
// so "LCO" and "LiCoO₂" papers that OpenAlex maps to the same concept merge by
// `source:id` key. Papers from arXiv/Semantic Scholar/PubMed have no such IDs and
// fall back to `text:<normalized label>`, so cross-source merging only happens
// when the surface labels match after normalization (see lookupLedgerEntries,
// which also matches on normalized label to bridge key/text entries).
export function preferenceKey(
  label: string,
  source: PreferenceConceptSource = "paper_keyword",
  id?: string,
): string {
  if (id && /^https?:\/\/openalex\.org\//i.test(id)) {
    return `${source}:${bareOpenAlexId(id)}`;
  }
  if (id && /^(?:(?:t|c|w)?\d+|[a-z0-9-]+)$/i.test(id.trim())) {
    return `${source}:${id.trim().toLowerCase()}`;
  }
  return `text:${normalizePreferenceLabel(label)}`;
}

export function normalizePreferenceConcepts(
  concepts: Array<Partial<PreferenceConcept> | null | undefined>,
): PreferenceConcept[] {
  const out: PreferenceConcept[] = [];
  const seen = new Set<string>();

  for (const rawConcept of concepts) {
    if (!rawConcept) continue;
    const label = rawConcept.label?.trim();
    if (!label) continue;
    const source = rawConcept.source ?? "paper_keyword";
    const key = rawConcept.key?.trim() || preferenceKey(label, source);
    const normalized: PreferenceConcept = {
      key,
      label,
      source,
      confidence:
        typeof rawConcept.confidence === "number"
          ? clamp01(rawConcept.confidence)
          : undefined,
    };
    if (seen.has(normalized.key)) continue;
    seen.add(normalized.key);
    out.push(normalized);
    if (out.length >= MAX_CONCEPTS_PER_ITEM) break;
  }

  return out;
}

function fallbackConceptsFromKeywords(keywords: string[]): PreferenceConcept[] {
  return normalizePreferenceConcepts(
    keywords.map((label) => ({
      key: preferenceKey(label, "paper_keyword"),
      label,
      source: "paper_keyword",
    })),
  );
}

export function conceptsFromPaper(paper: Paper): PreferenceConcept[] {
  const direct = normalizePreferenceConcepts(paper.preferenceSignals ?? []);
  if (direct.length > 0) return direct;
  return fallbackConceptsFromKeywords(paper.summaryExperimentKeywords ?? []);
}

export function conceptsFromRawItem(item: RawItem): PreferenceConcept[] {
  const direct = normalizePreferenceConcepts(item.metadata.preferenceSignals ?? []);
  if (direct.length > 0) return direct;
  return fallbackConceptsFromKeywords(item.tags ?? []);
}

function conceptMatchesRequired(
  concept: PreferenceConcept | PreferenceLedgerEntry,
  requiredTopics: string[] = [],
): boolean {
  const label = normalizePreferenceLabel(concept.label);
  if (!label) return false;
  return requiredTopics.some((topic) => {
    const required = normalizePreferenceLabel(topic);
    return Boolean(
      required &&
        (label === required ||
          label.includes(required) ||
          required.includes(label)),
    );
  });
}

function decayedEntry(
  entry: PreferenceLedgerEntry,
  nowIso: string,
  nowMs: number,
): PreferenceLedgerEntry {
  const factor = decayFactor(entry.lastSeenAt, nowMs);
  if (factor === 1) return { ...entry, lastSeenAt: nowIso };
  return {
    ...entry,
    positive: entry.positive * factor,
    negative: entry.negative * factor,
    lastSeenAt: nowIso,
  };
}

export function cleanPreferenceLedger(
  input: PreferenceLedger | null | undefined,
): PreferenceLedger {
  if (!input || typeof input !== "object") return {};
  const out: PreferenceLedger = {};

  for (const [key, raw] of Object.entries(input)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Partial<PreferenceLedgerEntry>;
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (!label) continue;
    const source = entry.source ?? "paper_keyword";
    const normalizedKey =
      typeof entry.key === "string" && entry.key.trim()
        ? entry.key.trim()
        : key || preferenceKey(label, source);
    out[normalizedKey] = {
      key: normalizedKey,
      label,
      source,
      confidence:
        typeof entry.confidence === "number"
          ? clamp01(entry.confidence)
          : undefined,
      positive:
        typeof entry.positive === "number" && Number.isFinite(entry.positive)
          ? Math.max(0, entry.positive)
          : 0,
      negative:
        typeof entry.negative === "number" && Number.isFinite(entry.negative)
          ? Math.max(0, entry.negative)
          : 0,
      lastPositiveAt:
        typeof entry.lastPositiveAt === "string"
          ? entry.lastPositiveAt
          : undefined,
      lastNegativeAt:
        typeof entry.lastNegativeAt === "string"
          ? entry.lastNegativeAt
          : undefined,
      lastSeenAt:
        typeof entry.lastSeenAt === "string"
          ? entry.lastSeenAt
          : new Date().toISOString(),
    };
  }

  return out;
}

export function applyPreferenceSignal(
  ledger: PreferenceLedger | undefined,
  concepts: PreferenceConcept[],
  signal: PreferenceSignalKind,
  options: ApplyPreferenceSignalOptions = {},
): PreferenceLedger {
  const nowIso = options.at ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const clean = cleanPreferenceLedger(ledger);
  const next: PreferenceLedger = { ...clean };

  for (const concept of normalizePreferenceConcepts(concepts)) {
    if (signal === "negative" && conceptMatchesRequired(concept, options.requiredTopics)) {
      continue;
    }
    const current = next[concept.key];
    const base: PreferenceLedgerEntry = current
      ? decayedEntry(current, nowIso, safeNowMs)
      : {
          ...concept,
          positive: 0,
          negative: 0,
          lastSeenAt: nowIso,
        };

    next[concept.key] =
      signal === "positive"
        ? {
            ...base,
            ...concept,
            positive: base.positive + 1,
            lastPositiveAt: nowIso,
            lastSeenAt: nowIso,
          }
        : {
            ...base,
            ...concept,
            negative: base.negative + 1,
            lastNegativeAt: nowIso,
            lastSeenAt: nowIso,
          };
  }

  return next;
}

function conceptFrequencyKeys(concept: PreferenceConcept): string[] {
  return [concept.key, `label:${normalizePreferenceLabel(concept.label)}`];
}

export function buildPreferenceDocumentFrequency(
  items: RawItem[],
): PreferenceDocumentFrequency {
  const frequencies: PreferenceDocumentFrequency = new Map();
  for (const item of items) {
    const itemKeys = new Set<string>();
    for (const concept of conceptsFromRawItem(item)) {
      for (const key of conceptFrequencyKeys(concept)) itemKeys.add(key);
    }
    for (const key of itemKeys) {
      frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    }
  }
  return frequencies;
}

export interface PreparedLedger {
  byKey: PreferenceLedger;
  byLabel: Map<string, PreferenceLedgerEntry[]>;
  size: number;
}

/**
 * Clean + index a ledger ONCE so the per-item scorer does O(1) key/label lookups
 * instead of cleaning the whole ledger and scanning every entry for every concept
 * of every candidate paper (which was O(items × concepts × ledger)).
 */
export function prepareLedger(
  ledger: PreferenceLedger | null | undefined,
): PreparedLedger {
  const clean = cleanPreferenceLedger(ledger);
  const byLabel = new Map<string, PreferenceLedgerEntry[]>();
  for (const entry of Object.values(clean)) {
    const label = normalizePreferenceLabel(entry.label);
    if (!label) continue;
    const bucket = byLabel.get(label);
    if (bucket) bucket.push(entry);
    else byLabel.set(label, [entry]);
  }
  return { byKey: clean, byLabel, size: Object.keys(clean).length };
}

function lookupLedgerEntries(
  prepared: PreparedLedger,
  concept: PreferenceConcept,
): PreferenceLedgerEntry[] {
  const exact = prepared.byKey[concept.key];
  const matches: PreferenceLedgerEntry[] = exact ? [exact] : [];
  // Also match by normalized label so a text-keyed entry and an OpenAlex-keyed
  // entry for the same concept name bridge across sources.
  const labelMatches = prepared.byLabel.get(normalizePreferenceLabel(concept.label));
  if (labelMatches) {
    for (const entry of labelMatches) {
      if (exact && entry.key === exact.key) continue;
      matches.push(entry);
    }
  }
  return matches;
}

function distinctiveness(
  concept: PreferenceConcept,
  documentFrequency: PreferenceDocumentFrequency | undefined,
  corpusSize: number,
): number {
  if (!documentFrequency || corpusSize <= 1) return 0.75;
  const keys = conceptFrequencyKeys(concept);
  const df = Math.max(...keys.map((key) => documentFrequency.get(key) ?? 0), 1);
  const rawIdf = Math.log((corpusSize + 1) / (df + 1)) / Math.log(corpusSize + 1);
  return 0.35 + 0.65 * clamp01(rawIdf);
}

function decayedCounts(
  entry: PreferenceLedgerEntry,
  nowMs: number,
): { positive: number; negative: number } {
  const factor = decayFactor(entry.lastSeenAt, nowMs);
  return {
    positive: entry.positive * factor,
    negative: entry.negative * factor,
  };
}

export function scorePreferenceMatch(
  item: RawItem,
  prepared: PreparedLedger | undefined,
  requiredTopics: string[] = [],
  options: {
    now?: number;
    documentFrequency?: PreferenceDocumentFrequency;
    corpusSize?: number;
  } = {},
): PreferenceMatchScore {
  if (!prepared || prepared.size === 0) {
    return { boost: 0, penalty: 1, matchedPositive: [], matchedNegative: [] };
  }

  const now = options.now ?? Date.now();
  let boost = 0;
  let penaltyLoss = 0;
  const matchedPositive = new Set<string>();
  const matchedNegative = new Set<string>();

  for (const concept of conceptsFromRawItem(item)) {
    const entries = lookupLedgerEntries(prepared, concept);
    if (entries.length === 0) continue;
    const specificity = distinctiveness(
      concept,
      options.documentFrequency,
      options.corpusSize ?? 0,
    );

    for (const entry of entries) {
      const { positive, negative } = decayedCounts(entry, now);
      const net = positive - negative;
      if (net > 0.05) {
        const magnitude = 1 - Math.exp(-net / 2);
        boost += POSITIVE_BOOST_MAX * magnitude * specificity;
        matchedPositive.add(entry.label);
      } else if (net < -0.05 && !conceptMatchesRequired(concept, requiredTopics)) {
        const magnitude = 1 - Math.exp(-Math.abs(net) / 2);
        penaltyLoss += NEGATIVE_PENALTY_MAX * magnitude * specificity;
        matchedNegative.add(entry.label);
      }
    }
  }

  return {
    boost: Math.min(POSITIVE_BOOST_MAX, boost),
    penalty: Math.max(1 - NEGATIVE_PENALTY_MAX, 1 - Math.min(NEGATIVE_PENALTY_MAX, penaltyLoss)),
    matchedPositive: Array.from(matchedPositive),
    matchedNegative: Array.from(matchedNegative),
  };
}

export function feedbackSnapshotForPaper(paper: Paper) {
  return {
    title: paper.title,
    concepts: conceptsFromPaper(paper),
  };
}

export interface LedgerSummaryRow {
  label: string;
  /** Decayed net strength (always positive in its list). */
  weight: number;
}

/**
 * Human-facing summary of what the ledger has learned, for the profile screen.
 * Aggregates entries by normalized label (so duplicate surface forms collapse),
 * applies time decay, and splits into "leaning toward" vs "easing off".
 */
export function summarizePreferenceLedger(
  ledger: PreferenceLedger | null | undefined,
  now: number = Date.now(),
  limit = 6,
): { liked: LedgerSummaryRow[]; disliked: LedgerSummaryRow[] } {
  const clean = cleanPreferenceLedger(ledger);
  const byLabel = new Map<string, { label: string; net: number }>();
  for (const entry of Object.values(clean)) {
    const key = normalizePreferenceLabel(entry.label);
    if (!key) continue;
    const { positive, negative } = decayedCounts(entry, now);
    const net = positive - negative;
    const prev = byLabel.get(key);
    if (prev) prev.net += net;
    else byLabel.set(key, { label: entry.label, net });
  }
  const rows = Array.from(byLabel.values());
  const liked = rows
    .filter((r) => r.net > 0.05)
    .sort((a, b) => b.net - a.net)
    .slice(0, limit)
    .map((r) => ({ label: r.label, weight: r.net }));
  const disliked = rows
    .filter((r) => r.net < -0.05)
    .sort((a, b) => a.net - b.net)
    .slice(0, limit)
    .map((r) => ({ label: r.label, weight: -r.net }));
  return { liked, disliked };
}
