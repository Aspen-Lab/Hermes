"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Paper, Event, Job, ItemFeedback } from "@/types";
import { mockPapers, mockEvents, mockJobs } from "@/data/mock";

interface FeedState {
  papers: Paper[];
  events: Event[];
  jobs: Job[];
  savedPapers: Paper[];
  savedEvents: Event[];
  savedJobs: Job[];
  isLoading: boolean;
  lastRefresh: string | null;

  loadFeed: () => void;
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

      loadFeed: () => {
        set({ isLoading: true });
        // Simulate network delay
        setTimeout(() => {
          const { savedPapers } = get();
          const savedIds = new Set(savedPapers.map((p) => p.id));
          const papers = mockPapers.map((p) =>
            savedIds.has(p.id)
              ? { ...p, isSaved: true, feedback: "saved" as ItemFeedback }
              : p
          );
          set({
            papers,
            events: mockEvents,
            jobs: mockJobs,
            isLoading: false,
            lastRefresh: new Date().toISOString(),
          });
        }, 600);
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
        set((s) => ({
          papers: s.papers.filter((p) => p.id !== paper.id),
          savedPapers: s.savedPapers.filter((p) => p.id !== paper.id),
        }));
        get().submitFeedback(paper.id, "paper", "notInterested");
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
        set((s) => ({
          events: s.events.filter((e) => e.id !== event.id),
          savedEvents: s.savedEvents.filter((e) => e.id !== event.id),
        }));
        get().submitFeedback(event.id, "event", "notInterested");
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
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== job.id),
          savedJobs: s.savedJobs.filter((j) => j.id !== job.id),
        }));
        get().submitFeedback(job.id, "job", "notInterested");
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
    }),
    {
      name: "hermes-feed",
      partialize: (state) => ({
        savedPapers: state.savedPapers,
        savedEvents: state.savedEvents,
        savedJobs: state.savedJobs,
      }),
    }
  )
);
