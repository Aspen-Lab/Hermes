"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { Paper } from "@/types";

interface DailyDigestProps {
  /** Papers in the order they appear in the feed. Citation [n] in the
   *  digest paragraph maps to the n-th paper (1-indexed). */
  papers: Paper[];
  /** User's current project + challenges, concatenated. Sent to the LLM
   *  as context so the digest speaks to their actual work. */
  contextHint?: string;
}

interface DigestPayload {
  bullets: { paperId: string; text: string }[];
  perPaper: Record<string, {
    headlineFinding?: string;
    keyNumbers?: { value: string; label: string }[];
  }>;
  noLlm?: boolean;
}

interface DigestCache {
  paperKey: string;
  payload: DigestPayload;
  fetchedAt: number;
}

const CACHE_KEY = "hermes-digest-cache";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function readCache(paperKey: string): DigestPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as DigestCache;
    if (entry.paperKey !== paperKey) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    // Invalidate caches that used the old paragraph format.
    if (!Array.isArray(entry.payload.bullets)) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

function writeCache(paperKey: string, payload: DigestPayload) {
  try {
    const entry: DigestCache = { paperKey, payload, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
}

/**
 * The daily one-paragraph briefing. Sits above the card grid on the
 * Discovery page. Hidden entirely when no LLM is configured (the API
 * returns `noLlm: true`) so the rest of the app keeps working without
 * an Anthropic API key.
 *
 * The result is cached in localStorage (12-hour TTL). On page refresh
 * the cached paragraph is shown immediately without a new LLM call.
 * The user can click "Regenerate" to force a fresh generation.
 */
export function DailyDigest({ papers, contextHint }: DailyDigestProps) {
  const [data, setData] = useState<DigestPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const paperKey = useMemo(() => papers.map((p) => p.id).join("|"), [papers]);

  const fetchDigest = useCallback(async (key: string, force = false) => {
    if (papers.length === 0) { setData(null); return; }

    if (!force) {
      const cached = readCache(key);
      if (cached) { setData(cached); return; }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          papers: papers.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            venue: p.venue,
            abstract: p.summaryIntro,
          })),
          contextHint,
        }),
      });
      if (!res.ok) { setData(null); return; }
      const json = (await res.json()) as DigestPayload;
      setData(json);
      if (json.bullets?.length && !json.noLlm) writeCache(key, json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [papers, contextHint]);

  useEffect(() => {
    fetchDigest(paperKey);
  }, [fetchDigest, paperKey]);

  const handleRegenerate = () => {
    clearCache();
    fetchDigest(paperKey, true);
  };

  if (!data || data.noLlm || !data.bullets?.length) {
    if (loading) return <DigestSkeleton />;
    return null;
  }

  return (
    <section
      className="mb-8 rounded-2xl bg-surface shadow-card px-7 py-6 animate-fade-in-up"
      style={{ fontFamily: "var(--font-sans)" }}
      aria-label="Daily briefing digest"
    >
      <header className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent/90">
          <span className="inline-block w-3.5 h-[1.5px] bg-accent/70" />
          Today&rsquo;s highlights
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            title="Regenerate digest"
            className="group inline-flex items-center gap-1.5 h-7 pl-2 pr-3 rounded-full bg-bg-secondary/60 text-text-faint hover:text-heading hover:bg-bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-300"}
              aria-hidden
            >
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span className="text-[11.5px] font-medium">Regenerate</span>
          </button>
          <AudioButton />
        </div>
      </header>

      <ol className="space-y-3 list-none m-0 p-0">
        {data.bullets.map((bullet, i) => {
          const paper = papers.find((p) => p.id === bullet.paperId);
          const scrollTo = (e: React.MouseEvent) => {
            e.preventDefault();
            const el = document.getElementById(`paper-${bullet.paperId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-2", "ring-accent/40");
              setTimeout(() => el.classList.remove("ring-2", "ring-accent/40"), 1500);
            }
          };
          return (
            <li key={bullet.paperId} className="flex items-start gap-3">
              <a
                href={`#paper-${bullet.paperId}`}
                onClick={scrollTo}
                title={paper?.title ?? "Jump to paper"}
                className="flex-shrink-0 mt-[3px] w-[22px] h-[22px] rounded-full bg-accent/15 text-accent text-[11px] font-semibold flex items-center justify-center hover:bg-accent hover:text-bg transition-colors no-underline"
              >
                {i + 1}
              </a>
              <p
                className="text-[15.5px] lg:text-[16.5px] text-heading leading-[1.65]"
                style={{ fontFamily: "var(--font-reading)" }}
              >
                {bullet.text}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}


function AudioButton() {
  return (
    <button
      type="button"
      disabled
      title="Audio briefing — coming soon"
      className="group inline-flex items-center gap-1.5 h-7 pl-2 pr-3 rounded-full bg-bg-secondary/60 text-text-faint cursor-not-allowed transition-all"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      <span className="text-[11.5px] font-medium">Listen</span>
      <span className="text-[9.5px] opacity-70 uppercase tracking-[0.1em] ml-0.5">
        soon
      </span>
    </button>
  );
}

function DigestSkeleton() {
  return (
    <section
      className="mb-8 rounded-2xl bg-surface shadow-card px-7 py-6"
      aria-busy="true"
    >
      <div className="h-3 w-32 bg-bg-secondary/70 rounded mb-4 animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-bg-secondary/70 rounded animate-pulse" />
        <div className="h-4 w-[95%] bg-bg-secondary/70 rounded animate-pulse" />
        <div className="h-4 w-[88%] bg-bg-secondary/70 rounded animate-pulse" />
        <div className="h-4 w-[60%] bg-bg-secondary/70 rounded animate-pulse" />
      </div>
    </section>
  );
}
