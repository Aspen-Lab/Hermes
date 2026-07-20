"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Paper } from "@/types";
import { useFeedStore } from "@/store/feed";
import { useProfileStore } from "@/store/profile";
import { PaperThinkingSurface } from "@/components/papers/paper-thinking-surface";
import { apiFetch } from "@/lib/api";

export default function PaperSurfacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = useMemo(() => {
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }, [rawId]);
  const isExternalId =
    id.startsWith("openalex:") || id.startsWith("arxiv:");

  const feedPapers = useFeedStore((s) => s.papers);
  const savedPapers = useFeedStore((s) => s.savedPapers);
  const markRead = useFeedStore((s) => s.markRead);
  const { savePaper, notInterestedPaper, moreLikePaper } = useFeedStore();
  const profile = useProfileStore((s) => s.profile);

  const [fetchResult, setFetchResult] = useState<{
    id: string;
    paper: Paper | null;
    done: boolean;
  }>(() => ({ id, paper: null, done: false }));

  const storePaper =
    feedPapers.find((p) => p.id === id) ?? savedPapers.find((p) => p.id === id);
  const storePaperIsEnriched = !!storePaper?.summaryIntro?.trim();
  const fetchedPaperForId = fetchResult.id === id ? fetchResult.paper : null;
  const fetchDoneForId = fetchResult.id === id && fetchResult.done;
  const paper = storePaperIsEnriched
    ? storePaper
    : (fetchedPaperForId ?? storePaper ?? undefined);
  const shouldFetchById = isExternalId && !storePaperIsEnriched && !fetchDoneForId;

  useEffect(() => {
    if (!shouldFetchById) return;
    let cancelled = false;
    apiFetch<Paper>(`/api/papers/${encodeURIComponent(id)}`)
      .then((nextPaper) => {
        if (!cancelled) setFetchResult({ id, paper: nextPaper, done: true });
      })
      .catch(() => {
        if (!cancelled) setFetchResult({ id, paper: null, done: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, shouldFetchById]);

  useEffect(() => {
    if (paper) markRead(paper.id);
  }, [paper, markRead]);

  if (!paper && shouldFetchById) {
    return (
      <div className="min-h-screen bg-[#08080a] text-white">
        <article className="mx-auto max-w-[760px] px-6 py-16">
          <Link href="/" className="text-[13px] text-white/40 hover:text-white">
            Back
          </Link>
          <div className="mt-10 space-y-3" aria-busy="true">
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="h-12 w-full max-w-[620px] rounded bg-white/10" />
            <div className="h-4 w-72 rounded bg-white/10" />
          </div>
        </article>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-[#08080a] text-white">
        <article className="mx-auto max-w-[720px] px-6 py-20">
          <p className="text-white/60 italic">Paper not found.</p>
          <Link href="/" className="mt-3 inline-block text-[14px] text-white/80 hover:text-white">
            Back to feed
          </Link>
        </article>
      </div>
    );
  }

  const savedPaper = savedPapers.find((p) => p.id === paper.id);
  const isSaved = Boolean(savedPaper ?? paper.isSaved);
  const hydratedPaper: Paper = {
    ...paper,
    ...(savedPaper ? { feedback: savedPaper.feedback } : {}),
    isSaved,
  };
  const isLiked =
    hydratedPaper.feedback === "moreLikeThis" || hydratedPaper.feedback === "liked";

  const handleDismiss = () => {
    notInterestedPaper(hydratedPaper);
    window.history.back();
  };

  return (
    <PaperThinkingSurface
      paper={hydratedPaper}
      profile={profile}
      isSaved={isSaved}
      isLiked={isLiked}
      onSave={() => savePaper(hydratedPaper)}
      onLike={() => moreLikePaper(hydratedPaper)}
      onDismiss={handleDismiss}
    />
  );
}
