import { beforeEach, describe, expect, it } from "vitest";
import { defaultProfile, type UserProfile } from "@/types";
import { migrateProfileStore, useProfileStore } from "./profile";

type SurfaceTopicField =
  | "eventRequiredTopics"
  | "eventExploreTopics"
  | "jobRequiredTopics"
  | "jobExploreTopics";

const profileFixture: UserProfile = {
  ...defaultProfile,
  researchTopics: ["paper-required"],
  softTopics: ["paper-explore"],
  eventRequiredTopics: ["event-required"],
  eventExploreTopics: ["event-explore"],
  jobRequiredTopics: ["job-required"],
  jobExploreTopics: ["job-explore"],
};

function expectOnlyTopicFieldChanged(
  field: SurfaceTopicField,
  update: (topics: string[]) => void,
) {
  const before = useProfileStore.getState().profile;
  const next = [`next-${field}`];

  update(next);

  expect(useProfileStore.getState().profile).toEqual({
    ...before,
    [field]: next,
  });
}

describe("profile per-surface topic setters", () => {
  beforeEach(() => {
    useProfileStore.setState({
      profile: {
        ...profileFixture,
        researchTopics: [...profileFixture.researchTopics],
        softTopics: [...(profileFixture.softTopics ?? [])],
        eventRequiredTopics: [...profileFixture.eventRequiredTopics],
        eventExploreTopics: [...profileFixture.eventExploreTopics],
        jobRequiredTopics: [...profileFixture.jobRequiredTopics],
        jobExploreTopics: [...profileFixture.jobExploreTopics],
      },
    });
  });

  it("writes each Events and Jobs topic field without changing another field", () => {
    const store = useProfileStore.getState();

    expectOnlyTopicFieldChanged(
      "eventRequiredTopics",
      store.updateEventTopics,
    );
    expectOnlyTopicFieldChanged(
      "eventExploreTopics",
      store.updateEventSoftTopics,
    );
    expectOnlyTopicFieldChanged("jobRequiredTopics", store.updateJobTopics);
    expectOnlyTopicFieldChanged("jobExploreTopics", store.updateJobSoftTopics);
  });
});

describe("profile persistence migration", () => {
  it("seeds empty per-surface fields from the v2 Papers topics", () => {
    const persistedV2 = {
      profile: {
        displayName: "Migrating member",
        researchTopics: ["solid-state battery"],
        softTopics: ["sodium-ion"],
        eventRequiredTopics: [],
        eventExploreTopics: [],
        jobRequiredTopics: [],
        jobExploreTopics: [],
        colorTheme: "lavender",
      },
    };

    const migrated = migrateProfileStore(persistedV2, 2);

    expect(migrated).toMatchObject({
      profile: {
        researchTopics: ["solid-state battery"],
        softTopics: ["sodium-ion"],
        eventRequiredTopics: ["solid-state battery"],
        eventExploreTopics: ["sodium-ion"],
        jobRequiredTopics: ["solid-state battery"],
        jobExploreTopics: ["sodium-ion"],
        colorTheme: "light:violet",
      },
    });
    expect(migrateProfileStore(migrated, 2)).toEqual(migrated);
  });

  it("does not overwrite user edits after the profile reaches v3", () => {
    const migrated = migrateProfileStore(
      {
        profile: {
          researchTopics: ["solid-state battery"],
          softTopics: ["sodium-ion"],
        },
      },
      2,
    ) as { profile: Record<string, unknown> };
    const editedV3 = {
      ...migrated,
      profile: {
        ...migrated.profile,
        eventRequiredTopics: ["electrochemistry conferences"],
        eventExploreTopics: [],
        jobRequiredTopics: ["battery scientist"],
        jobExploreTopics: ["national laboratory"],
      },
    };

    expect(migrateProfileStore(editedV3, 3)).toEqual(editedV3);
  });
});
