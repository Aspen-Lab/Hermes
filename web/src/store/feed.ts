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
import type { EventsFeedResponse } from "@/lib/events/types";
import type { JobsFeedResponse } from "@/lib/jobs/types";
import {
  feedbackSnapshotForEvent,
  feedbackSnapshotForJob,
  feedbackSnapshotForPaper,
} from "@/lib/preferences/ledger";

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
  payload?: unknown,
) {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, itemKind, feedback, payload }),
    });
  } catch (err) {
    console.warn("[feed] cloudFeedback failed", err);
  }
}

// Recently-shown tracking.
//
// Rule: a paper that's already been surfaced in this user's feed shouldn't
// re-appear in subsequent loads for a while. We persist a {id -> timestamp}
// map in localStorage (via zustand persist), expire entries after 14 days,
// and pass the active IDs as `excludeIds` to the API. The pipeline filters
// those out AFTER scoring so we always return a full topN of fresh items.
//
// 14 days keeps the next two weeks of daily digests free of repeats while
// still allowing genuinely relevant older papers to surface eventually if
// the user's interests shift.
const RECENTLY_SHOWN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RECENTLY_SHOWN_CAP = 1000;

function pruneRecentlyShown(
  map: Record<string, number>,
): Record<string, number> {
  const cutoff = Date.now() - RECENTLY_SHOWN_TTL_MS;
  const entries = Object.entries(map).filter(([, ts]) => ts >= cutoff);
  if (entries.length <= RECENTLY_SHOWN_CAP) return Object.fromEntries(entries);
  // Trim oldest first when we're over cap.
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, RECENTLY_SHOWN_CAP));
}

function activeRecentlyShownIds(map: Record<string, number>): string[] {
  const cutoff = Date.now() - RECENTLY_SHOWN_TTL_MS;
  return Object.entries(map)
    .filter(([, ts]) => ts >= cutoff)
    .map(([id]) => id);
}

const SEED_REFRESH_MS = 30 * 24 * 60 * 60 * 1000; // monthly

// Ensure advisor discovery seeds are present and fresh (recomputed at most
// monthly). Returns the seeds to use for this request; persists fresh ones to
// the profile store so the next load reuses them.
async function ensureAdvisorSeeds(
  profile: UserProfile,
): Promise<{ seedTexts: string[]; seedWorkIds: string[] }> {
  const authorId = profile.advisorAuthorId;
  if (!authorId) return { seedTexts: [], seedWorkIds: [] };

  const cachedTexts = profile.advisorSeedTexts ?? [];
  const cachedIds = profile.advisorSeedWorkIds ?? [];
  const refreshedAt = profile.advisorSeedsRefreshedAt
    ? new Date(profile.advisorSeedsRefreshedAt).getTime()
    : 0;
  const fresh = cachedTexts.length > 0 && Date.now() - refreshedAt < SEED_REFRESH_MS;
  if (fresh) return { seedTexts: cachedTexts, seedWorkIds: cachedIds };

  try {
    const params = new URLSearchParams({ authorId });
    const projectText = [profile.currentProject, profile.currentChallenges]
      .filter(Boolean)
      .join("\n");
    if (projectText) params.set("project", projectText);
    const res = await fetch(`/api/affiliation/seeds?${params}`, { cache: "no-store" });
    const data = (await res.json()) as { workIds?: string[]; texts?: string[] };
    if (data.texts && data.texts.length > 0) {
      useProfileStore.getState().setAdvisorSeeds({
        workIds: data.workIds ?? [],
        texts: data.texts,
      });
      return { seedTexts: data.texts, seedWorkIds: data.workIds ?? [] };
    }
  } catch {
    // Network/API hiccup — fall back to whatever's cached (possibly empty).
  }
  return { seedTexts: cachedTexts, seedWorkIds: cachedIds };
}

async function fetchRealFeed(
  profile: UserProfile,
  aiPaperSearchEnabled = true,
  excludeIds: string[] = [],
): Promise<Paper[]> {
  const topics = (profile.researchTopics ?? []).filter(Boolean);
  if (topics.length === 0) return [];

  // Advisor / PI discovery seeds (recomputed monthly). Their text biases TF-IDF
  // scoring; their work IDs anchor the citation-neighborhood pull in the pipeline.
  const advisorSeeds = await ensureAdvisorSeeds(profile);
  // Promote project description + open challenges into seedTexts. These get
  // concatenated into the TF-IDF profile string, so papers that mention the
  // user's specific work or the challenges they're hunting bias up the rank.
  const seedTexts = [
    profile.currentProject,
    profile.currentChallenges,
    ...advisorSeeds.seedTexts,
  ].filter((s): s is string => Boolean(s && s.trim().length > 0));
  const negativeTopics = (profile.dislikedTopics ?? []).filter((s) => s.trim().length > 0);
  const preferenceLedger = profile.preferenceLedger ?? {};
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
        // Preferred journals double as a primary source filter (venue search)
        // and earn a relevance boost in the pipeline (see applyJournalBoost).
        venues:
          (profile.preferredJournals ?? []).length > 0
            ? profile.preferredJournals
            : undefined,
        seedTexts: seedTexts.length > 0 ? seedTexts : undefined,
        preferenceLedger:
          Object.keys(preferenceLedger).length > 0 ? preferenceLedger : undefined,
        negativeTopics: negativeTopics.length > 0 ? negativeTopics : undefined,
        // Advisor citation-neighborhood discovery (new external work building on
        // the advisor's seeds). Only sent once an advisor has been confirmed.
        affiliation:
          profile.advisorAuthorId && advisorSeeds.seedWorkIds.length > 0
            ? {
                authorId: profile.advisorAuthorId,
                seedWorkIds: advisorSeeds.seedWorkIds,
              }
            : undefined,
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
        excludeIds: excludeIds.length > 0 ? excludeIds : undefined,
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

// Shared request-shaping for the jobs/events feeds: both routes take the
// same profile projection.
function opportunityRequestBody(
  profile: UserProfile,
  excludeIds: string[],
): Record<string, unknown> {
  const topics = (profile.researchTopics ?? []).filter(Boolean);
  const softTopics = (profile.softTopics ?? []).filter(Boolean);
  const preferenceLedger = profile.preferenceLedger ?? {};
  const tavilyApiKey = profile.tavilyApiKey?.trim();
  const feedAiApiKey = profile.feedAiApiKey?.trim();
  const hasUserLlmOverride =
    profile.feedAiProvider !== "default" && Boolean(feedAiApiKey);
  return {
    topics,
    softTopics: softTopics.length > 0 ? softTopics : undefined,
    methods: profile.preferredMethods,
    seedTexts: [profile.currentProject, profile.currentChallenges].filter(
      (s): s is string => Boolean(s && s.trim().length > 0),
    ),
    preferenceLedger:
      Object.keys(preferenceLedger).length > 0 ? preferenceLedger : undefined,
    careerStage: profile.careerStage,
    industryVsAcademia: profile.industryVsAcademia,
    locationPreferences: profile.locationPreferences,
    currentProject: profile.currentProject,
    topN: 5,
    aiTier: hasUserLlmOverride ? 2 : undefined,
    searchConnectors: profile.tavilyEnabled
      ? { tavily: { enabled: true, apiKey: tavilyApiKey || undefined } }
      : undefined,
    llmOverride: hasUserLlmOverride
      ? { provider: profile.feedAiProvider, apiKey: feedAiApiKey }
      : undefined,
    excludeIds: excludeIds.length > 0 ? excludeIds : undefined,
  };
}

async function fetchRealEvents(
  profile: UserProfile,
  excludeIds: string[] = [],
): Promise<Event[]> {
  if ((profile.researchTopics ?? []).filter(Boolean).length === 0) return [];
  try {
    const res = await fetch("/api/events/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opportunityRequestBody(profile, excludeIds)),
    });
    if (!res.ok) {
      console.error("[feed] /api/events/feed returned", res.status);
      return [];
    }
    const data = (await res.json()) as EventsFeedResponse;
    return data.items;
  } catch (err) {
    console.error("[feed] events fetch failed:", err);
    return [];
  }
}

async function fetchRealJobs(
  profile: UserProfile,
  excludeIds: string[] = [],
): Promise<Job[]> {
  if ((profile.researchTopics ?? []).filter(Boolean).length === 0) return [];
  try {
    const res = await fetch("/api/jobs/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opportunityRequestBody(profile, excludeIds)),
    });
    if (!res.ok) {
      console.error("[feed] /api/jobs/feed returned", res.status);
      return [];
    }
    const data = (await res.json()) as JobsFeedResponse;
    return data.items;
  } catch (err) {
    console.error("[feed] jobs fetch failed:", err);
    return [];
  }
}

type DismissalKind = "paper" | "event" | "job";

interface PendingDismissal {
  id: string;
  kind: DismissalKind;
  item: Paper | Event | Job;
  previousFeedback?: ItemFeedback;
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
  /** The required-topics signature the current `papers` were built from. When
   *  it diverges from the profile's topics, the feed page reloads automatically. */
  feedTopicsKey: string | null;
  aiPaperSearchEnabled: boolean;
  readItems: Record<string, true>;
  /** id -> ms timestamp. Drives the "don't repeat papers" exclude list. */
  recentlyShownIds: Record<string, number>;
  pendingDismissal: PendingDismissal | null;
  /** id -> feedback. Tracks save/like/dismiss state for any paper the user
   * has interacted with, even ones not in the current feed (e.g. searched). */
  paperFeedback: Record<string, ItemFeedback>;
  /** id -> feedback for events and jobs (ids are source-namespaced, so one
   * map covers both kinds without collisions). */
  oppFeedback: Record<string, ItemFeedback>;

  loadFeed: () => Promise<void>;
  setAiPaperSearchEnabled: (enabled: boolean) => Promise<void>;
  savePaper: (paper: Paper) => void;
  notInterestedPaper: (paper: Paper) => void;
  moreLikePaper: (paper: Paper) => void;
  saveEvent: (event: Event) => void;
  notInterestedEvent: (event: Event) => void;
  moreLikeEvent: (event: Event) => void;
  saveJob: (job: Job) => void;
  notInterestedJob: (job: Job) => void;
  moreLikeJob: (job: Job) => void;
  unsavePaper: (id: string) => void;
  unsaveEvent: (id: string) => void;
  unsaveJob: (id: string) => void;
  submitFeedback: (
    itemId: string,
    type: string,
    feedback: ItemFeedback,
    payload?: unknown,
  ) => void;
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
      feedTopicsKey: null,
      aiPaperSearchEnabled: true,
      readItems: {},
      recentlyShownIds: {},
      pendingDismissal: null,
      paperFeedback: {},
      oppFeedback: {},

      loadFeed: async () => {
        set({ isLoading: true });
        const {
          savedPapers,
          savedEvents,
          savedJobs,
          recentlyShownIds,
          paperFeedback,
          oppFeedback,
        } = get();
        const savedIds = new Set(savedPapers.map((p) => p.id));
        const savedEventIds = new Set(savedEvents.map((e) => e.id));
        const savedJobIds = new Set(savedJobs.map((j) => j.id));
        const aiPaperSearchEnabled = get().aiPaperSearchEnabled;
        const profile = useProfileStore.getState().profile;
        // Signature of the required topics this load is built from — must match
        // the feed page's auto-load key so the page knows the feed is current.
        const topicsKey = (profile.researchTopics ?? [])
          .map((t) => t.trim())
          .filter(Boolean)
          .join("\n");

        // Papers are consume-once: exclude any already shown recently (within
        // TTL) so the briefing brings fresh reading each load. Saved papers are
        // allowed back — the user bookmarked them.
        const paperExcludeIds = activeRecentlyShownIds(recentlyShownIds).filter(
          (id) => !savedIds.has(id),
        );

        // Events and jobs are STANDING opportunities, not consume-once items: a
        // conference is relevant every day until its deadline passes, so it
        // should keep surfacing rather than being suppressed after one view.
        // Exclude only the ones the user explicitly dismissed (persisted in
        // oppFeedback) so dismissals stick without starving the small pool.
        const dismissedOppIds = Object.entries(oppFeedback)
          .filter(([, f]) => f === "notInterested")
          .map(([id]) => id);

        // Three parallel pipelines; each helper degrades to [] on failure so
        // one surface never blanks the others.
        const [realPapers, realEvents, realJobs] = await Promise.all([
          fetchRealFeed(profile, aiPaperSearchEnabled, paperExcludeIds),
          fetchRealEvents(profile, dismissedOppIds),
          fetchRealJobs(profile, dismissedOppIds),
        ]);
        const papers = realPapers.map((p) =>
          savedIds.has(p.id)
            ? {
                ...p,
                isSaved: true,
                feedback: paperFeedback[p.id] ?? ("saved" as ItemFeedback),
              }
            : {
                ...p,
                feedback: paperFeedback[p.id] ?? p.feedback,
              },
        );
        const events = realEvents.map((e) => ({
          ...e,
          isSaved: savedEventIds.has(e.id),
          feedback:
            oppFeedback[e.id] ??
            (savedEventIds.has(e.id) ? ("saved" as ItemFeedback) : undefined),
        }));
        const jobs = realJobs.map((j) => ({
          ...j,
          isSaved: savedJobIds.has(j.id),
          feedback:
            oppFeedback[j.id] ??
            (savedJobIds.has(j.id) ? ("saved" as ItemFeedback) : undefined),
        }));
        // Record shown PAPERS so the next load skips them. Events/jobs are
        // deliberately NOT recorded here — they're standing opportunities that
        // should keep appearing until their deadline passes or the user acts.
        const now = Date.now();
        const nextShown: Record<string, number> = { ...recentlyShownIds };
        for (const paper of papers) {
          nextShown[paper.id] = now;
        }
        set({
          papers,
          events,
          jobs,
          isLoading: false,
          lastRefresh: new Date().toISOString(),
          feedTopicsKey: topicsKey,
          recentlyShownIds: pruneRecentlyShown(nextShown),
        });
      },

      setAiPaperSearchEnabled: async (enabled) => {
        set({ aiPaperSearchEnabled: enabled });
        await get().loadFeed();
      },

      savePaper: (paper) => {
        const alreadySaved = get().savedPapers.some((p) => p.id === paper.id);
        const previousFeedback = get().paperFeedback[paper.id] ?? paper.feedback;
        const savedFeedback =
          previousFeedback === "moreLikeThis" || previousFeedback === "liked"
            ? previousFeedback
            : ("saved" as ItemFeedback);
        const saved = { ...paper, isSaved: true, feedback: savedFeedback };
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id === paper.id ? saved : p
          ),
          savedPapers: s.savedPapers.some((p) => p.id === paper.id)
            ? s.savedPapers.map((p) => (p.id === paper.id ? saved : p))
            : [saved, ...s.savedPapers],
          paperFeedback: { ...s.paperFeedback, [paper.id]: savedFeedback },
        }));
        if (!alreadySaved) {
          useProfileStore.getState().recordPaperPreference(saved, "positive");
        }
        cloudSave(paper.id, "paper", saved);
        get().submitFeedback(
          paper.id,
          "paper",
          "saved",
          feedbackSnapshotForPaper(saved),
        );
      },

      notInterestedPaper: (paper) => {
        // Commit any previous pending dismissal before starting a new one.
        const prev = get().pendingDismissal;
        if (prev) get().commitDismiss();
        const previousFeedback = get().paperFeedback[paper.id] ?? paper.feedback;

        set((s) => ({
          papers: s.papers.filter((p) => p.id !== paper.id),
          savedPapers: s.savedPapers.filter((p) => p.id !== paper.id),
          paperFeedback: { ...s.paperFeedback, [paper.id]: "notInterested" },
          pendingDismissal: {
            id: paper.id,
            kind: "paper",
            item: paper,
            previousFeedback,
            expiresAt: Date.now() + 4000,
          },
        }));
      },

      moreLikePaper: (paper) => {
        const previous = get().paperFeedback[paper.id] ?? paper.feedback;
        const alreadyLiked = previous === "moreLikeThis" || previous === "liked";
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id === paper.id ? { ...p, feedback: "moreLikeThis" as ItemFeedback } : p
          ),
          paperFeedback: { ...s.paperFeedback, [paper.id]: "moreLikeThis" },
        }));
        if (!alreadyLiked) {
          useProfileStore.getState().recordPaperPreference(paper, "positive");
        }
        get().submitFeedback(
          paper.id,
          "paper",
          "moreLikeThis",
          feedbackSnapshotForPaper(paper),
        );
      },

      saveEvent: (event) => {
        const alreadySaved = get().savedEvents.some((e) => e.id === event.id);
        const previousFeedback = get().oppFeedback[event.id] ?? event.feedback;
        const savedFeedback =
          previousFeedback === "moreLikeThis" || previousFeedback === "liked"
            ? previousFeedback
            : ("saved" as ItemFeedback);
        const saved = { ...event, isSaved: true, feedback: savedFeedback };
        set((s) => ({
          events: s.events.map((e) => (e.id === event.id ? saved : e)),
          savedEvents: alreadySaved
            ? s.savedEvents.map((e) => (e.id === event.id ? saved : e))
            : [saved, ...s.savedEvents],
          oppFeedback: { ...s.oppFeedback, [event.id]: savedFeedback },
        }));
        if (!alreadySaved) {
          useProfileStore.getState().recordEventPreference(saved, "positive");
        }
        cloudSave(event.id, "event", saved);
        get().submitFeedback(
          event.id,
          "event",
          "saved",
          feedbackSnapshotForEvent(saved),
        );
      },

      notInterestedEvent: (event) => {
        const prev = get().pendingDismissal;
        if (prev) get().commitDismiss();
        const previousFeedback = get().oppFeedback[event.id] ?? event.feedback;

        set((s) => ({
          events: s.events.filter((e) => e.id !== event.id),
          savedEvents: s.savedEvents.filter((e) => e.id !== event.id),
          oppFeedback: { ...s.oppFeedback, [event.id]: "notInterested" },
          pendingDismissal: {
            id: event.id,
            kind: "event",
            item: event,
            previousFeedback,
            expiresAt: Date.now() + 4000,
          },
        }));
      },

      moreLikeEvent: (event) => {
        const previous = get().oppFeedback[event.id] ?? event.feedback;
        const alreadyLiked = previous === "moreLikeThis" || previous === "liked";
        set((s) => ({
          events: s.events.map((e) =>
            e.id === event.id
              ? { ...e, feedback: "moreLikeThis" as ItemFeedback }
              : e,
          ),
          oppFeedback: { ...s.oppFeedback, [event.id]: "moreLikeThis" },
        }));
        if (!alreadyLiked) {
          useProfileStore.getState().recordEventPreference(event, "positive");
        }
        get().submitFeedback(
          event.id,
          "event",
          "moreLikeThis",
          feedbackSnapshotForEvent(event),
        );
      },

      saveJob: (job) => {
        const alreadySaved = get().savedJobs.some((j) => j.id === job.id);
        const previousFeedback = get().oppFeedback[job.id] ?? job.feedback;
        const savedFeedback =
          previousFeedback === "moreLikeThis" || previousFeedback === "liked"
            ? previousFeedback
            : ("saved" as ItemFeedback);
        const saved = { ...job, isSaved: true, feedback: savedFeedback };
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === job.id ? saved : j)),
          savedJobs: alreadySaved
            ? s.savedJobs.map((j) => (j.id === job.id ? saved : j))
            : [saved, ...s.savedJobs],
          oppFeedback: { ...s.oppFeedback, [job.id]: savedFeedback },
        }));
        if (!alreadySaved) {
          useProfileStore.getState().recordJobPreference(saved, "positive");
        }
        cloudSave(job.id, "job", saved);
        get().submitFeedback(job.id, "job", "saved", feedbackSnapshotForJob(saved));
      },

      notInterestedJob: (job) => {
        const prev = get().pendingDismissal;
        if (prev) get().commitDismiss();
        const previousFeedback = get().oppFeedback[job.id] ?? job.feedback;

        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== job.id),
          savedJobs: s.savedJobs.filter((j) => j.id !== job.id),
          oppFeedback: { ...s.oppFeedback, [job.id]: "notInterested" },
          pendingDismissal: {
            id: job.id,
            kind: "job",
            item: job,
            previousFeedback,
            expiresAt: Date.now() + 4000,
          },
        }));
      },

      moreLikeJob: (job) => {
        const previous = get().oppFeedback[job.id] ?? job.feedback;
        const alreadyLiked = previous === "moreLikeThis" || previous === "liked";
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === job.id
              ? { ...j, feedback: "moreLikeThis" as ItemFeedback }
              : j,
          ),
          oppFeedback: { ...s.oppFeedback, [job.id]: "moreLikeThis" },
        }));
        if (!alreadyLiked) {
          useProfileStore.getState().recordJobPreference(job, "positive");
        }
        get().submitFeedback(
          job.id,
          "job",
          "moreLikeThis",
          feedbackSnapshotForJob(job),
        );
      },

      unsavePaper: (id) => {
        set((s) => {
          const nextFeedback = { ...s.paperFeedback };
          const currentFeedback = nextFeedback[id];
          if (currentFeedback === "saved") delete nextFeedback[id];
          return {
            papers: s.papers.map((p) =>
              p.id === id
                ? {
                    ...p,
                    isSaved: false,
                    feedback:
                      currentFeedback === "saved" ? undefined : currentFeedback,
                  }
                : p
            ),
            savedPapers: s.savedPapers.filter((p) => p.id !== id),
            paperFeedback: nextFeedback,
          };
        });
        cloudUnsave(id);
      },

      unsaveEvent: (id) => {
        set((s) => {
          const nextFeedback = { ...s.oppFeedback };
          const currentFeedback = nextFeedback[id];
          if (currentFeedback === "saved") delete nextFeedback[id];
          return {
            events: s.events.map((e) =>
              e.id === id
                ? {
                    ...e,
                    isSaved: false,
                    feedback:
                      currentFeedback === "saved" ? undefined : currentFeedback,
                  }
                : e,
            ),
            savedEvents: s.savedEvents.filter((e) => e.id !== id),
            oppFeedback: nextFeedback,
          };
        });
        cloudUnsave(id);
      },

      unsaveJob: (id) => {
        set((s) => {
          const nextFeedback = { ...s.oppFeedback };
          const currentFeedback = nextFeedback[id];
          if (currentFeedback === "saved") delete nextFeedback[id];
          return {
            jobs: s.jobs.map((j) =>
              j.id === id
                ? {
                    ...j,
                    isSaved: false,
                    feedback:
                      currentFeedback === "saved" ? undefined : currentFeedback,
                  }
                : j,
            ),
            savedJobs: s.savedJobs.filter((j) => j.id !== id),
            oppFeedback: nextFeedback,
          };
        });
        cloudUnsave(id);
      },

      submitFeedback: (itemId, type, feedback, payload) => {
        console.log(`[Peer] Feedback: ${type} ${itemId} → ${feedback}`);
        const kind =
          type === "paper" || type === "event" || type === "job"
            ? (type as ItemKind)
            : null;
        if (kind) cloudFeedback(itemId, kind, feedback, payload);
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
            const nextFeedback = { ...s.paperFeedback };
            if (pending.previousFeedback) {
              nextFeedback[pending.id] = pending.previousFeedback;
            } else {
              delete nextFeedback[pending.id];
            }
            return {
              papers: [pending.item as Paper, ...s.papers].sort(
                (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
              ),
              paperFeedback: nextFeedback,
              pendingDismissal: null,
            };
          }
          const nextOppFeedback = { ...s.oppFeedback };
          if (pending.previousFeedback) {
            nextOppFeedback[pending.id] = pending.previousFeedback;
          } else {
            delete nextOppFeedback[pending.id];
          }
          if (pending.kind === "event") {
            return {
              events: [pending.item as Event, ...s.events].sort(
                (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
              ),
              oppFeedback: nextOppFeedback,
              pendingDismissal: null,
            };
          }
          return {
            jobs: [pending.item as Job, ...s.jobs].sort(
              (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
            ),
            oppFeedback: nextOppFeedback,
            pendingDismissal: null,
          };
        });
      },

      commitDismiss: () => {
        const pending = get().pendingDismissal;
        if (!pending) return;
        if (pending.kind === "paper") {
          const paper = pending.item as Paper;
          useProfileStore.getState().recordPaperPreference(paper, "negative");
          get().submitFeedback(
            pending.id,
            pending.kind,
            "notInterested",
            feedbackSnapshotForPaper(paper),
          );
        } else if (pending.kind === "event") {
          const event = pending.item as Event;
          useProfileStore.getState().recordEventPreference(event, "negative");
          get().submitFeedback(
            pending.id,
            pending.kind,
            "notInterested",
            feedbackSnapshotForEvent(event),
          );
        } else {
          const job = pending.item as Job;
          useProfileStore.getState().recordJobPreference(job, "negative");
          get().submitFeedback(
            pending.id,
            pending.kind,
            "notInterested",
            feedbackSnapshotForJob(job),
          );
        }
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
          recentlyShownIds: {},
          pendingDismissal: null,
          paperFeedback: {},
          oppFeedback: {},
          aiPaperSearchEnabled: true,
        });
      },
    }),
    {
      name: "peer-feed",
      // skipHydration: rehydrated after mount via <StoreHydrator/> so the
      // first client render matches SSR defaults (empty feed / no saves) and
      // doesn't mismatch the server markup. See store/ui.ts for rationale.
      skipHydration: true,
      partialize: (state) => ({
        savedPapers: state.savedPapers,
        savedEvents: state.savedEvents,
        savedJobs: state.savedJobs,
        readItems: state.readItems,
        aiPaperSearchEnabled: state.aiPaperSearchEnabled,
        recentlyShownIds: state.recentlyShownIds,
        paperFeedback: state.paperFeedback,
        oppFeedback: state.oppFeedback,
      }),
    }
  )
);
