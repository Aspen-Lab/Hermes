// Shared plumbing for the jobs & events pipelines. These mirror the paper
// pipeline's conventions (8s per-source wall, RawItem scoring facade) without
// importing from lib/feed, so the three surfaces stay parallel implementations.

import { isGenericTerm } from "@/lib/scoring/term-expand";
import type { RawItem } from "@/lib/sources/types";
import type { PreferenceConcept } from "@/types";

/**
 * Hard wall on a single source's fetch — same contract as the paper
 * pipeline's guard: one slow source never drags Promise.allSettled past 8s.
 */
export async function withSourceTimeout<T>(
  sourceId: string,
  promise: Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[${sourceId}] source-timeout after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Stable, slash-free id suffix derived from a URL. Web-discovered items key on
 * their source URL, but embedding the raw URL in an id (`eventweb:https://…`)
 * breaks the single-segment `/events/[id]` route — the slashes make it a 404.
 * A short hash keeps ids unique and route-safe; the real URL lives in the
 * item's `url` field for outbound links. Deterministic (no Date/Math.random)
 * so the same posting dedups to the same id across fetches.
 */
export function urlHashId(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Make an id suffix safe for the single-segment `/events/[id]` and
 * `/jobs/[id]` routes. Any slash (or other route-breaking char) in an id
 * turns the detail page into a 404, so EVERY adapter must run its raw id
 * through this. URLs collapse to a stable hash; everything else keeps a
 * readable, deterministic slug. The result is used as the item's id
 * everywhere (dedup, scoring, dismissals, routing), so it must be stable for
 * the same input across fetches — no Date/Math.random.
 */
export function routeSafeId(raw: string): string {
  if (raw.includes("://")) return urlHashId(raw);
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || urlHashId(raw);
}

/** Strip HTML tags/entities from source-provided rich text (job descriptions). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// Generous default: the Tier-0 keyword gate runs over this text, and "machine
// learning" often first appears deep in a posting's requirements section.
export function truncateText(text: string, maxChars = 2400): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).replace(/\s+\S*$/, "")}…`;
}

/**
 * Facade so job/event candidates can flow through the existing scoring
 * primitives (scoreKeyword, TF-IDF index, scorePreferenceMatch), which all
 * take the paper pipeline's RawItem shape. `source` is a nominal placeholder
 * — the jobs/events scorers never use RawItem.source.
 */
export function toScoringItem(input: {
  id: string;
  title: string;
  text: string;
  summary?: string;
  tags: string[];
  publishedAt?: string;
  url?: string;
  preferenceSignals?: PreferenceConcept[];
}): RawItem {
  const metadata: RawItem["metadata"] & { gateText?: string } = {
    preferenceSignals: input.preferenceSignals,
    gateText: input.summary,
  };
  return {
    id: input.id,
    source: "web",
    title: input.title,
    authors: [],
    abstract: input.text,
    url: input.url ?? "",
    publishedAt: input.publishedAt ?? "",
    tags: input.tags,
    metadata,
  };
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REMOTE_PREF_RE = /\b(remote|anywhere|online)\b/i;

/**
 * 0–1 fit between an item's location and the user's location preferences.
 * Neutral (1) when the user has no preferences; remote items are always a
 * decent match; otherwise substring match against each preference.
 */
export function locationFit(
  itemLocation: string,
  isRemote: boolean,
  preferences: string[],
): number {
  const prefs = preferences.map(normalizeLoose).filter(Boolean);
  if (prefs.length === 0) return 1;
  if (isRemote && prefs.some((p) => REMOTE_PREF_RE.test(p))) return 1;
  const location = normalizeLoose(itemLocation);
  if (location) {
    for (const pref of prefs) {
      if (location.includes(pref) || pref.includes(location)) return 1;
    }
  }
  if (isRemote) return 0.85;
  return 0.4;
}

/**
 * Shared relevance gate for the events and jobs scorers.
 *
 * A candidate is relevant enough to rank when it either names a *specific*
 * required topic where it counts (title + short summary), or corroborates a
 * weaker signal by matching two distinct required topics anywhere.
 *
 * The generic-term rule is the important part: a lone match on a word like
 * "materials" or "energy" never opens the gate, because those words appear in
 * unrelated postings constantly ("marketing materials", "training materials",
 * "energy drinks"). Such a term still contributes to ranking via
 * `termSpecificity` — it just cannot be the sole reason an item is shown.
 */
export function passesRequiredGate(
  requiredTopics: string[],
  scoped: { matched: string[] },
  anywhere: { matched: string[] },
): boolean {
  if (requiredTopics.length === 0) return true;

  const specificScoped = scoped.matched.filter((t) => !isGenericTerm(t));
  if (specificScoped.length >= 1) return true;

  const distinctAnywhere = new Set(
    anywhere.matched.map((t) => t.toLocaleLowerCase()),
  );
  if (distinctAnywhere.size >= 2) return true;

  // Only generic matches, and only one of them — not enough to prove relevance.
  return false;
}

/** Case-insensitive containment against a list of phrases. */
export function textMatchesAny(haystack: string, phrases: string[]): boolean {
  const lower = haystack.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}
