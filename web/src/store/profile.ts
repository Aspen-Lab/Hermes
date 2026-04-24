"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  UserProfile,
  CareerStage,
  IndustryAcademiaPreference,
  DigestChannel,
  DigestFrequency,
} from "@/types";
import { defaultProfile } from "@/types";

interface ProfileState {
  profile: UserProfile;
  updateDisplayName: (name: string) => void;
  updateTopics: (topics: string[]) => void;
  updateVenues: (venues: string[]) => void;
  updateCareerStage: (stage: CareerStage) => void;
  updateIndustryPreference: (pref: IndustryAcademiaPreference) => void;
  updateLocations: (locations: string[]) => void;
  updateMethods: (methods: string[]) => void;
  updateDigestEnabled: (v: boolean) => void;
  updateDigestHourLocal: (h: number) => void;
  updateDigestTimezone: (tz: string) => void;
  updateDigestChannel: (c: DigestChannel) => void;
  updateDigestFrequency: (f: DigestFrequency) => void;
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
          if (remote.digestEnabled !== undefined) merged.digestEnabled = remote.digestEnabled;
          if (remote.digestHourLocal !== undefined) merged.digestHourLocal = remote.digestHourLocal;
          if (remote.digestTimezone !== undefined) merged.digestTimezone = remote.digestTimezone;
          if (remote.digestChannel !== undefined) merged.digestChannel = remote.digestChannel;
          if (remote.digestFrequency !== undefined) merged.digestFrequency = remote.digestFrequency;
          return { profile: merged };
        }),

      logOut: () => set({ profile: defaultProfile }),
    }),
    { name: "hermes-profile" }
  )
);
