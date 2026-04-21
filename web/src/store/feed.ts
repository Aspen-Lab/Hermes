"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Paper, Event, Job, ItemFeedback, UserProfile } from "@/types";
import { mockPapers, mockEvents, mockJobs } from "@/data/mock";
import { useProfileStore } from "@/store/profile";
import { scoredItemToPaper } from "@/lib/feed/mapper";
import type { FeedResponse } from "@/lib/feed/types";

async function fetchRealFeed(profile: UserProfile): Promise<Paper[]> {
  const topics = (profile.researchTopics ?? []).filter(Boolean);
  if (topics.length === 0) return [];
  try {
    const res = await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topics,
        methods: profile.preferredMethods,
        venues: profile.preferredVenues,
        topN: 30,
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
  readItems: Record<string, true>;
  pendingDismissal: PendingDismissal | null;

  loadFeed: () => Promise<void>;
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
      readItems: {},
      pendingDismissal: null,

      loadFeed: async () => {
        set({ isLoading: true });
        const { savedPapers } = get();
        const savedIds = new Set(savedPapers.map((p) => p.id));
        const profile = useProfileStore.getState().profile;

        const realPapers = await fetchRealFeed(profile);
        const source = realPapers.length > 0 ? realPapers : mockPapers;
        const papers = source.map((p) =>
          savedIds.has(p.id)
            ? { ...p, isSaved: true, feedback: "saved" as ItemFeedback }
            : p,
        );
        set({
          papers,
          events: mockEvents,
          jobs: mockJobs,
          isLoading: false,
          lastRefresh: new Date().toISOString(),
        });
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
        get().submitFeedback(paper.id, "paper", "saved");
      },

      notInterestedPaper: (paper) => {
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
      },

      unsaveEvent: (id) => {
        set((s) => ({
          savedEvents: s.savedEvents.filter((e) => e.id !== id),
        }));
      },

      unsaveJob: (id) => {
        set((s) => ({
          savedJobs: s.savedJobs.filter((j) => j.id !== id),
        }));
      },

      submitFeedback: (itemId, type, feedback) => {
        console.log(`[Hermes] Feedback: ${type} ${itemId} → ${feedback}`);
      },

      markRead: (id) => {
        set((s) =>
          s.readItems[id] ? s : { readItems: { ...s.readItems, [id]: true } },
        );
      },

      markUnread: (id) => {
        set((s) => {
          if (!s.readItems[id]) return s;
          const next = { ...s.readItems };
          delete next[id];
          return { readItems: next };
        });
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
    }),
    {
      name: "hermes-feed",
      partialize: (state) => ({
        savedPapers: state.savedPapers,
        savedEvents: state.savedEvents,
        savedJobs: state.savedJobs,
        readItems: state.readItems,
      }),
    }
  )
);
