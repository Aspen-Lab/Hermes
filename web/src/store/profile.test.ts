import { beforeEach, describe, expect, it } from "vitest";
import { defaultProfile, type UserProfile } from "@/types";
import {
  migrateProfileStore,
  promoteSearchInputs,
  useProfileStore,
} from "./profile";

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

describe("promoteSearchInputs", () => {
  it("creates the active snapshot on first run", () => {
    const promoted = promoteSearchInputs(
      profileFixture,
      new Date(2026, 6, 28, 8, 30),
    );

    expect(promoted.activeSearchInputs).toEqual({
      papers: {
        required: ["paper-required"],
        explore: ["paper-explore"],
      },
      events: {
        required: ["event-required"],
        explore: ["event-explore"],
      },
      jobs: {
        required: ["job-required"],
        explore: ["job-explore"],
      },
      careerStage: profileFixture.careerStage,
      locationPreferences: profileFixture.locationPreferences,
      promotedOn: "2026-07-28",
    });
  });

  it("returns the same profile object without refreshing on the same local day", () => {
    const promoted = promoteSearchInputs(
      profileFixture,
      new Date(2026, 6, 28, 0, 1),
    );
    const pendingEdit = {
      ...promoted,
      researchTopics: ["pending-paper-edit"],
      eventRequiredTopics: ["pending-event-edit"],
      jobRequiredTopics: ["pending-job-edit"],
    };

    expect(
      promoteSearchInputs(pendingEdit, new Date(2026, 6, 28, 23, 59)),
    ).toBe(pendingEdit);
  });

  it("promotes the latest pending values on the next local day", () => {
    const firstDay = promoteSearchInputs(
      profileFixture,
      new Date(2026, 6, 28, 23, 59),
    );
    const pendingEdit: UserProfile = {
      ...firstDay,
      researchTopics: ["next-paper"],
      softTopics: ["next-paper-explore"],
      eventRequiredTopics: ["next-event"],
      eventExploreTopics: ["next-event-explore"],
      jobRequiredTopics: ["next-job"],
      jobExploreTopics: ["next-job-explore"],
      careerStage: "Postdoc",
      locationPreferences: ["Chicago"],
    };

    expect(
      promoteSearchInputs(pendingEdit, new Date(2026, 6, 29, 0, 1))
        .activeSearchInputs,
    ).toEqual({
      papers: {
        required: ["next-paper"],
        explore: ["next-paper-explore"],
      },
      events: {
        required: ["next-event"],
        explore: ["next-event-explore"],
      },
      jobs: {
        required: ["next-job"],
        explore: ["next-job-explore"],
      },
      careerStage: "Postdoc",
      locationPreferences: ["Chicago"],
      promotedOn: "2026-07-29",
    });
  });
});

describe("bootstrap promotion — first-time onboarding", () => {
  const NOW = new Date("2026-07-29T12:00:00");
  const TOMORROW = new Date("2026-07-30T12:00:00");

  it("promotes topics entered after the day's promotion already ran on an empty profile", () => {
    // Hydration promotes while the profile is still empty.
    const firstOpen = promoteSearchInputs({ ...defaultProfile }, NOW);
    expect(firstOpen.activeSearchInputs?.papers.required).toEqual([]);

    // The user then completes onboarding the same day.
    const afterOnboarding = promoteSearchInputs(
      {
        ...firstOpen,
        researchTopics: ["battery"],
        eventRequiredTopics: ["battery"],
        jobRequiredTopics: ["battery"],
      },
      NOW,
    );

    expect(afterOnboarding.activeSearchInputs?.papers.required).toEqual(["battery"]);
    expect(afterOnboarding.activeSearchInputs?.events.required).toEqual(["battery"]);
  });

  it("still refuses a same-day promotion once real inputs exist", () => {
    const day1 = promoteSearchInputs(
      { ...defaultProfile, researchTopics: ["battery"] },
      NOW,
    );
    const edited = { ...day1, researchTopics: ["battery", "sodium-ion"] };
    const sameDay = promoteSearchInputs(edited, NOW);
    expect(sameDay.activeSearchInputs?.papers.required).toEqual(["battery"]);

    const nextDay = promoteSearchInputs(edited, TOMORROW);
    expect(nextDay.activeSearchInputs?.papers.required).toEqual([
      "battery",
      "sodium-ion",
    ]);
  });
});
