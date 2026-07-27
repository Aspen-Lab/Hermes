"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyColorTheme, normalizeColorTheme } from "@/lib/theme";
import type {
  UserProfile,
  Paper,
  Event,
  Job,
  CareerStage,
  IndustryAcademiaPreference,
  DigestChannel,
  DigestFrequency,
  ColorTheme,
  FeedFocus,
  FeedFreshness,
  FeedSourceMix,
  FeedImportance,
  FeedMethodMode,
  FeedDiscoveryMode,
} from "@/types";
import { defaultProfile } from "@/types";
import {
  applyOpportunityFacetPreferenceSignal,
  applyPreferenceSignal,
  conceptsFromEvent,
  conceptsFromJob,
  conceptsFromPaper,
  type OpportunityFacetGroup,
} from "@/lib/preferences/ledger";

interface ProfileState {
  profile: UserProfile;
  updateDisplayName: (name: string) => void;
  updateTopics: (topics: string[]) => void;
  updateSoftTopics: (topics: string[]) => void;
  updatePreferredJournals: (journals: string[]) => void;
  updateCareerStage: (stage: CareerStage) => void;
  updateIndustryPreference: (pref: IndustryAcademiaPreference) => void;
  updateLocations: (locations: string[]) => void;
  updateMethods: (methods: string[]) => void;
  updateSchool: (school: string) => void;
  updateCurrentProject: (text: string) => void;
  updateCurrentChallenges: (text: string) => void;
  recordPaperPreference: (
    paper: Paper,
    signal: "positive" | "negative",
    at?: string,
  ) => void;
  /** Event feedback: recorded under the `event` origin namespace — flows
   * weakly into job scoring, never back into papers. */
  recordEventPreference: (
    event: Event,
    signal: "positive" | "negative",
    at?: string,
  ) => void;
  /** Job feedback: recorded under the `job` origin namespace — job-only. */
  recordJobPreference: (
    job: Job,
    signal: "positive" | "negative",
    at?: string,
  ) => void;
  /** Facet clicks are weak, positive-only evidence under event/job origins. */
  recordOpportunityFacetPreference: (
    origin: "event" | "job",
    group: OpportunityFacetGroup,
    value: string,
    at?: string,
  ) => void;
  /** Wipe everything Peer has learned from likes/saves/dismissals. */
  resetPreferenceLedger: () => void;
  updateFeedFocus: (value: FeedFocus) => void;
  updateFeedFreshness: (value: FeedFreshness) => void;
  updatePaperCount: (value: 5 | 10) => void;
  updateFeedSourceMix: (value: FeedSourceMix) => void;
  updateFeedImportance: (value: FeedImportance) => void;
  updateFeedMethodMode: (value: FeedMethodMode) => void;
  updateFeedDiscoveryMode: (value: FeedDiscoveryMode) => void;
  updateFeedAvoidReviews: (value: boolean) => void;
  updateFeedAvoidOldPapers: (value: boolean) => void;
  updateFeedAvoidBroadSurveys: (value: boolean) => void;
  updateAdvisorName: (name: string) => void;
  /** Lock in the user-confirmed OpenAlex author identity for the advisor. */
  confirmAdvisorAuthor: (authorId: string, label: string) => void;
  /** Clear the confirmed advisor identity + its cached seeds (e.g. on "change"). */
  clearAdvisorAuthor: () => void;
  /** Store freshly recomputed advisor discovery seeds and stamp the refresh time. */
  setAdvisorSeeds: (seeds: { workIds: string[]; texts: string[] }) => void;
  updateDigestEnabled: (v: boolean) => void;
  updateDigestHourLocal: (h: number) => void;
  updateDigestTimezone: (tz: string) => void;
  updateDigestChannel: (c: DigestChannel) => void;
  updateDigestFrequency: (f: DigestFrequency) => void;
  updateDigestEmail: (email: string) => void;
  updateTavilyEnabled: (value: boolean) => void;
  updateTavilyApiKey: (value: string) => void;
  updateAdzunaKeys: (appId: string, appKey: string) => void;
  updateUsajobsKeys: (apiKey: string, userAgent: string) => void;
  updateFeedAiProvider: (value: UserProfile["feedAiProvider"]) => void;
  updateFeedAiApiKey: (value: string) => void;
  updateDeepReportEnabled: (value: boolean) => void;
  updateColorTheme: (theme: ColorTheme) => void;
  /** Mark first-run onboarding complete (defaults to now). */
  completeOnboarding: (at?: string) => void;
  /** Clear the onboarding flag so the welcome flow shows again (replay / dev). */
  resetOnboarding: () => void;
  /** Replace local state with a server snapshot. Undefined fields keep local values. */
  hydrateFromRemote: (remote: Partial<UserProfile>) => void;
  logOut: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: defaultProfile,

      updateDisplayName: (name) =>
        set((s) => ({
          profile: {
            ...s.profile,
            displayName: name.trim() || "Peer Member",
          },
        })),

      updateTopics: (topics) =>
        set((s) => ({ profile: { ...s.profile, researchTopics: topics } })),

      updateSoftTopics: (topics) =>
        set((s) => ({ profile: { ...s.profile, softTopics: topics } })),

      updatePreferredJournals: (journals) =>
        set((s) => ({ profile: { ...s.profile, preferredJournals: journals } })),


      updateCareerStage: (stage) =>
        set((s) => ({ profile: { ...s.profile, careerStage: stage } })),

      updateIndustryPreference: (pref) =>
        set((s) => ({ profile: { ...s.profile, industryVsAcademia: pref } })),

      updateLocations: (locations) =>
        set((s) => ({
          profile: { ...s.profile, locationPreferences: locations },
        })),

      updateMethods: (methods) =>
        set((s) => ({
          profile: { ...s.profile, preferredMethods: methods },
        })),

      updateSchool: (school) =>
        set((s) => ({
          profile: { ...s.profile, school: school.trim() || undefined },
        })),

      updateCurrentProject: (text) =>
        set((s) => ({
          profile: { ...s.profile, currentProject: text || undefined },
        })),

      updateCurrentChallenges: (text) =>
        set((s) => ({
          profile: { ...s.profile, currentChallenges: text || undefined },
        })),

      recordPaperPreference: (paper, signal, at) =>
        set((s) => ({
          profile: {
            ...s.profile,
            preferenceLedger: applyPreferenceSignal(
              s.profile.preferenceLedger,
              conceptsFromPaper(paper),
              signal,
              {
                at,
                requiredTopics: s.profile.researchTopics,
              },
            ),
          },
        })),

      recordEventPreference: (event, signal, at) =>
        set((s) => ({
          profile: {
            ...s.profile,
            preferenceLedger: applyPreferenceSignal(
              s.profile.preferenceLedger,
              conceptsFromEvent(event),
              signal,
              { at, origin: "event" },
            ),
          },
        })),

      recordJobPreference: (job, signal, at) =>
        set((s) => ({
          profile: {
            ...s.profile,
            preferenceLedger: applyPreferenceSignal(
              s.profile.preferenceLedger,
              conceptsFromJob(job),
              signal,
              { at, origin: "job" },
            ),
          },
        })),

      recordOpportunityFacetPreference: (origin, group, value, at) =>
        set((s) => ({
          profile: {
            ...s.profile,
            preferenceLedger: applyOpportunityFacetPreferenceSignal(
              s.profile.preferenceLedger,
              group,
              value,
              { at, origin },
            ),
          },
        })),

      resetPreferenceLedger: () =>
        set((s) => ({ profile: { ...s.profile, preferenceLedger: {} } })),

      updateFeedFocus: (value) =>
        set((s) => ({ profile: { ...s.profile, feedFocus: value } })),
      updateFeedFreshness: (value) =>
        set((s) => ({ profile: { ...s.profile, feedFreshness: value } })),
      updatePaperCount: (value) =>
        set((s) => ({ profile: { ...s.profile, paperCount: value } })),
      updateFeedSourceMix: (value) =>
        set((s) => ({ profile: { ...s.profile, feedSourceMix: value } })),
      updateFeedImportance: (value) =>
        set((s) => ({ profile: { ...s.profile, feedImportance: value } })),
      updateFeedMethodMode: (value) =>
        set((s) => ({ profile: { ...s.profile, feedMethodMode: value } })),
      updateFeedDiscoveryMode: (value) =>
        set((s) => ({ profile: { ...s.profile, feedDiscoveryMode: value } })),
      updateFeedAvoidReviews: (value) =>
        set((s) => ({ profile: { ...s.profile, feedAvoidReviews: value } })),
      updateFeedAvoidOldPapers: (value) =>
        set((s) => ({ profile: { ...s.profile, feedAvoidOldPapers: value } })),
      updateFeedAvoidBroadSurveys: (value) =>
        set((s) => ({ profile: { ...s.profile, feedAvoidBroadSurveys: value } })),

      updateAdvisorName: (name) =>
        set((s) => {
          // Do NOT trim here — trimming on every keystroke eats spaces while
          // the user is still typing. The find() call in AdvisorField trims
          // before it actually searches.
          return {
            profile: {
              ...s.profile,
              advisorName: name || undefined,
              advisorAuthorId: undefined,
              advisorAuthorLabel: undefined,
              advisorSeedWorkIds: undefined,
              advisorSeedTexts: undefined,
              advisorSeedsRefreshedAt: null,
            },
          };
        }),
      confirmAdvisorAuthor: (authorId, label) =>
        set((s) => ({
          profile: {
            ...s.profile,
            advisorAuthorId: authorId,
            advisorAuthorLabel: label,
            // Force a seed recompute on next feed load.
            advisorSeedsRefreshedAt: null,
          },
        })),
      clearAdvisorAuthor: () =>
        set((s) => ({
          profile: {
            ...s.profile,
            advisorAuthorId: undefined,
            advisorAuthorLabel: undefined,
            advisorSeedWorkIds: undefined,
            advisorSeedTexts: undefined,
            advisorSeedsRefreshedAt: null,
          },
        })),
      setAdvisorSeeds: ({ workIds, texts }) =>
        set((s) => ({
          profile: {
            ...s.profile,
            advisorSeedWorkIds: workIds,
            advisorSeedTexts: texts,
            advisorSeedsRefreshedAt: new Date().toISOString(),
          },
        })),

      updateDigestEnabled: (v) =>
        set((s) => ({ profile: { ...s.profile, digestEnabled: v } })),
      updateDigestHourLocal: (h) =>
        set((s) => ({ profile: { ...s.profile, digestHourLocal: h } })),
      updateDigestTimezone: (tz) =>
        set((s) => ({ profile: { ...s.profile, digestTimezone: tz } })),
      updateDigestChannel: (c) =>
        set((s) => ({ profile: { ...s.profile, digestChannel: c } })),
      updateDigestFrequency: (f) =>
        set((s) => ({ profile: { ...s.profile, digestFrequency: f } })),
      updateDigestEmail: (email) =>
        set((s) => ({ profile: { ...s.profile, digestEmail: email } })),
      updateTavilyEnabled: (value) =>
        set((s) => ({ profile: { ...s.profile, tavilyEnabled: value } })),
      updateTavilyApiKey: (value) =>
        set((s) => ({
          profile: { ...s.profile, tavilyApiKey: value.trim() || undefined },
        })),
      updateAdzunaKeys: (appId, appKey) =>
        set((s) => ({
          profile: {
            ...s.profile,
            adzunaAppId: appId.trim() || undefined,
            adzunaAppKey: appKey.trim() || undefined,
          },
        })),
      updateUsajobsKeys: (apiKey, userAgent) =>
        set((s) => ({
          profile: {
            ...s.profile,
            usajobsApiKey: apiKey.trim() || undefined,
            usajobsUserAgent: userAgent.trim() || undefined,
          },
        })),
      updateFeedAiProvider: (value) =>
        set((s) => ({
          profile: {
            ...s.profile,
            feedAiProvider: value,
            feedAiApiKey:
              value === "default" ? undefined : s.profile.feedAiApiKey,
          },
        })),
      updateFeedAiApiKey: (value) =>
        set((s) => ({
          profile: { ...s.profile, feedAiApiKey: value.trim() || undefined },
        })),
      updateDeepReportEnabled: (value) =>
        set((s) => ({ profile: { ...s.profile, deepReportEnabled: value } })),
      updateColorTheme: (theme) => {
        applyColorTheme(theme);
        set((s) => ({ profile: { ...s.profile, colorTheme: theme } }));
      },

      completeOnboarding: (at) =>
        set((s) => ({
          profile: { ...s.profile, onboardedAt: at ?? new Date().toISOString() },
        })),
      resetOnboarding: () =>
        set((s) => ({ profile: { ...s.profile, onboardedAt: null } })),

      hydrateFromRemote: (remote) =>
        set((s) => {
          const merged: UserProfile = { ...s.profile };
          if (remote.displayName !== undefined) merged.displayName = remote.displayName;
          if (remote.researchTopics !== undefined) merged.researchTopics = remote.researchTopics;
          if (remote.preferredMethods !== undefined) merged.preferredMethods = remote.preferredMethods;
          if (remote.locationPreferences !== undefined) merged.locationPreferences = remote.locationPreferences;
          if (remote.careerStage !== undefined) merged.careerStage = remote.careerStage;
          if (remote.industryVsAcademia !== undefined) merged.industryVsAcademia = remote.industryVsAcademia;
          if (remote.phdYear !== undefined) merged.phdYear = remote.phdYear;
          if (remote.school !== undefined) merged.school = remote.school;
          if (remote.currentProject !== undefined) merged.currentProject = remote.currentProject;
          if (remote.currentChallenges !== undefined) merged.currentChallenges = remote.currentChallenges;
          if (remote.dislikedTopics !== undefined) merged.dislikedTopics = remote.dislikedTopics;
          if (remote.preferenceLedger !== undefined) merged.preferenceLedger = remote.preferenceLedger;
          if (remote.softTopics !== undefined) merged.softTopics = remote.softTopics;
          if (remote.preferredJournals !== undefined) merged.preferredJournals = remote.preferredJournals;
          if (remote.feedFocus !== undefined) merged.feedFocus = remote.feedFocus;
          if (remote.feedFreshness !== undefined) merged.feedFreshness = remote.feedFreshness;
          if (remote.paperCount !== undefined) merged.paperCount = remote.paperCount;
          if (remote.feedSourceMix !== undefined) merged.feedSourceMix = remote.feedSourceMix;
          if (remote.feedImportance !== undefined) merged.feedImportance = remote.feedImportance;
          if (remote.feedMethodMode !== undefined) merged.feedMethodMode = remote.feedMethodMode;
          if (remote.feedDiscoveryMode !== undefined) merged.feedDiscoveryMode = remote.feedDiscoveryMode;
          if (remote.feedAvoidReviews !== undefined) merged.feedAvoidReviews = remote.feedAvoidReviews;
          if (remote.feedAvoidOldPapers !== undefined) merged.feedAvoidOldPapers = remote.feedAvoidOldPapers;
          if (remote.feedAvoidBroadSurveys !== undefined) merged.feedAvoidBroadSurveys = remote.feedAvoidBroadSurveys;
          if (remote.advisorName !== undefined) merged.advisorName = remote.advisorName;
          if (remote.digestEnabled !== undefined) merged.digestEnabled = remote.digestEnabled;
          if (remote.digestHourLocal !== undefined) merged.digestHourLocal = remote.digestHourLocal;
          if (remote.digestTimezone !== undefined) merged.digestTimezone = remote.digestTimezone;
          if (remote.digestChannel !== undefined) merged.digestChannel = remote.digestChannel;
          if (remote.digestEmail !== undefined) merged.digestEmail = remote.digestEmail;
          if (remote.digestFrequency !== undefined) merged.digestFrequency = remote.digestFrequency;
          if (remote.tavilyEnabled !== undefined) merged.tavilyEnabled = remote.tavilyEnabled;
          if (remote.tavilyApiKey !== undefined) merged.tavilyApiKey = remote.tavilyApiKey;
          if (remote.feedAiProvider !== undefined) merged.feedAiProvider = remote.feedAiProvider;
          if (remote.feedAiApiKey !== undefined) merged.feedAiApiKey = remote.feedAiApiKey;
          if (remote.deepReportEnabled !== undefined) merged.deepReportEnabled = remote.deepReportEnabled;
          if (remote.colorTheme !== undefined) {
            // The server may still hold a pre-v2 single-name theme
            // ("black", "lavender", …) — normalize BEFORE storing, or the
            // picker's mode/accent split chokes on the legacy value.
            const normalized = normalizeColorTheme(remote.colorTheme);
            merged.colorTheme = normalized;
            applyColorTheme(normalized);
          }
          return { profile: merged };
        }),

      logOut: () => {
        applyColorTheme(defaultProfile.colorTheme);
        set({ profile: defaultProfile });
      },
    }),
    // skipHydration: persisted state is rehydrated after mount via
    // <StoreHydrator/> so the first client render matches SSR defaults and
    // avoids a hydration mismatch. See store/ui.ts for the full rationale.
    {
      name: "peer-profile",
      skipHydration: true,
      // v2: colorTheme became a "mode:accent" composite; migrate any
      // persisted legacy single-name value (normalize is a no-op on v2).
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { profile?: { colorTheme?: string } };
        if (state?.profile?.colorTheme !== undefined) {
          state.profile.colorTheme = normalizeColorTheme(state.profile.colorTheme);
        }
        return persisted;
      },
    }
  )
);
