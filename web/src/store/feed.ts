"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Paper, Event, Job, ItemFeedback, UserProfile } from "@/types";
// Mock fixtures kept for use in unit tests / Storybook only — never wired
// into the live feed. Pre-2026-04-28 the store used `mockPapers` as a
// fallback when the real API returned 0 results, which silently surfaced
// battery-research demo data as the user's feed. Removed.
import { useProfileStore } from "@/store/profile";
import { scoredItemToPaper } from "@/lib/feed/mapper";
import type { FeedResponse } from "@/lib/feed/types";

// ── Cloud-sync helpers (fire-and-forget) ────────────────────────
// All writes are optimistic: local state already changed before we call
// these. Failures are logged but never block the UI.

type ItemKind = "paper" | "event" | "job";

async function cloudSave(itemId: string, itemKind: ItemKind, payload: unknown) {
  try {
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, itemKind, payload }),
    });
  } catch (err) {
    console.warn("[feed] cloudSave failed", err);
  }
}

async function cloudUnsave(itemId: string) {
  try {
    await fetch(`/api/saved?itemId=${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("[feed] cloudUnsave failed", err);
  }
}

async function cloudMarkRead(itemId: string) {
  try {
    await fetch("/api/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
  } catch (err) {
    console.warn("[feed] cloudMarkRead failed", err);
  }
}

async function cloudMarkUnread(itemId: string) {
  try {
    await fetch(`/api/read?itemId=${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("[feed] cloudMarkUnread failed", err);
  }
}

async function cloudFeedback(
  itemId: string,
  itemKind: ItemKind,
  feedback: ItemFeedback,
) {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, itemKind, feedback }),
    });
  } catch (err) {
    console.warn("[feed] cloudFeedback failed", err);
  }
}

async function fetchRealFeed(
  profile: UserProfile,
  savedPapers: Paper[] = [],
  aiPaperSearchEnabled = true,
): Promise<Paper[]> {
  const topics = (profile.researchTopics ?? []).filter(Boolean);
  if (topics.length === 0) return [];
  // Promote project description + open challenges into seedTexts. These get
  // concatenated into the TF-IDF profile string, so papers that mention the
  // user's specific work or the challenges they're hunting bias up the rank.
  const savedSignals = savedPapers.slice(0, 8).map((paper) =>
    [
      paper.title,
      paper.summaryIntro,
      paper.summaryExperimentKeywords.join(" "),
    ].filter(Boolean).join(" "),
  );
  const seedTexts = [
    profile.currentProject,
    profile.currentChallenges,
    ...savedSignals,
  ].filter((s): s is string => Boolean(s && s.trim().length > 0));
  const negativeTopics = (profile.dislikedTopics ?? []).filter((s) => s.trim().length > 0);
  const softTopics = (profile.softTopics ?? []).filter(Boolean);
  const tavilyApiKey = profile.tavilyApiKey?.trim();
  const feedAiApiKey = profile.feedAiApiKey?.trim();
  const hasUserLlmOverride =
    aiPaperSearchEnabled &&
    profile.feedAiProvider !== "default" &&
    Boolean(feedAiApiKey);
  try {
    const res = await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topics,
        softTopics: softTopics.length > 0 ? softTopics : undefined,
        methods: profile.preferredMethods,
        venues: profile.preferredVenues,
        seedTexts: seedTexts.length > 0 ? seedTexts : undefined,
        negativeTopics: negativeTopics.length > 0 ? negativeTopics : undefined,
        topN: profile.paperCount,
        aiTier: aiPaperSearchEnabled
          ? (hasUserLlmOverride ? 2 : undefined)
          : 0,
        searchConnectors: profile.tavilyEnabled
          ? {
              tavily: {
                enabled: true,
                apiKey: tavilyApiKey || undefined,
              },
            }
          : undefined,
        llmOverride: hasUserLlmOverride
          ? {
              provider: profile.feedAiProvider,
              apiKey: feedAiApiKey,
            }
          : undefined,
        controls: {
          focus: profile.feedFocus,
          freshness: profile.feedFreshness,
          paperCount: profile.paperCount,
          sourceMix: profile.feedSourceMix,
          importance: profile.feedImportance,
          methodMode: profile.feedMethodMode,
          discoveryMode: profile.feedDiscoveryMode,
          avoidReviews: profile.feedAvoidReviews,
          avoidOldPapers: profile.feedAvoidOldPapers,
          avoidBroadSurveys: profile.feedAvoidBroadSurveys,
        },
      }),
    });
    if (!res.ok) {
      console.error("[feed] /api/feed returned", res.status);
      return [];
    }
    const data = (await res.json()) as FeedResponse;
    return data.items.map(scoredItemToPaper);
  } catch (err) {
    console.error("[feed] fetch failed:", err);
    return [];
  }
}

type DismissalKind = "paper" | "event" | "job";

interface PendingDismissal {
  id: string;
  kind: DismissalKind;
  item: Paper | Event | Job;
  expiresAt: number;
}

interface FeedState {
  papers: Paper[];
  events: Event[];
  jobs: Job[];
  savedPapers: Paper[];
  savedEvents: Event[];
  savedJobs: Job[];
  isLoading: boolean;
  lastRefresh: string | null;
  aiPaperSearchEnabled: boolean;
  readItems: Record<string, true>;
  pendingDismissal: PendingDismissal | null;

  loadFeed: () => Promise<void>;
  setAiPaperSearchEnabled: (enabled: boolean) => Promise<void>;
  savePaper: (paper: Paper) => void;
  notInterestedPaper: (paper: Paper) => void;
  moreLikePaper: (paper: Paper) => void;
  saveEvent: (event: Event) => void;
  notInterestedEvent: (event: Event) => void;
  saveJob: (job: Job) => void;
  notInterestedJob: (job: Job) => void;
  unsavePaper: (id: string) => void;
  unsaveEvent: (id: string) => void;
  unsaveJob: (id: string) => void;
  submitFeedback: (itemId: string, type: string, feedback: ItemFeedback) => void;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  undoDismiss: () => void;
  commitDismiss: () => void;
  /**
   * Replace saved lists and readItems with a server snapshot. Called by
   * FeedSync on login. Local-only changes that haven't been flushed yet
   * are merged in (see FeedSync for the merge pass).
   */
  hydrateFromRemote: (remote: {
    savedPapers?: Paper[];
    savedEvents?: Event[];
    savedJobs?: Job[];
    readItems?: Record<string, true>;
  }) => void;
  /** Reset local state — called on sign-out so the next user starts clean. */
  resetLocal: () => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      papers: [],
      events: [],
      jobs: [],
      savedPapers: [],
      savedEvents: [],
      savedJobs: [],
      isLoading: false,
      lastRefresh: null,
      aiPaperSearchEnabled: true,
      readItems: {},
      pendingDismissal: null,

      loadFeed: async () => {
        set({ isLoading: true });
        const { savedPapers } = get();
        const savedIds = new Set(savedPapers.map((p) => p.id));
        const aiPaperSearchEnabled = get().aiPaperSearchEnabled;
        const profile = useProfileStore.getState().profile;

        const realPapers = await fetchRealFeed(
          profile,
          savedPapers,
          aiPaperSearchEnabled,
        );
        const papers = realPapers.map((p) =>
          savedIds.has(p.id)
            ? { ...p, isSaved: true, feedback: "saved" as ItemFeedback }
            : p,
        );
        set({
          papers,
          // No real Events / Jobs adapters yet — empty arrays beat
          // mock fixtures masquerading as user data.
          events: [],
          jobs: [],
          isLoading: false,
          lastRefresh: new Date().toISOString(),
        });
      },

      setAiPaperSearchEnabled: async (enabled) => {
        set({ aiPaperSearchEnabled: enabled });
        await get().loadFeed();
      },

      savePaper: (paper) => {
        const saved = { ...paper, isSaved: true, feedback: "saved" as ItemFeedback };
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id === paper.id ? saved : p
          ),
          savedPapers: s.savedPapers.some((p) => p.id === paper.id)
            ? s.savedPapers.map((p) => (p.id === paper.id ? saved : p))
            : [saved, ...s.savedPapers],
        }));
        cloudSave(paper.id, "paper", saved);
        get().submitFeedback(paper.id, "paper", "saved");
      },

      notInterestedPaper: (paper) => {
        // Persist disliked keywords to profile for long-term negative signal.
        if (paper.summaryExperimentKeywords.length > 0) {
          useProfileStore.getState().addDislikedTopics(paper.summaryExperimentKeywords);
        }

        // Commit any previous pending dismissal before starting a new one.
        const prev = get().pendingDismissal;
        if (prev) get().commitDismiss();

        set((s) => ({
          papers: s.papers.filter((p) => p.id !== paper.id),
          savedPapers: s.savedPapers.filter((p) => p.id !== paper.id),
          pendingDismissal: {
            id: paper.id,
            kind: "paper",
            item: paper,
            expiresAt: Date.now() + 4000,
          },
        }));
      },

      moreLikePaper: (paper) => {
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id === paper.id ? { ...p, feedback: "moreLikeThis" as ItemFeedback } : p
          ),
        }));
        get().submitFeedback(paper.id, "paper", "moreLikeThis");
      },

      saveEvent: (event) => {
        set((s) => ({
          savedEvents: s.savedEvents.some((e) => e.id === event.id)
            ? s.savedEvents
            : [event, ...s.savedEvents],
        }));
        cloudSave(event.id, "event", event);
        get().submitFeedback(event.id, "event", "saved");
      },

      notInterestedEvent: (event) => {
        const prev = get().pendingDismissal;
        if (prev) get().commitDismiss();

        set((s) => ({
          events: s.events.filter((e) => e.id !== event.id),
          savedEvents: s.savedEvents.filter((e) => e.id !== event.id),
          pendingDismissal: {
            id: event.id,
            kind: "event",
            item: event,
            expiresAt: Date.now() + 4000,
          },
        }));
      },

      saveJob: (job) => {
        set((s) => ({
          savedJobs: s.savedJobs.some((j) => j.id === job.id)
            ? s.savedJobs
            : [job, ...s.savedJobs],
        }));
        cloudSave(job.id, "job", job);
        get().submitFeedback(job.id, "job", "saved");
      },

      notInterestedJob: (job) => {
        const prev = get().pendingDismissal;
        if (prev) get().commitDismiss();

        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== job.id),
          savedJobs: s.savedJobs.filter((j) => j.id !== job.id),
          pendingDismissal: {
            id: job.id,
            kind: "job",
            item: job,
            expiresAt: Date.now() + 4000,
          },
        }));
      },

      unsavePaper: (id) => {
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id === id ? { ...p, isSaved: false, feedback: undefined } : p
          ),
          savedPapers: s.savedPapers.filter((p) => p.id !== id),
        }));
        cloudUnsave(id);
      },

      unsaveEvent: (id) => {
        set((s) => ({
          savedEvents: s.savedEvents.filter((e) => e.id !== id),
        }));
        cloudUnsave(id);
      },

      unsaveJob: (id) => {
        set((s) => ({
          savedJobs: s.savedJobs.filter((j) => j.id !== id),
        }));
        cloudUnsave(id);
      },

      submitFeedback: (itemId, type, feedback) => {
        console.log(`[Hermes] Feedback: ${type} ${itemId} → ${feedback}`);
        const kind =
          type === "paper" || type === "event" || type === "job"
            ? (type as ItemKind)
            : null;
        if (kind) cloudFeedback(itemId, kind, feedback);
      },

      markRead: (id) => {
        set((s) =>
          s.readItems[id] ? s : { readItems: { ...s.readItems, [id]: true } },
        );
        cloudMarkRead(id);
      },

      markUnread: (id) => {
        set((s) => {
          if (!s.readItems[id]) return s;
          const next = { ...s.readItems };
          delete next[id];
          return { readItems: next };
        });
        cloudMarkUnread(id);
      },

      undoDismiss: () => {
        const pending = get().pendingDismissal;
        if (!pending) return;
        set((s) => {
          if (pending.kind === "paper") {
            return {
              papers: [pending.item as Paper, ...s.papers].sort(
                (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
              ),
              pendingDismissal: null,
            };
          }
          if (pending.kind === "event") {
            return {
              events: [pending.item as Event, ...s.events].sort(
                (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
              ),
              pendingDismissal: null,
            };
          }
          return {
            jobs: [pending.item as Job, ...s.jobs].sort(
              (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
            ),
            pendingDismissal: null,
          };
        });
      },

      commitDismiss: () => {
        const pending = get().pendingDismissal;
        if (!pending) return;
        get().submitFeedback(pending.id, pending.kind, "notInterested");
        set({ pendingDismissal: null });
      },

      hydrateFromRemote: (remote) => {
        set((s) => ({
          savedPapers: remote.savedPapers ?? s.savedPapers,
          savedEvents: remote.savedEvents ?? s.savedEvents,
          savedJobs: remote.savedJobs ?? s.savedJobs,
          readItems: remote.readItems ?? s.readItems,
        }));
      },

      resetLocal: () => {
        set({
          savedPapers: [],
          savedEvents: [],
          savedJobs: [],
          readItems: {},
          pendingDismissal: null,
          aiPaperSearchEnabled: true,
        });
      },
    }),
    {
      name: "hermes-feed",
      partialize: (state) => ({
        savedPapers: state.savedPapers,
        savedEvents: state.savedEvents,
        savedJobs: state.savedJobs,
        readItems: state.readItems,
        aiPaperSearchEnabled: state.aiPaperSearchEnabled,
      }),
    }
  )
);
