"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyColorTheme } from "@/lib/theme";
import type {
  UserProfile,
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

interface ProfileState {
  profile: UserProfile;
  updateDisplayName: (name: string) => void;
  updateTopics: (topics: string[]) => void;
  updateSoftTopics: (topics: string[]) => void;
  updateVenues: (venues: string[]) => void;
  updateCareerStage: (stage: CareerStage) => void;
  updateIndustryPreference: (pref: IndustryAcademiaPreference) => void;
  updateLocations: (locations: string[]) => void;
  updateMethods: (methods: string[]) => void;
  updateSchool: (school: string) => void;
  updateCurrentProject: (text: string) => void;
  updateCurrentChallenges: (text: string) => void;
  addDislikedTopics: (keywords: string[]) => void;
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
  updateLab: (lab: string) => void;
  updateDigestEnabled: (v: boolean) => void;
  updateDigestHourLocal: (h: number) => void;
  updateDigestTimezone: (tz: string) => void;
  updateDigestChannel: (c: DigestChannel) => void;
  updateDigestFrequency: (f: DigestFrequency) => void;
  updateTavilyEnabled: (value: boolean) => void;
  updateTavilyApiKey: (value: string) => void;
  updateFeedAiProvider: (value: UserProfile["feedAiProvider"]) => void;
  updateFeedAiApiKey: (value: string) => void;
  updateColorTheme: (theme: ColorTheme) => void;
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
            displayName: name.trim() || "Hermes Member",
          },
        })),

      updateTopics: (topics) =>
        set((s) => ({ profile: { ...s.profile, researchTopics: topics } })),

      updateSoftTopics: (topics) =>
        set((s) => ({ profile: { ...s.profile, softTopics: topics } })),

      updateVenues: (venues) =>
        set((s) => ({ profile: { ...s.profile, preferredVenues: venues } })),

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

      addDislikedTopics: (keywords) =>
        set((s) => {
          const existing = new Set(s.profile.dislikedTopics ?? []);
          keywords.forEach((k) => { if (k.trim()) existing.add(k.trim()); });
          return { profile: { ...s.profile, dislikedTopics: Array.from(existing) } };
        }),

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

      updateLab: (lab) =>
        set((s) => ({
          profile: { ...s.profile, lab: lab.trim() || undefined },
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
      updateTavilyEnabled: (value) =>
        set((s) => ({ profile: { ...s.profile, tavilyEnabled: value } })),
      updateTavilyApiKey: (value) =>
        set((s) => ({
          profile: { ...s.profile, tavilyApiKey: value.trim() || undefined },
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
      updateColorTheme: (theme) => {
        applyColorTheme(theme);
        set((s) => ({ profile: { ...s.profile, colorTheme: theme } }));
      },

      hydrateFromRemote: (remote) =>
        set((s) => {
          const merged: UserProfile = { ...s.profile };
          if (remote.displayName !== undefined) merged.displayName = remote.displayName;
          if (remote.researchTopics !== undefined) merged.researchTopics = remote.researchTopics;
          if (remote.preferredMethods !== undefined) merged.preferredMethods = remote.preferredMethods;
          if (remote.preferredVenues !== undefined) merged.preferredVenues = remote.preferredVenues;
          if (remote.locationPreferences !== undefined) merged.locationPreferences = remote.locationPreferences;
          if (remote.careerStage !== undefined) merged.careerStage = remote.careerStage;
          if (remote.industryVsAcademia !== undefined) merged.industryVsAcademia = remote.industryVsAcademia;
          if (remote.phdYear !== undefined) merged.phdYear = remote.phdYear;
          if (remote.school !== undefined) merged.school = remote.school;
          if (remote.currentProject !== undefined) merged.currentProject = remote.currentProject;
          if (remote.currentChallenges !== undefined) merged.currentChallenges = remote.currentChallenges;
          if (remote.dislikedTopics !== undefined) merged.dislikedTopics = remote.dislikedTopics;
          if (remote.softTopics !== undefined) merged.softTopics = remote.softTopics;
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
          if (remote.lab !== undefined) merged.lab = remote.lab;
          if (remote.digestEnabled !== undefined) merged.digestEnabled = remote.digestEnabled;
          if (remote.digestHourLocal !== undefined) merged.digestHourLocal = remote.digestHourLocal;
          if (remote.digestTimezone !== undefined) merged.digestTimezone = remote.digestTimezone;
          if (remote.digestChannel !== undefined) merged.digestChannel = remote.digestChannel;
          if (remote.digestFrequency !== undefined) merged.digestFrequency = remote.digestFrequency;
          if (remote.tavilyEnabled !== undefined) merged.tavilyEnabled = remote.tavilyEnabled;
          if (remote.tavilyApiKey !== undefined) merged.tavilyApiKey = remote.tavilyApiKey;
          if (remote.feedAiProvider !== undefined) merged.feedAiProvider = remote.feedAiProvider;
          if (remote.feedAiApiKey !== undefined) merged.feedAiApiKey = remote.feedAiApiKey;
          if (remote.colorTheme !== undefined) {
            merged.colorTheme = remote.colorTheme;
            applyColorTheme(remote.colorTheme);
          }
          return { profile: merged };
        }),

      logOut: () => {
        applyColorTheme(defaultProfile.colorTheme);
        set({ profile: defaultProfile });
      },
    }),
    { name: "hermes-profile" }
  )
);
